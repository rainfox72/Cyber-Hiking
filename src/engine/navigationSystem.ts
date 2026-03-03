/**
 * Navigation accuracy system — calculates getting-lost probability
 * and find-way-back mechanics for the Ao Tai Cyber-Hike.
 */
import type { GameState, PlayerState, TerrainType, WeatherCondition, Waypoint } from "./types.ts";
import type { RNG } from "../utils/random.ts";

/** Terrain modifiers for getting lost (additive to base chance) */
const TERRAIN_LOST_MODIFIER: Record<TerrainType, number> = {
  stream_valley: -0.15,
  forest: -0.10,
  meadow: 0,
  ridge: 0.05,
  scree: 0.05,
  stone_sea: 0.10,
  summit: 0.05,
};

/** Weather modifiers for getting lost (additive) */
const WEATHER_LOST_MODIFIER: Record<WeatherCondition, number> = {
  clear: 0,
  cloudy: 0,
  fog: 0.20,
  rain: 0.05,
  snow: 0.10,
  wind: 0.05,
  blizzard: 0.15,
};

/** Weather modifiers for find-way-back (multiplicative) */
const WEATHER_FINDBACK_MULT: Record<WeatherCondition, number> = {
  clear: 1.0,
  cloudy: 1.0,
  fog: 0.7,
  rain: 0.9,
  snow: 0.8,
  wind: 1.0,
  blizzard: 0.7,
};

const BASE_LOST_CHANCE = 0.04;
const NO_MAP_CHECK_PENALTY = 0.06;
const MAP_CHECK_BONUS = -0.04;
const NIGHT_LOST_MULTIPLIER = 1.5;
const BASE_FIND_WAY_BACK = 0.15;
const NIGHT_FINDBACK_MULTIPLIER = 0.5;

/**
 * Rolls whether the hiker gets lost on this push_forward.
 * Returns true if lost.
 */
export function rollGettingLost(
  state: GameState,
  waypoint: Waypoint,
  rng: RNG,
): boolean {
  if (state.player.isLost) return false; // already lost

  let chance = BASE_LOST_CHANCE;

  // Map check bonus/penalty
  if (state.player.checkedMapThisSegment) {
    chance += MAP_CHECK_BONUS;
  } else {
    chance += NO_MAP_CHECK_PENALTY;
  }

  // Terrain modifier
  chance += TERRAIN_LOST_MODIFIER[waypoint.terrain];

  // Weather modifier
  chance += WEATHER_LOST_MODIFIER[state.weather.current];

  // Night multiplier
  const isNight = state.time.timeOfDay === "night" || state.time.timeOfDay === "dusk";
  if (isNight) {
    chance *= NIGHT_LOST_MULTIPLIER;
  }

  // Clamp to 0-0.95
  chance = Math.max(0, Math.min(0.95, chance));

  return rng.chance(chance);
}

/**
 * Rolls whether the lost hiker finds their way back.
 * Called on push_forward when isLost = true.
 * Returns the waypoint index to return to, or -1 if still lost.
 */
export function rollFindWayBack(
  state: GameState,
  rng: RNG,
  totalWaypoints: number,
): number {
  let chance = state.player.findWayBackChance / 100;

  // Night penalty
  const isNight = state.time.timeOfDay === "night" || state.time.timeOfDay === "dusk";
  if (isNight) {
    chance *= NIGHT_FINDBACK_MULTIPLIER;
  }

  // Weather penalty
  chance *= WEATHER_FINDBACK_MULT[state.weather.current];

  chance = Math.max(0, Math.min(0.95, chance));

  if (!rng.chance(chance)) return -1; // still lost

  // Found way back: random waypoint within ±2 of where they got lost
  const lostFrom = state.player.lostFromWaypointIndex;
  const minWP = Math.max(0, lostFrom - 2);
  const maxWP = Math.min(totalWaypoints - 1, lostFrom + 2);
  return rng.nextInt(minWP, maxWP);
}

/**
 * Applies the "getting lost" state to the player.
 */
export function applyGettingLost(player: PlayerState): PlayerState {
  return {
    ...player,
    isLost: true,
    lostTurns: 0,
    lostFromWaypointIndex: player.currentWaypointIndex,
    findWayBackChance: BASE_FIND_WAY_BACK * 100, // 15%
  };
}

/**
 * Applies "found way back" — places hiker at the given waypoint.
 */
export function applyFoundWayBack(player: PlayerState, waypointIndex: number): PlayerState {
  return {
    ...player,
    isLost: false,
    lostTurns: 0,
    findWayBackChance: BASE_FIND_WAY_BACK * 100,
    currentWaypointIndex: waypointIndex,
  };
}
