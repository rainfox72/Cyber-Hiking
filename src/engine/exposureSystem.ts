/**
 * Exposure system for the Ao Tai Cyber-Hike.
 * Tracks cumulative exposure to harsh ridge conditions.
 * Hidden from UI — affects bodyTemp and energy drain multipliers.
 */

import type { GameAction, GameState, TerrainType, WeatherCondition } from "./types.ts";

const EXPOSED_TERRAIN: TerrainType[] = ["ridge", "summit"];
const EXPOSURE_WEATHER: WeatherCondition[] = ["blizzard", "wind", "snow"];

export function updateExposure(
  state: GameState,
  action: GameAction,
  terrain: TerrainType,
  shelterAvailable: boolean,
  elevation: number = 0,
): number {
  let exposure = state.player.exposure;
  const isExposedTerrain = EXPOSED_TERRAIN.includes(terrain);
  const isHarshWeather = EXPOSURE_WEATHER.includes(state.weather.current);

  if (isExposedTerrain && isHarshWeather) {
    let exposureGain = 15 * state.weather.intensity;
    // Above 3500m: increased exposure accumulation rate
    if (elevation > 3500) {
      exposureGain *= 1 + (elevation - 3500) / 1000; // e.g., 3767m = 1.267x
    }
    exposure += exposureGain;
  }

  if (action === "set_camp") {
    exposure -= shelterAvailable ? 25 : 20;
  } else if (action === "rest") {
    exposure -= 5;
  }

  return Math.min(Math.max(exposure, 0), 100);
}

export function getExposureTempMultiplier(exposure: number): number {
  if (exposure > 60) return 2.5;
  if (exposure > 30) return 1.5;
  return 1;
}

export function getExposureEnergyMultiplier(exposure: number): number {
  if (exposure > 80) return 2;
  return 1;
}
