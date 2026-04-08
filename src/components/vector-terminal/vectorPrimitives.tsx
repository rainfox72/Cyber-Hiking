/**
 * VectorPrimitives — Reusable Three.js components for CRT vector art.
 *
 * All rendered as wireframe/line geometry in green phosphor style.
 * No lighting needed — everything is MeshBasicMaterial (self-lit).
 */

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type {
  VectorTerrain,
  VectorLine,
  VectorWireframeMesh,
  VectorPoints,
  VectorRing,
  VectorHiker,
  VectorMotionGhosts,
  VectorGrid,
} from "./types.ts";

const GREEN = "#00ff41";

// ── Wireframe terrain from heightmap (grid-line edges only, no diagonals) ──

export function TerrainPrimitive({
  heightmap,
  position = [0, 0, 0],
  scale = [4, 1, 2],
  color = GREEN,
}: VectorTerrain) {
  const lineObj = useMemo(() => {
    const rows = heightmap.length;
    const cols = heightmap[0].length;

    // Build vertex grid
    const verts: [number, number, number][] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c / (cols - 1)) - 0.5;
        const y = heightmap[r][c];
        const z = (r / (rows - 1)) - 0.5;
        verts.push([x, y, z]);
      }
    }

    // Build edge pairs (horizontal + vertical lines only — no diagonals)
    const edgePositions: number[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        // Horizontal edge (to right neighbor)
        if (c < cols - 1) {
          const right = idx + 1;
          edgePositions.push(...verts[idx], ...verts[right]);
        }
        // Vertical edge (to bottom neighbor)
        if (r < rows - 1) {
          const below = idx + cols;
          edgePositions.push(...verts[idx], ...verts[below]);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));

    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });

    return new THREE.LineSegments(geo, mat);
  }, [heightmap, color]);

  return (
    <primitive object={lineObj} position={position} scale={scale} />
  );
}

// ── Line path ──

export function LinePrimitive({
  points,
  color = GREEN,
  opacity = 0.8,
}: VectorLine) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3] = points[i][0];
      positions[i * 3 + 1] = points[i][1];
      positions[i * 3 + 2] = points[i][2];
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [points]);

  const lineObj = useMemo(() => {
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    return new THREE.Line(geometry, mat);
  }, [geometry, color, opacity]);

  return <primitive object={lineObj} />;
}

// ── Wireframe mesh (cone, box, sphere, etc.) ──

const GEOMETRY_MAP: Record<string, () => THREE.BufferGeometry> = {
  cone: () => new THREE.ConeGeometry(0.5, 1, 8),
  cylinder: () => new THREE.CylinderGeometry(0.3, 0.3, 1, 8),
  box: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.5, 8, 6),
  octahedron: () => new THREE.OctahedronGeometry(0.5, 0),
  torus: () => new THREE.TorusGeometry(0.4, 0.15, 8, 16),
  dodecahedron: () => new THREE.DodecahedronGeometry(0.5, 0),
};

export function WireframeMeshPrimitive({
  geometry: geoType,
  position,
  scale,
  rotation = [0, 0, 0],
  color = GREEN,
  opacity = 0.7,
}: VectorWireframeMesh) {
  const geo = useMemo(() => {
    const factory = GEOMETRY_MAP[geoType];
    return factory ? factory() : new THREE.BoxGeometry(1, 1, 1);
  }, [geoType]);

  return (
    <mesh
      geometry={geo}
      position={position}
      scale={scale}
      rotation={rotation as unknown as THREE.Euler}
    >
      <meshBasicMaterial color={color} wireframe transparent opacity={opacity} />
    </mesh>
  );
}

// ── Point cloud ──

export function PointsPrimitive({
  positions,
  size,
  color = GREEN,
  opacity = 0.6,
}: VectorPoints) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const posArr = new Float32Array(positions.length * 3);
    for (let i = 0; i < positions.length; i++) {
      posArr[i * 3] = positions[i][0];
      posArr[i * 3 + 1] = positions[i][1];
      posArr[i * 3 + 2] = positions[i][2];
    }
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    return geo;
  }, [positions]);

  return (
    <points geometry={geometry}>
      <pointsMaterial color={color} size={size} transparent opacity={opacity} sizeAttenuation />
    </points>
  );
}

// ── Pulse ring ──

export function RingPrimitive({
  position,
  radius,
  innerRadius,
  color = GREEN,
  pulse = false,
  rotation = [-Math.PI / 2, 0, 0],
}: VectorRing) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (pulse && meshRef.current) {
      const t = clock.elapsedTime;
      const s = 1 + Math.sin(t * 3) * 0.2;
      meshRef.current.scale.set(s, s, 1);
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.4 + Math.sin(t * 3) * 0.3;
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={rotation as unknown as THREE.Euler}>
      <ringGeometry args={[innerRadius ?? radius * 0.85, radius, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

// ── Simplified wireframe hiker ──

const HIKER_JOINTS: Record<string, [number, number, number][]> = {
  standing: [
    // Head
    [0, 1.7, 0], [0, 1.5, 0],
    // Spine
    [0, 1.5, 0], [0, 1.0, 0],
    // Left arm
    [0, 1.4, 0], [-0.25, 1.1, 0],
    // Right arm
    [0, 1.4, 0], [0.25, 1.1, 0],
    // Left leg
    [0, 1.0, 0], [-0.12, 0.5, 0],
    [-0.12, 0.5, 0], [-0.12, 0, 0],
    // Right leg
    [0, 1.0, 0], [0.12, 0.5, 0],
    [0.12, 0.5, 0], [0.12, 0, 0],
    // Backpack
    [0, 1.4, -0.1], [0, 1.0, -0.15],
    [-0.12, 1.4, -0.1], [-0.12, 1.0, -0.15],
    [0.12, 1.4, -0.1], [0.12, 1.0, -0.15],
  ],
  walking: [
    [0, 1.7, 0], [0, 1.5, 0],
    [0, 1.5, 0], [0, 1.0, 0.05],
    [0, 1.4, 0], [-0.3, 1.15, 0.1],
    [0, 1.4, 0], [0.2, 1.2, -0.15],
    [0, 1.0, 0.05], [-0.15, 0.5, -0.1],
    [-0.15, 0.5, -0.1], [-0.2, 0, 0.05],
    [0, 1.0, 0.05], [0.15, 0.5, 0.15],
    [0.15, 0.5, 0.15], [0.1, 0, -0.05],
    [0, 1.4, -0.1], [0, 1.0, -0.15],
    [-0.12, 1.4, -0.1], [-0.12, 1.0, -0.15],
    [0.12, 1.4, -0.1], [0.12, 1.0, -0.15],
  ],
  hunched: [
    [0, 1.5, 0.1], [0, 1.35, 0.05],
    [0, 1.35, 0.05], [0, 0.9, 0.1],
    [0, 1.3, 0.05], [-0.2, 1.0, 0.15],
    [0, 1.3, 0.05], [0.2, 1.0, 0.15],
    [0, 0.9, 0.1], [-0.15, 0.45, 0.05],
    [-0.15, 0.45, 0.05], [-0.15, 0, 0],
    [0, 0.9, 0.1], [0.15, 0.45, 0.05],
    [0.15, 0.45, 0.05], [0.15, 0, 0],
    [0, 1.3, -0.05], [0, 0.9, -0.05],
    [-0.12, 1.3, -0.05], [-0.12, 0.9, -0.05],
    [0.12, 1.3, -0.05], [0.12, 0.9, -0.05],
  ],
  curled: [
    [0, 0.6, 0.2], [0, 0.5, 0.15],
    [0, 0.5, 0.15], [0, 0.3, 0.2],
    [0, 0.45, 0.15], [-0.2, 0.3, 0.25],
    [0, 0.45, 0.15], [0.2, 0.3, 0.25],
    [0, 0.3, 0.2], [-0.1, 0.15, 0.15],
    [-0.1, 0.15, 0.15], [-0.15, 0, 0.1],
    [0, 0.3, 0.2], [0.1, 0.15, 0.15],
    [0.1, 0.15, 0.15], [0.15, 0, 0.1],
    [0, 0.45, 0.05], [0, 0.3, 0.05],
    [-0.1, 0.45, 0.05], [-0.1, 0.3, 0.05],
    [0.1, 0.45, 0.05], [0.1, 0.3, 0.05],
  ],
  fallen: [
    [0.3, 0.15, 0], [0.15, 0.12, 0],
    [0.15, 0.12, 0], [-0.2, 0.1, 0],
    [0.1, 0.12, 0], [-0.1, 0.2, -0.15],
    [0.1, 0.12, 0], [0.3, 0.25, 0.1],
    [-0.2, 0.1, 0], [-0.5, 0.05, -0.1],
    [-0.5, 0.05, -0.1], [-0.7, 0.02, 0],
    [-0.2, 0.1, 0], [-0.4, 0.15, 0.15],
    [-0.4, 0.15, 0.15], [-0.6, 0.02, 0.1],
    [0.1, 0.1, -0.08], [-0.2, 0.08, -0.1],
    [-0.05, 0.1, -0.08], [-0.25, 0.08, -0.1],
    [0.2, 0.1, -0.08], [-0.05, 0.08, -0.1],
  ],
};

export function HikerPrimitive({
  position,
  scale: s = 1,
  color = GREEN,
  pose = "standing",
}: VectorHiker) {
  const geometry = useMemo(() => {
    const joints = HIKER_JOINTS[pose] || HIKER_JOINTS.standing;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(joints.length * 3);
    for (let i = 0; i < joints.length; i++) {
      positions[i * 3] = joints[i][0] * s;
      positions[i * 3 + 1] = joints[i][1] * s;
      positions[i * 3 + 2] = joints[i][2] * s;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [pose, s]);

  return (
    <lineSegments geometry={geometry} position={position}>
      <lineBasicMaterial color={color} transparent opacity={0.9} />
    </lineSegments>
  );
}

// ── Motion ghosts (for fall/tumble events) ──

export function MotionGhostsPrimitive({
  path,
  count,
  color = GREEN,
}: VectorMotionGhosts) {
  const ghosts = useMemo(() => {
    const result: { position: [number, number, number]; opacity: number }[] = [];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      // Interpolate along path
      const pathIdx = t * (path.length - 1);
      const lo = Math.floor(pathIdx);
      const hi = Math.min(lo + 1, path.length - 1);
      const f = pathIdx - lo;
      const pos: [number, number, number] = [
        path[lo][0] + (path[hi][0] - path[lo][0]) * f,
        path[lo][1] + (path[hi][1] - path[lo][1]) * f,
        path[lo][2] + (path[hi][2] - path[lo][2]) * f,
      ];
      result.push({ position: pos, opacity: 0.3 + (1 - t) * 0.5 });
    }
    return result;
  }, [path, count]);

  return (
    <>
      {ghosts.map((g, i) => (
        <HikerPrimitive
          key={i}
          type="hiker"
          position={g.position}
          scale={0.6}
          color={color}
          pose="fallen"
        />
      ))}
    </>
  );
}

// ── Grid floor ──

export function GridPrimitive({
  size,
  divisions,
  position = [0, 0, 0],
  color = GREEN,
  opacity = 0.15,
}: VectorGrid) {
  return (
    <group position={position}>
      <gridHelper args={[size, divisions, color, color]} />
      <meshBasicMaterial transparent opacity={opacity} />
    </group>
  );
}
