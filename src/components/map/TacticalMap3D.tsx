/**
 * TacticalMap3D — Three.js WebGL terrain map with CRT wireframe aesthetic.
 * Replaces the SVG isometric map. Falls back to TacticalMapLegacy on WebGL failure.
 */

import { useRef, useMemo, useState, useEffect, Component } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import { generateTerrainMesh } from "./terrainMesh.ts";
import { TacticalMapLegacy } from "./TacticalMapLegacy.tsx";

// Compute terrain mesh once at module load (WAYPOINTS is static)
const MESH_DATA = generateTerrainMesh(WAYPOINTS);

// ── Error boundary for WebGL fallback ──────────

interface ErrorBoundaryState { hasError: boolean }

class WebGLErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ── Terrain wireframe mesh ─────────────────────

function TerrainWireframe() {
  const meshData = MESH_DATA;
  const lineRef = useRef<THREE.LineSegments>(null);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const isLost = useGameStore((s) => s.player.isLost);
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const prevIndexRef = useRef(0);
  const revealProgressRef = useRef(1);
  const wasTintedRef = useRef(false);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(meshData.edgePositions.slice(), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(meshData.edgeColors.slice(), 3));
    return geo;
  }, [meshData]);

  useFrame(({ clock }, delta) => {
    // Reveal animation
    if (currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = currentIndex;
      revealProgressRef.current = 0;
    }
    if (revealProgressRef.current < 1) {
      revealProgressRef.current = Math.min(1, revealProgressRef.current + delta * 1.5);
    }

    // Lost-state tint with sine-wave flicker + reset when found
    if (isLost && lineRef.current) {
      const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
      const baseColors = meshData.edgeColors;
      const arr = colors.array as Float32Array;
      const flickerR = 0.9 + Math.sin(clock.elapsedTime * 20) * 0.1;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = baseColors[i] * 0.5 + flickerR * 0.5;
        arr[i + 1] = baseColors[i + 1] * 0.3;
        arr[i + 2] = baseColors[i + 2] * 0.3;
      }
      colors.needsUpdate = true;
      wasTintedRef.current = true;
    } else if (wasTintedRef.current && lineRef.current) {
      const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
      (colors.array as Float32Array).set(meshData.edgeColors);
      colors.needsUpdate = true;
      wasTintedRef.current = false;
    }

    // Direct material opacity mutation (fix reveal animation)
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial;
      const nightDim = timeOfDay === "night" ? 0.6 : timeOfDay === "dusk" ? 0.8 : 1.0;
      mat.opacity = nightDim * revealProgressRef.current;
    }
  });

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent />
    </lineSegments>
  );
}

// ── Grid floor ─────────────────────────────────

function GridFloor() {
  return (
    <gridHelper args={[10, 40, "#112211", "#0a150a"]} position={[0, 0, 0]} />
  );
}

// ── Trail line ─────────────────────────────────

function TrailLine() {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);

  const traversedPoints = useMemo(() => {
    const maxDist = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
    const endDist = WAYPOINTS[Math.min(currentIndex, WAYPOINTS.length - 1)].distanceFromStart;
    const endNorm = endDist / maxDist;
    const endIdx = Math.round(endNorm * (meshData.trailPoints.length - 1));
    return meshData.trailPoints.slice(0, endIdx + 1);
  }, [currentIndex, meshData]);

  const futurePoints = useMemo(() => {
    const maxDist = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
    const startDist = WAYPOINTS[Math.min(currentIndex, WAYPOINTS.length - 1)].distanceFromStart;
    const startNorm = startDist / maxDist;
    const startIdx = Math.round(startNorm * (meshData.trailPoints.length - 1));
    return meshData.trailPoints.slice(startIdx);
  }, [currentIndex, meshData]);

  const traversedGeo = useMemo(() => {
    if (traversedPoints.length < 2) return null;
    const pts = new Float32Array(traversedPoints.length * 3);
    traversedPoints.forEach((p, i) => { pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return geo;
  }, [traversedPoints]);

  const futureGeo = useMemo(() => {
    if (futurePoints.length < 2) return null;
    const pts = new Float32Array(futurePoints.length * 3);
    futurePoints.forEach((p, i) => { pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return geo;
  }, [futurePoints]);

  const traversedLineRef = useRef<THREE.Line | null>(null);
  const futureLineRef = useRef<THREE.Line | null>(null);

  const traversedLine = useMemo(() => {
    if (!traversedGeo) return null;
    const mat = new THREE.LineBasicMaterial({ color: "#00ff41", transparent: true, opacity: 0.9 });
    return new THREE.Line(traversedGeo, mat);
  }, [traversedGeo]);

  const futureLine = useMemo(() => {
    if (!futureGeo) return null;
    const line = new THREE.Line(futureGeo, new THREE.LineDashedMaterial({
      color: "#335533", dashSize: 0.1, gapSize: 0.05, transparent: true, opacity: 0.4,
    }));
    line.computeLineDistances();
    return line;
  }, [futureGeo]);

  // Dispose old Three.js objects in useEffect cleanup (not useMemo)
  useEffect(() => {
    traversedLineRef.current = traversedLine;
    return () => {
      if (traversedLineRef.current) {
        traversedLineRef.current.geometry.dispose();
        (traversedLineRef.current.material as THREE.Material).dispose();
      }
    };
  }, [traversedLine]);

  useEffect(() => {
    futureLineRef.current = futureLine;
    return () => {
      if (futureLineRef.current) {
        futureLineRef.current.geometry.dispose();
        (futureLineRef.current.material as THREE.Material).dispose();
      }
    };
  }, [futureLine]);

  return (
    <>
      {traversedLine && <primitive object={traversedLine} />}
      {futureLine && <primitive object={futureLine} />}
    </>
  );
}

// ── Waypoint markers ───────────────────────────

function WaypointMarkers() {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);

  return (
    <>
      {meshData.waypointPositions.map((pos, i) => {
        let color = "#335533";
        if (i < currentIndex) color = "#00ff41";
        if (i === currentIndex) color = "#ffb000";
        const scale = i === currentIndex ? 0.12 : 0.08;
        return (
          <mesh key={i} position={pos} scale={[scale, scale * 1.5, scale]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={color} transparent opacity={i === currentIndex ? 1 : 0.7} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Hiker marker ───────────────────────────────

function HikerMarker() {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const markerRef = useRef<THREE.Group>(null);

  const pos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];

  useFrame(({ clock }) => {
    if (markerRef.current) {
      markerRef.current.position.y = pos.y + 0.15 + Math.sin(clock.elapsedTime * 2) * 0.02;
    }
  });

  return (
    <group ref={markerRef} position={[pos.x, pos.y + 0.15, pos.z]}>
      <mesh>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#00ff41" />
      </mesh>
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
        <meshBasicMaterial color="#00ff41" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ── Camera controller ──────────────────────────

function CameraController() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const isLost = useGameStore((s) => s.player.isLost);
  const meshData = MESH_DATA;
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 1, 0));
  const orbitAngleRef = useRef(0);

  useEffect(() => {
    const pos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];
    targetRef.current.set(pos.x, pos.y + 0.5, pos.z);
  }, [currentIndex, meshData]);

  useFrame((_, delta) => {
    const target = targetRef.current;

    orbitAngleRef.current += delta * 0.5 * (Math.PI / 180);
    const orbitRadius = 3.3;
    const orbitX = Math.sin(orbitAngleRef.current) * orbitRadius;
    const orbitZ = Math.cos(orbitAngleRef.current) * orbitRadius;

    const camPos = new THREE.Vector3(target.x + orbitX, target.y + 2, target.z + orbitZ);

    if (isLost) {
      camPos.x += (Math.random() - 0.5) * 0.05;
      camPos.y += (Math.random() - 0.5) * 0.03;
    }

    camera.position.lerp(camPos, 0.03);
    camera.lookAt(target);
  });

  return null;
}

// ── Fog controller ─────────────────────────────

function FogController() {
  const weather = useGameStore((s) => s.weather.current);
  const { scene } = useThree();

  useEffect(() => {
    if (weather === "fog") {
      scene.fog = new THREE.Fog("#0a0a0a", 3, 6);
    } else if (weather === "blizzard") {
      scene.fog = new THREE.Fog("#1a1a1a", 4, 8);
    } else {
      scene.fog = null;
    }
  }, [weather, scene]);

  return null;
}

// ── Main component ─────────────────────────────

export function TacticalMap3D() {
  const [webglFailed, setWebglFailed] = useState(false);

  if (webglFailed) return <TacticalMapLegacy />;

  return (
    <div className="tactical-map">
      <WebGLErrorBoundary onError={() => setWebglFailed(true)}>
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 40, near: 0.1, far: 50, position: [2, 3, 4] }}
          frameloop="always"
        >
          <CameraController />
          <FogController />
          <GridFloor />
          <TerrainWireframe />
          <TrailLine />
          <WaypointMarkers />
          <HikerMarker />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
