/**
 * Day/night cycle system for the Ao Tai Cyber-Hike.
 * Manages in-game clock progression, time-of-day classification,
 * and temperature modifiers based on solar position.
 */

import type { GameTime, TimeOfDay } from "./types.ts";

/** Hours in a full day. */
const HOURS_PER_DAY = 24;

/**
 * Determines the time-of-day classification for a given hour.
 *
 * dawn:      5-6
 * morning:   7-10
 * midday:    11-13
 * afternoon: 14-16
 * dusk:      17-18
 * night:     19-4
 */
export function getTimeOfDay(hour: number): TimeOfDay {
  const h = ((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;

  if (h >= 5 && h <= 6) return "dawn";
  if (h >= 7 && h <= 10) return "morning";
  if (h >= 11 && h <= 13) return "midday";
  if (h >= 14 && h <= 16) return "afternoon";
  if (h >= 17 && h <= 18) return "dusk";
  return "night";
}

/**
 * Advances the game clock by the specified number of hours.
 * Handles day rollover when crossing midnight.
 *
 * @param time - Current game time.
 * @param hours - Number of hours to advance (can be fractional).
 * @returns New GameTime with updated day, hour, and timeOfDay.
 */
export function advanceClock(time: GameTime, hours: number): GameTime {
  const totalHours = time.hour + hours;
  const newHour = ((totalHours % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY;
  const daysElapsed = Math.floor(totalHours / HOURS_PER_DAY);

  const newDay = time.day + daysElapsed;
  const roundedHour = Math.round(newHour * 10) / 10;

  return {
    day: newDay,
    hour: roundedHour,
    timeOfDay: getTimeOfDay(Math.floor(roundedHour)),
  };
}

/**
 * Returns the ambient temperature modifier for a given time of day.
 * Negative values indicate colder temperatures relative to midday baseline.
 *
 * dawn:      -8 C
 * morning:   -3 C
 * midday:     0 C (baseline)
 * afternoon: -2 C
 * dusk:      -5 C
 * night:    -10 C
 */
export function getTemperatureModifier(timeOfDay: TimeOfDay): number {
  const modifiers: Record<TimeOfDay, number> = {
    dawn: -8,
    morning: -3,
    midday: 0,
    afternoon: -2,
    dusk: -5,
    night: -10,
  };

  return modifiers[timeOfDay];
}
