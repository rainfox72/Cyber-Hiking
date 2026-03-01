/**
 * Fall/drop system — calculates terrain fall probability
 * and applies devastating damage.
 */
import type { GameState, PlayerState, TerrainType, WeatherCondition, Waypoint } from "./types.ts";
import type { RNG } from "../utils/random.ts";

/** Base fall chance by terrain */
const TERRAIN_FALL_BASE: Record<TerrainType, number> = {
  stream_valley: 0.02,
  forest: 0.02,
  meadow: 0.02,
  ridge: 0.05,
  scree: 0.06,
  stone_sea: 0.08,
  summit: 0.04,
};

/** Weather multiplier for fall chance */
const WEATHER_FALL_MULT: Record<WeatherCondition, number> = {
  clear: 1.0,
  cloudy: 1.0,
  fog: 1.2,
  rain: 1.2,
  snow: 1.2,
  wind: 1.3,
  blizzard: 1.5,
};

const NIGHT_FALL_MULTIPLIER = 1.5;
const LOST_FALL_MULTIPLIER = 1.3;
const LOW_ENERGY_FALL_MULTIPLIER = 1.3;
const LOW_ENERGY_THRESHOLD = 30;

const FALL_VITAL_REDUCTION = 0.50;
const FALL_GEAR_DAMAGE = 20;
const FALL_SCATTER_CHANCE = 0.30;
const INSTANT_DEATH_THRESHOLD = 25;

/**
 * Rolls whether a fall occurs on this push_forward.
 */
export function rollFall(
  state: GameState,
  waypoint: Waypoint,
  rng: RNG,
): boolean {
  let chance = TERRAIN_FALL_BASE[waypoint.terrain];

  // Weather multiplier
  chance *= WEATHER_FALL_MULT[state.weather.current];

  // Night multiplier
  const isNight = state.time.timeOfDay === "night" || state.time.timeOfDay === "dusk";
  if (isNight) chance *= NIGHT_FALL_MULTIPLIER;

  // Lost multiplier
  if (state.player.isLost) chance *= LOST_FALL_MULTIPLIER;

  // Low energy multiplier
  if (state.player.energy < LOW_ENERGY_THRESHOLD) chance *= LOW_ENERGY_FALL_MULTIPLIER;

  chance = Math.max(0, Math.min(0.95, chance));

  return rng.chance(chance);
}

/**
 * Checks if fall is instantly fatal (avg health <= 25%).
 */
export function isFallFatal(player: PlayerState): boolean {
  const avg = (player.energy + player.hydration + player.bodyTemp +
    player.o2Saturation + player.morale) / 5;
  return avg <= INSTANT_DEATH_THRESHOLD;
}

/**
 * Applies fall damage to the player. Returns new PlayerState.
 * Reduces all vitals by 50%, damages gear, may scatter items.
 */
export function applyFallDamage(player: PlayerState, rng: RNG): PlayerState {
  const p = { ...player, statusEffects: [...player.statusEffects] };

  // 50% reduction to all vitals
  p.energy = Math.round(p.energy * (1 - FALL_VITAL_REDUCTION));
  p.hydration = Math.round(p.hydration * (1 - FALL_VITAL_REDUCTION));
  p.bodyTemp = Math.round(p.bodyTemp * (1 - FALL_VITAL_REDUCTION));
  p.o2Saturation = Math.round(p.o2Saturation * (1 - FALL_VITAL_REDUCTION));
  p.morale = Math.round(p.morale * (1 - FALL_VITAL_REDUCTION));

  // Gear damage
  p.gear = Math.max(0, p.gear - FALL_GEAR_DAMAGE);

  // Item scatter
  if (rng.chance(FALL_SCATTER_CHANCE)) {
    if (rng.chance(0.5) && p.food > 0) {
      p.food -= 1;
    } else if (p.water > 0) {
      p.water = Math.max(0, p.water - 0.5);
    }
  }

  // Add fall_injury status effect (only if not already injured)
  if (!p.statusEffects.some(e => e.id === "fall_injury")) {
    p.statusEffects.push({
      id: "fall_injury",
      turnsRemaining: 999,
    });
  }

  return p;
}
