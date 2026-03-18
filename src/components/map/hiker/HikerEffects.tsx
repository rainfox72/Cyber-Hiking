/**
 * HikerEffects — Trail afterimages and radar ping effects for the hiker.
 *
 * Trail afterimages: 4 ghost silhouettes (11 spheres each) in a ring buffer,
 * updated every 0.3s during movement with fading opacity.
 *
 * Radar ping: single reusable RingGeometry that expands on waypoint arrival,
 * colored by health state.
 *
 * Lives as a sibling of <group ref={markerRef}> in world space so afterimages
 * can persist at old positions as the hiker advances.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HikerEffectsProps {
  hikerPosRef: React.MutableRefObject<THREE.Vector3>;
  isMoving: boolean;
  currentWaypointIndex: number;
  healthPercent: number;
  isLost: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NUM_GHOSTS = 4;
const NUM_JOINTS = 11;
const GHOST_INTERVAL = 0.3;   // seconds between ghost captures
const GHOST_LIFETIME = 0.6;   // seconds for full fade-out
const GHOST_FADE_OUT = 0.3;   // fade-out on movement end

const PING_DURATION = 0.8;    // seconds for ring expansion
const PING_MAX_RADIUS = 1.5;
const PING_INNER_RATIO = 0.92; // innerRadius = outerRadius * ratio

// Humanoid joint offsets (x, y, z) relative to group center (hips ≈ 0,0,0).
// Ordered to match the 11 joints: hips, spine, head,
// armL, forearmL, armR, forearmR, legL, shinL, legR, shinR
const JOINT_OFFSETS: ReadonlyArray<[number, number, number]> = [
  [  0.000,  0.000,  0.000 ], // hips
  [  0.000,  0.040,  0.000 ], // spine
  [  0.000,  0.110,  0.000 ], // head
  [ -0.025,  0.090,  0.000 ], // armL
  [ -0.025,  0.055,  0.000 ], // forearmL
  [  0.025,  0.090,  0.000 ], // armR
  [  0.025,  0.055,  0.000 ], // forearmR
  [ -0.012,  0.000,  0.000 ], // legL
  [ -0.012, -0.045,  0.000 ], // shinL
  [  0.012,  0.000,  0.000 ], // legR
  [  0.012, -0.045,  0.000 ], // shinR
];

// ---------------------------------------------------------------------------
// Helper: derive ping color
// ---------------------------------------------------------------------------

function pingColor(healthPercent: number, wasJustFoundRef: boolean): string {
  if (wasJustFoundRef) return "#00ccdd"; // cyan when just resolved lost state
  if (healthPercent > 60) return "#00ff41";
  if (healthPercent >= 30) return "#ffb000";
  return "#ff2222";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HikerEffects({
  hikerPosRef,
  isMoving,
  currentWaypointIndex,
  healthPercent,
  isLost,
}: HikerEffectsProps) {

  // ── Ghost ring buffer state ──
  const ghostTimerRef = useRef(0);
  const ghostHeadRef = useRef(0);  // ring buffer write pointer

  // Per-ghost: captured world position and birth time
  const ghostPosRef = useRef<THREE.Vector3[]>(
    Array.from({ length: NUM_GHOSTS }, () => new THREE.Vector3())
  );
  const ghostBirthRef = useRef<number[]>(Array(NUM_GHOSTS).fill(-9999));

  // Whether we're currently fading out (movement just ended)
  const fadingOutRef = useRef(false);
  const fadeOutStartRef = useRef(0);
  const wasMovingRef = useRef(false);

  // ── Ping state ──
  const pingActiveRef = useRef(false);
  const pingStartRef = useRef(0);
  const pingColorStrRef = useRef<string>("#00ff41");
  const prevWaypointRef = useRef(currentWaypointIndex);

  // Track lost→found transition for cyan ping
  const wasLostRef = useRef(isLost);
  const justFoundRef = useRef(false);

  // ── Geometry (pre-created, never regenerated) ──
  const ghostSphereGeo = useMemo(
    () => new THREE.SphereGeometry(0.005, 3, 3),
    []
  );

  // 4 ghost materials — one per ghost slot for independent opacity
  const ghostMats = useMemo(
    () =>
      Array.from({ length: NUM_GHOSTS }, () =>
        new THREE.MeshBasicMaterial({
          color: "#00ff41",
          transparent: true,
          opacity: 0,
          depthWrite: false,
        })
      ),
    []
  );

  // Ping geometry — a ring that we scale via uniforms/material opacity
  const pingRingGeo = useMemo(
    () => new THREE.RingGeometry(PING_MAX_RADIUS * PING_INNER_RATIO, PING_MAX_RADIUS, 48),
    []
  );

  const pingMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#00ff41",
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    []
  );

  // ── Refs to ghost group objects (one per ghost) ──
  const ghostGroupRefs = useRef<(THREE.Group | null)[]>(
    Array(NUM_GHOSTS).fill(null)
  );
  const pingMeshRef = useRef<THREE.Mesh>(null);

  // ── Dispose on unmount ──
  useEffect(() => {
    return () => {
      ghostSphereGeo.dispose();
      ghostMats.forEach((m) => m.dispose());
      pingRingGeo.dispose();
      pingMat.dispose();
    };
  }, [ghostSphereGeo, ghostMats, pingRingGeo, pingMat]);

  // ── Per-frame logic ──
  useFrame(({ clock }, delta) => {
    const elapsed = clock.elapsedTime;

    // ── Track lost→found for cyan ping ──
    if (wasLostRef.current && !isLost) {
      justFoundRef.current = true;
    } else if (!isLost && justFoundRef.current && prevWaypointRef.current !== currentWaypointIndex) {
      // Once we advance after being found, clear the cyan flag
      justFoundRef.current = false;
    }
    wasLostRef.current = isLost;

    // ── Detect waypoint change → trigger ping ──
    if (currentWaypointIndex !== prevWaypointRef.current) {
      prevWaypointRef.current = currentWaypointIndex;
      pingActiveRef.current = true;
      pingStartRef.current = elapsed;
      pingColorStrRef.current = pingColor(healthPercent, justFoundRef.current);
      (pingMat.color as THREE.Color).setStyle(pingColorStrRef.current);
    }

    // ── Trail afterimage logic ──
    const movingNow = isMoving;

    // Detect movement-end transition
    if (wasMovingRef.current && !movingNow) {
      fadingOutRef.current = true;
      fadeOutStartRef.current = elapsed;
    }
    wasMovingRef.current = movingNow;

    if (movingNow) {
      fadingOutRef.current = false;

      // Advance ring buffer every GHOST_INTERVAL
      ghostTimerRef.current += delta;
      if (ghostTimerRef.current >= GHOST_INTERVAL) {
        ghostTimerRef.current = 0;
        const idx = ghostHeadRef.current;
        // Capture current world position
        ghostPosRef.current[idx].copy(hikerPosRef.current);
        ghostBirthRef.current[idx] = elapsed;
        ghostHeadRef.current = (idx + 1) % NUM_GHOSTS;
      }
    }

    // Update each ghost group visibility + opacity + position
    for (let g = 0; g < NUM_GHOSTS; g++) {
      const grp = ghostGroupRefs.current[g];
      if (!grp) continue;

      const birthTime = ghostBirthRef.current[g];
      const age = elapsed - birthTime;

      let opacity = 0;
      let visible = false;

      if (birthTime > -9000) { // has been initialized
        if (movingNow && age <= GHOST_LIFETIME) {
          // Normal fade: 0.15 → 0 over GHOST_LIFETIME
          const t = age / GHOST_LIFETIME;
          opacity = 0.15 * (1 - t);
          visible = opacity > 0.005;
        } else if (fadingOutRef.current) {
          // Movement ended — fade remaining ghosts out over GHOST_FADE_OUT
          const fadeAge = elapsed - fadeOutStartRef.current;
          const baseOpacity = age <= GHOST_LIFETIME ? 0.15 * (1 - age / GHOST_LIFETIME) : 0;
          const fadeT = Math.min(fadeAge / GHOST_FADE_OUT, 1);
          opacity = baseOpacity * (1 - fadeT);
          visible = opacity > 0.005;
        }
      }

      grp.visible = visible;
      ghostMats[g].opacity = opacity;

      if (visible) {
        // Position each ghost at the captured world position
        grp.position.copy(ghostPosRef.current[g]);
        // Offset slightly backward along trail (simple backward bias along -Z)
        // This is a subtle backward push to stagger silhouettes
        const stagger = (g * 0.03);
        grp.position.x -= stagger * 0.5;
        grp.position.z -= stagger * 0.5;
      }
    }

    // ── Radar ping animation ──
    const pingMesh = pingMeshRef.current;
    if (pingMesh) {
      if (pingActiveRef.current) {
        const pingAge = elapsed - pingStartRef.current;
        const progress = Math.min(pingAge / PING_DURATION, 1);

        // Ease-out
        const eased = 1 - Math.pow(1 - progress, 3);

        // Scale ring from ~0 → full size
        const scale = eased;
        pingMesh.scale.setScalar(scale < 0.01 ? 0.01 : scale);

        // Opacity: 0.4 → 0
        pingMat.opacity = 0.4 * (1 - progress);

        // Y sine displacement
        pingMesh.position.x = hikerPosRef.current.x;
        pingMesh.position.z = hikerPosRef.current.z;
        pingMesh.position.y =
          hikerPosRef.current.y + 0.02 + Math.sin(progress * Math.PI * 3) * 0.03;

        if (progress >= 1) {
          pingActiveRef.current = false;
          pingMat.opacity = 0;
        }
      } else {
        // Keep ping at hiker position even when inactive
        pingMesh.position.x = hikerPosRef.current.x;
        pingMesh.position.z = hikerPosRef.current.z;
        pingMesh.position.y = hikerPosRef.current.y + 0.02;
      }
    }
  });

  // ── Build ghost joint positions ──
  // Static offsets from JOINT_OFFSETS; the group itself is positioned at the captured world pos
  const jointOffsetVecs = useMemo(
    () => JOINT_OFFSETS.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    []
  );

  // ── Render ──
  return (
    <>
      {/* Trail afterimage ghosts */}
      {Array.from({ length: NUM_GHOSTS }, (_, g) => (
        <group
          key={`ghost-${g}`}
          ref={(ref) => { ghostGroupRefs.current[g] = ref; }}
          visible={false}
        >
          {jointOffsetVecs.map((offset, j) => (
            <mesh
              key={`ghost-${g}-joint-${j}`}
              geometry={ghostSphereGeo}
              material={ghostMats[g]}
              position={[offset.x, offset.y, offset.z]}
            />
          ))}
        </group>
      ))}

      {/* Radar ping ring */}
      <mesh
        ref={pingMeshRef}
        geometry={pingRingGeo}
        material={pingMat}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[0.01, 0.01, 0.01]}
        position={[0, 0.02, 0]}
      />
    </>
  );
}
