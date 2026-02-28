/**
 * Risk calculation engine for the Ao Tai Cyber-Hike.
 * Computes a composite risk percentage (0-0.95) based on altitude, weather,
 * vital signs, time of day, terrain, and gear condition.
 */

import type {
  GameState,
  TerrainType,
  TimeOfDay,
  Waypoint,
  WeatherCondition,
} from "./types.ts";

/** Maximum elevation on the Ao Tai route (Baxian Platform). */
const MAX_ELEVATION = 3767;

/** Elevation threshold below which altitude risk is zero. */
const ALTITUDE_RISK_FLOOR = 2500;

/** Maximum contribution of altitude to total risk. */
const ALTITUDE_RISK_CAP = 0.30;

/** Weather condition risk lookup. */
const WEATHER_RISK: Record<WeatherCondition, number> = {
  clear: 0.00,
  cloudy: 0.02,
  fog: 0.08,
  rain: 0.12,
  snow: 0.20,
  wind: 0.15,
  blizzard: 0.40,
};

/** Terrain type risk lookup. */
const TERRAIN_RISK: Record<TerrainType, number> = {
  stream_valley: 0.00,
  forest: 0.00,
  meadow: 0.03,
  scree: 0.08,
  stone_sea: 0.12,
  ridge: 0.15,
  summit: 0.10,
};

/** Vital stat threshold below which penalties apply. */
const VITAL_PENALTY_THRESHOLD = 30;

/** Per-point penalty for each vital below the threshold. */
const VITAL_PENALTY_RATE = 0.005;

/** Vital stats that contribute to risk when low. */
const RISK_VITALS: readonly (keyof GameState["player"])[] = [
  "energy",
  "hydration",
  "bodyTemp",
  "o2Saturation",
  "morale",
] as const;

/** Night and dusk time penalties. */
const TIME_PENALTIES: Partial<Record<TimeOfDay, number>> = {
  night: 0.10,
  dusk: 0.05,
};

/** Gear condition threshold below which penalties apply. */
const GEAR_PENALTY_THRESHOLD = 50;

/** Per-point penalty for gear below threshold. */
const GEAR_PENALTY_RATE = 0.003;

/** Absolute maximum risk (prevents guaranteed death). */
const MAX_RISK = 0.95;

/**
 * Calculates the composite risk percentage for the current game state.
 * Higher values mean greater chance of triggering a critical event.
 *
 * @returns Risk as a float between 0.0 and 0.95.
 */
export function calculateRisk(
  state: GameState,
  waypoints: Waypoint[],
): number {
  const waypoint = waypoints[state.player.currentWaypointIndex];
  const elevation = waypoint.elevation;

  // Altitude risk: 0 below 2500m, scales linearly above
  let altitudeRisk = 0;
  if (elevation > ALTITUDE_RISK_FLOOR) {
    altitudeRisk =
      ((elevation - ALTITUDE_RISK_FLOOR) / (MAX_ELEVATION - ALTITUDE_RISK_FLOOR)) *
      ALTITUDE_RISK_CAP;
  }

  // Weather risk: base value scaled by intensity
  const weatherRisk =
    WEATHER_RISK[state.weather.current] * state.weather.intensity;

  // Vital penalties: each low vital adds risk
  let vitalPenalty = 0;
  for (const vital of RISK_VITALS) {
    const value = state.player[vital] as number;
    if (value < VITAL_PENALTY_THRESHOLD) {
      vitalPenalty += (VITAL_PENALTY_THRESHOLD - value) * VITAL_PENALTY_RATE;
    }
  }

  // Night/dusk penalty
  const nightPenalty = TIME_PENALTIES[state.time.timeOfDay] ?? 0;

  // Terrain risk
  const terrainRisk = TERRAIN_RISK[waypoint.terrain];

  // Gear penalty
  let gearPenalty = 0;
  if (state.player.gear < GEAR_PENALTY_THRESHOLD) {
    gearPenalty =
      (GEAR_PENALTY_THRESHOLD - state.player.gear) * GEAR_PENALTY_RATE;
  }

  // Total risk, clamped
  const totalRisk =
    altitudeRisk +
    weatherRisk +
    vitalPenalty +
    nightPenalty +
    terrainRisk +
    gearPenalty;

  return Math.min(Math.max(totalRisk, 0), MAX_RISK);
}
