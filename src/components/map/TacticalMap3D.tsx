/**
 * TacticalMap3D — Three.js WebGL terrain map with CRT wireframe aesthetic.
 * Replaces the SVG isometric map. Falls back to TacticalMapLegacy on WebGL failure.
 */

import { useRef, useMemo, useState, useEffect, Component } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
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
import { useVisualState } from './VisualStateBridge.tsx';
import { Skydome3D } from "./atmosphere/Skydome3D.tsx";
import { SceneLighting } from "./atmosphere/SceneLighting.tsx";
import { SceneFog } from "./atmosphere/SceneFog.tsx";
import { WeatherParticles3D } from "./atmosphere/WeatherParticles3D.tsx";
import { FogPlanes } from "./atmosphere/FogPlanes.tsx";
import { LightningController } from "./atmosphere/LightningController.tsx";
import { CameraDirector } from "./CameraDirector.tsx";
import { PostFXController } from "./PostFXController.tsx";
import { SceneAlerts } from "./SceneAlerts.tsx";

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

// ── Band palette targets for terrain tinting ──

import type { BandId } from '../../store/visualState.ts';

const BAND_TINT: Record<BandId, [number, number, number]> = {
  forest:  [0.10, 0.29, 0.10],  // muted green
  rocky:   [0.29, 0.29, 0.23],  // gray-amber
  plateau: [0.23, 0.23, 0.29],  // desaturated gray-blue
  storm:   [0.16, 0.16, 0.23],  // dark blue-gray
  summit:  [0.35, 0.35, 0.35],  // stark white-gray
};

// ── Terrain wireframe mesh with color compositor ──

function TerrainWireframe() {
  const meshData = MESH_DATA;
  const lineRef = useRef<THREE.LineSegments>(null);
  const isLost = useGameStore((s) => s.player.isLost);
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const vsRef = useVisualState();
  const prevIndexRef = useRef(0);
  const revealProgressRef = useRef(1);

  // Band transition lerp progress (0→1 over 1.5s)
  const bandLerpRef = useRef(1);
  const prevBandRef = useRef<BandId>('forest');

  // Snow accumulation level (0→1)
  const snowLevelRef = useRef(0);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(meshData.edgePositions.slice(), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(meshData.edgeColors.slice(), 3));
    return geo;
  }, [meshData]);

  useFrame(({ clock }, delta) => {
    const vs = vsRef.current;

    // Waypoint change reveal
    if (currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = currentIndex;
      revealProgressRef.current = 0.7;
    }
    if (revealProgressRef.current < 1) {
      revealProgressRef.current = Math.min(1, revealProgressRef.current + delta * 2);
    }

    // Band transition tracking
    if (vs.bandId !== prevBandRef.current) {
      prevBandRef.current = vs.bandId;
      bandLerpRef.current = 0;
    }
    if (bandLerpRef.current < 1) {
      bandLerpRef.current = Math.min(1, bandLerpRef.current + delta * 0.67); // ~1.5s
    }

    // Snow accumulation
    const isSnowing = vs.weather === 'snow' || vs.weather === 'blizzard';
    if (isSnowing) {
      snowLevelRef.current = Math.min(1, snowLevelRef.current + delta * 0.05);
    } else {
      snowLevelRef.current = Math.max(0, snowLevelRef.current - delta * 0.02); // gradual melt
    }

    // ── Color compositor: base → band → weather → lost ──
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    const baseColors = meshData.edgeColors;
    const arr = colors.array as Float32Array;
    const bandTint = BAND_TINT[vs.bandId];
    const bandT = bandLerpRef.current * 0.35; // max 35% tint influence
    const snow = snowLevelRef.current;
    const isRaining = vs.weather === 'rain';
    const rainDarken = isRaining ? 0.8 : 1.0;

    // Lost-state flicker
    const lostFlicker = isLost ? 0.9 + Math.sin(clock.elapsedTime * 20) * 0.1 : 0;

    for (let i = 0; i < arr.length; i += 3) {
      let r = baseColors[i];
      let g = baseColors[i + 1];
      let b = baseColors[i + 2];

      // Step 2: Band tinting (lerp toward band palette)
      r += (bandTint[0] - r) * bandT;
      g += (bandTint[1] - g) * bandT;
      b += (bandTint[2] - b) * bandT;

      // Step 3a: Snow accumulation (blend toward white)
      if (snow > 0) {
        r += (1.0 - r) * snow * 0.4;
        g += (1.0 - g) * snow * 0.4;
        b += (1.0 - b) * snow * 0.4;
      }

      // Step 3b: Rain darkening
      r *= rainDarken;
      g *= rainDarken;
      b *= rainDarken;

      // Step 4: Lost-state red flicker (applied last)
      if (isLost) {
        r = r * 0.5 + lostFlicker * 0.5;
        g *= 0.3;
        b *= 0.3;
      }

      arr[i] = r;
      arr[i + 1] = g;
      arr[i + 2] = b;
    }
    colors.needsUpdate = true;

    // Opacity: night dim + reveal
    if (lineRef.current) {
      const mat = lineRef.current.material as THREE.LineBasicMaterial;
      const nightDim = vs.timeOfDay === "night" ? 0.6 : vs.timeOfDay === "dusk" ? 0.8 : 1.0;
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
        const wp = WAYPOINTS[i];

        // Show labels for nearby waypoints (within ±3 of current)
        const distance = Math.abs(i - currentIndex);
        const showLabel = distance <= 3;
        const labelOpacity = i === currentIndex ? 1.0
          : distance <= 1 ? 0.7
          : distance <= 2 ? 0.5
          : 0.3;

        return (
          <group key={i}>
            <mesh position={pos} scale={[scale, scale * 1.5, scale]}>
              <octahedronGeometry args={[1, 0]} />
              <meshBasicMaterial color={color} transparent opacity={i === currentIndex ? 1 : 0.7} />
            </mesh>
            {showLabel && (
              <Html
                position={[pos.x, pos.y + 0.25, pos.z]}
                center
                style={{
                  pointerEvents: "none",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  opacity: labelOpacity,
                  transition: "opacity 0.5s",
                }}
              >
                <div style={{
                  fontFamily: "var(--font-mono, monospace)",
                  textAlign: "center",
                  textShadow: `0 0 8px ${color}88`,
                  lineHeight: 1.2,
                }}>
                  <div style={{
                    fontSize: i === currentIndex ? "13px" : "10px",
                    fontWeight: i === currentIndex ? "bold" : "normal",
                    color: color,
                    letterSpacing: "1px",
                  }}>
                    {wp.nameCN}
                  </div>
                  <div style={{
                    fontSize: i === currentIndex ? "10px" : "8px",
                    color: color,
                    opacity: 0.8,
                  }}>
                    {wp.name}
                  </div>
                  <div style={{
                    fontSize: "8px",
                    color: color,
                    opacity: 0.6,
                  }}>
                    {wp.elevation}m
                  </div>
                </div>
              </Html>
            )}
          </group>
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

  // Track movement as React state so HikerRig3D gets re-rendered with correct isMoving
  const [isMoving, setIsMoving] = useState(false);

  // Health vitals for HikerEffects ping color
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const healthPercent = (energy + hydration + bodyTemp + o2 + morale) / 5;
  const markerRef = useRef<THREE.Group>(null);
  const prevIndexRef = useRef(0);
  const facingAngleRef = useRef(0); // Y-axis rotation to face travel direction

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
    setIsMoving(true);

    // Compute facing angle toward destination
    const dx = endPos.x - startPos.x;
    const dz = endPos.z - startPos.z;
    facingAngleRef.current = Math.atan2(dx, dz);
  }, [currentIndex, lastAction, meshData]);

  useFrame((_state, delta) => {
    const anim = animRef.current;
    const d = driftRef.current;

    // Movement animation
    if (anim.active) {
      anim.progress += delta / anim.duration;
      if (anim.progress >= 1) { anim.active = false; anim.progress = 1; setIsMoving(false); }

      const t = anim.progress < 0.5
        ? 2 * anim.progress * anim.progress
        : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;
      const pos = anim.startPos.clone().lerp(anim.endPos, t);

      if (markerRef.current) {
        markerRef.current.position.copy(pos);
        markerRef.current.position.y += 0.15;
        markerRef.current.rotation.y = facingAngleRef.current;
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

    // Compute facing direction toward next waypoint when idle
    const nextIdx = Math.min(currentIndex + 1, meshData.waypointPositions.length - 1);
    if (nextIdx !== currentIndex) {
      const nextPos = meshData.waypointPositions[nextIdx];
      const dx = nextPos.x - truePos.x;
      const dz = nextPos.z - truePos.z;
      const targetAngle = Math.atan2(dx, dz);
      // Smooth lerp toward target facing
      let angleDiff = targetAngle - facingAngleRef.current;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      facingAngleRef.current += angleDiff * delta * 3;
    }

    const displayPos = truePos.clone().add(d.offset);
    if (markerRef.current) {
      markerRef.current.position.copy(displayPos);
      markerRef.current.position.y += 0.15;
      markerRef.current.rotation.y = facingAngleRef.current;
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
          isMoving={isMoving}
          // eslint-disable-next-line react-hooks/refs
          movementDuration={animRef.current.duration}
          isLost={isLost}
          weather={weather}
          timeOfDay={timeOfDay}
          gamePhase={gamePhase}
        />
      </group>
      <HikerEffects
        hikerPosRef={hikerDisplayPos}
        isMoving={isMoving}
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
  const vs = useVisualState();
  const bandId = vs.current.bandId;

  // Band density multipliers — trees thin out at altitude, rocks dominate mid-range
  const treeDensity = bandId === 'forest' ? 1.0 : bandId === 'rocky' ? 0.3 : 0;
  const rockDensity = bandId === 'forest' ? 0.3 : bandId === 'rocky' ? 1.0
    : bandId === 'plateau' ? 0.7 : bandId === 'storm' ? 0.5 : 0.3;

  return (
    <>
      <TerrainVegetation details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} bandTreeDensity={treeDensity} />
      <TerrainRocks details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} bandRockDensity={rockDensity} />
      <TerrainWater details={DETAIL_DATA} timeOfDay={timeOfDay} />
      <TerrainLandmarks details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} currentIndex={currentIndex} />
    </>
  );
}

// ── Scene content (used by full-bleed Canvas in App) ──

export function SceneContent() {
  return (
    <>
      <Skydome3D />
      <SceneLighting />
      <SceneFog />
      <WeatherParticles3D />
      <FogPlanes />
      <LightningController />
      <CameraDirector hikerPosRef={hikerDisplayPos} />
      <PostFXController />
      <GridFloor />
      <TerrainWireframe />
      <TrailLine />
      <WaypointMarkers />
      <HikerMarker />
      <SceneAlerts hikerPosRef={hikerDisplayPos} />
      <TerrainDetailLayer />
    </>
  );
}

// ── Legacy panel-based component (for WebGL fallback) ──

export function TacticalMap3D() {
  return (
    <div className="tactical-map">
      <WebGLErrorBoundary fallback={<TacticalMapLegacy />}>
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 45, near: 0.1, far: 50, position: [2, 3, 4] }}
          frameloop="always"
        >
          <SceneContent />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
