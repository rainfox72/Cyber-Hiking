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
import { getExposureTempMultiplier, getExposureEnergyMultiplier } from "./exposureSystem.ts";
import { getEncumbranceEnergyPenalty } from "./encumbrance.ts";

/** Elevation threshold below which O2 saturation is unaffected. */
const O2_ALTITUDE_FLOOR = 2500;

/** Rate at which O2 baseline drops per meter above the floor. */
const O2_DROP_PER_METER = 1 / 40;

/** Terrain energy cost modifiers for push_forward action. */
const TERRAIN_ENERGY_COST: Record<TerrainType, number> = {
  stream_valley: 11,
  forest: 13,
  meadow: 12,
  scree: 16,
  stone_sea: 17,
  ridge: 18,
  summit: 17,
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
 * Above 3500m, the drop steepens to 1 per 25m (altitude sickness zone).
 */
function getO2Baseline(elevation: number): number {
  if (elevation <= O2_ALTITUDE_FLOOR) return 100;
  if (elevation <= 3500) {
    return Math.max(0, 100 - (elevation - O2_ALTITUDE_FLOOR) * O2_DROP_PER_METER);
  }
  // Up to 3500m: standard drop
  const baselineTo3500 = 100 - (3500 - O2_ALTITUDE_FLOOR) * O2_DROP_PER_METER;
  // Above 3500m: steeper drop (1 per 25m)
  const steepDrop = (elevation - 3500) / 25;
  return Math.max(0, baselineTo3500 - steepDrop);
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
  timeCost?: number,
): PlayerState {
  const player = { ...state.player };
  const waypoint = waypoints[player.currentWaypointIndex];
  const o2Baseline = getO2Baseline(waypoint.elevation);
  const bodyTempDelta = computeBodyTempDelta(state, waypoint);

  switch (action) {
    case "push_forward": {
      const terrainCost = TERRAIN_ENERGY_COST[waypoint.terrain];
      const exposureEnergyMult = getExposureEnergyMultiplier(player.exposure);
      const encumbrancePenalty = getEncumbranceEnergyPenalty(player);
      const kneeInjuryPenalty = state.player.statusEffects
        .filter((e) => e.modifiers?.pushForwardEnergyCost)
        .reduce((sum, e) => sum + (e.modifiers!.pushForwardEnergyCost ?? 0), 0);

      player.energy -= (terrainCost + encumbrancePenalty + kneeInjuryPenalty) * exposureEnergyMult;
      player.hydration -= 7;
      player.gear -= 3;

      // Gear degradation cascade
      if (player.gear < 30) player.bodyTemp -= 5;
      if (player.gear < 10) player.hydration -= 5;

      // Body temp with exposure multiplier
      const exposureTempMult = getExposureTempMultiplier(player.exposure);
      player.bodyTemp += bodyTempDelta * 0.4 * exposureTempMult;

      player.o2Saturation += (o2Baseline - player.o2Saturation) * 0.3;
      break;
    }

    case "set_camp": {
      const hoursMult = (timeCost ?? 4) / 4;

      // Camp fatigue: diminishing returns (95%/30%/8%)
      const fatigueMultiplier =
        state.player.campFatigueCount <= 1 ? 0.95 :
        state.player.campFatigueCount === 2 ? 0.30 : 0.08;

      // Morale collapse halves recovery
      const moraleCollapseMult = player.morale < 20 ? 0.5 : 1.0;

      // Resource-dependent recovery
      let resourceMult = 1.0;
      if (player.food <= 0 && player.water <= 0) resourceMult = 0.1;
      else if (player.water <= 0) resourceMult = 0.2;
      else if (player.food <= 0) resourceMult = 0.3;

      const recoveryMult = fatigueMultiplier * moraleCollapseMult * resourceMult;

      player.energy += 20 * hoursMult * recoveryMult;

      // Body temp recovery — camp is the PRIMARY way to recover bodyTemp.
      // Overnight camp with shelter should nearly fully restore bodyTemp.
      // Bad weather significantly reduces recovery.
      const isOvernight = (timeCost ?? 4) >= 6;
      const weatherPenalty =
        state.weather.current === "blizzard" ? 0.3 :
        state.weather.current === "wind" ? 0.5 :
        state.weather.current === "snow" ? 0.7 : 1.0;

      if (waypoint.shelterAvailable) {
        if (isOvernight) {
          // Shelter + overnight: fully recover bodyTemp to 70 in clear weather.
          // Weather reduces the target: blizzard→70*0.3=21, wind→35, snow→49, clear→70.
          const target = 70 * weatherPenalty;
          player.bodyTemp = Math.max(player.bodyTemp, target * recoveryMult + player.bodyTemp * (1 - recoveryMult));
        } else {
          player.bodyTemp += 15 * hoursMult * weatherPenalty * recoveryMult;
        }
      } else {
        if (isOvernight) {
          // No shelter + overnight: converge toward 50 (partial warmth)
          const target = 50 * weatherPenalty;
          player.bodyTemp = Math.max(player.bodyTemp, target * recoveryMult + player.bodyTemp * (1 - recoveryMult));
        } else {
          player.bodyTemp += 8 * hoursMult * weatherPenalty * recoveryMult;
        }
      }

      // Camping hydration drain scales with hours (1/h), capped at 4
      player.hydration -= Math.min(4, 1 * (timeCost ?? 4));

      // Resource drain: camping costs food (cold exposure = double)
      const campFoodCost = player.bodyTemp < 35 ? 2 : 1;
      if (player.food >= campFoodCost) {
        player.food -= campFoodCost;
      } else if (player.food > 0) {
        player.food = 0;
        player.morale -= 10; // partial penalty — had some food but not enough
      } else {
        // No food: massive morale penalty
        player.morale -= 20;
      }
      // Camping boosts morale (shelter from the elements)
      player.morale += 5;
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
      // Rest = catching your breath in the open. Minor recovery only.
      // For serious recovery, use set_camp (shelter, fire, proper sleep).
      const moraleCollapseMult = player.morale < 20 ? 0.5 : 1.0;

      // Rest fatigue: diminishing returns like camp (uses shared campFatigueCount)
      const restFatigueMult =
        state.player.campFatigueCount <= 1 ? 1.0 :
        state.player.campFatigueCount === 2 ? 0.50 : 0.1;

      // Resource-dependent recovery
      let resourceMult = 1.0;
      if (player.food <= 0 && player.water <= 0) resourceMult = 0.1;
      else if (player.water <= 0) resourceMult = 0.3;
      else if (player.food <= 0) resourceMult = 0.5;

      const restRecovery = restFatigueMult * moraleCollapseMult * resourceMult;
      player.energy += 8 * restRecovery;
      // Slight bodyTemp recovery from rest — huddling, rubbing hands, small fire.
      // Much weaker than camp. Bad weather negates it entirely.
      if (state.weather.current !== "blizzard" && state.weather.current !== "wind") {
        player.bodyTemp += 2 * restRecovery;
      }

      // Resource drain: resting costs water (cold exposure = double)
      const restWaterCost = player.bodyTemp < 35 ? 0.6 : 0.3;
      if (player.water >= restWaterCost) {
        player.water -= restWaterCost;
        // Hydration still gets a small boost from drinking during rest
        player.hydration += 3;
      } else if (player.water > 0) {
        player.water = 0;
        player.hydration += 1; // minimal hydration from last drops
      } else {
        // No water: no hydration recovery, energy recovery halved
        player.energy -= 4 * restRecovery; // claw back half the recovery
      }
      break;
    }

    case "eat": {
      if (player.food > 0) {
        // 5% food poisoning chance
        const poisoned = (state.turnNumber * 7 + player.food * 13) % 100 < 5;
        if (poisoned) {
          player.energy -= 10;
        } else {
          player.energy += 50;
        }
        player.morale += 8;
        player.bodyTemp += 3; // hot food warms you up slightly
        player.food -= 1;
      }
      break;
    }

    case "drink": {
      if (player.water > 0) {
        player.hydration += 40;
        player.morale += 3;  // NEW: drinking boosts spirits
        player.water -= 0.5;
      }
      break;
    }

    case "use_medicine": {
      if (player.medicine > 0) {
        // Check for fall injury — medicine prioritizes fall recovery
        const hasFallInjury = player.statusEffects.some(e => e.id === "fall_injury");
        if (hasFallInjury) {
          // Fall recovery: +25% all vitals, clear injury
          player.energy = Math.min(100, player.energy + 25);
          player.hydration = Math.min(100, player.hydration + 25);
          player.bodyTemp = Math.min(100, player.bodyTemp + 25);
          player.o2Saturation = Math.min(100, player.o2Saturation + 25);
          player.morale = Math.min(100, player.morale + 25);
          player.statusEffects = player.statusEffects.filter(e => e.id !== "fall_injury");
        } else {
          // Normal medicine: O2 recovery only (bodyTemp requires camp)
          player.o2Saturation += 20;
        }
        player.medicine -= 1;
      }
      break;
    }

  }

  // Passive hydration drain on remaining actions (-2 per hour)
  if (action === "check_map" || action === "eat" || action === "drink" || action === "use_medicine") {
    player.hydration -= 1;  // 0.5h x 2/h = 1
  }

  // Starvation cascade: when food is depleted
  if (player.food <= 0) {
    player.energy -= 3;
    player.morale -= 2;
  }

  // Dehydration cascade: when water is depleted
  if (player.water <= 0) {
    player.energy -= 5;
    player.bodyTemp -= 2;
    player.o2Saturation -= 2;
  }

  // Night penalties: extra energy drain and morale drain
  const isNight = state.time.timeOfDay === "night" || state.time.timeOfDay === "dusk";
  if (isNight) {
    // Night energy drain: 15% multiplicative increase on energy spent this action
    if (action === "push_forward") {
      const terrainCost = TERRAIN_ENERGY_COST[waypoint.terrain];
      player.energy -= terrainCost * 0.15;
    }
    // Night morale drain: extra -1 per action
    player.morale -= 1;
  }

  // Morale: isolation drain (Death Stranding loneliness)
  player.morale -= 0.5;

  // Morale: low vitals penalty (reduced to slow death spiral)
  const lowVitals = (["energy", "hydration", "bodyTemp", "o2Saturation"] as const)
    .filter((v) => player[v] < 30);
  if (lowVitals.length > 0) {
    player.morale -= 1 * lowVitals.length;
  }

  // Morale: weather effects (includes severity scaling)
  if (state.weather.current === "blizzard") {
    player.morale -= 5;
  } else if (state.weather.current === "wind") {
    player.morale -= 3;
  } else if (state.weather.current === "snow") {
    player.morale -= 1.5;
  } else if (state.weather.current === "rain") {
    player.morale -= 0.5;
  } else if (state.weather.current === "clear") {
    player.morale += 3;
  }

  // Low morale movement penalty: +10% energy cost on push_forward (reduced to break death spiral)
  if (action === "push_forward" && player.morale < 20) {
    const terrainCost = TERRAIN_ENERGY_COST[waypoint.terrain];
    player.energy -= terrainCost * 0.10;
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

export interface DefeatResult {
  dyingCause: string;
  defeatCause: string;
}

/**
 * Checks whether the player has met a defeat condition.
 * Returns a structured result with both short (dying overlay) and long (defeat screen) cause strings.
 */
export function checkDefeatCondition(player: PlayerState): DefeatResult | null {
  if (player.energy <= 0) {
    return {
      dyingCause: "EXHAUSTION \u2014 BODY SHUTDOWN",
      defeatCause: "Total exhaustion \u2014 your body can no longer move.",
    };
  }
  if (player.hydration <= 0) {
    return {
      dyingCause: "DEHYDRATION \u2014 ORGAN FAILURE",
      defeatCause: "Severe dehydration \u2014 your organs begin to shut down.",
    };
  }
  if (player.bodyTemp <= 0) {
    return {
      dyingCause: "HYPOTHERMIA \u2014 FROZEN",
      defeatCause: "Fatal hypothermia \u2014 the cold has claimed you.",
    };
  }
  if (player.o2Saturation <= 0) {
    return {
      dyingCause: "ALTITUDE SICKNESS \u2014 OXYGEN FAILURE",
      defeatCause: "Oxygen deprivation \u2014 the altitude has overwhelmed your body.",
    };
  }
  if (player.morale <= 0) {
    return {
      dyingCause: "DESPAIR \u2014 WILL BROKEN",
      defeatCause: "Complete despair \u2014 you can no longer find the will to continue.",
    };
  }
  return null;
}
