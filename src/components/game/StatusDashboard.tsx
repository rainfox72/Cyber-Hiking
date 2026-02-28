/**
 * StatusDashboard component — displays all player vital bars (energy, hydration, etc.).
 */

import { useGameStore } from "../../store/gameStore.ts";
import { VitalBar } from "./VitalBar.tsx";

export function StatusDashboard() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  return (
    <>
      <VitalBar label="Energy" value={energy} />
      <VitalBar label="Hydration" value={hydration} color="var(--cyan)" />
      <VitalBar label="Body Temp" value={bodyTemp} color={bodyTemp < 30 ? "var(--danger)" : bodyTemp > 70 ? "var(--danger)" : "var(--amber)"} />
      <VitalBar label="O2 Sat" value={o2} color="var(--amber)" />
      <VitalBar label="Morale" value={morale} color="var(--magenta)" />
    </>
  );
}
