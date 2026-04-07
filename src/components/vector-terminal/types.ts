/**
 * Vector Terminal — Type definitions for CRT vector art popup scenes.
 *
 * Scene definitions are pure data objects that the VectorScene renderer
 * interprets into Three.js geometry. No React/Three imports here.
 */

// ── Popup request (dispatched from game store) ──

export interface PopupRequest {
  type: "location" | "event";
  id: string;              // waypoint id or event id
  title: string;           // Main title (e.g. "TANGKOU" or "ALTITUDE SICKNESS")
  titleCN?: string;        // Chinese subtitle (e.g. "塘口")
  subtitle: string;        // Metadata line (e.g. "ALT: 1740M | TERRAIN: STREAM VALLEY")
  timestamp: number;       // For dedup
}

// ── Scene definition ──

export interface VectorSceneDef {
  id: string;
  camera: {
    position: [number, number, number];
    lookAt: [number, number, number];
    zoom?: number;
  };
  elements: VectorElement[];
  labels: VectorLabel[];
  accentColor?: string;       // Override green phosphor for warnings (amber/red)
  animateRotation?: number;   // Slow Y-rotation speed (rad/s), 0 = static
}

// ── Geometry primitives ──

export type VectorElement =
  | VectorTerrain
  | VectorLine
  | VectorWireframeMesh
  | VectorPoints
  | VectorRing
  | VectorHiker
  | VectorMotionGhosts
  | VectorGrid;

export interface VectorTerrain {
  type: "terrain";
  heightmap: number[][];     // 2D array of elevation values (0-1)
  position?: [number, number, number];
  scale?: [number, number, number];
  color?: string;
}

export interface VectorLine {
  type: "line";
  points: [number, number, number][];
  color?: string;
  opacity?: number;
  dashed?: boolean;
}

export interface VectorWireframeMesh {
  type: "wireframe-mesh";
  geometry: "cone" | "cylinder" | "box" | "sphere" | "octahedron" | "torus" | "dodecahedron";
  position: [number, number, number];
  scale: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  opacity?: number;
}

export interface VectorPoints {
  type: "points";
  positions: [number, number, number][];
  size: number;
  color?: string;
  opacity?: number;
}

export interface VectorRing {
  type: "ring";
  position: [number, number, number];
  radius: number;
  innerRadius?: number;
  color?: string;
  pulse?: boolean;        // Animate scale pulsing
  rotation?: [number, number, number];
}

export interface VectorHiker {
  type: "hiker";
  position: [number, number, number];
  scale?: number;
  color?: string;
  pose?: "standing" | "hunched" | "curled" | "walking" | "fallen";
}

export interface VectorMotionGhosts {
  type: "motion-ghosts";
  path: [number, number, number][];   // Positions along motion path
  count: number;                       // Number of ghost copies
  color?: string;
}

export interface VectorGrid {
  type: "grid";
  size: number;
  divisions: number;
  position?: [number, number, number];
  color?: string;
  opacity?: number;
}

// ── Labels ──

export interface VectorLabel {
  text: string;
  position: [number, number, number];
  fontSize?: number;        // px, default 14
  color?: string;
  bold?: boolean;
  animate?: "blink" | "pulse" | "none";
  letterSpacing?: number;   // px
}
