/**
 * TerrainVegetation — instanced trees + animated grass line segments.
 * Trees: InstancedMesh with ConeGeometry (low poly).
 * Grass: merged BufferGeometry rendered as lineSegments with sway animation.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TerrainDetailData } from "./terrainDetails.ts";
import type { TimeOfDay, WeatherCondition } from "../../../engine/types.ts";

interface Props {
  details: TerrainDetailData;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}

// ---------------------------------------------------------------------------
// Helper — resolve per-frame opacity targets based on time of day and weather
// ---------------------------------------------------------------------------

function resolveOpacity(
  timeOfDay: TimeOfDay,
  weather: WeatherCondition,
): { tree: number; grass: number } {
  if (timeOfDay === "night") return { tree: 0.24, grass: 0.18 };
  if (weather === "fog") return { tree: 0.2, grass: 0.15 };
  if (weather === "blizzard") return { tree: 0.15, grass: 0.10 };
  return { tree: 0.4, grass: 0.3 };
}

// ---------------------------------------------------------------------------
// TerrainVegetation
// ---------------------------------------------------------------------------

export function TerrainVegetation({ details, timeOfDay, weather }: Props) {
  // ── Tree instanced mesh ──────────────────────────────────────────────────
  const treeRef = useRef<THREE.InstancedMesh>(null);

  const treeGeo = useMemo(() => new THREE.ConeGeometry(0.03, 0.06, 4), []);
  const treeMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        color: "#1a5c1a",
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
      }),
    [],
  );

  // Apply pre-computed instance matrices once on mount / when details change
  useEffect(() => {
    const mesh = treeRef.current;
    if (!mesh || details.trees.count === 0) return;
    const mat4 = new THREE.Matrix4();
    for (let i = 0; i < details.trees.count; i++) {
      mat4.fromArray(details.trees.matrices, i * 16);
      mesh.setMatrixAt(i, mat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [details]);

  // ── Grass line segments ──────────────────────────────────────────────────
  const grassRef = useRef<THREE.LineSegments>(null);

  // grassGeo + baseTipY are both derived from details; keep them in sync via useMemo.
  const { grassGeo, baseTipY, grassBaseX } = useMemo(() => {
    if (details.grass.count === 0) {
      return { grassGeo: null, baseTipY: null, grassBaseX: null };
    }

    // Each grass tuft = 3 short lines fanning upward from base point.
    // Each line = 2 vertices, so 3 lines × 2 vertices × 3 floats = 18 floats per tuft.
    const LINES_PER_TUFT = 3;
    const VERTS_PER_LINE = 2;
    const tufts = details.grass.count;
    const posArray = new Float32Array(tufts * LINES_PER_TUFT * VERTS_PER_LINE * 3);

    // Snapshot of each tip's rest Y and base X (for sway phase offset)
    const tipYBase = new Float32Array(tufts * LINES_PER_TUFT);
    const baseXArr = new Float32Array(tufts);

    const fanAngles = [-0.2, 0, 0.2]; // radians from vertical
    const lineHeight = 0.04;

    let vi = 0;
    for (let i = 0; i < tufts; i++) {
      const bx = details.grass.positions[i * 3];
      const by = details.grass.positions[i * 3 + 1];
      const bz = details.grass.positions[i * 3 + 2];
      baseXArr[i] = bx;

      for (let f = 0; f < LINES_PER_TUFT; f++) {
        const angle = fanAngles[f];
        const tipY = by + Math.cos(angle) * lineHeight;

        // base vertex
        posArray[vi++] = bx;
        posArray[vi++] = by;
        posArray[vi++] = bz;
        // tip vertex
        posArray[vi++] = bx + Math.sin(angle) * lineHeight;
        posArray[vi++] = tipY;
        posArray[vi++] = bz;

        tipYBase[i * LINES_PER_TUFT + f] = tipY;
      }
    }

    const geo = new THREE.BufferGeometry();
    // DynamicDrawUsage so the GPU driver knows the buffer will be updated frequently
    const posAttr = new THREE.BufferAttribute(posArray, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("position", posAttr);

    return { grassGeo: geo, baseTipY: tipYBase, grassBaseX: baseXArr };
  }, [details]);

  const grassMat = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: "#2a7a2a",
        transparent: true,
        opacity: 0.3,
      }),
    [],
  );

  // ── Per-frame animation ──────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    const { tree: treeOpacity, grass: grassOpacity } = resolveOpacity(timeOfDay, weather);

    // Tree opacity
    if (treeRef.current) {
      (treeRef.current.material as THREE.MeshLambertMaterial).opacity = treeOpacity;
    }

    // Grass sway + opacity
    if (grassRef.current && grassGeo && baseTipY && grassBaseX) {
      (grassRef.current.material as THREE.LineBasicMaterial).opacity = grassOpacity;

      const posAttr = grassGeo.getAttribute("position") as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      const tufts = details.grass.count;
      const LINES_PER_TUFT = 3;
      const VERTS_PER_LINE = 2;

      for (let i = 0; i < tufts; i++) {
        const sway = Math.sin(elapsed * 2 + grassBaseX[i] * 10) * 0.003;

        for (let f = 0; f < LINES_PER_TUFT; f++) {
          // Index of the tip vertex Y component in the flat array
          // Layout per tuft: [base0, tip0, base1, tip1, base2, tip2] × 3 floats each
          const tipVertexIdx = i * LINES_PER_TUFT * VERTS_PER_LINE + f * VERTS_PER_LINE + 1;
          arr[tipVertexIdx * 3 + 1] = baseTipY[i * LINES_PER_TUFT + f] + sway;
        }
      }
      posAttr.needsUpdate = true;
    }
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      treeGeo.dispose();
      treeMat.dispose();
      if (grassGeo) grassGeo.dispose();
      grassMat.dispose();
    };
  }, [treeGeo, treeMat, grassGeo, grassMat]);

  if (details.trees.count === 0 && details.grass.count === 0) return null;

  return (
    <>
      {details.trees.count > 0 && (
        <instancedMesh
          ref={treeRef}
          args={[treeGeo, treeMat, details.trees.count]}
        />
      )}
      {grassGeo && details.grass.count > 0 && (
        <lineSegments ref={grassRef} geometry={grassGeo} material={grassMat} />
      )}
    </>
  );
}
