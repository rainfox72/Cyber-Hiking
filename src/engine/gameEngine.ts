/**
 * Core game engine for the Ao Tai Cyber-Hike.
 * Orchestrates the turn-based pipeline: validation, clock, weather,
 * movement, vitals, risk, events, and win/defeat conditions.
 */

import type {
  CriticalEvent,
  GameAction,
  GameState,
  LogEntry,
  PlayerState,
  TerrainType,
  TurnResult,
  Waypoint,
} from "./types.ts";
import { advanceClock, getTimeOfDay } from "./dayNightCycle.ts";
import { calculateRisk } from "./riskCalculator.ts";
import { applyVitalChanges, checkDefeatCondition } from "./vitalCalculator.ts";
import { rollWeather } from "./weatherSystem.ts";
import { selectEvent } from "../data/events.ts";
import type { RNG } from "../utils/random.ts";
import { updateExposure, getExposureTempMultiplier, getExposureEnergyMultiplier } from "./exposureSystem.ts";
import { getEncumbranceTimePenalty, getEncumbranceEnergyPenalty } from "./encumbrance.ts";

/** Summit waypoint index (Baxian Platform). */
const SUMMIT_INDEX = 12;

/** Time cost in hours for each action, by terrain where applicable. */
const BASE_TIME_COSTS: Record<GameAction, number> = {
  push_forward: 4, // overridden by terrain
  set_camp: 4,
  descend: 2,
  check_map: 1,
  rest: 2,
  eat: 0.5,
  drink: 0.5,
  use_medicine: 0.5,
  wait: 1,
};

/** Terrain-specific time cost for push_forward. */
const PUSH_FORWARD_TIME: Record<TerrainType, number> = {
  stream_valley: 3,
  forest: 4,
  meadow: 3,
  scree: 5,
  stone_sea: 5,
  ridge: 5,
  summit: 4,
};

/**
 * Creates the initial game state at the Tangkou trailhead.
 */
export function createInitialState(): GameState {
  return {
    player: {
      energy: 100,
      hydration: 100,
      bodyTemp: 50,
      o2Saturation: 100,
      morale: 100,
      food: 8,
      water: 6,
      gear: 100,
      medicine: 3,
      exposure: 0,
      statusEffects: [],
      campFatigueCount: 0,
      lastCampWaypoint: -1,
      currentWaypointIndex: 0,
      distanceTraveled: 0,
      isAlive: true,
      hasReachedSummit: false,
    },
    weather: {
      current: "clear",
      intensity: 0.3,
      temperatureModifier: 0,
      visibilityModifier: 1.0,
      windSpeed: 5,
    },
    time: {
      day: 1,
      hour: 8,
      timeOfDay: getTimeOfDay(8),
    },
    turnNumber: 0,
    log: [],
    gamePhase: "playing",
    defeatCause: null,
    mapRevealed: false,
  };
}

/**
 * Validates whether an action can be performed in the current state.
 */
export function validateAction(
  state: GameState,
  action: GameAction,
  waypoints: Waypoint[],
): boolean {
  if (state.gamePhase !== "playing") return false;
  if (!state.player.isAlive) return false;

  // Whiteout: only wait is allowed
  const hasWhiteout = state.player.statusEffects.some(
    (e) => e.modifiers?.disableActions,
  );
  if (hasWhiteout && action !== "wait") return false;

  switch (action) {
    case "push_forward":
      // Cannot push beyond the last waypoint
      return state.player.currentWaypointIndex < waypoints.length - 1;

    case "descend":
      // Cannot descend below first waypoint or past point-of-no-return (waypoint 10+)
      return state.player.currentWaypointIndex > 0 &&
        state.player.currentWaypointIndex <= 10;

    case "set_camp": {
      // Must be at a campable waypoint
      const wp = waypoints[state.player.currentWaypointIndex];
      return wp.canCamp;
    }

    case "eat":
      return state.player.food > 0;

    case "drink":
      return state.player.water > 0;

    case "use_medicine":
      return state.player.medicine > 0;

    case "check_map":
    case "rest":
      return true;

    case "wait":
      return state.player.statusEffects.some(
        (e) => e.modifiers?.disableActions,
      );

    default:
      return false;
  }
}

/**
 * Formats an in-game timestamp string from GameTime.
 */
function formatTimestamp(day: number, hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `Day ${day}, ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Creates a log entry for the current action.
 */
function createLogEntry(
  turnNumber: number,
  action: GameAction,
  waypoint: Waypoint,
  state: GameState,
  narrative: string,
): LogEntry {
  const actionLabels: Record<GameAction, string> = {
    push_forward: "Push Forward",
    set_camp: "Set Camp",
    descend: "Descend",
    check_map: "Check Map",
    rest: "Rest",
    eat: "Eat",
    drink: "Drink",
    use_medicine: "Use Medicine",
    wait: "Wait",
  };

  return {
    turnNumber,
    text: `[${actionLabels[action]}] at ${waypoint.name} (${waypoint.nameCN}) — ${narrative}`,
    type: "action",
    timestamp: formatTimestamp(state.time.day, state.time.hour),
  };
}

/**
 * Generates a brief narrative summary for the action taken.
 */
function generateNarrative(
  action: GameAction,
  waypoint: Waypoint,
  nextWaypoint: Waypoint | null,
  state: GameState,
): string {
  switch (action) {
    case "push_forward":
      if (nextWaypoint) {
        return `Pressed onward through ${waypoint.terrain.replace("_", " ")} toward ${nextWaypoint.name}.`;
      }
      return `Pressed onward through ${waypoint.terrain.replace("_", " ")}.`;

    case "set_camp":
      return waypoint.shelterAvailable
        ? `Made camp in the shelter at ${waypoint.name}. A chance to recover.`
        : `Set up camp in the open at ${waypoint.name}. The wind never stops.`;

    case "descend":
      return `Retreated downhill, losing hard-won elevation.`;

    case "check_map":
      return `Studied the map and assessed the route ahead. The terrain is now revealed.`;

    case "rest":
      return `Stopped to rest and catch your breath. The mountains wait.`;

    case "eat":
      return state.player.food <= 1
        ? `Ate the last meal. The pack feels lighter — and emptier.`
        : `Had a meal. ${state.player.food - 1} remaining.`;

    case "drink":
      return state.player.water <= 0.5
        ? `Drained the last of the water. Finding more is now critical.`
        : `Drank deeply. ${(state.player.water - 0.5).toFixed(1)}L remaining.`;

    case "use_medicine":
      return `Took medicine to ease the altitude sickness. ${state.player.medicine - 1} doses left.`;

    case "wait":
      return "You hunker down and wait for the whiteout to pass. Visibility: zero.";

    default:
      return `Took action.`;
  }
}

/**
 * Applies a critical event's effects to a player state, returning a new state.
 * Effects are additive for numeric values and clamped to valid ranges.
 */
function applyEventEffects(
  player: PlayerState,
  event: CriticalEvent,
): PlayerState {
  const updated = { ...player };

  for (const [key, value] of Object.entries(event.effects)) {
    const k = key as keyof PlayerState;
    if (typeof updated[k] === "number" && typeof value === "number") {
      (updated[k] as number) += value;
    }
  }

  // Clamp all vitals
  updated.energy = Math.min(Math.max(updated.energy, 0), 100);
  updated.hydration = Math.min(Math.max(updated.hydration, 0), 100);
  updated.bodyTemp = Math.min(Math.max(updated.bodyTemp, 0), 100);
  updated.o2Saturation = Math.min(Math.max(updated.o2Saturation, 0), 100);
  updated.morale = Math.min(Math.max(updated.morale, 0), 100);
  updated.gear = Math.min(Math.max(updated.gear, 0), 100);
  updated.food = Math.max(updated.food, 0);
  updated.water = Math.max(updated.water, 0);
  updated.medicine = Math.max(updated.medicine, 0);

  return updated;
}

/**
 * Deep clones a GameState for immutable state management.
 */
function cloneState(state: GameState): GameState {
  return {
    player: {
      ...state.player,
      statusEffects: state.player.statusEffects.map((e) => ({ ...e })),
    },
    weather: { ...state.weather },
    time: { ...state.time },
    turnNumber: state.turnNumber,
    log: [...state.log],
    gamePhase: state.gamePhase,
    defeatCause: state.defeatCause,
    mapRevealed: state.mapRevealed,
  };
}

/**
 * The core turn pipeline. Processes a single player action and returns
 * the complete TurnResult with all state changes.
 *
 * Pipeline:
 * 1. Validate action
 * 2. Calculate time cost
 * 3. Advance clock
 * 4. Roll weather transition
 * 5. Calculate movement
 * 6. Apply vital changes
 * 7. Calculate risk %
 * 8. Roll for critical events
 * 9. Check win condition
 * 10. Check defeat condition
 * 11. Add action log entry
 * 12. Return TurnResult
 */
export function processAction(
  state: GameState,
  action: GameAction,
  waypoints: Waypoint[],
  rng: RNG,
): TurnResult {
  // 1. Validate action
  if (!validateAction(state, action, waypoints)) {
    throw new Error(
      `Invalid action "${action}" in current state (waypoint: ${state.player.currentWaypointIndex}, phase: ${state.gamePhase})`,
    );
  }

  // Snapshot previous state
  const previousState = cloneState(state);

  // Build new state (mutable working copy)
  const newState = cloneState(state);
  newState.turnNumber += 1;

  // 2. Calculate time cost
  const currentWaypoint = waypoints[newState.player.currentWaypointIndex];
  let timeCost: number;
  if (action === "push_forward") {
    timeCost = PUSH_FORWARD_TIME[currentWaypoint.terrain];
    timeCost += getEncumbranceTimePenalty(newState.player);
  } else {
    timeCost = BASE_TIME_COSTS[action];
  }

  // 3. Advance clock
  newState.time = advanceClock(newState.time, timeCost);

  // 3b. Nightfall trap — if push_forward crosses into night (19:00)
  const crossedIntoNight =
    action === "push_forward" &&
    previousState.time.hour < 19 &&
    newState.time.hour >= 19;
  if (crossedIntoNight) {
    newState.player.bodyTemp -= 20;
    newState.player.morale -= 15;
    newState.player.energy -= 10;
    const bivouacEntry: LogEntry = {
      turnNumber: newState.turnNumber,
      text: "[FORCED BIVOUAC] Nightfall caught you between waypoints. You spend a miserable night exposed on the mountain.",
      type: "event",
      timestamp: formatTimestamp(newState.time.day, newState.time.hour),
    };
    newState.log.push(bivouacEntry);
  }

  // 4. Roll weather transition
  newState.weather = rollWeather(
    newState.weather,
    currentWaypoint.elevation,
    rng,
  );

  // 5. Calculate movement
  let distanceCovered = 0;

  if (action === "push_forward") {
    const nextIndex = newState.player.currentWaypointIndex + 1;
    if (nextIndex < waypoints.length) {
      const nextWaypoint = waypoints[nextIndex];
      distanceCovered =
        nextWaypoint.distanceFromStart -
        waypoints[newState.player.currentWaypointIndex].distanceFromStart;
      newState.player.currentWaypointIndex = nextIndex;
      newState.player.distanceTraveled += distanceCovered;
    }
  } else if (action === "descend") {
    const prevIndex = newState.player.currentWaypointIndex - 1;
    if (prevIndex >= 0) {
      distanceCovered =
        waypoints[newState.player.currentWaypointIndex].distanceFromStart -
        waypoints[prevIndex].distanceFromStart;
      newState.player.currentWaypointIndex = prevIndex;
      // Distance traveled still increases (you're still walking)
      newState.player.distanceTraveled += distanceCovered;
    }
  } else if (action === "check_map") {
    newState.mapRevealed = true;
  }

  // 5b. Camp fatigue tracking
  if (action === "set_camp" || action === "rest") {
    if (newState.player.lastCampWaypoint === newState.player.currentWaypointIndex) {
      newState.player.campFatigueCount += 1;
    } else {
      newState.player.campFatigueCount = 1;
      newState.player.lastCampWaypoint = newState.player.currentWaypointIndex;
    }
  } else if (action === "push_forward" || action === "descend") {
    newState.player.campFatigueCount = 0;
  }

  // 6. Apply vital changes
  newState.player = applyVitalChanges(newState, action, waypoints);

  // 6b. Update exposure
  const wpForExposure = waypoints[newState.player.currentWaypointIndex];
  newState.player.exposure = updateExposure(
    newState, action, wpForExposure.terrain, wpForExposure.shelterAvailable,
  );

  // 6c. Apply persistent status effects
  newState.player.statusEffects = newState.player.statusEffects
    .map((effect) => {
      // Apply per-turn effects
      if (effect.onTurnStart) {
        for (const [key, value] of Object.entries(effect.onTurnStart)) {
          const k = key as keyof typeof newState.player;
          if (typeof newState.player[k] === "number" && typeof value === "number") {
            (newState.player[k] as number) += value;
          }
        }
      }
      return { ...effect, turnsRemaining: effect.turnsRemaining - 1 };
    })
    .filter((effect) => effect.turnsRemaining > 0);

  // 6d. Resource decay at midnight
  const crossedMidnight = previousState.time.day < newState.time.day;
  if (crossedMidnight) {
    newState.player.water = Math.max(0, newState.player.water - 0.2);
    if (rng.chance(0.3)) {
      newState.player.food = Math.max(0, newState.player.food - 1);
    }
  }

  // 7. Calculate risk %
  const riskPercent = calculateRisk(newState, waypoints);

  // 8. Roll for critical events
  const events: CriticalEvent[] = [];
  if (
    (action === "push_forward" || action === "descend") &&
    rng.chance(riskPercent)
  ) {
    const updatedWaypoint = waypoints[newState.player.currentWaypointIndex];
    const event = selectEvent(
      newState.weather.current,
      updatedWaypoint.terrain,
      rng,
    );
    events.push(event);
    newState.player = applyEventEffects(newState.player, event);

    // Apply status effects from special events
    if (event.id === "whiteout_event") {
      newState.player.statusEffects.push({
        id: "whiteout",
        turnsRemaining: 1,
        modifiers: { disableActions: true },
      });
    } else if (event.id === "pulmonary_edema") {
      newState.player.statusEffects.push({
        id: "pulmonary_edema",
        turnsRemaining: 3,
        onTurnStart: { energy: -10 },
      });
    } else if (event.id === "knee_injury") {
      newState.player.statusEffects.push({
        id: "knee_injury",
        turnsRemaining: 3,
        modifiers: { pushForwardEnergyCost: 15 },
      });
    } else if (event.id === "trail_collapse") {
      // Forced descend
      if (newState.player.currentWaypointIndex > 0) {
        newState.player.currentWaypointIndex -= 1;
      }
    } else if (event.id === "gear_tumble") {
      // Randomly lose food or water
      if (rng.chance(0.5)) {
        newState.player.water = Math.max(0, newState.player.water - 1);
      }
    }

    // Add event to log
    const eventEntry: LogEntry = {
      turnNumber: newState.turnNumber,
      text: `[Event: ${event.name}] ${event.description}`,
      type: "event",
      timestamp: formatTimestamp(newState.time.day, newState.time.hour),
    };
    newState.log.push(eventEntry);
  }

  // 9. Check win condition
  if (newState.player.currentWaypointIndex === SUMMIT_INDEX) {
    newState.player.hasReachedSummit = true;
    newState.gamePhase = "victory";

    const victoryEntry: LogEntry = {
      turnNumber: newState.turnNumber,
      text: `[VICTORY] You have reached Baxian Platform (拔仙台) at 3767m — the roof of the Qinling Mountains!`,
      type: "system",
      timestamp: formatTimestamp(newState.time.day, newState.time.hour),
    };
    newState.log.push(victoryEntry);
  }

  // 10. Check defeat condition
  if (newState.gamePhase !== "victory") {
    const defeatCause = checkDefeatCondition(newState.player);
    if (defeatCause) {
      newState.player.isAlive = false;
      newState.gamePhase = "defeat";
      newState.defeatCause = defeatCause;

      const defeatEntry: LogEntry = {
        turnNumber: newState.turnNumber,
        text: `[DEFEAT] ${defeatCause}`,
        type: "system",
        timestamp: formatTimestamp(newState.time.day, newState.time.hour),
      };
      newState.log.push(defeatEntry);
    }
  }

  // 11. Generate narrative and add action log entry
  const nextWP =
    action === "push_forward" &&
    previousState.player.currentWaypointIndex + 1 < waypoints.length
      ? waypoints[previousState.player.currentWaypointIndex + 1]
      : null;
  const narrative = generateNarrative(
    action,
    currentWaypoint,
    nextWP,
    previousState,
  );

  const actionEntry = createLogEntry(
    newState.turnNumber,
    action,
    action === "push_forward" || action === "descend"
      ? waypoints[newState.player.currentWaypointIndex]
      : currentWaypoint,
    newState,
    narrative,
  );
  newState.log.push(actionEntry);

  // 12. Return TurnResult
  return {
    action,
    previousState,
    newState,
    narrative,
    events,
    riskPercent,
    distanceCovered,
    timeElapsed: timeCost,
  };
}
