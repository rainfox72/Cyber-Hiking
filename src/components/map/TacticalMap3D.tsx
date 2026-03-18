/**
 * TacticalMap3D — Three.js WebGL terrain map with CRT wireframe aesthetic.
 * Replaces the SVG isometric map. Falls back to TacticalMapLegacy on WebGL failure.
 */

import { useRef, useMemo, useState, useEffect, Component } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

// ── Hiker marker ───────────────────────────────

interface HikerMarkerProps {
  hikerPosRef: React.MutableRefObject<THREE.Vector3>;
}

function HikerMarker({ hikerPosRef }: HikerMarkerProps) {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const lastAction = useGameStore((s) => s.lastAction);
  const isLost = useGameStore((s) => s.player.isLost);
  const lostTurns = useGameStore((s) => s.player.lostTurns);
  const markerRef = useRef<THREE.Group>(null);
  const prevIndexRef = useRef(0);

  // Drift state for lost displacement
  const driftRef = useRef({
    offset: new THREE.Vector3(),
    direction: 0,
    prevLost: false,
    prevLostTurns: 0,
  });

  // Animation state for smooth movement
  const animRef = useRef({
    active: false,
    progress: 0,
    duration: 0,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
  });

  // Start movement animation on waypoint change
  useEffect(() => {
    if (currentIndex === prevIndexRef.current) return;
    const oldIdx = prevIndexRef.current;
    prevIndexRef.current = currentIndex;

    // Snap previous animation if mid-flight
    if (animRef.current.active) {
      animRef.current.active = false;
    }

    const durations: Record<string, number> = {
      push_forward: 2.5,
      descend: 1.5,
    };
    const dur = durations[lastAction ?? ""] ?? 0;
    if (dur === 0) return;

    const startPos = meshData.waypointPositions[Math.min(oldIdx, meshData.waypointPositions.length - 1)];
    const endPos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];

    animRef.current = {
      active: true,
      progress: 0,
      duration: dur,
      startPos: startPos.clone(),
      endPos: endPos.clone(),
    };
  }, [currentIndex, lastAction, meshData]);

  useFrame(({ clock }, delta) => {
    const anim = animRef.current;
    const d = driftRef.current;

    // Movement animation (priority over drift)
    if (anim.active) {
      anim.progress += delta / anim.duration;
      if (anim.progress >= 1) {
        anim.active = false;
        anim.progress = 1;
      }

      const t = anim.progress < 0.5
        ? 2 * anim.progress * anim.progress
        : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;

      const pos = anim.startPos.clone().lerp(anim.endPos, t);

      if (markerRef.current) {
        markerRef.current.position.copy(pos);
        markerRef.current.position.y += 0.15 + Math.sin(clock.elapsedTime * 4) * 0.02;
      }
      hikerPosRef.current.copy(pos);
      hikerPosRef.current.y += 0.5;
      return; // Skip drift during animation
    }

    // Lost drift logic
    const truePos = meshData.waypointPositions[
      Math.min(currentIndex, meshData.waypointPositions.length - 1)
    ];

    if (isLost && !d.prevLost) {
      d.direction = Math.random() * Math.PI * 2;
      d.prevLostTurns = 0;
      d.prevLost = true;
    }

    if (isLost && lostTurns !== d.prevLostTurns) {
      d.prevLostTurns = lostTurns;
      const magnitude = Math.min(0.3 + lostTurns * 0.25, 1.5);
      const wobble = (lostTurns * 0.3) % (Math.PI * 2);
      d.offset.set(
        Math.cos(d.direction + wobble * 0.2) * magnitude,
        0,
        Math.sin(d.direction + wobble * 0.2) * magnitude,
      );
    }

    if (!isLost && d.prevLost) {
      d.offset.lerp(new THREE.Vector3(), delta * 3);
      if (d.offset.length() < 0.01) {
        d.offset.set(0, 0, 0);
        d.prevLost = false;
      }
    }

    const displayPos = truePos.clone().add(d.offset);

    if (markerRef.current) {
      markerRef.current.position.copy(displayPos);
      markerRef.current.position.y += 0.15 + Math.sin(clock.elapsedTime * 2) * 0.02;
    }

    hikerPosRef.current.copy(displayPos);
    hikerPosRef.current.y += 0.5;
  }, 1); // priority 1: write before camera reads

  return (
    <>
      <group ref={markerRef} position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#00ff41" />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
          <meshBasicMaterial color="#00ff41" transparent opacity={0.4} />
        </mesh>
      </group>
      {isLost && <SearchRing posRef={hikerPosRef} lostTurns={lostTurns} />}
    </>
  );
}

// ── Camera system (OrbitControls + auto-orbit) ─

interface CameraSystemProps {
  hikerPosRef: React.MutableRefObject<THREE.Vector3>;
  recenterRef: React.MutableRefObject<(() => void) | null>;
}

function CameraSystem({ hikerPosRef, recenterRef }: CameraSystemProps) {
  const controlsRef = useRef<any>(null);
  const isUserControllingRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const autoOrbitRef = useRef(true);
  const isTargetFollowingRef = useRef(true);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    if (isTargetFollowingRef.current) {
      controlsRef.current.target.lerp(hikerPosRef.current, 0.05);
    }

    if (autoOrbitRef.current && !isUserControllingRef.current) {
      const azimuth = controlsRef.current.getAzimuthalAngle();
      controlsRef.current.setAzimuthalAngle(azimuth + delta * 0.5 * (Math.PI / 180));
    }

    controlsRef.current.update();
  }, 2); // priority 2: reads after HikerMarker writes

  const handleStart = () => {
    isUserControllingRef.current = true;
    autoOrbitRef.current = false;
    isTargetFollowingRef.current = false;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  };

  const handleEnd = () => {
    isUserControllingRef.current = false;
    inactivityTimerRef.current = window.setTimeout(() => {
      autoOrbitRef.current = true;
      isTargetFollowingRef.current = true;
    }, 5000);
  };

  useEffect(() => {
    recenterRef.current = () => {
      if (!controlsRef.current) return;
      controlsRef.current.target.copy(hikerPosRef.current);
      autoOrbitRef.current = true;
      isTargetFollowingRef.current = true;
      isUserControllingRef.current = false;
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
    return () => {
      recenterRef.current = null;
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [recenterRef, hikerPosRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI / 2.2}
      minDistance={1.5}
      maxDistance={8}
      enableDamping
      dampingFactor={0.05}
      onStart={handleStart}
      onEnd={handleEnd}
    />
  );
}

// ── Recenter button ────────────────────────────

function RecenterButton({ onRecenter }: { onRecenter: () => void }) {
  return (
    <div className="tactical-map__controls">
      <button onClick={onRecenter} title="Recenter on hiker">⌖</button>
    </div>
  );
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
  const hikerPosRef = useRef(new THREE.Vector3());
  const recenterRef = useRef<(() => void) | null>(null);

  if (webglFailed) return <TacticalMapLegacy />;

  return (
    <div className="tactical-map">
      <RecenterButton onRecenter={() => recenterRef.current?.()} />
      <WebGLErrorBoundary onError={() => setWebglFailed(true)}>
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 40, near: 0.1, far: 50, position: [2, 3, 4] }}
          frameloop="always"
        >
          <CameraSystem hikerPosRef={hikerPosRef} recenterRef={recenterRef} />
          <FogController />
          <GridFloor />
          <TerrainWireframe />
          <TrailLine />
          <WaypointMarkers />
          <HikerMarker hikerPosRef={hikerPosRef} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
