/**
 * HikerRig3D — 3-layer "Hybrid Tactical Hologram" skeleton rig.
 *
 * Renders the 11-joint hiker as:
 *   1. Solid mesh     — low-segment geo, neon tinted, very transparent
 *   2. Edge wireframe — <Line> outlines on 6 major body parts
 *   3. Joint glow     — small emissive spheres at every joint pivot
 *
 * Health state drives color, opacity, and flicker effects.
 * Animation is delegated to HikerAnimator (pure TS state machine).
 *
 * This component lives inside the parent <group ref={markerRef}> in
 * TacticalMap3D — it NEVER modifies world position; only local bone
 * rotations, colors, props, and visual effects.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../../../store/gameStore.ts";
import { HikerAnimator } from "./hikerAnimator.ts";
import type {
  GameAction,
  WeatherCondition,
  TimeOfDay,
  GamePhase,
} from "../../../engine/types.ts";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HikerRig3DProps {
  lastAction: GameAction | null;
  turnNumber: number;
  currentWaypointIndex: number;
  isMoving: boolean;
  movementDuration: number;
  isLost: boolean;
  weather: WeatherCondition;
  timeOfDay: TimeOfDay;
  gamePhase: GamePhase;
}

// ---------------------------------------------------------------------------
// Health color thresholds
// ---------------------------------------------------------------------------

const COLOR_GREEN = new THREE.Color("#00ff41");
const COLOR_AMBER = new THREE.Color("#ffb000");
const COLOR_RED = new THREE.Color("#ff2222");
const COLOR_CYAN_GLITCH = new THREE.Color("#00ccdd");
const COLOR_MAGENTA_GLITCH = new THREE.Color("#cc00dd");

function healthColor(pct: number): THREE.Color {
  if (pct > 60) return COLOR_GREEN;
  if (pct >= 30) return COLOR_AMBER;
  return COLOR_RED;
}

// ---------------------------------------------------------------------------
// Edge extraction: box and cylinder wireframe outlines
// ---------------------------------------------------------------------------

/** Return line-loop points for the 12 edges of a box. */
function boxEdgePoints(w: number, h: number, d: number): THREE.Vector3[] {
  const hw = w / 2, hh = h / 2, hd = d / 2;
  // 8 corners
  const c = [
    new THREE.Vector3(-hw, -hh, -hd), // 0
    new THREE.Vector3( hw, -hh, -hd), // 1
    new THREE.Vector3( hw,  hh, -hd), // 2
    new THREE.Vector3(-hw,  hh, -hd), // 3
    new THREE.Vector3(-hw, -hh,  hd), // 4
    new THREE.Vector3( hw, -hh,  hd), // 5
    new THREE.Vector3( hw,  hh,  hd), // 6
    new THREE.Vector3(-hw,  hh,  hd), // 7
  ];
  // 12 edges as line segments (pairs)
  return [
    // front face
    c[0], c[1], c[1], c[2], c[2], c[3], c[3], c[0],
    // back face
    c[4], c[5], c[5], c[6], c[6], c[7], c[7], c[4],
    // connecting edges
    c[0], c[4], c[1], c[5], c[2], c[6], c[3], c[7],
  ];
}

// ---------------------------------------------------------------------------
// Joint names
// ---------------------------------------------------------------------------

type JointName =
  | "hips" | "spine" | "head"
  | "armL" | "forearmL" | "armR" | "forearmR"
  | "legL" | "shinL" | "legR" | "shinR";

const ALL_JOINTS: ReadonlyArray<JointName> = [
  "hips", "spine", "head",
  "armL", "forearmL", "armR", "forearmR",
  "legL", "shinL", "legR", "shinR",
];

// Edge wireframes are rendered on 6 major parts: head, spine, hips, legL, legR, pack.
// See edgePoints and edgeLine calls in JSX below.

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function HikerRig3D({
  lastAction,
  turnNumber,
  currentWaypointIndex,
  isMoving,
  movementDuration,
  isLost,
  weather,
  timeOfDay,
  gamePhase,
}: HikerRig3DProps) {
  // ── Store vitals for health color ──
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const healthPercent = (energy + hydration + bodyTemp + o2 + morale) / 5;

  // ── Animator (persistent across renders) ──
  const animatorRef = useRef(new HikerAnimator());

  // ── Group refs for every joint ──
  const rootRef = useRef<THREE.Group>(null);
  const hipsRef = useRef<THREE.Group>(null);
  const spineRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const armLRef = useRef<THREE.Group>(null);
  const forearmLRef = useRef<THREE.Group>(null);
  const armRRef = useRef<THREE.Group>(null);
  const forearmRRef = useRef<THREE.Group>(null);
  const legLRef = useRef<THREE.Group>(null);
  const shinLRef = useRef<THREE.Group>(null);
  const legRRef = useRef<THREE.Group>(null);
  const shinRRef = useRef<THREE.Group>(null);

  const jointRefs: Record<JointName, React.RefObject<THREE.Group | null>> = useMemo(
    () => ({
      hips: hipsRef,
      spine: spineRef,
      head: headRef,
      armL: armLRef,
      forearmL: forearmLRef,
      armR: armRRef,
      forearmR: forearmRRef,
      legL: legLRef,
      shinL: shinLRef,
      legR: legRRef,
      shinR: shinRRef,
    }),
    []
  );

  // ── Geometries (created once, disposed on unmount) ──
  const geos = useMemo(() => ({
    head:     new THREE.BoxGeometry(0.03, 0.035, 0.025),
    spine:    new THREE.BoxGeometry(0.04, 0.06, 0.02),
    hips:     new THREE.BoxGeometry(0.04, 0.02, 0.02),
    armL:     new THREE.CylinderGeometry(0.006, 0.006, 0.04, 4),
    armR:     new THREE.CylinderGeometry(0.006, 0.006, 0.04, 4),
    forearmL: new THREE.CylinderGeometry(0.005, 0.005, 0.035, 4),
    forearmR: new THREE.CylinderGeometry(0.005, 0.005, 0.035, 4),
    legL:     new THREE.BoxGeometry(0.02, 0.05, 0.015),
    legR:     new THREE.BoxGeometry(0.02, 0.05, 0.015),
    shinL:    new THREE.CylinderGeometry(0.006, 0.006, 0.045, 4),
    shinR:    new THREE.CylinderGeometry(0.006, 0.006, 0.045, 4),
    pack:     new THREE.BoxGeometry(0.025, 0.04, 0.015),
    jointGlow: new THREE.SphereGeometry(0.006, 4, 4),
    // Props
    mapProp:     new THREE.BoxGeometry(0.03, 0.001, 0.02),
    bottleProp:  new THREE.CylinderGeometry(0.003, 0.003, 0.015, 4),
    tentProp:    new THREE.ConeGeometry(0.08, 0.10, 6), // big tent on the ground
    medkitProp:  new THREE.BoxGeometry(0.008, 0.008, 0.006),
    foodProp:    new THREE.SphereGeometry(0.004, 4, 4),
  }), []);

  // ── Materials (created once, disposed on unmount) ──
  const mats = useMemo(() => ({
    solid: new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0.12,
      color: COLOR_GREEN,
    }),
    jointGlow: new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 1.0,
      color: COLOR_GREEN,
    }),
    // Prop materials (slightly brighter)
    propSolid: new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0.25,
      color: COLOR_GREEN,
    }),
    tentWire: new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      opacity: 0.5,
      color: COLOR_GREEN,
      wireframe: true,
    }),
  }), []);

  // ── Edge wireframe points (static box outlines for 6 major parts) ──
  const edgePoints = useMemo(() => ({
    head:  boxEdgePoints(0.03, 0.035, 0.025),
    spine: boxEdgePoints(0.04, 0.06, 0.02),
    hips:  boxEdgePoints(0.04, 0.02, 0.02),
    legL:  boxEdgePoints(0.02, 0.05, 0.015),
    legR:  boxEdgePoints(0.02, 0.05, 0.015),
    pack:  boxEdgePoints(0.025, 0.04, 0.015),
  }), []);

  // ── Dispose geometries and materials on unmount ──
  useEffect(() => {
    return () => {
      for (const g of Object.values(geos)) g.dispose();
      for (const m of Object.values(mats)) m.dispose();
    };
  }, [geos, mats]);

  // ── Camping "enter tent" animation progress (0=standing, 1=inside tent) ──
  const campProgressRef = useRef(0);

  // ── Prop visibility refs ──
  const mapPropRef = useRef<THREE.Mesh>(null);
  const bottlePropRef = useRef<THREE.Mesh>(null);
  const tentPropRef = useRef<THREE.Group>(null);
  const medkitPropRef = useRef<THREE.Mesh>(null);
  const foodPropRef = useRef<THREE.Mesh>(null);

  // ── Edge line refs (to update color/opacity per frame) ──
  const edgeLineRefs = useRef<Record<string, THREE.Object3D | null>>({});

  // ── Per-frame animation ──
  useFrame((state, delta) => {
    const animator = animatorRef.current;
    const elapsed = state.clock.elapsedTime;

    // Update animator state machine
    animator.update(
      delta,
      elapsed,
      lastAction,
      turnNumber,
      currentWaypointIndex,
      isMoving,
      movementDuration,
      isLost,
      gamePhase
    );

    // Copy joint quaternions to group refs
    for (const joint of ALL_JOINTS) {
      const ref = jointRefs[joint];
      if (ref.current && animator.jointQuats[joint]) {
        ref.current.quaternion.copy(animator.jointQuats[joint]);
      }
    }

    // Glitch jitter on root
    if (rootRef.current) {
      rootRef.current.position.x = animator.glitchActive
        ? animator.glitchJitterX
        : 0;
    }

    // ── Health-driven visual effects ──
    const hc = healthColor(healthPercent);
    const isBadWeather = weather === "fog" || weather === "blizzard";
    const isNight = timeOfDay === "night";

    // Determine base opacities
    let solidOpacity: number;
    let edgeOpacity: number;
    let glowOpacity: number;
    let glowScale: number;

    if (healthPercent > 60) {
      solidOpacity = 0.12;
      edgeOpacity = 0.9;
      glowOpacity = 1.0;
      glowScale = 1.0;
    } else if (healthPercent >= 30) {
      // Amber zone: edge opacity drops, solid flickers at 8Hz
      edgeOpacity = 0.5;
      solidOpacity = 0.08 + 0.07 * (0.5 + 0.5 * Math.sin(elapsed * 8 * Math.PI * 2));
      glowOpacity = 1.0;
      glowScale = 1.0;
    } else {
      // Red zone: edges flicker 10Hz, glow pulses 5Hz, solid flickers 12-15Hz
      edgeOpacity = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(elapsed * 10 * Math.PI * 2));
      glowOpacity = 0.6 + 0.4 * (0.5 + 0.5 * Math.sin(elapsed * 5 * Math.PI * 2));
      solidOpacity = 0.08 + 0.07 * (0.5 + 0.5 * Math.sin(elapsed * 13 * Math.PI * 2));
      glowScale = 1.0;
    }

    // Bad weather overrides: boost visibility
    if (isBadWeather) {
      solidOpacity = Math.max(solidOpacity, 0.4);
      edgeOpacity = 1.0;
      glowScale = 1.33;
    }

    // Night mode: boost glow
    if (isNight) {
      glowScale *= 1.33;
      glowOpacity = Math.min(glowOpacity * 1.2, 1.0);
    }

    // Glitch color override
    let edgeColor = hc;
    if (animator.glitchActive) {
      if (animator.glitchColorShift === "cyan") {
        edgeColor = COLOR_CYAN_GLITCH;
      } else if (animator.glitchColorShift === "magenta") {
        edgeColor = COLOR_MAGENTA_GLITCH;
      }
    }

    // Apply to solid material
    mats.solid.color.copy(hc);
    mats.solid.opacity = solidOpacity;

    // Apply to glow material
    mats.jointGlow.color.copy(edgeColor);
    mats.jointGlow.opacity = glowOpacity;

    // Apply glow sphere scale
    const glowSize = 0.006 * glowScale;
    // We set glow sphere scales via the group (handled below in the JSX via
    // a data attribute approach — but since Three.js meshes don't have data attrs,
    // we use a direct traversal approach stored in a ref)

    // Update edge line colors and opacity via ref traversal
    for (const key of Object.keys(edgeLineRefs.current)) {
      const obj = edgeLineRefs.current[key];
      if (!obj) continue;
      // drei Line uses Line2 which has a material with color and opacity
      const mat = (obj as unknown as { material?: THREE.Material }).material;
      if (mat && "color" in mat && "opacity" in mat) {
        (mat as THREE.LineBasicMaterial).color.copy(edgeColor);
        (mat as THREE.LineBasicMaterial).opacity = edgeOpacity;
      }
    }

    // Update prop material
    mats.propSolid.color.copy(hc);
    mats.tentWire.color.copy(hc);

    // Prop visibility based on animator's activeProp
    const activeProp = animator.activeProp;
    const isCamping = activeProp === "tent";
    if (mapPropRef.current)    mapPropRef.current.visible    = activeProp === "map";
    if (bottlePropRef.current) bottlePropRef.current.visible = activeProp === "bottle";
    if (medkitPropRef.current) medkitPropRef.current.visible = activeProp === "medkit";
    if (foodPropRef.current)   foodPropRef.current.visible   = activeProp === "food";

    // Camping "enter tent" animation
    if (isCamping) {
      campProgressRef.current = Math.min(1, campProgressRef.current + delta * 1.2); // ~0.8s to enter
    } else {
      campProgressRef.current = Math.max(0, campProgressRef.current - delta * 2.5); // fast exit
    }

    const campT = campProgressRef.current;

    // Tent: visible and scales up as hiker enters
    if (tentPropRef.current) {
      tentPropRef.current.visible = campT > 0.01;
      const tentScale = 0.3 + campT * 0.7; // 30% → 100%
      tentPropRef.current.scale.setScalar(tentScale);
    }

    // Hiker body: shrink + move toward tent as camping progresses
    if (hipsRef.current && campT > 0) {
      // Scale hiker down (1.0 → 0.2)
      const hikerScale = 1 - campT * 0.8;
      hipsRef.current.scale.setScalar(hikerScale);
      // Move hiker toward tent position
      hipsRef.current.position.x = campT * 0.04;
      // Fade hiker opacity
      mats.solid.opacity = solidOpacity * (1 - campT * 0.7);
    } else if (hipsRef.current && campT <= 0) {
      hipsRef.current.scale.setScalar(1);
      hipsRef.current.position.x = 0;
    }

    // Update glow sphere scales
    if (rootRef.current) {
      rootRef.current.traverse((child) => {
        if (child.userData.isGlowSphere) {
          child.scale.setScalar(glowSize / 0.006);
        }
      });
    }
  });

  // ── Helper: create joint glow sphere ──
  const glowSphere = (key: string) => (
    <mesh
      key={`glow-${key}`}
      geometry={geos.jointGlow}
      material={mats.jointGlow}
      userData={{ isGlowSphere: true }}
    />
  );

  // ── Helper: create edge wireframe for a body part ──
  const edgeLine = (key: string, points: THREE.Vector3[]) => (
    <Line
      key={`edge-${key}`}
      ref={(ref: THREE.Object3D | null) => {
        edgeLineRefs.current[key] = ref;
      }}
      points={points}
      color={COLOR_GREEN}
      lineWidth={2}
      transparent
      opacity={0.9}
      segments
    />
  );

  // ── Render ──
  return (
    <group ref={rootRef}>
      {/* ══ HIPS ══ */}
      <group ref={hipsRef} position={[0, 0.07, 0]}>
        {/* Solid mesh */}
        <mesh geometry={geos.hips} material={mats.solid} />
        {/* Edge wireframe */}
        {edgeLine("hips", edgePoints.hips)}
        {/* Joint glow at hips pivot */}
        {glowSphere("hips")}

        {/* ══ SPINE ══ */}
        <group ref={spineRef} position={[0, 0.04, 0]}>
          <mesh geometry={geos.spine} material={mats.solid} />
          {edgeLine("spine", edgePoints.spine)}
          {glowSphere("spine")}

          {/* ══ HEAD ══ */}
          <group ref={headRef} position={[0, 0.065, 0]}>
            <mesh geometry={geos.head} material={mats.solid} />
            {edgeLine("head", edgePoints.head)}
            {glowSphere("head")}
          </group>

          {/* ══ ARM LEFT ══ */}
          <group ref={armLRef} position={[-0.025, 0.05, 0]}>
            <mesh geometry={geos.armL} material={mats.solid} />
            {glowSphere("armL")}

            {/* ══ FOREARM LEFT ══ */}
            <group ref={forearmLRef} position={[0, -0.04, 0]}>
              <mesh geometry={geos.forearmL} material={mats.solid} />
              {glowSphere("forearmL")}

              {/* Props attached at left hand position */}
              <mesh
                ref={bottlePropRef}
                geometry={geos.bottleProp}
                material={mats.propSolid}
                position={[0, -0.015, 0]}
                visible={false}
              />
              <mesh
                ref={medkitPropRef}
                geometry={geos.medkitProp}
                material={mats.propSolid}
                position={[0, -0.015, 0]}
                visible={false}
              />
            </group>
          </group>

          {/* ══ ARM RIGHT ══ */}
          <group ref={armRRef} position={[0.025, 0.05, 0]}>
            <mesh geometry={geos.armR} material={mats.solid} />
            {glowSphere("armR")}

            {/* ══ FOREARM RIGHT ══ */}
            <group ref={forearmRRef} position={[0, -0.04, 0]}>
              <mesh geometry={geos.forearmR} material={mats.solid} />
              {glowSphere("forearmR")}

              {/* Map prop at right forearm */}
              <mesh
                ref={mapPropRef}
                geometry={geos.mapProp}
                material={mats.propSolid}
                position={[0, -0.015, 0]}
                visible={false}
              />
              {/* Food prop near mouth (attached at right forearm tip) */}
              <mesh
                ref={foodPropRef}
                geometry={geos.foodProp}
                material={mats.propSolid}
                position={[0, -0.01, 0]}
                visible={false}
              />
            </group>
          </group>

          {/* ══ PACK (static, no animation) ══ */}
          <group position={[0, 0.02, -0.015]}>
            <mesh geometry={geos.pack} material={mats.solid} />
            {edgeLine("pack", edgePoints.pack)}
          </group>
        </group>

        {/* ══ LEG LEFT ══ */}
        <group ref={legLRef} position={[-0.012, 0, 0]}>
          <mesh geometry={geos.legL} material={mats.solid} />
          {edgeLine("legL", edgePoints.legL)}
          {glowSphere("legL")}

          {/* ══ SHIN LEFT ══ */}
          <group ref={shinLRef} position={[0, -0.05, 0]}>
            <mesh geometry={geos.shinL} material={mats.solid} />
            {glowSphere("shinL")}
          </group>
        </group>

        {/* ══ LEG RIGHT ══ */}
        <group ref={legRRef} position={[0.012, 0, 0]}>
          <mesh geometry={geos.legR} material={mats.solid} />
          {edgeLine("legR", edgePoints.legR)}
          {glowSphere("legR")}

          {/* ══ SHIN RIGHT ══ */}
          <group ref={shinRRef} position={[0, -0.05, 0]}>
            <mesh geometry={geos.shinR} material={mats.solid} />
            {glowSphere("shinR")}
          </group>
        </group>
      </group>

      {/* ══ TENT PROP (ground level, beside hiker) ══ */}
      <group ref={tentPropRef} position={[0.06, -0.02, 0]} visible={false}>
        <mesh geometry={geos.tentProp} material={mats.tentWire} />
      </group>
    </group>
  );
}
