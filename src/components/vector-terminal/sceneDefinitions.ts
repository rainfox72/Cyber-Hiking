/**
 * Scene Definitions — Pure data for all CRT vector art popup scenes.
 *
 * 13 location scenes (one per waypoint) + 12 event scenes.
 * Each scene is a VectorSceneDef object interpreted by VectorScene.tsx.
 */

import type { VectorSceneDef } from "./types.ts";

// ── Helper: generate a simple heightmap ──

function generateHeightmap(
  rows: number,
  cols: number,
  generator: (r: number, c: number) => number,
): number[][] {
  const map: number[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: number[] = [];
    for (let c = 0; c < cols; c++) {
      row.push(generator(r / (rows - 1), c / (cols - 1)));
    }
    map.push(row);
  }
  return map;
}

// Simple noise-like function for terrain variation
function ridgeProfile(x: number, z: number, sharpness: number): number {
  const center = Math.exp(-((z - 0.5) ** 2) / (2 * sharpness * sharpness));
  const noise = Math.sin(x * 12) * 0.03 + Math.sin(x * 7 + 1) * 0.02 + Math.sin(z * 9) * 0.02;
  return center * (0.3 + x * 0.4) + noise;
}

function valleyProfile(x: number, z: number): number {
  const sides = Math.abs(z - 0.5) * 2;
  const valley = sides * sides * 0.5;
  const noise = Math.sin(x * 8) * 0.02 + Math.sin(z * 6 + 2) * 0.015;
  return valley * 0.4 + noise + 0.05;
}

function meadowProfile(x: number, z: number): number {
  const gentle = Math.sin(x * 3) * 0.05 + Math.sin(z * 4) * 0.04;
  const base = 0.15 + x * 0.1;
  return base + gentle;
}

// ═══════════════════════════════════════════════
// LOCATION SCENES (13 waypoints)
// ═══════════════════════════════════════════════

const locationScenes: Record<string, VectorSceneDef> = {
  // ── 0: Tangkou (Trailhead) ──
  tangkou: {
    id: "tangkou",
    camera: { position: [2, 2.5, 3], lookAt: [0, 0.3, 0], zoom: 70 },
    animateRotation: 0.08,
    elements: [
      // Valley terrain
      { type: "terrain", heightmap: generateHeightmap(16, 24, valleyProfile), scale: [5, 1.5, 3] },
      // Ground grid
      { type: "grid", size: 4, divisions: 16, opacity: 0.1 },
      // Trailhead gate (two posts + crossbar)
      { type: "wireframe-mesh", geometry: "cylinder", position: [-0.4, 0.4, 0.3], scale: [0.06, 0.8, 0.06] },
      { type: "wireframe-mesh", geometry: "cylinder", position: [0.4, 0.4, 0.3], scale: [0.06, 0.8, 0.06] },
      { type: "wireframe-mesh", geometry: "box", position: [0, 0.82, 0.3], scale: [0.9, 0.06, 0.08] },
      // Trees (forest)
      { type: "wireframe-mesh", geometry: "cone", position: [-1.2, 0.35, -0.5], scale: [0.2, 0.5, 0.2], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [-0.9, 0.3, -0.8], scale: [0.25, 0.6, 0.25], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [1.0, 0.28, -0.6], scale: [0.22, 0.55, 0.22], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [1.4, 0.32, -0.4], scale: [0.18, 0.45, 0.18], color: "#00cc33" },
      // Stream ribbons
      { type: "line", points: [[-2, 0.05, 0.1], [-1, 0.04, 0.15], [0, 0.03, 0.05], [1, 0.04, 0.12], [2, 0.05, 0.08]], color: "#00aaff", opacity: 0.5 },
      // Trail path going up
      { type: "line", points: [[0, 0.05, 0.3], [0.2, 0.1, 0], [0.5, 0.2, -0.3], [1.0, 0.35, -0.6]], opacity: 0.9 },
      // Hiker at gate
      { type: "hiker", position: [0, 0.05, 0.4], pose: "standing", scale: 0.25 },
    ],
    labels: [
      { text: "TRAILHEAD", position: [0, 1.2, 0.3], fontSize: 16, bold: true, letterSpacing: 4 },
      { text: "ALT: 1740M", position: [0, 1.0, 0.3], fontSize: 10, letterSpacing: 2 },
    ],
  },

  // ── 1: West Flower Valley ──
  xihuagou: {
    id: "xihuagou",
    camera: { position: [2, 2, 3], lookAt: [0, 0.2, 0], zoom: 70 },
    animateRotation: 0.06,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(16, 24, valleyProfile), scale: [5, 2, 3] },
      { type: "grid", size: 4, divisions: 16, opacity: 0.1 },
      // Dense forest
      { type: "wireframe-mesh", geometry: "cone", position: [-1.5, 0.3, -0.3], scale: [0.3, 0.7, 0.3], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [-1.0, 0.25, -0.6], scale: [0.25, 0.6, 0.25], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [-0.5, 0.2, -0.4], scale: [0.28, 0.65, 0.28], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [0.5, 0.22, -0.5], scale: [0.26, 0.62, 0.26], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [1.0, 0.28, -0.3], scale: [0.3, 0.7, 0.3], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cone", position: [1.5, 0.32, -0.7], scale: [0.22, 0.55, 0.22], color: "#00cc33" },
      // Wildflower points
      { type: "points", positions: [
        [-0.8, 0.08, 0.2], [-0.3, 0.06, 0.4], [0.2, 0.05, 0.3], [0.7, 0.07, 0.1],
        [-0.5, 0.04, 0.5], [0.4, 0.06, 0.5], [-1.0, 0.09, 0.3], [1.2, 0.08, 0.2],
      ], size: 0.04, color: "#44ff88" },
      // Stream
      { type: "line", points: [[-2, 0.03, 0.2], [-0.5, 0.02, 0.15], [0.5, 0.02, 0.25], [2, 0.03, 0.18]], color: "#00aaff", opacity: 0.5 },
      // Trail
      { type: "line", points: [[-2, 0.06, 0], [-0.5, 0.08, 0.05], [0.5, 0.12, -0.1], [2, 0.25, -0.3]], opacity: 0.8 },
      { type: "hiker", position: [0, 0.06, 0.05], pose: "walking", scale: 0.22 },
    ],
    labels: [
      { text: "XIHUAGOU", position: [0, 1.2, 0], fontSize: 18, bold: true, letterSpacing: 4 },
      { text: "西花沟", position: [0, 1.0, 0], fontSize: 14, letterSpacing: 3 },
    ],
  },

  // ── 2: 2900 Camp ──
  camp_2900: {
    id: "camp_2900",
    camera: { position: [2, 2, 2.5], lookAt: [0, 0.2, 0], zoom: 75 },
    animateRotation: 0.05,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(12, 20, (x, z) => meadowProfile(x, z) + 0.1), scale: [4, 1.5, 2.5] },
      { type: "grid", size: 3, divisions: 12, opacity: 0.1 },
      // Tents
      { type: "wireframe-mesh", geometry: "cone", position: [-0.3, 0.22, 0.2], scale: [0.25, 0.2, 0.2], color: "#00ff41" },
      { type: "wireframe-mesh", geometry: "cone", position: [0.3, 0.22, 0.15], scale: [0.22, 0.18, 0.18], color: "#00ff41" },
      // Campfire ring
      { type: "ring", position: [0, 0.18, 0.3], radius: 0.08, color: "#ff8800", pulse: true },
      // Scattered fire points
      { type: "points", positions: [
        [0, 0.22, 0.3], [-0.02, 0.25, 0.31], [0.02, 0.24, 0.29],
      ], size: 0.03, color: "#ff6600" },
      // Trees behind
      { type: "wireframe-mesh", geometry: "cone", position: [-0.8, 0.28, -0.4], scale: [0.2, 0.5, 0.2], color: "#00aa33" },
      { type: "wireframe-mesh", geometry: "cone", position: [0.7, 0.26, -0.5], scale: [0.22, 0.55, 0.22], color: "#00aa33" },
      // Trail
      { type: "line", points: [[-2, 0.16, 0], [0, 0.18, 0.05], [2, 0.25, -0.2]], opacity: 0.7 },
    ],
    labels: [
      { text: "2900 CAMP", position: [0, 1.0, 0], fontSize: 16, bold: true, letterSpacing: 3 },
      { text: "SHELTER AVAILABLE", position: [0, 0.8, 0], fontSize: 11, color: "#44ff88", animate: "pulse" },
      { text: "+2 FOOD", position: [0.6, 0.6, 0], fontSize: 10, color: "#ffaa00" },
    ],
  },

  // ── 3: Bonsai Garden ──
  penjingyuan: {
    id: "penjingyuan",
    camera: { position: [2.5, 2, 2.5], lookAt: [0, 0.3, 0], zoom: 70 },
    animateRotation: 0.07,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(16, 24, meadowProfile), scale: [5, 2, 3] },
      { type: "grid", size: 4, divisions: 16, opacity: 0.1 },
      // Twisted bonsai trees (bent shapes)
      { type: "wireframe-mesh", geometry: "cylinder", position: [-0.6, 0.2, 0.1], scale: [0.04, 0.35, 0.04], rotation: [0, 0, 0.3] },
      { type: "wireframe-mesh", geometry: "sphere", position: [-0.5, 0.45, 0.15], scale: [0.15, 0.12, 0.15], color: "#00cc33" },
      { type: "wireframe-mesh", geometry: "cylinder", position: [0.4, 0.22, -0.2], scale: [0.03, 0.3, 0.03], rotation: [0, 0, -0.2] },
      { type: "wireframe-mesh", geometry: "sphere", position: [0.45, 0.42, -0.18], scale: [0.12, 0.1, 0.12], color: "#00cc33" },
      // Exposed rocks
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [-1.0, 0.18, -0.3], scale: [0.15, 0.12, 0.13] },
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [0.8, 0.2, 0.3], scale: [0.12, 0.1, 0.11] },
      // Meadow points
      { type: "points", positions: [
        [-0.3, 0.15, 0.3], [0.1, 0.14, 0.4], [0.5, 0.16, 0.2], [-0.7, 0.13, 0.5],
        [0.9, 0.17, 0.4], [-1.2, 0.16, 0.2], [1.1, 0.18, 0.1],
      ], size: 0.025, color: "#44ff88" },
      { type: "hiker", position: [0, 0.14, 0.2], pose: "standing", scale: 0.2 },
    ],
    labels: [
      { text: "BONSAI GARDEN", position: [0, 1.2, 0], fontSize: 16, bold: true, letterSpacing: 3 },
      { text: "盆景园", position: [0, 1.0, 0], fontSize: 14, letterSpacing: 3 },
      { text: "3276M", position: [0, 0.85, 0], fontSize: 10 },
    ],
  },

  // ── 4: Navigation Tower ──
  daohangja: {
    id: "daohangja",
    camera: { position: [2, 2.5, 2], lookAt: [0, 0.5, 0], zoom: 65 },
    animateRotation: 0.06,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => ridgeProfile(x, z, 0.15)), scale: [5, 2.5, 3] },
      { type: "grid", size: 4, divisions: 16, opacity: 0.08 },
      // Navigation tower structure
      { type: "wireframe-mesh", geometry: "cylinder", position: [0, 0.6, 0], scale: [0.08, 0.8, 0.08] },
      { type: "wireframe-mesh", geometry: "octahedron", position: [0, 1.1, 0], scale: [0.15, 0.15, 0.15], color: "#ffaa00" },
      // Tower base platform
      { type: "wireframe-mesh", geometry: "cylinder", position: [0, 0.22, 0], scale: [0.2, 0.04, 0.2] },
      // Wind streaks
      { type: "line", points: [[-2, 0.8, 0.2], [-1, 0.85, 0.15], [0, 0.9, 0.1]], opacity: 0.3 },
      { type: "line", points: [[-1.5, 0.7, -0.1], [-0.5, 0.75, -0.15], [0.5, 0.8, -0.2]], opacity: 0.25 },
      { type: "hiker", position: [-0.4, 0.25, 0.3], pose: "standing", scale: 0.2 },
    ],
    labels: [
      { text: "NAV TOWER", position: [0, 1.6, 0], fontSize: 16, bold: true, letterSpacing: 4 },
      { text: "导航架", position: [0, 1.4, 0], fontSize: 14, letterSpacing: 3 },
      { text: "3431M — RIDGE", position: [0, 1.25, 0], fontSize: 10, color: "#ffaa00" },
    ],
  },

  // ── 5: Medicine King Temple ──
  yaowangmiao: {
    id: "yaowangmiao",
    camera: { position: [2, 2, 2.5], lookAt: [0, 0.3, 0], zoom: 70 },
    animateRotation: 0.05,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => ridgeProfile(x, z, 0.3) * 0.8), scale: [5, 2, 3] },
      { type: "grid", size: 4, divisions: 16, opacity: 0.1 },
      // Temple structure
      { type: "wireframe-mesh", geometry: "box", position: [0, 0.35, 0], scale: [0.5, 0.3, 0.35] },
      { type: "wireframe-mesh", geometry: "cone", position: [0, 0.58, 0], scale: [0.35, 0.2, 0.25], rotation: [0, 0.4, 0] },
      // Stone blocks scattered (stone sea)
      { type: "wireframe-mesh", geometry: "box", position: [-0.8, 0.16, 0.3], scale: [0.12, 0.08, 0.1] },
      { type: "wireframe-mesh", geometry: "box", position: [0.7, 0.18, -0.2], scale: [0.15, 0.1, 0.12] },
      { type: "wireframe-mesh", geometry: "box", position: [-0.4, 0.14, -0.5], scale: [0.1, 0.07, 0.09] },
      { type: "wireframe-mesh", geometry: "box", position: [1.1, 0.17, 0.4], scale: [0.13, 0.09, 0.11] },
      // Shrine glow ring
      { type: "ring", position: [0, 0.22, 0], radius: 0.35, color: "#ffaa00", pulse: true },
      { type: "hiker", position: [0.5, 0.18, 0.4], pose: "standing", scale: 0.2 },
    ],
    labels: [
      { text: "MEDICINE KING TEMPLE", position: [0, 1.3, 0], fontSize: 14, bold: true, letterSpacing: 3 },
      { text: "药王庙", position: [0, 1.1, 0], fontSize: 14, letterSpacing: 3 },
      { text: "STONE SEA — 3327M", position: [0, 0.95, 0], fontSize: 10 },
    ],
  },

  // ── 6: Wheat Straw Ridge ──
  maijianliang: {
    id: "maijianliang",
    camera: { position: [2, 3, 2], lookAt: [0, 0.5, 0], zoom: 60 },
    animateRotation: 0.04,
    elements: [
      // Knife-edge ridge terrain
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => ridgeProfile(x, z, 0.1)), scale: [6, 3, 3] },
      { type: "grid", size: 5, divisions: 20, opacity: 0.06 },
      // Wind streak lines
      { type: "line", points: [[-2.5, 0.9, 0.2], [-1, 0.95, 0.1], [0.5, 1.0, 0], [2, 1.05, -0.1]], opacity: 0.3 },
      { type: "line", points: [[-2, 0.8, -0.1], [-0.5, 0.85, -0.15], [1, 0.9, -0.2]], opacity: 0.25 },
      { type: "line", points: [[-1.5, 1.0, 0.3], [0, 1.05, 0.2], [1.5, 1.1, 0.15]], opacity: 0.2 },
      // Hiker on ridge
      { type: "hiker", position: [0, 0.4, 0], pose: "walking", scale: 0.2 },
    ],
    labels: [
      { text: "WHEAT STRAW RIDGE", position: [0, 1.8, 0], fontSize: 16, bold: true, letterSpacing: 3 },
      { text: "麦秸岭", position: [0, 1.6, 0], fontSize: 14, letterSpacing: 3 },
      { text: "DANGER: EXPOSED RIDGE", position: [0, 1.4, 0], fontSize: 11, color: "#ff4400", animate: "blink" },
      { text: "3528M", position: [0, 1.25, 0], fontSize: 10 },
    ],
  },

  // ── 7: Water Pit Camp ──
  shuiwozi: {
    id: "shuiwozi",
    camera: { position: [2, 2, 2.5], lookAt: [0, 0.2, 0], zoom: 72 },
    animateRotation: 0.06,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(14, 20, meadowProfile), scale: [4.5, 1.5, 2.5] },
      { type: "grid", size: 3.5, divisions: 14, opacity: 0.1 },
      // Tents
      { type: "wireframe-mesh", geometry: "cone", position: [-0.4, 0.18, 0.15], scale: [0.22, 0.18, 0.18] },
      { type: "wireframe-mesh", geometry: "cone", position: [0.2, 0.19, 0.2], scale: [0.2, 0.16, 0.16] },
      // Water source (stream lines)
      { type: "line", points: [[-1.5, 0.06, 0.5], [-0.5, 0.05, 0.45], [0.5, 0.04, 0.5], [1.5, 0.05, 0.48]], color: "#00aaff", opacity: 0.6 },
      { type: "line", points: [[-1.2, 0.05, 0.55], [0, 0.04, 0.52], [1.2, 0.05, 0.54]], color: "#0088dd", opacity: 0.4 },
      // Campfire
      { type: "ring", position: [0, 0.16, 0.3], radius: 0.06, color: "#ff8800", pulse: true },
      { type: "hiker", position: [0.4, 0.15, 0.35], pose: "standing", scale: 0.2 },
    ],
    labels: [
      { text: "WATER PIT CAMP", position: [0, 1.0, 0], fontSize: 16, bold: true, letterSpacing: 3 },
      { text: "水窝子", position: [0, 0.85, 0], fontSize: 14, letterSpacing: 3 },
      { text: "WATER RESUPPLY", position: [0, 0.7, 0], fontSize: 11, color: "#00aaff", animate: "pulse" },
      { text: "+2 FOOD", position: [0.5, 0.55, 0], fontSize: 10, color: "#ffaa00" },
    ],
  },

  // ── 8: Airplane Ridge ──
  feijiliang: {
    id: "feijiliang",
    camera: { position: [2.5, 2.5, 2], lookAt: [0, 0.4, 0], zoom: 65 },
    animateRotation: 0.05,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => ridgeProfile(x, z, 0.2) * 0.9 + 0.1), scale: [5, 2.5, 3] },
      { type: "grid", size: 4, divisions: 16, opacity: 0.08 },
      // Scattered scree rocks
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [-0.5, 0.3, 0.2], scale: [0.08, 0.06, 0.07] },
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [0.3, 0.32, -0.1], scale: [0.1, 0.07, 0.09] },
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [-0.2, 0.28, -0.3], scale: [0.07, 0.05, 0.06] },
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [0.8, 0.35, 0.1], scale: [0.09, 0.06, 0.08] },
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [-0.9, 0.26, 0.4], scale: [0.06, 0.05, 0.07] },
      // Steep trail
      { type: "line", points: [[-2, 0.2, 0], [-0.5, 0.3, 0.05], [0.5, 0.4, -0.05], [2, 0.55, -0.1]], opacity: 0.8 },
      { type: "hiker", position: [0, 0.32, 0.1], pose: "walking", scale: 0.18 },
    ],
    labels: [
      { text: "AIRPLANE RIDGE", position: [0, 1.5, 0], fontSize: 16, bold: true, letterSpacing: 3 },
      { text: "飞机梁", position: [0, 1.3, 0], fontSize: 14, letterSpacing: 3 },
      { text: "SCREE — 3400M", position: [0, 1.15, 0], fontSize: 10 },
    ],
  },

  // ── 9: 2800 Camp ──
  camp_2800: {
    id: "camp_2800",
    camera: { position: [2, 2, 2.5], lookAt: [0, 0.2, 0], zoom: 72 },
    animateRotation: 0.05,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(14, 20, (x, z) => meadowProfile(x, z) * 0.8), scale: [4.5, 1.5, 2.5] },
      { type: "grid", size: 3.5, divisions: 14, opacity: 0.1 },
      // Tents
      { type: "wireframe-mesh", geometry: "cone", position: [-0.3, 0.14, 0.15], scale: [0.2, 0.16, 0.16] },
      { type: "wireframe-mesh", geometry: "cone", position: [0.25, 0.15, 0.2], scale: [0.18, 0.14, 0.14] },
      // Campfire
      { type: "ring", position: [0, 0.12, 0.25], radius: 0.06, color: "#ff8800", pulse: true },
      // Descending terrain path
      { type: "line", points: [[-1.5, 0.2, 0], [0, 0.14, 0.05], [1.5, 0.08, 0.1]], opacity: 0.7 },
      { type: "hiker", position: [0.3, 0.12, 0.3], pose: "standing", scale: 0.2 },
    ],
    labels: [
      { text: "2800 CAMP", position: [0, 0.9, 0], fontSize: 16, bold: true, letterSpacing: 3 },
      { text: "SHELTER AVAILABLE", position: [0, 0.75, 0], fontSize: 11, color: "#44ff88", animate: "pulse" },
      { text: "POINT OF NO RETURN AHEAD", position: [0, 0.55, 0], fontSize: 10, color: "#ff4400", animate: "blink" },
      { text: "+2 FOOD", position: [0.5, 0.4, 0], fontSize: 10, color: "#ffaa00" },
    ],
  },

  // ── 10: South Heaven Gate ──
  nantianmen: {
    id: "nantianmen",
    camera: { position: [2, 2.5, 2], lookAt: [0, 0.5, 0], zoom: 65 },
    animateRotation: 0.06,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => ridgeProfile(x, z, 0.12)), scale: [5, 2.5, 3] },
      { type: "grid", size: 4, divisions: 16, opacity: 0.08 },
      // Two tall rock pillars forming gate
      { type: "wireframe-mesh", geometry: "box", position: [-0.35, 0.6, 0.1], scale: [0.15, 0.8, 0.12] },
      { type: "wireframe-mesh", geometry: "box", position: [0.35, 0.55, 0.1], scale: [0.15, 0.7, 0.12] },
      // Ridge path through gate
      { type: "line", points: [[-1.5, 0.3, 0.1], [-0.5, 0.35, 0.1], [0, 0.38, 0.1], [0.5, 0.35, 0.1], [1.5, 0.3, 0.1]], opacity: 0.8 },
      { type: "hiker", position: [-0.5, 0.33, 0.15], pose: "walking", scale: 0.18 },
    ],
    labels: [
      { text: "SOUTH HEAVEN GATE", position: [0, 1.6, 0], fontSize: 16, bold: true, letterSpacing: 3 },
      { text: "南天门", position: [0, 1.4, 0], fontSize: 14, letterSpacing: 3 },
      { text: "NO RETREAT BEYOND", position: [0, 1.2, 0], fontSize: 11, color: "#ff4400", animate: "blink" },
      { text: "3300M", position: [0, 1.05, 0], fontSize: 10 },
    ],
  },

  // ── 11: Taibai Ridge ──
  taibailiang: {
    id: "taibailiang",
    camera: { position: [2, 3, 2], lookAt: [0, 0.6, 0], zoom: 60 },
    animateRotation: 0.04,
    elements: [
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => ridgeProfile(x, z, 0.12) * 1.1), scale: [6, 3, 3] },
      { type: "grid", size: 5, divisions: 20, opacity: 0.06 },
      // Wind streaks
      { type: "line", points: [[-2.5, 1.1, 0.2], [-1, 1.15, 0.1], [1, 1.2, 0]], opacity: 0.25 },
      { type: "line", points: [[-2, 1.0, -0.2], [0, 1.05, -0.25], [2, 1.1, -0.3]], opacity: 0.2 },
      // Cloud line points below
      { type: "points", positions: [
        [-2, 0.3, 1], [-1, 0.25, 1.2], [0, 0.28, 1.1], [1, 0.22, 1.3], [2, 0.3, 1.0],
        [-1.5, 0.2, 1.4], [0.5, 0.18, 1.5], [1.5, 0.25, 1.2],
      ], size: 0.06, color: "#88aacc", opacity: 0.3 },
      { type: "hiker", position: [0, 0.5, 0], pose: "walking", scale: 0.18 },
    ],
    labels: [
      { text: "TAIBAI RIDGE", position: [0, 1.8, 0], fontSize: 16, bold: true, letterSpacing: 4 },
      { text: "太白梁", position: [0, 1.6, 0], fontSize: 14, letterSpacing: 3 },
      { text: "SUMMIT AHEAD", position: [0, 1.4, 0], fontSize: 12, color: "#ffaa00", animate: "pulse" },
      { text: "3523M", position: [0, 1.25, 0], fontSize: 10 },
    ],
  },

  // ── 12: Baxian Platform (Summit) ──
  baxiantai: {
    id: "baxiantai",
    camera: { position: [2, 3, 2.5], lookAt: [0, 0.8, 0], zoom: 55 },
    animateRotation: 0.03,
    elements: [
      // Summit terrain
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => {
        const peak = Math.exp(-((x - 0.7) ** 2 + (z - 0.5) ** 2) / 0.08) * 0.6;
        const ridge = ridgeProfile(x, z, 0.15);
        return Math.max(peak, ridge) + 0.1;
      }), scale: [6, 3.5, 3.5] },
      { type: "grid", size: 5, divisions: 20, opacity: 0.06 },
      // Summit beacon
      { type: "wireframe-mesh", geometry: "cylinder", position: [0.8, 1.2, 0], scale: [0.05, 1.0, 0.05] },
      { type: "wireframe-mesh", geometry: "sphere", position: [0.8, 1.8, 0], scale: [0.12, 0.12, 0.12], color: "#ffaa00" },
      // Victory glow ring
      { type: "ring", position: [0.8, 0.75, 0], radius: 0.4, color: "#ffcc00", pulse: true },
      // Panoramic mountain silhouettes below
      { type: "line", points: [[-3, 0.3, -1.5], [-2, 0.5, -1.3], [-1, 0.35, -1.4], [0, 0.55, -1.2], [1, 0.4, -1.5], [2, 0.6, -1.3], [3, 0.35, -1.4]], opacity: 0.3 },
      { type: "hiker", position: [0.8, 0.75, 0.2], pose: "standing", scale: 0.2 },
    ],
    labels: [
      { text: "BAXIAN PLATFORM", position: [0.8, 2.3, 0], fontSize: 18, bold: true, letterSpacing: 4, color: "#ffcc00" },
      { text: "拔仙台", position: [0.8, 2.05, 0], fontSize: 16, letterSpacing: 4, color: "#ffcc00" },
      { text: "THE ROOF OF QINLING", position: [0.8, 1.85, 0], fontSize: 11, color: "#ffcc00", animate: "pulse" },
      { text: "3767M — SUMMIT", position: [0.8, 1.7, 0], fontSize: 10, color: "#ffaa00" },
    ],
  },
};

// ═══════════════════════════════════════════════
// EVENT SCENES (12 critical events)
// ═══════════════════════════════════════════════

const eventScenes: Record<string, VectorSceneDef> = {
  // ── Fall/Drop ──
  fall_drop: {
    id: "fall_drop",
    camera: { position: [1.5, 2, 2.5], lookAt: [0, 0.5, 0], zoom: 75 },
    accentColor: "#ff4400",
    elements: [
      // Slope terrain
      { type: "terrain", heightmap: generateHeightmap(12, 16, (x, z) => x * 0.6 + Math.sin(z * 4) * 0.05), scale: [4, 2, 2] },
      { type: "grid", size: 3, divisions: 12, opacity: 0.1 },
      // Motion ghosts tumbling down slope
      { type: "motion-ghosts", path: [
        [0.8, 1.0, 0], [0.4, 0.7, 0.1], [0, 0.4, 0.15], [-0.4, 0.2, 0.1], [-0.8, 0.05, 0],
      ], count: 4 },
      // Impact lines
      { type: "line", points: [[0.8, 1.0, 0], [-0.8, 0.05, 0]], color: "#ff4400", opacity: 0.4 },
    ],
    labels: [
      { text: "UNCONTROLLED DESCENT", position: [0, 1.5, 0], fontSize: 16, bold: true, color: "#ff4400", animate: "blink", letterSpacing: 3 },
      { text: "FALL DETECTED", position: [0, 1.3, 0], fontSize: 12, color: "#ff4400" },
    ],
  },

  // ── Altitude Sickness ──
  altitude_sickness: {
    id: "altitude_sickness",
    camera: { position: [1, 1.5, 2], lookAt: [0, 0.5, 0], zoom: 85 },
    accentColor: "#ffaa00",
    elements: [
      { type: "grid", size: 2, divisions: 8, opacity: 0.1 },
      { type: "hiker", position: [0, 0, 0], pose: "hunched", scale: 0.5 },
      // Dizziness rings around head
      { type: "ring", position: [0, 1.0, 0], radius: 0.2, color: "#ffaa00", pulse: true },
      { type: "ring", position: [0, 1.0, 0], radius: 0.35, color: "#ffaa00", pulse: true },
      { type: "ring", position: [0, 1.0, 0], radius: 0.5, color: "#ff6600", pulse: true },
    ],
    labels: [
      { text: "ALTITUDE SICKNESS", position: [0, 1.6, 0], fontSize: 16, bold: true, color: "#ffaa00", letterSpacing: 3 },
      { text: "O2 LEVEL: CRITICAL", position: [0, 1.4, 0], fontSize: 11, color: "#ff4400", animate: "blink" },
    ],
  },

  // ── Hypothermia ──
  hypothermia_onset: {
    id: "hypothermia_onset",
    camera: { position: [1, 1.5, 2], lookAt: [0, 0.3, 0], zoom: 85 },
    accentColor: "#4488ff",
    elements: [
      { type: "grid", size: 2, divisions: 8, opacity: 0.1 },
      { type: "hiker", position: [0, 0, 0], pose: "curled", scale: 0.5 },
      // Ice crystal points
      { type: "points", positions: [
        [-0.5, 0.3, 0.3], [0.4, 0.5, -0.2], [-0.3, 0.7, 0.1], [0.6, 0.2, 0.4],
        [-0.6, 0.6, -0.3], [0.3, 0.8, 0.2], [-0.2, 0.1, -0.4], [0.5, 0.4, -0.1],
      ], size: 0.04, color: "#4488ff" },
      // Cold aura ring
      { type: "ring", position: [0, 0.3, 0], radius: 0.6, color: "#4488ff", pulse: true },
    ],
    labels: [
      { text: "HYPOTHERMIA ONSET", position: [0, 1.3, 0], fontSize: 16, bold: true, color: "#4488ff", letterSpacing: 3 },
      { text: "CORE TEMP: DROPPING", position: [0, 1.1, 0], fontSize: 11, color: "#4488ff", animate: "blink" },
    ],
  },

  // ── Equipment Failure ──
  equipment_failure: {
    id: "equipment_failure",
    camera: { position: [1.5, 1.5, 2], lookAt: [0, 0.3, 0], zoom: 80 },
    accentColor: "#ff4400",
    elements: [
      { type: "grid", size: 2.5, divisions: 10, opacity: 0.1 },
      // Scattered gear wireframes
      { type: "wireframe-mesh", geometry: "box", position: [-0.4, 0.1, 0.2], scale: [0.2, 0.15, 0.12], rotation: [0.3, 0.5, 0.2] },
      { type: "wireframe-mesh", geometry: "cylinder", position: [0.3, 0.08, -0.1], scale: [0.08, 0.25, 0.08], rotation: [0.8, 0, 0.3] },
      { type: "wireframe-mesh", geometry: "box", position: [0, 0.06, 0.4], scale: [0.15, 0.1, 0.1], rotation: [-0.2, 0.3, 0.6] },
      { type: "wireframe-mesh", geometry: "sphere", position: [-0.2, 0.05, -0.3], scale: [0.06, 0.06, 0.06] },
      // Broken line segments
      { type: "line", points: [[-0.5, 0.15, 0.1], [-0.2, 0.2, 0], [0.1, 0.12, -0.1]], color: "#ff4400", opacity: 0.5 },
      { type: "line", points: [[0.2, 0.18, 0.2], [0.4, 0.1, 0.3]], color: "#ff4400", opacity: 0.4 },
      { type: "hiker", position: [0, 0, 0], pose: "hunched", scale: 0.4 },
    ],
    labels: [
      { text: "EQUIPMENT FAILURE", position: [0, 1.2, 0], fontSize: 16, bold: true, color: "#ff4400", letterSpacing: 3 },
      { text: "GEAR INTEGRITY: 0%", position: [0, 1.0, 0], fontSize: 12, color: "#ff4400", animate: "blink" },
    ],
  },

  // ── Lost in Fog ──
  lost_in_fog: {
    id: "lost_in_fog",
    camera: { position: [1, 1.5, 2], lookAt: [0, 0.4, 0], zoom: 80 },
    elements: [
      { type: "grid", size: 2.5, divisions: 10, opacity: 0.06 },
      { type: "hiker", position: [0, 0, 0], pose: "standing", scale: 0.45 },
      // Fog layers (horizontal lines at different depths)
      { type: "line", points: [[-1.5, 0.3, 0.5], [-0.5, 0.35, 0.6], [0.5, 0.3, 0.5], [1.5, 0.35, 0.55]], opacity: 0.2 },
      { type: "line", points: [[-1.2, 0.5, -0.3], [0, 0.55, -0.4], [1.2, 0.5, -0.3]], opacity: 0.15 },
      { type: "line", points: [[-1, 0.7, 0.2], [0.5, 0.75, 0.3], [1.5, 0.7, 0.2]], opacity: 0.1 },
      // Compass with spinning indicator
      { type: "ring", position: [0.6, 0.8, 0], radius: 0.15, color: "#ffaa00", pulse: true },
    ],
    labels: [
      { text: "LOST IN FOG", position: [0, 1.4, 0], fontSize: 16, bold: true, letterSpacing: 4 },
      { text: "?", position: [0, 1.0, 0], fontSize: 28, bold: true, color: "#ffaa00", animate: "blink" },
      { text: "NAVIGATION COMPROMISED", position: [0, 1.2, 0], fontSize: 10, color: "#ffaa00" },
    ],
  },

  // ── Frostbite ──
  frostbite: {
    id: "frostbite",
    camera: { position: [0.5, 1, 2], lookAt: [0, 0.3, 0], zoom: 100 },
    accentColor: "#ff6600",
    elements: [
      { type: "grid", size: 1.5, divisions: 6, opacity: 0.08 },
      // Foot/hand wireframe outlines
      // Simplified foot shape
      { type: "line", points: [[-0.2, 0.05, 0], [-0.15, 0.12, 0], [-0.1, 0.18, 0], [0, 0.2, 0], [0.1, 0.18, 0], [0.15, 0.15, 0], [0.2, 0.08, 0], [0.2, 0.03, 0], [-0.2, 0.03, 0], [-0.2, 0.05, 0]], opacity: 0.7 },
      // Toe outlines
      { type: "line", points: [[-0.15, 0.2, 0], [-0.12, 0.24, 0]], opacity: 0.5 },
      { type: "line", points: [[-0.05, 0.22, 0], [-0.03, 0.27, 0]], opacity: 0.5 },
      { type: "line", points: [[0.05, 0.21, 0], [0.07, 0.26, 0]], opacity: 0.5 },
      { type: "line", points: [[0.12, 0.18, 0], [0.14, 0.23, 0]], opacity: 0.5 },
      // Pain rings at extremities
      { type: "ring", position: [-0.1, 0.25, 0], radius: 0.06, color: "#ff6600", pulse: true },
      { type: "ring", position: [0.05, 0.25, 0], radius: 0.06, color: "#ff6600", pulse: true },
      { type: "ring", position: [0.15, 0.08, 0], radius: 0.05, color: "#ff4400", pulse: true },
      // Hand outline (offset right)
      { type: "line", points: [[0.5, 0.1, 0], [0.5, 0.25, 0], [0.45, 0.35, 0], [0.42, 0.4, 0]], opacity: 0.5 },
      { type: "line", points: [[0.5, 0.25, 0], [0.48, 0.38, 0]], opacity: 0.5 },
      { type: "line", points: [[0.5, 0.25, 0], [0.52, 0.38, 0]], opacity: 0.5 },
      { type: "line", points: [[0.5, 0.25, 0], [0.55, 0.35, 0]], opacity: 0.5 },
      { type: "ring", position: [0.48, 0.38, 0], radius: 0.04, color: "#ff6600", pulse: true },
    ],
    labels: [
      { text: "FROSTBITE DETECTED", position: [0.2, 0.6, 0], fontSize: 14, bold: true, color: "#ff6600", letterSpacing: 3 },
      { text: "EXTREMITY DAMAGE", position: [0.2, 0.5, 0], fontSize: 10, color: "#ff4400", animate: "blink" },
    ],
  },

  // ── Whiteout ──
  sudden_whiteout: {
    id: "sudden_whiteout",
    camera: { position: [0.5, 1, 2], lookAt: [0, 0.3, 0], zoom: 80 },
    elements: [
      // Dense point cloud (whiteout particles)
      { type: "points", positions: Array.from({ length: 40 }, () => [
        (Math.random() - 0.5) * 2,
        Math.random() * 1.2,
        (Math.random() - 0.5) * 2,
      ] as [number, number, number]), size: 0.03, opacity: 0.3 },
      // Faint hiker outline
      { type: "hiker", position: [0, 0, 0], pose: "hunched", scale: 0.4, color: "#00ff4133" },
    ],
    labels: [
      { text: "WHITEOUT", position: [0, 1.2, 0], fontSize: 20, bold: true, letterSpacing: 6, animate: "blink" },
      { text: "VISIBILITY: 0M", position: [0, 1.0, 0], fontSize: 12, color: "#ff4400", animate: "blink" },
    ],
  },

  // ── Pulmonary Edema ──
  pulmonary_edema: {
    id: "pulmonary_edema",
    camera: { position: [0.5, 1, 2], lookAt: [0, 0.4, 0], zoom: 90 },
    accentColor: "#ff4400",
    elements: [
      { type: "grid", size: 1.5, divisions: 6, opacity: 0.08 },
      // Torso wireframe (cross-section view)
      { type: "line", points: [[-0.3, 0.1, 0], [-0.35, 0.3, 0], [-0.3, 0.5, 0], [-0.2, 0.65, 0], [0, 0.7, 0], [0.2, 0.65, 0], [0.3, 0.5, 0], [0.35, 0.3, 0], [0.3, 0.1, 0], [-0.3, 0.1, 0]], opacity: 0.6 },
      // Lung outlines (left)
      { type: "line", points: [[-0.22, 0.25, 0], [-0.25, 0.35, 0], [-0.22, 0.5, 0], [-0.12, 0.55, 0], [-0.08, 0.45, 0], [-0.08, 0.3, 0], [-0.12, 0.22, 0], [-0.22, 0.25, 0]], color: "#ff4400", opacity: 0.7 },
      // Lung outlines (right)
      { type: "line", points: [[0.22, 0.25, 0], [0.25, 0.35, 0], [0.22, 0.5, 0], [0.12, 0.55, 0], [0.08, 0.45, 0], [0.08, 0.3, 0], [0.12, 0.22, 0], [0.22, 0.25, 0]], color: "#ff4400", opacity: 0.7 },
      // Distress rings on lungs
      { type: "ring", position: [-0.15, 0.4, 0], radius: 0.1, color: "#ff4400", pulse: true },
      { type: "ring", position: [0.15, 0.4, 0], radius: 0.1, color: "#ff4400", pulse: true },
    ],
    labels: [
      { text: "MEDICAL ALERT", position: [0, 0.95, 0], fontSize: 14, bold: true, color: "#ff4400", letterSpacing: 3, animate: "blink" },
      { text: "PULMONARY EDEMA", position: [0, 0.85, 0], fontSize: 12, color: "#ff4400" },
    ],
  },

  // ── Beautiful Vista ──
  beautiful_vista: {
    id: "beautiful_vista",
    camera: { position: [2, 2.5, 3], lookAt: [0, 0.5, 0], zoom: 55 },
    animateRotation: 0.03,
    elements: [
      // Ridge terrain
      { type: "terrain", heightmap: generateHeightmap(16, 24, (x, z) => ridgeProfile(x, z, 0.2) * 0.8), scale: [6, 2, 3] },
      // Panoramic mountain silhouettes
      { type: "line", points: [[-3, 0.8, -1.5], [-2, 1.2, -1.3], [-1.5, 0.9, -1.4], [-0.5, 1.3, -1.2], [0, 1.0, -1.5], [0.5, 1.4, -1.1], [1.5, 1.0, -1.3], [2.5, 1.3, -1.4], [3, 0.9, -1.5]], opacity: 0.4 },
      { type: "line", points: [[-3, 0.5, -2], [-1.5, 0.7, -1.8], [0, 0.6, -2], [1.5, 0.8, -1.9], [3, 0.5, -2]], opacity: 0.2 },
      // Hiker on ridge edge
      { type: "hiker", position: [0, 0.4, 0.3], pose: "standing", scale: 0.25 },
    ],
    labels: [
      { text: "BEAUTIFUL VISTA", position: [0, 2.0, 0], fontSize: 18, bold: true, color: "#44ff88", letterSpacing: 4 },
      { text: "MORALE +20", position: [0, 1.8, 0], fontSize: 14, color: "#44ff88", animate: "pulse" },
    ],
  },

  // ── Found Water ──
  found_water: {
    id: "found_water",
    camera: { position: [1, 1.5, 2], lookAt: [0, 0.2, 0], zoom: 85 },
    elements: [
      { type: "grid", size: 2, divisions: 8, opacity: 0.1 },
      // Stream lines
      { type: "line", points: [[-1, 0.02, 0.3], [-0.3, 0.01, 0.25], [0.3, 0.01, 0.3], [1, 0.02, 0.28]], color: "#00aaff", opacity: 0.7 },
      { type: "line", points: [[-0.8, 0.01, 0.35], [0, 0.005, 0.32], [0.8, 0.01, 0.34]], color: "#0088dd", opacity: 0.5 },
      // Water container wireframe
      { type: "wireframe-mesh", geometry: "cylinder", position: [0, 0.12, 0], scale: [0.06, 0.2, 0.06] },
      { type: "wireframe-mesh", geometry: "sphere", position: [0, 0.24, 0], scale: [0.07, 0.04, 0.07] },
      // Hiker kneeling-ish
      { type: "hiker", position: [-0.3, 0, 0.1], pose: "hunched", scale: 0.4 },
      // Water splash points
      { type: "points", positions: [
        [0.05, 0.05, 0.28], [-0.05, 0.04, 0.3], [0.1, 0.06, 0.25],
      ], size: 0.03, color: "#00aaff" },
    ],
    labels: [
      { text: "WATER SOURCE FOUND", position: [0, 1.0, 0], fontSize: 14, bold: true, color: "#00aaff", letterSpacing: 3 },
      { text: "HYDRATION RESTORED", position: [0, 0.85, 0], fontSize: 11, color: "#00aaff", animate: "pulse" },
    ],
  },

  // ── Knee Injury ──
  knee_injury: {
    id: "knee_injury",
    camera: { position: [0.5, 1, 2], lookAt: [0, 0.35, 0], zoom: 95 },
    accentColor: "#ff6600",
    elements: [
      { type: "grid", size: 1.5, divisions: 6, opacity: 0.08 },
      // Leg wireframe (side view)
      // Thigh
      { type: "line", points: [[0, 0.7, 0], [0, 0.45, 0.02]], opacity: 0.7 },
      // Shin
      { type: "line", points: [[0, 0.45, 0.02], [0.02, 0.1, 0], [0.05, 0, 0.1]], opacity: 0.7 },
      // Knee joint detail
      { type: "ring", position: [0, 0.45, 0.02], radius: 0.08, color: "#ff6600", pulse: true },
      { type: "ring", position: [0, 0.45, 0.02], radius: 0.12, color: "#ff4400", pulse: true },
      // Bone outlines
      { type: "line", points: [[-0.02, 0.68, 0], [-0.02, 0.47, 0], [0.02, 0.47, 0], [0.02, 0.68, 0]], opacity: 0.4 },
      { type: "line", points: [[-0.02, 0.43, 0.02], [0, 0.12, 0], [0.04, 0.12, 0], [0.02, 0.43, 0.02]], opacity: 0.4 },
    ],
    labels: [
      { text: "KNEE INJURY", position: [0, 0.95, 0], fontSize: 16, bold: true, color: "#ff6600", letterSpacing: 3 },
      { text: "MOBILITY IMPAIRED", position: [0, 0.85, 0], fontSize: 11, color: "#ff4400", animate: "blink" },
    ],
  },

  // ── Trail Collapse ──
  trail_collapse: {
    id: "trail_collapse",
    camera: { position: [1.5, 2, 2.5], lookAt: [0, 0.3, 0], zoom: 70 },
    accentColor: "#ff4400",
    elements: [
      { type: "grid", size: 3, divisions: 12, opacity: 0.08 },
      // Fractured ground (broken grid lines)
      { type: "line", points: [[-1, 0.15, 0.2], [-0.3, 0.12, 0.18], [-0.1, 0.05, 0.2]], opacity: 0.6 },
      { type: "line", points: [[0.1, 0.08, 0.15], [0.5, 0.02, 0.2], [1, -0.05, 0.18]], opacity: 0.5, color: "#ff4400" },
      { type: "line", points: [[-0.5, 0.1, -0.1], [0, 0, -0.05], [0.3, -0.08, 0]], opacity: 0.4, color: "#ff4400" },
      // Falling rocks (motion lines)
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [0.2, -0.1, 0.2], scale: [0.06, 0.05, 0.06], color: "#ff4400" },
      { type: "wireframe-mesh", geometry: "dodecahedron", position: [-0.1, -0.15, 0.15], scale: [0.04, 0.04, 0.04], color: "#ff4400" },
      { type: "line", points: [[0.2, 0.1, 0.2], [0.2, -0.1, 0.2]], color: "#ff4400", opacity: 0.3 },
      { type: "line", points: [[-0.1, 0.08, 0.15], [-0.1, -0.15, 0.15]], color: "#ff4400", opacity: 0.25 },
      // Hiker jumping back
      { type: "hiker", position: [-0.6, 0.15, 0.2], pose: "walking", scale: 0.3 },
    ],
    labels: [
      { text: "TRAIL COLLAPSE", position: [0, 1.0, 0], fontSize: 16, bold: true, color: "#ff4400", letterSpacing: 3, animate: "blink" },
      { text: "STRUCTURAL FAILURE", position: [0, 0.85, 0], fontSize: 11, color: "#ff4400" },
    ],
  },
};

// ═══════════════════════════════════════════════
// LOOKUP FUNCTIONS
// ═══════════════════════════════════════════════

// Waypoint ID → scene ID mapping
const WAYPOINT_SCENE_MAP: Record<string, string> = {
  tangkou: "tangkou",
  xihuagou: "xihuagou",
  camp_2900: "camp_2900",
  penjingyuan: "penjingyuan",
  daohangja: "daohangja",
  yaowangmiao: "yaowangmiao",
  maijianliang: "maijianliang",
  shuiwozi: "shuiwozi",
  feijiliang: "feijiliang",
  camp_2800: "camp_2800",
  nantianmen: "nantianmen",
  taibailiang: "taibailiang",
  baxiantai: "baxiantai",
};

/**
 * Get a scene definition by type and ID.
 * Falls back to a generic scene if no specific one exists.
 */
// Event ID aliases (multiple game event IDs can map to one scene)
const EVENT_ALIAS: Record<string, string> = {
  whiteout_event: "sudden_whiteout",
  ankle_sprain: "knee_injury",        // similar injury art
};

export function getSceneDef(type: "location" | "event", id: string): VectorSceneDef | null {
  if (type === "location") {
    const sceneId = WAYPOINT_SCENE_MAP[id] || id;
    return locationScenes[sceneId] || null;
  }
  const resolvedId = EVENT_ALIAS[id] || id;
  return eventScenes[resolvedId] || null;
}

/**
 * Get all event IDs that have scene definitions (including aliases).
 */
export function getEventSceneIds(): string[] {
  return [...Object.keys(eventScenes), ...Object.keys(EVENT_ALIAS)];
}
