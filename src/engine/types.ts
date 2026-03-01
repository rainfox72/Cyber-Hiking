/**
 * Core type definitions for the Ao Tai Cyber-Hike game engine.
 * All interfaces and type aliases used across the engine, data, and utility modules.
 */

export type TerrainType =
  | "forest"
  | "meadow"
  | "stone_sea"
  | "ridge"
  | "summit"
  | "scree"
  | "stream_valley";

export type WeatherCondition =
  | "clear"
  | "cloudy"
  | "fog"
  | "rain"
  | "snow"
  | "blizzard"
  | "wind";

export type TimeOfDay =
  | "dawn"
  | "morning"
  | "midday"
  | "afternoon"
  | "dusk"
  | "night";

export type GameAction =
  | "push_forward"
  | "set_camp"
  | "descend"
  | "check_map"
  | "rest"
  | "eat"
  | "drink"
  | "use_medicine";

export type GamePhase = "title" | "playing" | "victory" | "defeat";

export type LogEntryType = "narrative" | "event" | "system" | "action";

export interface Waypoint {
  id: string;
  name: string;
  nameCN: string;
  elevation: number;
  distanceFromStart: number;
  terrain: TerrainType;
  canCamp: boolean;
  shelterAvailable: boolean;
  description: string;
}

export interface PlayerState {
  energy: number;
  hydration: number;
  bodyTemp: number;
  o2Saturation: number;
  morale: number;
  food: number;
  water: number;
  gear: number;
  medicine: number;
  currentWaypointIndex: number;
  distanceTraveled: number;
  exposure: number;
  statusEffects: StatusEffect[];
  campFatigueCount: number;
  lastCampWaypoint: number;
  isAlive: boolean;
  hasReachedSummit: boolean;
  isLost: boolean;
  lostTurns: number;
  lostFromWaypointIndex: number;
  checkedMapThisSegment: boolean;
  findWayBackChance: number;
}

export interface WeatherState {
  current: WeatherCondition;
  intensity: number;
  temperatureModifier: number;
  visibilityModifier: number;
  windSpeed: number;
}

export interface GameTime {
  day: number;
  hour: number;
  timeOfDay: TimeOfDay;
}

export interface CriticalEvent {
  id: string;
  name: string;
  description: string;
  effects: Partial<PlayerState>;
  severity: "minor" | "major" | "critical";
}

export interface StatusEffect {
  id: string;
  turnsRemaining: number;
  onTurnStart?: Partial<PlayerState>;
  modifiers?: {
    pushForwardEnergyCost?: number;
    disableActions?: boolean;
  };
}

export interface LogEntry {
  turnNumber: number;
  text: string;
  type: LogEntryType;
  timestamp: string;
}

export interface TurnResult {
  action: GameAction;
  previousState: GameState;
  newState: GameState;
  narrative: string;
  events: CriticalEvent[];
  riskPercent: number;
  distanceCovered: number;
  timeElapsed: number;
}

export interface GameState {
  player: PlayerState;
  weather: WeatherState;
  time: GameTime;
  turnNumber: number;
  log: LogEntry[];
  gamePhase: GamePhase;
  defeatCause: string | null;
  mapRevealed: boolean;
}
