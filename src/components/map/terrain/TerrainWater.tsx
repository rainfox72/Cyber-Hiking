/**
 * TerrainWater — stream valley water ribbons rendered as a plain Three.js
 * Line with a slow opacity pulse animation.
 * The water positions buffer stores pairs: Line A (Z-0.1) and Line B (Z+0.1)
 * interleaved by the generator, so all points feed into one LineSegments draw.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TerrainDetailData } from "./terrainDetails.ts";
import type { TimeOfDay } from "../../../engine/types.ts";

interface Props {
  details: TerrainDetailData;
  timeOfDay: TimeOfDay;
}

// ---------------------------------------------------------------------------
// TerrainWater
// ---------------------------------------------------------------------------

export function TerrainWater({ details, timeOfDay }: Props) {
  if (details.water.count === 0) return null;
  return <WaterLines details={details} timeOfDay={timeOfDay} />;
}

// Inner component owns all hooks — avoids conditional hook calls in parent.
function WaterLines({ details, timeOfDay }: Props) {
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(details.water.positions.slice(), 3),
    );
    return geo;
  }, [details]);

  // ── Opacity pulse ──────────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const mat = matRef.current;
    if (!mat) return;
    const elapsed = clock.getElapsedTime();
    const isNight = timeOfDay === "night";
    const maxOpacity = isNight ? 0.2 : 0.35;
    const pulsed = 0.25 + Math.sin(elapsed * Math.PI) * 0.1;
    mat.opacity = Math.min(pulsed, maxOpacity);
  });

  // ── Cleanup ────────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial
        ref={matRef}
        color="#2288aa"
        transparent
        opacity={0.3}
      />
    </lineSegments>
  );
}
