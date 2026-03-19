/**
 * DangerOverlay — CSS-only frost edges + panel border escalation.
 * Positioned above the 3D canvas, pointer-events: none.
 * Perception effects that must not be affected by postprocessing.
 */

import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore.ts';

export function DangerOverlay() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);

  const { frostOpacity, borderColor } = useMemo(() => {
    const worstVital = Math.min(energy, hydration, bodyTemp, o2, morale);

    // Frost edges when cold
    let frost = 0;
    if (bodyTemp < 30) {
      frost = Math.min((30 - bodyTemp) / 30, 0.5);
    }

    // Panel border color escalation
    let border = 'rgba(61, 139, 55, 0.15)'; // tactical green (default)
    if (worstVital <= 15) {
      border = 'rgba(201, 56, 56, 0.5)'; // hazard red
    } else if (worstVital <= 30) {
      border = 'rgba(201, 122, 46, 0.4)'; // warning orange
    } else if (worstVital <= 60) {
      border = 'rgba(212, 168, 67, 0.3)'; // amber
    }

    return { frostOpacity: frost, borderColor: border };
  }, [energy, hydration, bodyTemp, o2, morale]);

  // Set CSS variable for panel borders
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--bg-panel-border', borderColor);
  }

  if (frostOpacity <= 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
        background: `radial-gradient(ellipse 80% 80% at 50% 50%, transparent 40%, rgba(200, 220, 255, ${frostOpacity}) 100%)`,
        transition: 'background 1s ease',
      }}
    />
  );
}
