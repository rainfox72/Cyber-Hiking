/**
 * Terrain mesh generation for the 3D TacticalMap.
 * Generates a heightmap grid from waypoint elevation data with
 * terrain-type-driven ridge profiles and procedural noise.
 */

import type { Waypoint, TerrainType } from "../../engine/types.ts";
import * as THREE from "three";

const GRID_X = 128;
const GRID_Z = 64;

/** Lateral falloff width per terrain type (0 = narrow ridge, 1 = wide valley) */
const RIDGE_WIDTH: Record<TerrainType, number> = {
  ridge: 0.15,
  summit: 0.2,
  scree: 0.35,
  stone_sea: 0.3,
  forest: 0.5,
  meadow: 0.7,
  stream_valley: 0.8,
};

/** Noise amplitude per terrain type */
const NOISE_AMP: Record<TerrainType, number> = {
  ridge: 0.02,
  summit: 0.015,
  scree: 0.06,
  stone_sea: 0.05,
  forest: 0.025,
  meadow: 0.01,
  stream_valley: 0.008,
};

/** Simple mulberry32-based value noise for terrain displacement */
function valueNoise(x: number, z: number, seed: number): number {
  let state = (Math.floor(x * 100) * 73856093 ^ Math.floor(z * 100) * 19349663 ^ seed) | 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
}

/** Cubic Hermite interpolation for smooth elevation between waypoints */
function cubicInterp(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
  const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
  const c = -0.5 * p0 + 0.5 * p2;
  const d = p1;
  return a * t * t * t + b * t * t + c * t + d;
}

/** Get interpolated elevation and terrain type at a given distance along the trail */
function sampleTrail(
  waypoints: Waypoint[],
  distance: number,
  maxDist: number,
): { elevation: number; terrain: TerrainType } {
  const norm = (distance / maxDist) * (waypoints.length - 1);
  const i = Math.floor(norm);
  const t = norm - i;

  const clampIdx = (idx: number) => Math.max(0, Math.min(waypoints.length - 1, idx));

  const e0 = waypoints[clampIdx(i - 1)].elevation;
  const e1 = waypoints[clampIdx(i)].elevation;
  const e2 = waypoints[clampIdx(i + 1)].elevation;
  const e3 = waypoints[clampIdx(i + 2)].elevation;

  return {
    elevation: cubicInterp(e0, e1, e2, e3, t),
    terrain: waypoints[clampIdx(i)].terrain,
  };
}

/** Elevation color: green < 2500, amber 2500-3200, red > 3500 */
export function elevationColor(elevation: number): THREE.Color {
  const green = new THREE.Color("#00ff41");
  const amber = new THREE.Color("#ffb000");
  const red = new THREE.Color("#ff2222");

  if (elevation < 2500) return green;
  if (elevation < 3200) {
    const t = (elevation - 2500) / 700;
    return green.clone().lerp(amber, t);
  }
  if (elevation < 3500) {
    const t = (elevation - 3200) / 300;
    return amber.clone().lerp(red, t);
  }
  return red;
}

export interface TerrainMeshData {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  edgePositions: Float32Array;
  edgeColors: Float32Array;
  trailPoints: THREE.Vector3[];
  waypointPositions: THREE.Vector3[];
}

export function generateTerrainMesh(waypoints: Waypoint[]): TerrainMeshData {
  const maxDist = waypoints[waypoints.length - 1].distanceFromStart;
  const minElev = 1500;
  const maxElev = 3800;
  const elevRange = maxElev - minElev;

  const positions = new Float32Array(GRID_X * GRID_Z * 3);
  const colors = new Float32Array(GRID_X * GRID_Z * 3);
  const elevations: number[] = [];

  for (let ix = 0; ix < GRID_X; ix++) {
    const distNorm = ix / (GRID_X - 1);
    const dist = distNorm * maxDist;
    const { elevation: centerElev, terrain } = sampleTrail(waypoints, dist, maxDist);
    const ridgeW = RIDGE_WIDTH[terrain];
    const noiseAmp = NOISE_AMP[terrain];

    for (let iz = 0; iz < GRID_Z; iz++) {
      const zNorm = (iz / (GRID_Z - 1)) * 2 - 1;
      const lateralDist = Math.abs(zNorm);

      const falloff = Math.max(0, 1 - lateralDist / ridgeW);
      const falloffCurve = falloff * falloff * (3 - 2 * falloff);
      const baseElev = minElev + (centerElev - minElev) * falloffCurve;

      const noise = valueNoise(distNorm * 20, zNorm * 20, 12345) * noiseAmp * elevRange;
      const finalElev = Math.max(minElev, baseElev + noise);

      const idx = (ix * GRID_Z + iz) * 3;
      positions[idx] = distNorm * 10 - 5;
      positions[idx + 1] = (finalElev - minElev) / elevRange * 2;
      positions[idx + 2] = zNorm * 3;

      elevations.push(finalElev);

      const color = elevationColor(finalElev);
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
  }

  const indexCount = (GRID_X - 1) * (GRID_Z - 1) * 6;
  const indices = new Uint32Array(indexCount);
  let ii = 0;
  for (let ix = 0; ix < GRID_X - 1; ix++) {
    for (let iz = 0; iz < GRID_Z - 1; iz++) {
      const a = ix * GRID_Z + iz;
      const b = a + GRID_Z;
      const c = a + 1;
      const d = b + 1;
      indices[ii++] = a; indices[ii++] = b; indices[ii++] = c;
      indices[ii++] = c; indices[ii++] = b; indices[ii++] = d;
    }
  }

  const edgeSet = new Set<string>();
  const edgeList: [number, number][] = [];

  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edgeList.push([a, b]);
    }
  };

  for (let i = 0; i < indexCount; i += 3) {
    addEdge(indices[i], indices[i + 1]);
    addEdge(indices[i + 1], indices[i + 2]);
    addEdge(indices[i + 2], indices[i]);
  }

  const edgePositions = new Float32Array(edgeList.length * 6);
  const edgeColors = new Float32Array(edgeList.length * 6);

  for (let i = 0; i < edgeList.length; i++) {
    const [a, b] = edgeList[i];
    const ai = a * 3;
    const bi = b * 3;
    const oi = i * 6;
    edgePositions[oi] = positions[ai]; edgePositions[oi + 1] = positions[ai + 1]; edgePositions[oi + 2] = positions[ai + 2];
    edgePositions[oi + 3] = positions[bi]; edgePositions[oi + 4] = positions[bi + 1]; edgePositions[oi + 5] = positions[bi + 2];
    edgeColors[oi] = colors[ai]; edgeColors[oi + 1] = colors[ai + 1]; edgeColors[oi + 2] = colors[ai + 2];
    edgeColors[oi + 3] = colors[bi]; edgeColors[oi + 4] = colors[bi + 1]; edgeColors[oi + 5] = colors[bi + 2];
  }

  const centerZ = Math.floor(GRID_Z / 2);
  const trailPoints: THREE.Vector3[] = [];
  for (let ix = 0; ix < GRID_X; ix++) {
    const idx = (ix * GRID_Z + centerZ) * 3;
    trailPoints.push(new THREE.Vector3(positions[idx], positions[idx + 1] + 0.02, positions[idx + 2]));
  }

  const waypointPositions: THREE.Vector3[] = waypoints.map((wp) => {
    const xNorm = wp.distanceFromStart / maxDist;
    const ix = Math.round(xNorm * (GRID_X - 1));
    const idx = (ix * GRID_Z + centerZ) * 3;
    return new THREE.Vector3(positions[idx], positions[idx + 1] + 0.05, positions[idx + 2]);
  });

  return { positions, colors, indices, edgePositions, edgeColors, trailPoints, waypointPositions };
}
