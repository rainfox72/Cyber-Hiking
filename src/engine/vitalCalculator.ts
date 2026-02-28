/**
 * Vital signs calculator for the Ao Tai Cyber-Hike.
 * Handles all player stat changes from actions, environmental factors,
 * and defeat condition checks.
 */

import type {
  GameAction,
  GameState,
  PlayerState,
  TerrainType,
  Waypoint,
} from "./types.ts";
import { getTemperatureModifier } from "./dayNightCycle.ts";

/** Elevation threshold below which O2 saturation is unaffected. */
const O2_ALTITUDE_FLOOR = 2500;

/** Rate at which O2 baseline drops per meter above the floor. */
const O2_DROP_PER_METER = 1 / 40;

/** Terrain energy cost modifiers for push_forward action. */
const TERRAIN_ENERGY_COST: Record<TerrainType, number> = {
  stream_valley: 15,
  forest: 17,
  meadow: 16,
  scree: 22,
  stone_sea: 23,
  ridge: 25,
  summit: 24,
};

/**
 * Clamps a numeric value between min and max (inclusive).
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Computes the baseline O2 saturation for a given elevation.
 * 100% below 2500m, then drops by 1 per 40m of elevation gain.
 */
function getO2Baseline(elevation: number): number {
  if (elevation <= O2_ALTITUDE_FLOOR) return 100;
  return Math.max(0, 100 - (elevation - O2_ALTITUDE_FLOOR) * O2_DROP_PER_METER);
}

/**
 * Computes the body temperature modifier from weather, altitude, and time of day.
 * Returns a signed value: negative = cooling, positive = warming.
 */
function computeBodyTempDelta(state: GameState, waypoint: Waypoint): number {
  // Weather contribution
  const weatherTemp = state.weather.temperatureModifier;

  // Altitude contribution: -1 per 200m above 2500m
  let altitudeTemp = 0;
  if (waypoint.elevation > O2_ALTITUDE_FLOOR) {
    altitudeTemp = -(waypoint.elevation - O2_ALTITUDE_FLOOR) / 200;
  }

  // Time of day contribution
  const timeTemp = getTemperatureModifier(state.time.timeOfDay);

  // Scale combined environmental effect to a body temp impact
  // Environmental temps are in degrees C; body temp is 0-100 scale
  // A combined -30 C modifier should produce roughly -15 body temp units
  const combined = weatherTemp + altitudeTemp + timeTemp;
  return combined * 0.5;
}

/**
 * Applies vital changes from the given action to the player state.
 * Returns a new PlayerState with all values clamped to valid ranges.
 */
export function applyVitalChanges(
  state: GameState,
  action: GameAction,
  waypoints: Waypoint[],
): PlayerState {
  const player = { ...state.player };
  const waypoint = waypoints[player.currentWaypointIndex];
  const o2Baseline = getO2Baseline(waypoint.elevation);
  const bodyTempDelta = computeBodyTempDelta(state, waypoint);

  switch (action) {
    case "push_forward": {
      const terrainCost = TERRAIN_ENERGY_COST[waypoint.terrain];
      player.energy -= terrainCost;
      player.hydration -= 10;
      player.gear -= 3;
      // Body temp shifts toward environmental conditions
      player.bodyTemp += bodyTempDelta * 0.4;
      // O2 drifts toward altitude baseline
      player.o2Saturation += (o2Baseline - player.o2Saturation) * 0.3;
      break;
    }

    case "set_camp": {
      player.energy += 30;
      if (waypoint.shelterAvailable) {
        player.bodyTemp += 15;
      } else {
        player.bodyTemp += 5;
      }
      // Camping normalizes body temp toward 50
      player.bodyTemp += (50 - player.bodyTemp) * 0.1;
      break;
    }

    case "descend": {
      player.energy -= 10;
      player.hydration -= 5;
      player.gear -= 2;
      // Body temp shifts mildly
      player.bodyTemp += bodyTempDelta * 0.2;
      // O2 improves as elevation drops (use previous waypoint's baseline)
      const prevIndex = Math.max(0, player.currentWaypointIndex - 1);
      const prevO2 = getO2Baseline(waypoints[prevIndex].elevation);
      player.o2Saturation += (prevO2 - player.o2Saturation) * 0.3;
      break;
    }

    case "check_map": {
      player.energy -= 3;
      break;
    }

    case "rest": {
      player.energy += 15;
      player.bodyTemp += 5;
      // Rest normalizes body temp slightly
      player.bodyTemp += (50 - player.bodyTemp) * 0.05;
      break;
    }

    case "eat": {
      if (player.food > 0) {
        player.energy += 20;
        player.food -= 1;
      }
      break;
    }

    case "drink": {
      if (player.water > 0) {
        player.hydration += 25;
        player.water -= 0.5;
      }
      break;
    }

    case "use_medicine": {
      if (player.medicine > 0) {
        player.o2Saturation += 15;
        // Body temp normalizes toward 50 by 10 points
        const tempDiff = 50 - player.bodyTemp;
        const shift = Math.sign(tempDiff) * Math.min(Math.abs(tempDiff), 10);
        player.bodyTemp += shift;
        player.medicine -= 1;
      }
      break;
    }
  }

  // Morale adjustments based on conditions
  const lowVitals = (["energy", "hydration", "bodyTemp", "o2Saturation"] as const)
    .filter((v) => player[v] < 30);
  if (lowVitals.length > 0) {
    player.morale -= 2 * lowVitals.length;
  }

  if (state.weather.current === "blizzard") {
    player.morale -= 5;
  } else if (state.weather.current === "clear") {
    player.morale += 3;
  }

  // Clamp all vitals to 0-100
  player.energy = clamp(player.energy, 0, 100);
  player.hydration = clamp(player.hydration, 0, 100);
  player.bodyTemp = clamp(player.bodyTemp, 0, 100);
  player.o2Saturation = clamp(player.o2Saturation, 0, 100);
  player.morale = clamp(player.morale, 0, 100);
  player.gear = clamp(player.gear, 0, 100);

  // Clamp consumables to min 0
  player.food = Math.max(player.food, 0);
  player.water = Math.max(player.water, 0);
  player.medicine = Math.max(player.medicine, 0);

  return player;
}

/**
 * Checks whether the player has met a defeat condition.
 * Returns a descriptive defeat cause string, or null if the player is still alive.
 */
export function checkDefeatCondition(player: PlayerState): string | null {
  if (player.energy <= 0) {
    return "Total exhaustion — your body can no longer move.";
  }
  if (player.hydration <= 0) {
    return "Severe dehydration — your organs begin to shut down.";
  }
  if (player.bodyTemp <= 0) {
    return "Fatal hypothermia — the cold has claimed you.";
  }
  if (player.o2Saturation <= 0) {
    return "Oxygen deprivation — the altitude has overwhelmed your body.";
  }
  if (player.morale <= 0) {
    return "Complete despair — you can no longer find the will to continue.";
  }
  return null;
}
