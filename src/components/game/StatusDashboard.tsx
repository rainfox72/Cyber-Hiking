/**
 * StatusDashboard component — displays all player vital bars (energy, hydration, etc.).
 * Applies fog-of-war vitals jitter when morale is low (<40%).
 */

import { useGameStore } from "../../store/gameStore.ts";
import { VitalBar } from "./VitalBar.tsx";

export function StatusDashboard() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const vitalsJitter = useGameStore((s) => s.vitalsJitter);

  // Fog of war: jitter displayed values when morale is low
  const jitter = (value: number, key: string) =>
    Math.round(Math.min(100, Math.max(0, value + (vitalsJitter[key] ?? 0))));

  const displayEnergy = jitter(energy, "energy");
  const displayHydration = jitter(hydration, "hydration");
  const displayBodyTemp = jitter(bodyTemp, "bodyTemp");
  const displayO2 = jitter(o2, "o2Saturation");
  const displayMorale = jitter(morale, "morale");

  return (
    <div>
      <div className="section-label">VITALS</div>
      <VitalBar label="Energy" value={displayEnergy} />
      <VitalBar label="Hydration" value={displayHydration} color="var(--teal-muted)" />
      <VitalBar label="Body Temp" value={displayBodyTemp} color={displayBodyTemp < 30 ? "var(--hazard-red)" : displayBodyTemp > 70 ? "var(--hazard-red)" : "var(--amber)"} />
      <VitalBar label="O2 Sat" value={displayO2} color="var(--amber)" />
      <VitalBar label="Morale" value={displayMorale} color="var(--warning-orange)" />
    </div>
  );
}
