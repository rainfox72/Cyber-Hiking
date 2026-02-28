/**
 * Markov chain weather transition probabilities for the Ao Tai route.
 * Each row sums to 1.0 and represents the probability of transitioning
 * from the row's weather condition to each column's weather condition.
 */

import type { WeatherCondition } from "../engine/types.ts";

/**
 * 7x7 transition probability matrix.
 * WEATHER_TRANSITIONS[currentWeather][nextWeather] = probability
 */
export const WEATHER_TRANSITIONS: Record<
  WeatherCondition,
  Record<WeatherCondition, number>
> = {
  clear: {
    clear: 0.40,
    cloudy: 0.30,
    fog: 0.10,
    rain: 0.08,
    snow: 0.02,
    blizzard: 0.00,
    wind: 0.10,
  },
  cloudy: {
    clear: 0.20,
    cloudy: 0.30,
    fog: 0.15,
    rain: 0.15,
    snow: 0.05,
    blizzard: 0.02,
    wind: 0.13,
  },
  fog: {
    clear: 0.10,
    cloudy: 0.20,
    fog: 0.30,
    rain: 0.15,
    snow: 0.08,
    blizzard: 0.02,
    wind: 0.15,
  },
  rain: {
    clear: 0.10,
    cloudy: 0.25,
    fog: 0.10,
    rain: 0.25,
    snow: 0.10,
    blizzard: 0.05,
    wind: 0.15,
  },
  snow: {
    clear: 0.05,
    cloudy: 0.15,
    fog: 0.10,
    rain: 0.05,
    snow: 0.30,
    blizzard: 0.20,
    wind: 0.15,
  },
  blizzard: {
    clear: 0.02,
    cloudy: 0.08,
    fog: 0.10,
    rain: 0.05,
    snow: 0.30,
    blizzard: 0.30,
    wind: 0.15,
  },
  wind: {
    clear: 0.15,
    cloudy: 0.20,
    fog: 0.10,
    rain: 0.10,
    snow: 0.10,
    blizzard: 0.10,
    wind: 0.25,
  },
};

/** Weather conditions that benefit from high-altitude probability boost. */
export const HIGH_ALTITUDE_FAVORED: WeatherCondition[] = [
  "snow",
  "blizzard",
  "wind",
];

/** Weather conditions that lose probability at high altitude. */
export const HIGH_ALTITUDE_REDUCED: WeatherCondition[] = ["clear", "cloudy"];
