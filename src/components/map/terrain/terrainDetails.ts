/**
 * Terrain detail placement generator for the 3D TacticalMap.
 * Generates pre-computed instance matrices for vegetation, rocks, water,
 * and landmark definitions. Computed once at module load via generateTerrainDetails().
 */

import * as THREE from "three";
import { GRID_X, GRID_Z, valueNoise, type TerrainMeshData } from "../terrainMesh.ts";
import type { Waypoint } from "../../../engine/types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LandmarkType =
  | "trailhead_gate"
  | "shelter_marker"
  | "shrine"
  | "cairn"
  | "warning_sign"
  | "summit_beacon";

export interface LandmarkDef {
  waypointId: string;
  type: LandmarkType;
  position: THREE.Vector3;
  scale: number;
}

export interface TerrainDetailData {
  trees: { matrices: Float32Array; count: number };
  grass: { positions: Float32Array; count: number };
  rocks: { matrices: Float32Array; colors: Float32Array; count: number };
  water: { positions: Float32Array; count: number };
  landmarks: LandmarkDef[];
}

// ---------------------------------------------------------------------------
// Terrain type index lookup (must match order in terrainMesh.ts)
// ---------------------------------------------------------------------------

const TERRAIN_TYPES = ["forest", "meadow", "stone_sea", "ridge", "summit", "scree", "stream_valley"] as const;
type TerrainLabel = typeof TERRAIN_TYPES[number];

function getTerrainLabel(idx: number): TerrainLabel {
  return TERRAIN_TYPES[idx] ?? "forest";
}

// ---------------------------------------------------------------------------
// Per-terrain density thresholds (noise value in [0,1] must be BELOW threshold)
// ---------------------------------------------------------------------------

const TREE_DENSITY: Partial<Record<TerrainLabel, number>> = {
  forest: 0.08,
  meadow: 0.01,
};

const ROCK_DENSITY: Partial<Record<TerrainLabel, number>> = {
  stone_sea: 0.06,
  scree: 0.07,
  ridge: 0.02,
  summit: 0.03,
};

const GRASS_DENSITY: Partial<Record<TerrainLabel, number>> = {
  meadow: 0.12,
  forest: 0.06,
};

// ---------------------------------------------------------------------------
// Module-level singleton scratch objects (avoids per-iteration allocations)
// ---------------------------------------------------------------------------

const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _axis = new THREE.Vector3(1, 0, 0); // lean axis for trees

// ---------------------------------------------------------------------------
// Elevation-driven tree scale and lean angle
// ---------------------------------------------------------------------------

function treeScaleAndLean(elevation: number): { scale: number; lean: number } {
  if (elevation < 2500) return { scale: 1.0, lean: 0 };
  if (elevation < 3200) return { scale: 0.8, lean: 0.1 };
  return { scale: 0.6, lean: 0.2 };
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export function generateTerrainDetails(
  waypoints: Waypoint[],
  meshData: TerrainMeshData,
): TerrainDetailData {
  const totalCells = GRID_X * GRID_Z;

  // Pre-allocate max-size buffers
  const maxTrees = totalCells;
  const maxRocks = totalCells;
  const maxGrass = totalCells;
  const maxWater = totalCells;

  const treeMatrices = new Float32Array(maxTrees * 16);
  const rockMatrices = new Float32Array(maxRocks * 16);
  const rockColors = new Float32Array(maxRocks * 3);
  const grassPositions = new Float32Array(maxGrass * 3);
  const waterPositions = new Float32Array(maxWater * 3);

  let treeCount = 0;
  let rockCount = 0;
  let grassCount = 0;
  let waterCount = 0;

  // Seeds differentiate detail types for independent placement patterns
  const SEED_TREE = 11111;
  const SEED_ROCK = 22222;
  const SEED_GRASS = 33333;
  const SEED_WATER = 44444;

  for (let ix = 0; ix < GRID_X; ix++) {
    for (let iz = 0; iz < GRID_Z; iz++) {
      const cellIdx = ix * GRID_Z + iz;
      const terrainLabel = getTerrainLabel(meshData.cellTerrains[cellIdx]);
      const elevation = meshData.elevations[cellIdx];

      // Normalised lateral position (-1 … +1); trail corridor at |zNorm| < 0.10
      const zNorm = (iz / (GRID_Z - 1)) * 2 - 1;
      const inTrailCorridor = Math.abs(zNorm) < 0.10;

      // World-space position on terrain surface
      const pi = cellIdx * 3;
      const wx = meshData.positions[pi];
      const wy = meshData.positions[pi + 1];
      const wz = meshData.positions[pi + 2];

      // ----------------------------------------------------------------
      // Trees
      // ----------------------------------------------------------------
      const treeDensity = TREE_DENSITY[terrainLabel] ?? 0;
      if (treeDensity > 0 && !inTrailCorridor && treeCount < maxTrees) {
        const treeNoise = valueNoise(ix * 0.1, iz * 0.1, SEED_TREE) + 0.5; // remap to [0,1]
        if (treeNoise < treeDensity) {
          const { scale: ts, lean } = treeScaleAndLean(elevation);
          _pos.set(wx, wy, wz);
          _quat.setFromAxisAngle(_axis, lean);
          _scale.setScalar(ts);
          _mat4.compose(_pos, _quat, _scale);
          _mat4.toArray(treeMatrices, treeCount * 16);
          treeCount++;
        }
      }

      // ----------------------------------------------------------------
      // Rocks
      // ----------------------------------------------------------------
      const rockDensity = ROCK_DENSITY[terrainLabel] ?? 0;
      if (rockDensity > 0 && !inTrailCorridor && rockCount < maxRocks) {
        const rockNoise = valueNoise(ix * 0.1, iz * 0.1, SEED_ROCK) + 0.5;
        if (rockNoise < rockDensity) {
          _pos.set(wx, wy, wz);
          _quat.identity();
          _scale.setScalar(1.0);
          _mat4.compose(_pos, _quat, _scale);
          _mat4.toArray(rockMatrices, rockCount * 16);

          const ci = cellIdx * 3;
          rockColors[rockCount * 3] = meshData.colors[ci];
          rockColors[rockCount * 3 + 1] = meshData.colors[ci + 1];
          rockColors[rockCount * 3 + 2] = meshData.colors[ci + 2];

          rockCount++;
        }
      }

      // ----------------------------------------------------------------
      // Grass (stored as positions, not instance matrices)
      // ----------------------------------------------------------------
      const grassDensity = GRASS_DENSITY[terrainLabel] ?? 0;
      if (grassDensity > 0 && !inTrailCorridor && grassCount < maxGrass) {
        const grassNoise = valueNoise(ix * 0.1, iz * 0.1, SEED_GRASS) + 0.5;
        if (grassNoise < grassDensity) {
          grassPositions[grassCount * 3] = wx;
          grassPositions[grassCount * 3 + 1] = wy;
          grassPositions[grassCount * 3 + 2] = wz;
          grassCount++;
        }
      }

      // ----------------------------------------------------------------
      // Water ribbons — stream_valley cells near trail centreline (|zNorm| ≈ 0)
      // Collect two lines offset ±0.1 on Z from center
      // ----------------------------------------------------------------
      if (terrainLabel === "stream_valley" && Math.abs(zNorm) < 0.25 && waterCount + 1 < maxWater) {
        const waterNoise = valueNoise(ix * 0.1, iz * 0.1, SEED_WATER) + 0.5;
        if (waterNoise < 0.35) {
          // Line A: offset -0.1
          waterPositions[waterCount * 3] = wx;
          waterPositions[waterCount * 3 + 1] = wy + 0.005;
          waterPositions[waterCount * 3 + 2] = wz - 0.1;
          waterCount++;

          if (waterCount < maxWater) {
            // Line B: offset +0.1
            waterPositions[waterCount * 3] = wx;
            waterPositions[waterCount * 3 + 1] = wy + 0.005;
            waterPositions[waterCount * 3 + 2] = wz + 0.1;
            waterCount++;
          }
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Landmarks
  // ----------------------------------------------------------------
  const landmarks: LandmarkDef[] = [];

  // Build a quick lookup from waypoint id to its mesh position
  const wpPositionMap = new Map<string, THREE.Vector3>();
  waypoints.forEach((wp, i) => {
    if (i < meshData.waypointPositions.length) {
      wpPositionMap.set(wp.id, meshData.waypointPositions[i].clone());
    }
  });

  function addLandmark(
    waypointId: string,
    type: LandmarkType,
    scale = 1.0,
  ): void {
    const pos = wpPositionMap.get(waypointId);
    if (pos) {
      landmarks.push({ waypointId, type, position: pos, scale });
    }
  }

  addLandmark("tangkou", "trailhead_gate");
  addLandmark("camp_2900", "shelter_marker");
  addLandmark("camp_2800", "shelter_marker");
  addLandmark("yaowangmiao", "shrine");
  addLandmark("daohangja", "cairn");
  addLandmark("maijianliang", "cairn");
  addLandmark("taibailiang", "cairn");
  addLandmark("nantianmen", "warning_sign");
  addLandmark("baxiantai", "summit_beacon", 1.5);

  // Return sliced views so consumers only iterate actual counts
  return {
    trees: {
      matrices: treeMatrices.slice(0, treeCount * 16),
      count: treeCount,
    },
    grass: {
      positions: grassPositions.slice(0, grassCount * 3),
      count: grassCount,
    },
    rocks: {
      matrices: rockMatrices.slice(0, rockCount * 16),
      colors: rockColors.slice(0, rockCount * 3),
      count: rockCount,
    },
    water: {
      positions: waterPositions.slice(0, waterCount * 3),
      count: waterCount,
    },
    landmarks,
  };
}
