/**
 * Dynamic vignette overlay that closes in as player vitals drop.
 * Simulates tunnel vision during critical states.
 */

import { useMemo } from "react";
import { useGameStore } from "../../store/gameStore.ts";

export function Vignette() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);

  const { radius, tintColor } = useMemo(() => {
    const worstVital = Math.min(energy, hydration, bodyTemp, o2, morale);

    let r: number;
    if (worstVital > 60) r = 0;        // no vignette
    else if (worstVital > 30) r = 70;   // subtle
    else if (worstVital > 10) r = 40;   // heavy
    else r = 20;                         // near blackout

    // Color tint based on which vital is worst
    let tint = "rgba(0,0,0,0)";
    if (worstVital <= 30) {
      if (bodyTemp <= worstVital + 5) tint = "rgba(0,50,120,0.15)";      // cold = blue
      else if (o2 <= worstVital + 5) tint = "rgba(120,0,0,0.15)";        // low O2 = red
    }

    return { radius: r, tintColor: tint };
  }, [energy, hydration, bodyTemp, o2, morale]);

  if (radius === 0) return null;

  return (
    <div
      className="vignette"
      style={{
        background: `radial-gradient(ellipse ${radius}% ${radius}% at center, transparent 0%, ${tintColor} 40%, rgba(0,0,0,0.85) 100%)`,
      }}
    />
  );
}
