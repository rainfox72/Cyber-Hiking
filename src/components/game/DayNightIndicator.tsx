/**
 * DayNightIndicator component — shows the current day, hour, and time-of-day period.
 */

import { useGameStore } from "../../store/gameStore.ts";
import type { TimeOfDay } from "../../engine/types.ts";

// eslint-disable-next-line react-refresh/only-export-components
export const TIME_ICONS: Record<TimeOfDay, string> = {
  dawn: "\uD83C\uDF05",
  morning: "\u2600\uFE0F",
  midday: "\u2600\uFE0F",
  afternoon: "\u26C5",
  dusk: "\uD83C\uDF07",
  night: "\uD83C\uDF19",
};

export function DayNightIndicator() {
  const time = useGameStore((s) => s.time);
  return (
    <div className="day-night panel" style={{ flex: 1 }}>
      <span className="day-night__icon">{TIME_ICONS[time.timeOfDay]}</span>
      <span className="day-night__time">Day {time.day} {String(Math.floor(time.hour)).padStart(2, "0")}:00</span>
      <span className="day-night__period">{time.timeOfDay}</span>
    </div>
  );
}
