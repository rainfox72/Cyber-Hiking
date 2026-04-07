/**
 * WeatherDisplay component — shows current weather condition with icon and details.
 */

import { useGameStore } from "../../store/gameStore.ts";
import type { WeatherCondition } from "../../engine/types.ts";

// eslint-disable-next-line react-refresh/only-export-components
export const WEATHER_ICONS: Record<WeatherCondition, string> = {
  clear: "\u2600",
  cloudy: "\u2601",
  fog: "\uD83C\uDF2B\uFE0F",
  rain: "\uD83C\uDF27\uFE0F",
  snow: "\u2744\uFE0F",
  blizzard: "\uD83C\uDF28\uFE0F",
  wind: "\uD83D\uDCA8",
};

export function WeatherDisplay() {
  const weather = useGameStore((s) => s.weather);
  return (
    <div className="weather-display panel" style={{ flex: 1 }}>
      <span className="weather-display__icon">{WEATHER_ICONS[weather.current]}</span>
      <div className="weather-display__info">
        <span className="weather-display__condition">{weather.current}</span>
        <span className="weather-display__detail">Int: {Math.round(weather.intensity * 100)}% | Wind: {Math.round(weather.windSpeed)} km/h</span>
      </div>
    </div>
  );
}
