/**
 * Weather simulation system for the Ao Tai Cyber-Hike.
 * Uses a Markov chain with altitude-dependent probability shifting
 * to generate realistic mountain weather transitions.
 */

import type { WeatherCondition, WeatherState } from "./types.ts";
import {
  HIGH_ALTITUDE_FAVORED,
  HIGH_ALTITUDE_REDUCED,
  WEATHER_TRANSITIONS,
} from "../data/weatherTransitions.ts";
import type { RNG } from "../utils/random.ts";

/** Elevation threshold above which weather shifts toward severe conditions. */
const HIGH_ALTITUDE_THRESHOLD = 3400;

/** Total probability mass shifted toward severe weather at high altitude. */
const HIGH_ALTITUDE_SHIFT = 0.15;

/** All weather conditions in stable iteration order. */
const ALL_CONDITIONS: WeatherCondition[] = [
  "clear",
  "cloudy",
  "fog",
  "rain",
  "snow",
  "blizzard",
  "wind",
];

/** Temperature modifier lookup by weather condition. */
const BASE_TEMP_MODIFIER: Record<WeatherCondition, number> = {
  clear: 0,
  cloudy: -2,
  fog: -4,
  rain: -6,
  snow: -10,
  blizzard: -15,
  wind: -8,
};

/** Visibility modifier lookup by weather condition (1.0 = full visibility). */
const BASE_VISIBILITY: Record<WeatherCondition, number> = {
  clear: 1.0,
  cloudy: 0.8,
  fog: 0.2,
  rain: 0.5,
  snow: 0.3,
  blizzard: 0.1,
  wind: 0.7,
};

/** Base wind speed by weather condition (km/h). */
const BASE_WIND_SPEED: Record<WeatherCondition, number> = {
  clear: 5,
  cloudy: 10,
  fog: 5,
  rain: 20,
  snow: 25,
  blizzard: 60,
  wind: 45,
};

/**
 * Applies high-altitude probability shifting to a transition row.
 * Redistributes probability from clear/cloudy toward snow/blizzard/wind.
 */
function applyAltitudeShift(
  probabilities: Record<WeatherCondition, number>,
): Record<WeatherCondition, number> {
  const shifted = { ...probabilities };

  // Calculate how much probability to take from reduced conditions
  const reducedCount = HIGH_ALTITUDE_REDUCED.length;
  const favoredCount = HIGH_ALTITUDE_FAVORED.length;
  const perReducedLoss = HIGH_ALTITUDE_SHIFT / reducedCount;
  const perFavoredGain = HIGH_ALTITUDE_SHIFT / favoredCount;

  for (const condition of HIGH_ALTITUDE_REDUCED) {
    shifted[condition] = Math.max(0, shifted[condition] - perReducedLoss);
  }

  for (const condition of HIGH_ALTITUDE_FAVORED) {
    shifted[condition] += perFavoredGain;
  }

  // Normalize to sum to 1.0
  const total = ALL_CONDITIONS.reduce((sum, c) => sum + shifted[c], 0);
  if (total > 0) {
    for (const condition of ALL_CONDITIONS) {
      shifted[condition] /= total;
    }
  }

  return shifted;
}

/**
 * Rolls a new weather state based on the current weather, altitude, and RNG.
 * Uses the Markov transition matrix with optional high-altitude shifting.
 */
export function rollWeather(
  current: WeatherState,
  altitude: number,
  rng: RNG,
): WeatherState {
  // Get base transition probabilities for current weather
  let probabilities = { ...WEATHER_TRANSITIONS[current.current] };

  // Apply altitude shift if above threshold
  if (altitude > HIGH_ALTITUDE_THRESHOLD) {
    probabilities = applyAltitudeShift(probabilities);
  }

  // Roll weighted random to select new condition
  let roll = rng.next();
  let newCondition: WeatherCondition = current.current;

  for (const condition of ALL_CONDITIONS) {
    roll -= probabilities[condition];
    if (roll <= 0) {
      newCondition = condition;
      break;
    }
  }

  // Generate new intensity
  const intensity = 0.3 + rng.next() * 0.7;

  // Compute derived weather properties
  const temperatureModifier = BASE_TEMP_MODIFIER[newCondition] * intensity;
  const visibilityModifier =
    BASE_VISIBILITY[newCondition] + (1 - BASE_VISIBILITY[newCondition]) * (1 - intensity) * 0.3;
  const windSpeed = BASE_WIND_SPEED[newCondition] * (0.5 + intensity * 0.5);

  return {
    current: newCondition,
    intensity,
    temperatureModifier,
    visibilityModifier: Math.min(Math.max(visibilityModifier, 0), 1),
    windSpeed,
  };
}
