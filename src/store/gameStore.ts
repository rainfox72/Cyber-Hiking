/**
 * Zustand store bridging the pure game engine to React components.
 * Game state updates synchronously via the engine; Ollama narration is async.
 */

import { create } from "zustand";
import type {
  GameAction,
  GamePhase,
  GameState,
  LogEntry,
  PlayerState,
  WeatherState,
  GameTime,
  CriticalEvent,
} from "../engine/types.ts";
import {
  createInitialState,
  processAction,
  validateAction,
} from "../engine/gameEngine.ts";
import { WAYPOINTS } from "../data/waypoints.ts";
import { createRNG, type RNG } from "../utils/random.ts";
import { generateNarrative } from "../services/ollamaService.ts";
import { generateFallbackNarrative } from "../services/fallbackNarrator.ts";

interface GameStore {
  // Game state
  player: PlayerState;
  weather: WeatherState;
  time: GameTime;
  turnNumber: number;
  log: LogEntry[];
  gamePhase: GamePhase;
  defeatCause: string | null;
  mapRevealed: boolean;

  // UI state
  isProcessing: boolean;
  ollamaConnected: boolean;
  lastRiskPercent: number;
  lastEvents: CriticalEvent[];
  isShaking: boolean;

  // RNG
  rng: RNG;

  // Actions
  startGame: () => void;
  initGame: () => void;
  performAction: (action: GameAction) => void;
  isActionValid: (action: GameAction) => boolean;
  setOllamaConnected: (connected: boolean) => void;
}

function stateFromGameState(gs: GameState): Partial<GameStore> {
  return {
    player: gs.player,
    weather: gs.weather,
    time: gs.time,
    turnNumber: gs.turnNumber,
    log: gs.log,
    gamePhase: gs.gamePhase,
    defeatCause: gs.defeatCause,
    mapRevealed: gs.mapRevealed,
  };
}

function gameStateFromStore(store: GameStore): GameState {
  return {
    player: store.player,
    weather: store.weather,
    time: store.time,
    turnNumber: store.turnNumber,
    log: store.log,
    gamePhase: store.gamePhase,
    defeatCause: store.defeatCause,
    mapRevealed: store.mapRevealed,
  };
}

const initialGameState = createInitialState();

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial game state — override to "title" so the title screen shows first
  ...stateFromGameState(initialGameState),
  gamePhase: "title" as GamePhase,

  // UI state
  isProcessing: false,
  ollamaConnected: false,
  lastRiskPercent: 0,
  lastEvents: [],
  isShaking: false,

  // RNG with random seed
  rng: createRNG(Date.now()),

  startGame: () => {
    const fresh = createInitialState();
    set({
      ...stateFromGameState(fresh),
      isProcessing: false,
      lastRiskPercent: 0,
      lastEvents: [],
      isShaking: false,
      rng: createRNG(Date.now()),
    });
  },

  initGame: () => {
    const fresh = createInitialState();
    set({
      ...stateFromGameState(fresh),
      isProcessing: false,
      lastRiskPercent: 0,
      lastEvents: [],
      isShaking: false,
      rng: createRNG(Date.now()),
    });
  },

  performAction: (action: GameAction) => {
    const store = get();
    if (store.isProcessing) return;
    if (store.gamePhase !== "playing") return;

    const currentState = gameStateFromStore(store);

    if (!validateAction(currentState, action, WAYPOINTS)) return;

    set({ isProcessing: true });

    try {
      const result = processAction(currentState, action, WAYPOINTS, store.rng);

      // Screen shake on critical events
      const hasEvents = result.events.length > 0;

      set({
        ...stateFromGameState(result.newState),
        isProcessing: false,
        lastRiskPercent: result.riskPercent,
        lastEvents: result.events,
        isShaking: hasEvents,
      });

      // Clear shake after animation
      if (hasEvents) {
        setTimeout(() => set({ isShaking: false }), 600);
      }

      // Async: request Ollama narration (non-blocking)
      generateNarrative(result).then((aiText) => {
        const narrativeText = aiText ?? generateFallbackNarrative(result, store.rng);
        const narrativeEntry: LogEntry = {
          turnNumber: result.newState.turnNumber,
          text: narrativeText,
          type: "narrative",
          timestamp: `Day ${result.newState.time.day}, ${String(Math.floor(result.newState.time.hour)).padStart(2, "0")}:00`,
        };
        set((s) => ({
          log: [...s.log, narrativeEntry],
        }));
      });
    } catch {
      set({ isProcessing: false });
    }
  },

  isActionValid: (action: GameAction) => {
    const store = get();
    const currentState = gameStateFromStore(store);
    return validateAction(currentState, action, WAYPOINTS);
  },

  setOllamaConnected: (connected: boolean) => {
    set({ ollamaConnected: connected });
  },
}));
