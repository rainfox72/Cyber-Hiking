/**
 * TerrainAtmosphere — terrain-type visual overlay between Skybox and UI panels.
 * Uses SVG noise filters and CSS gradients per terrain type with crossfade transitions.
 */

import { useRef, useEffect, useState } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import type { TerrainType } from "../../engine/types.ts";

interface TerrainEffect {
  background: string;
  filter?: string;
  terrainTint: string;
}

const HIGH_ALTITUDE_THRESHOLD = 3200;

const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  stream_valley: {
    background: "radial-gradient(ellipse at 50% 100%, rgba(20, 80, 70, 0.08) 0%, transparent 60%)",
    terrainTint: "rgba(20, 80, 70, 0.03)",
  },
  forest: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(10, 40, 15, 0.08) 100%)",
    filter: "url(#terrain-noise-forest)",
    terrainTint: "rgba(10, 40, 15, 0.03)",
  },
  meadow: {
    background: "linear-gradient(180deg, transparent 60%, rgba(40, 50, 20, 0.06) 100%)",
    terrainTint: "rgba(40, 50, 20, 0.02)",
  },
  stone_sea: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(60, 60, 60, 0.04) 100%)",
    filter: "url(#terrain-noise-stone)",
    terrainTint: "rgba(60, 60, 60, 0.03)",
  },
  scree: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(80, 70, 50, 0.04) 100%)",
    filter: "url(#terrain-noise-stone)",
    terrainTint: "rgba(80, 70, 50, 0.03)",
  },
  ridge: {
    background: "linear-gradient(180deg, rgba(10, 20, 40, 0.06) 0%, transparent 40%)",
    terrainTint: "rgba(10, 20, 40, 0.04)",
  },
  summit: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(200, 200, 200, 0.04) 100%)",
    terrainTint: "rgba(100, 100, 100, 0.03)",
  },
};

export function TerrainAtmosphere() {
  const waypointIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const gamePhase = useGameStore((s) => s.gamePhase);

  const [state, setState] = useState(() => {
    const e = TERRAIN_EFFECTS.stream_valley;
    return { effects: [e, e] as [TerrainEffect, TerrainEffect], activeLayer: 0 };
  });

  const prevIndexRef = useRef(-1);

  useEffect(() => {
    if (gamePhase === "title") return;
    const wp = WAYPOINTS[waypointIndex];
    if (!wp) return;

    if (waypointIndex === prevIndexRef.current) return;
    prevIndexRef.current = waypointIndex;

    let effect = { ...TERRAIN_EFFECTS[wp.terrain] };

    if (wp.elevation > HIGH_ALTITUDE_THRESHOLD) {
      const factor = Math.min((wp.elevation - HIGH_ALTITUDE_THRESHOLD) / 600, 1);
      effect.terrainTint = `rgba(40, 50, 70, ${0.02 + factor * 0.03})`;
    }

    setState((prev) => {
      const newActive = prev.activeLayer === 0 ? 1 : 0;
      const effects: [TerrainEffect, TerrainEffect] = [prev.effects[0], prev.effects[1]];
      effects[newActive] = effect;
      return { effects, activeLayer: newActive };
    });

    document.documentElement.style.setProperty("--terrain-tint", effect.terrainTint);
  }, [waypointIndex, gamePhase]);

  if (gamePhase === "title") return null;

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 1,
    transition: "opacity 1.5s ease",
  };

  return (
    <>
      <svg aria-hidden="true" style={{ position: "fixed", width: 0, height: 0 }}>
        <defs>
          <filter id="terrain-noise-forest" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="42" result="noise" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.04  0 0 0 0 0.16  0 0 0 0 0.06  0 0 0 0.08 0" in="noise" />
          </filter>
          <filter id="terrain-noise-stone" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="99" result="noise" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.24  0 0 0 0 0.24  0 0 0 0.04 0" in="noise" />
          </filter>
        </defs>
      </svg>

      <div
        style={{
          ...baseStyle,
          background: state.effects[0].background,
          filter: state.effects[0].filter,
          opacity: state.activeLayer === 0 ? 1 : 0,
        }}
      />
      <div
        style={{
          ...baseStyle,
          background: state.effects[1].background,
          filter: state.effects[1].filter,
          opacity: state.activeLayer === 1 ? 1 : 0,
        }}
      />
    </>
  );
}
