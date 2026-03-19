/**
 * TerrainRocks — two instanced mesh variants (octahedra + tetrahedra) with
 * per-instance colors derived from the terrain palette.
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
  bandRockDensity?: number;
}

// ---------------------------------------------------------------------------
// Opacity target based on conditions
// ---------------------------------------------------------------------------

function resolveOpacity(timeOfDay: TimeOfDay, weather: WeatherCondition): number {
  if (timeOfDay === "night") return 0.2;
  if (weather === "fog") return 0.15;
  if (weather === "blizzard") return 0.1;
  return 0.35;
}

// ---------------------------------------------------------------------------
// TerrainRocks
// ---------------------------------------------------------------------------

export function TerrainRocks({ details, timeOfDay, weather, bandRockDensity = 1.0 }: Props) {
  const { count } = details.rocks;

  // Split: first 60% octahedra (larger boulders), rest tetrahedra (debris)
  const octaCount = Math.ceil(count * 0.6);
  const tetraCount = count - octaCount;

  // ── Geometries & materials ───────────────────────────────────────────────
  const octaGeo = useMemo(() => new THREE.OctahedronGeometry(0.04, 0), []);
  const tetraGeo = useMemo(() => new THREE.TetrahedronGeometry(0.025, 0), []);

  // vertexColors: true — per-instance colors are supplied via instanceColor
  const octaMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        vertexColors: true,
      }),
    [],
  );
  const tetraMat = useMemo(
    () =>
      new THREE.MeshLambertMaterial({
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        vertexColors: true,
      }),
    [],
  );

  const octaRef = useRef<THREE.InstancedMesh>(null);
  const tetraRef = useRef<THREE.InstancedMesh>(null);

  // ── Apply matrices + per-instance colors on mount ────────────────────────
  useEffect(() => {
    if (count === 0) return;
    const mat4 = new THREE.Matrix4();

    // Octahedra — indices [0, octaCount)
    const octaMesh = octaRef.current;
    if (octaMesh && octaCount > 0) {
      const octaColorArr = new Float32Array(octaCount * 3);
      for (let i = 0; i < octaCount; i++) {
        mat4.fromArray(details.rocks.matrices, i * 16);
        octaMesh.setMatrixAt(i, mat4);
        octaColorArr[i * 3] = details.rocks.colors[i * 3];
        octaColorArr[i * 3 + 1] = details.rocks.colors[i * 3 + 1];
        octaColorArr[i * 3 + 2] = details.rocks.colors[i * 3 + 2];
      }
      octaMesh.instanceMatrix.needsUpdate = true;
      octaMesh.instanceColor = new THREE.InstancedBufferAttribute(octaColorArr, 3);
    }

    // Tetrahedra — indices [octaCount, count)
    const tetraMesh = tetraRef.current;
    if (tetraMesh && tetraCount > 0) {
      const tetraColorArr = new Float32Array(tetraCount * 3);
      for (let i = 0; i < tetraCount; i++) {
        const srcIdx = octaCount + i;
        mat4.fromArray(details.rocks.matrices, srcIdx * 16);
        tetraMesh.setMatrixAt(i, mat4);
        tetraColorArr[i * 3] = details.rocks.colors[srcIdx * 3];
        tetraColorArr[i * 3 + 1] = details.rocks.colors[srcIdx * 3 + 1];
        tetraColorArr[i * 3 + 2] = details.rocks.colors[srcIdx * 3 + 2];
      }
      tetraMesh.instanceMatrix.needsUpdate = true;
      tetraMesh.instanceColor = new THREE.InstancedBufferAttribute(tetraColorArr, 3);
    }
  }, [details, count, octaCount, tetraCount]);

  // ── Per-frame opacity update ─────────────────────────────────────────────
  useFrame(() => {
    const opacity = resolveOpacity(timeOfDay, weather) * bandRockDensity;
    if (octaRef.current) {
      (octaRef.current.material as THREE.MeshLambertMaterial).opacity = opacity;
      octaRef.current.count = Math.floor(octaCount * bandRockDensity);
    }
    if (tetraRef.current) {
      (tetraRef.current.material as THREE.MeshLambertMaterial).opacity = opacity;
      tetraRef.current.count = Math.floor(tetraCount * bandRockDensity);
    }
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      octaGeo.dispose();
      tetraGeo.dispose();
      octaMat.dispose();
      tetraMat.dispose();
    };
  }, [octaGeo, tetraGeo, octaMat, tetraMat]);

  if (count === 0) return null;

  return (
    <>
      {octaCount > 0 && (
        <instancedMesh
          ref={octaRef}
          args={[octaGeo, octaMat, octaCount]}
        />
      )}
      {tetraCount > 0 && (
        <instancedMesh
          ref={tetraRef}
          args={[tetraGeo, tetraMat, tetraCount]}
        />
      )}
    </>
  );
}
