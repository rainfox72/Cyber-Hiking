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
import { HikerRig3D } from "./hiker/HikerRig3D.tsx";
import { HikerEffects } from "./hiker/HikerEffects.tsx";
import { generateTerrainDetails, type TerrainDetailData } from "./terrain/terrainDetails.ts";
import { TerrainVegetation } from "./terrain/TerrainVegetation.tsx";
import { TerrainRocks } from "./terrain/TerrainRocks.tsx";
import { TerrainWater } from "./terrain/TerrainWater.tsx";
import { TerrainLandmarks } from "./terrain/TerrainLandmarks.tsx";
import { Skydome3D } from "./atmosphere/Skydome3D.tsx";
import { SceneLighting } from "./atmosphere/SceneLighting.tsx";
import { SceneFog } from "./atmosphere/SceneFog.tsx";

// Compute terrain mesh once at module load (WAYPOINTS is static)
const MESH_DATA = generateTerrainMesh(WAYPOINTS);
const DETAIL_DATA: TerrainDetailData = generateTerrainDetails(WAYPOINTS, MESH_DATA);

// ── Error boundary for WebGL fallback ──────────

interface ErrorBoundaryState { hasError: boolean }

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
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
    if (currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = currentIndex;
      revealProgressRef.current = 0.7; // subtle dim, not full blackout
    }
    if (revealProgressRef.current < 1) {
      revealProgressRef.current = Math.min(1, revealProgressRef.current + delta * 2);
    }

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

// ── Search radius ring ─────────────────────────

function SearchRing({ posRef, lostTurns }: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  lostTurns: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const radius = 0.4 + lostTurns * 0.15;

  useFrame(({ clock }) => {
    if (ringRef.current) {
      ringRef.current.position.x = posRef.current.x;
      ringRef.current.position.z = posRef.current.z;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(clock.elapsedTime * 4) * 0.2;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius, 32]} />
      <meshBasicMaterial color="#ff2222" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ── Hiker marker with displacement + animation ─

// Shared ref for camera to follow displaced hiker position
const hikerDisplayPos = { current: new THREE.Vector3() };

function HikerMarker() {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const lastAction = useGameStore((s) => s.lastAction);
  const isLost = useGameStore((s) => s.player.isLost);
  const lostTurns = useGameStore((s) => s.player.lostTurns);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const weather = useGameStore((s) => s.weather.current);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const gamePhase = useGameStore((s) => s.gamePhase);

  // Health vitals for HikerEffects ping color
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const healthPercent = (energy + hydration + bodyTemp + o2 + morale) / 5;
  const markerRef = useRef<THREE.Group>(null);
  const prevIndexRef = useRef(0);

  const driftRef = useRef({
    offset: new THREE.Vector3(),
    direction: 0,
    prevLost: false,
    prevLostTurns: 0,
  });

  const animRef = useRef({
    active: false,
    progress: 0,
    duration: 0,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
  });

  useEffect(() => {
    if (currentIndex === prevIndexRef.current) return;
    const oldIdx = prevIndexRef.current;
    prevIndexRef.current = currentIndex;

    if (animRef.current.active) animRef.current.active = false;

    const durations: Record<string, number> = { push_forward: 2.5, descend: 1.5 };
    const dur = durations[lastAction ?? ""] ?? 0;
    if (dur === 0) return;

    const startPos = meshData.waypointPositions[Math.min(oldIdx, meshData.waypointPositions.length - 1)];
    const endPos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];

    animRef.current = {
      active: true, progress: 0, duration: dur,
      startPos: startPos.clone(), endPos: endPos.clone(),
    };
  }, [currentIndex, lastAction, meshData]);

  useFrame(({ clock }, delta) => {
    const anim = animRef.current;
    const d = driftRef.current;

    // Movement animation
    if (anim.active) {
      anim.progress += delta / anim.duration;
      if (anim.progress >= 1) { anim.active = false; anim.progress = 1; }

      const t = anim.progress < 0.5
        ? 2 * anim.progress * anim.progress
        : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;
      const pos = anim.startPos.clone().lerp(anim.endPos, t);

      if (markerRef.current) {
        markerRef.current.position.copy(pos);
        markerRef.current.position.y += 0.15;
      }
      hikerDisplayPos.current.copy(pos);
      hikerDisplayPos.current.y += 0.5;
      return;
    }

    // Normal positioning + lost drift
    const truePos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];

    if (isLost && !d.prevLost) {
      d.direction = Math.random() * Math.PI * 2;
      d.prevLostTurns = 0;
      d.prevLost = true;
    }
    if (isLost && lostTurns !== d.prevLostTurns) {
      d.prevLostTurns = lostTurns;
      const magnitude = Math.min(0.3 + lostTurns * 0.25, 1.5);
      const wobble = (lostTurns * 0.3) % (Math.PI * 2);
      d.offset.set(Math.cos(d.direction + wobble * 0.2) * magnitude, 0, Math.sin(d.direction + wobble * 0.2) * magnitude);
    }
    if (!isLost && d.prevLost) {
      d.offset.lerp(new THREE.Vector3(), delta * 3);
      if (d.offset.length() < 0.01) { d.offset.set(0, 0, 0); d.prevLost = false; }
    }

    const displayPos = truePos.clone().add(d.offset);
    if (markerRef.current) {
      markerRef.current.position.copy(displayPos);
      markerRef.current.position.y += 0.15;
    }
    hikerDisplayPos.current.copy(displayPos);
    hikerDisplayPos.current.y += 0.5;
  });

  return (
    <>
      <group ref={markerRef} position={[0, 0, 0]}>
        <HikerRig3D
          lastAction={lastAction}
          turnNumber={turnNumber}
          currentWaypointIndex={currentIndex}
          isMoving={animRef.current.active}
          movementDuration={animRef.current.duration}
          isLost={isLost}
          weather={weather}
          timeOfDay={timeOfDay}
          gamePhase={gamePhase}
        />
      </group>
      <HikerEffects
        hikerPosRef={hikerDisplayPos}
        isMoving={animRef.current.active}
        currentWaypointIndex={currentIndex}
        healthPercent={healthPercent}
        isLost={isLost}
      />
      {isLost && <SearchRing posRef={hikerDisplayPos} lostTurns={lostTurns} />}
    </>
  );
}

// ── Terrain detail layer ────────────────────────

function TerrainDetailLayer() {
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const weather = useGameStore((s) => s.weather.current);
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  return (
    <>
      <TerrainVegetation details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} />
      <TerrainRocks details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} />
      <TerrainWater details={DETAIL_DATA} timeOfDay={timeOfDay} />
      <TerrainLandmarks details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} currentIndex={currentIndex} />
    </>
  );
}

// ── Zoom controls ──────────────────────────────

function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  return (
    <div className="tactical-map__zoom-controls">
      <button onClick={() => setZoom(Math.max(1, zoom - 1))}>-</button>
      <span>{zoom}x</span>
      <button onClick={() => setZoom(Math.min(3, zoom + 1))}>+</button>
    </div>
  );
}

// ── Temporary camera (will be replaced by CameraDirector) ──

function TempCamera() {
  const { camera } = useThree();
  const orbitAngleRef = useRef(0);

  useFrame((_, delta) => {
    const target = hikerDisplayPos.current;
    orbitAngleRef.current += delta * 0.5 * (Math.PI / 180);
    const orbitRadius = 3.3;
    const orbitX = Math.sin(orbitAngleRef.current) * orbitRadius;
    const orbitZ = Math.cos(orbitAngleRef.current) * orbitRadius;
    const camPos = new THREE.Vector3(target.x + orbitX, target.y + 2, target.z + orbitZ);
    camera.position.lerp(camPos, 0.03);
    camera.lookAt(target);
  });

  return null;
}

// ── Scene content (used by full-bleed Canvas in App) ──

export function SceneContent() {
  return (
    <>
      <Skydome3D />
      <SceneLighting />
      <SceneFog />
      <TempCamera />
      <GridFloor />
      <TerrainWireframe />
      <TrailLine />
      <WaypointMarkers />
      <HikerMarker />
      <TerrainDetailLayer />
    </>
  );
}

// ── Legacy panel-based component (for WebGL fallback) ──

export function TacticalMap3D() {
  const [zoom, setZoom] = useState(1);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) setZoom((z) => Math.min(3, z + 1));
    else setZoom((z) => Math.max(1, z - 1));
  };

  return (
    <div className="tactical-map" onWheel={handleWheel}>
      <ZoomControls zoom={zoom} setZoom={setZoom} />
      <WebGLErrorBoundary fallback={<TacticalMapLegacy />}>
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 45 + (zoom - 1) * -10, near: 0.1, far: 50, position: [2, 3, 4] }}
          frameloop="always"
        >
          <SceneContent />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
