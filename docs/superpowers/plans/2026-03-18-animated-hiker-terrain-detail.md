# Animated 3D Hiker + Procedural Terrain Detail — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sphere+cylinder hiker with an 11-joint articulated 3D character using hybrid tactical hologram rendering, add terrain-type-specific procedural details and unique waypoint landmarks to the wireframe map.

**Architecture:** Two independent subsystems (hiker/ and terrain/) added as new directories under src/components/map/. The hiker rig replaces the sphere inside the existing HikerMarker group. Terrain details are added as sibling components in the R3F Canvas, consuming pre-computed placement data from terrainMesh.ts. Both tracks share no coupling.

**Tech Stack:** React 19, TypeScript, Three.js 0.183, @react-three/fiber v9, @react-three/drei v10 (specifically `<Line>` for fat lines), Zustand 5.

**Spec:** `docs/superpowers/specs/2026-03-18-animated-hiker-terrain-detail-design.md`

---

## File Map

### New Files — Hiker (Track A)

| File | Responsibility |
|------|---------------|
| `src/components/map/hiker/hikerPoses.ts` | Pose table: 9 poses as Euler rotation targets per joint, pre-converted to Quaternions |
| `src/components/map/hiker/hikerAnimator.ts` | Pose blending state machine (IDLE/GLITCH/BLENDING/WALKING), walk cycle logic |
| `src/components/map/hiker/HikerRig3D.tsx` | Skeleton group with 3-layer rendering (solid + Line edges + joint glow), props system |
| `src/components/map/hiker/HikerEffects.tsx` | CRT glitch overlay, trail afterimages (joint-only ghosts), radar ping on arrival |

### New Files — Terrain (Track B)

| File | Responsibility |
|------|---------------|
| `src/components/map/terrain/terrainDetails.ts` | Detail placement generator: per-terrain density, trail exclusion, instance matrices |
| `src/components/map/terrain/TerrainVegetation.tsx` | Instanced trees + merged line grass/shrubs |
| `src/components/map/terrain/TerrainRocks.tsx` | Instanced rocks + merged line debris |
| `src/components/map/terrain/TerrainWater.tsx` | Stream valley water ribbons with opacity pulse |
| `src/components/map/terrain/TerrainLandmarks.tsx` | 6 unique waypoint landmark types with animations |

### Modified Files

| File | Change |
|------|--------|
| `src/components/map/terrainMesh.ts` | Export `GRID_X`, `GRID_Z`, `valueNoise`, per-cell terrain type array |
| `src/components/map/TacticalMap3D.tsx` | Replace sphere with HikerRig3D, remove Y-bob, add health/turn selectors, add terrain detail components, compute DETAIL_DATA |
| `CHANGELOG.md` | v3.2 entry |
| `CLAUDE.md` | Update architecture section with new hiker/ and terrain/ directories |

---

## Track A: Animated 3D Hiker

### Task 1: Pose Table (`hikerPoses.ts`)

**Files:**
- Create: `src/components/map/hiker/hikerPoses.ts`

**Context:** This is pure data — no React, no Three.js runtime. Defines the 9 pose targets as Euler rotations, pre-converts to Quaternions at load time. Reference the SVG poses in `src/components/map/HumanMarker.tsx:20-40` for action→pose mapping and `HumanMarker.tsx:83-209` for the geometric pose shapes to translate into 3D joint angles.

- [ ] **Step 1: Create the pose types and action mapping**

```ts
// src/components/map/hiker/hikerPoses.ts
import * as THREE from "three";
import type { GameAction } from "../../../engine/types.ts";

/** Euler rotation targets [x, y, z] in radians for each joint */
type EulerTarget = [number, number, number];

interface PoseEulers {
  hips: EulerTarget;
  spine: EulerTarget;
  head: EulerTarget;
  armL: EulerTarget;
  forearmL: EulerTarget;
  armR: EulerTarget;
  forearmR: EulerTarget;
  legL: EulerTarget;
  shinL: EulerTarget;
  legR: EulerTarget;
  shinR: EulerTarget;
}

export interface PoseDef {
  joints: Record<string, THREE.Quaternion>;
  prop: "map" | "bottle" | "tent" | "medkit" | "food" | null;
  facing: "forward" | "backward";
}

export type HikerPose =
  | "idle" | "walkingA" | "walkingB"
  | "camping" | "eating" | "drinking"
  | "resting" | "mapping" | "medicine";
```

- [ ] **Step 2: Define all 9 poses as Euler targets and convert to Quaternions**

Define the `POSE_EULERS` record with all 9 poses. Key angles to get right:
- `idle`: slight forward spine lean (0.05 rad X), arms relaxed at sides (~0.15 rad Z outward)
- `walkingA` / `walkingB`: alternating leg/arm stride (~±0.4 rad on legs, ±0.2 on arms)
- `camping`: deep hip crouch (-0.5 rad X on hips), arms forward
- `eating`: seated crouch, right arm raised to mouth
- `drinking`: standing, left arm raised with bottle prop
- `resting`: seated, shoulders slumped, spine leaned back
- `mapping`: standing tall, both arms forward/up holding map prop
- `medicine`: crouched, left arm extended with medkit prop

Then convert each to `PoseDef` with pre-computed Quaternions:

```ts
function eulersToPose(
  eulers: PoseEulers,
  prop: PoseDef["prop"],
  facing: PoseDef["facing"],
): PoseDef {
  const joints: Record<string, THREE.Quaternion> = {};
  for (const [name, [x, y, z]] of Object.entries(eulers)) {
    joints[name] = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));
  }
  return { joints, prop, facing };
}

export const POSES: Record<HikerPose, PoseDef> = {
  idle: eulersToPose({ /* angles */ }, null, "forward"),
  walkingA: eulersToPose({ /* angles */ }, null, "forward"),
  walkingB: eulersToPose({ /* angles */ }, null, "forward"),
  camping: eulersToPose({ /* angles */ }, "tent", "forward"),
  eating: eulersToPose({ /* angles */ }, "food", "forward"),
  drinking: eulersToPose({ /* angles */ }, "bottle", "forward"),
  resting: eulersToPose({ /* angles */ }, null, "forward"),
  mapping: eulersToPose({ /* angles */ }, "map", "forward"),
  medicine: eulersToPose({ /* angles */ }, "medkit", "forward"),
};
```

Fill in actual angle values during implementation — these will need visual tuning.

- [ ] **Step 3: Add action→pose mapping function**

```ts
export function actionToPose(action: GameAction | null): HikerPose {
  switch (action) {
    case "push_forward":
    case "descend":
      return "walkingA"; // walk cycle handles A↔B
    case "set_camp": return "camping";
    case "eat": return "eating";
    case "drink": return "drinking";
    case "rest": return "resting";
    case "check_map": return "mapping";
    case "use_medicine": return "medicine";
    default: return "idle";
  }
}
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add src/components/map/hiker/hikerPoses.ts
git commit -m "feat(hiker): pose table with 9 poses and Euler→Quaternion conversion"
```

---

### Task 2: Animation State Machine (`hikerAnimator.ts`)

**Files:**
- Create: `src/components/map/hiker/hikerAnimator.ts`

**Context:** Pure TS module (no React). Manages the IDLE → GLITCH → BLENDING → IDLE / WALKING state machine. Called from `useFrame` in HikerRig3D. The walk cycle syncs to the existing movement animation durations (2.5s push_forward, 1.5s descend) already in `TacticalMap3D.tsx:246`.

- [ ] **Step 1: Create the animator types and class**

```ts
// src/components/map/hiker/hikerAnimator.ts
import * as THREE from "three";
import { POSES, actionToPose, type HikerPose, type PoseDef } from "./hikerPoses.ts";
import type { GameAction } from "../../../engine/types.ts";

type AnimState = "idle" | "glitch" | "blending" | "walking" | "wandering";

export interface AnimatorConfig {
  glitchDuration: number;    // 0.05 (50ms)
  blendDuration: number;     // 0.2  (200ms)
  idleWobbleAmp: number;     // 0.02 rad
  idleWobblePeriod: number;  // 3.0s
}

const DEFAULT_CONFIG: AnimatorConfig = {
  glitchDuration: 0.05,
  blendDuration: 0.2,
  idleWobbleAmp: 0.02,
  idleWobblePeriod: 3.0,
};

export class HikerAnimator {
  state: AnimState = "idle";
  currentPose: PoseDef;
  targetPose: PoseDef;
  progress = 0;
  config: AnimatorConfig;

  // Walk cycle state
  private walkStepProgress = 0;
  private walkStepDuration = 0;
  private walkPoseA = true; // alternates A↔B
  private walkTotalDuration = 0;
  private walkElapsed = 0;

  // Trigger tracking
  private lastTriggerKey = "";

  // Per-joint current quaternions (mutated in place for perf)
  jointQuats: Record<string, THREE.Quaternion> = {};

  // Glitch state for effects
  glitchActive = false;
  glitchJitterX = 0;
  glitchColorShift: "none" | "cyan" | "magenta" = "none"; // color channel shift during glitch

  constructor(config: Partial<AnimatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentPose = POSES.idle;
    this.targetPose = POSES.idle;
    // Init joint quats from idle
    for (const [name, quat] of Object.entries(POSES.idle.joints)) {
      this.jointQuats[name] = quat.clone();
    }
  }
  // ... methods in next steps
}
```

- [ ] **Step 2: Implement the update method**

The `update(delta, elapsed, action, turnNumber, waypointIndex, isMoving, moveDuration, gamePhase)` method:
1. Check `gamePhase !== "playing"` → freeze, return early
2. Build trigger key from `turnNumber-action-waypointIndex`
3. If trigger changed and `isMoving` → enter WALKING
4. If trigger changed and not moving → enter GLITCH → BLENDING
5. In each state, advance progress and interpolate joints via `Quaternion.slerp`
6. In IDLE, apply spine breathing wobble

```ts
update(
  delta: number,
  elapsed: number,
  action: GameAction | null,
  turnNumber: number,
  waypointIndex: number,
  isMoving: boolean,
  moveDuration: number,
  isLost: boolean,
  gamePhase: string,
): void {
  // Freeze during non-playing phases
  if (gamePhase !== "playing") return;

  // Detect action change
  const triggerKey = `${turnNumber}-${action}-${waypointIndex}`;
  if (triggerKey !== this.lastTriggerKey) {
    this.lastTriggerKey = triggerKey;
    const newPose = actionToPose(action);
    this.targetPose = POSES[newPose];

    if (isMoving) {
      this.startWalking(moveDuration);
    } else if (isLost && (action === "push_forward" || action === "descend")) {
      // Push while lost: no walk cycle, enter wandering idle (restless sway)
      this.state = "wandering";
      this.progress = 0;
    } else {
      this.enterGlitch();
    }
  }

  // State machine
  switch (this.state) {
    case "glitch":
      this.updateGlitch(delta);
      break;
    case "blending":
      this.updateBlending(delta);
      break;
    case "walking":
      this.updateWalking(delta);
      // If movement ended, transition out
      if (!isMoving) {
        this.targetPose = POSES.idle;
        this.enterGlitch();
      }
      break;
    case "wandering":
      this.updateWandering(elapsed);
      break;
    case "idle":
      this.updateIdle(elapsed);
      break;
  }
}
```

- [ ] **Step 3: Implement state transition helpers**

```ts
private enterGlitch(): void {
  this.state = "glitch";
  this.progress = 0;
  this.glitchActive = true;
  this.glitchJitterX = (Math.random() - 0.5) * 0.01;
  this.glitchColorShift = Math.random() > 0.5 ? "cyan" : "magenta";
}

private updateGlitch(delta: number): void {
  this.progress += delta / this.config.glitchDuration;
  if (this.progress >= 1) {
    this.glitchActive = false;
    this.glitchJitterX = 0;
    this.glitchColorShift = "none";
    this.state = "blending";
    this.progress = 0;
    this.snapshotCurrent();
  }
}

private snapshotCurrent(): void {
  this.currentPose = {
    joints: Object.fromEntries(
      Object.entries(this.jointQuats).map(([k, q]) => [k, q.clone()])
    ),
    prop: this.targetPose.prop,
    facing: this.targetPose.facing,
  };
}

private updateBlending(delta: number): void {
  this.progress += delta / this.config.blendDuration;
  const t = this.easeInOut(Math.min(this.progress, 1));
  this.slerpJoints(this.currentPose, this.targetPose, t);
  if (this.progress >= 1) {
    this.state = "idle";
  }
}

private startWalking(duration: number): void {
  this.state = "walking";
  this.walkTotalDuration = duration;
  this.walkElapsed = 0;
  const stepCount = duration > 2 ? 4 : 3;
  this.walkStepDuration = duration / stepCount;
  this.walkStepProgress = 0;
  this.walkPoseA = true;
  this.glitchActive = false;
  this.glitchJitterX = 0;
}

private updateWalking(delta: number): void {
  this.walkElapsed += delta;
  this.walkStepProgress += delta / this.walkStepDuration;
  if (this.walkStepProgress >= 1) {
    this.walkStepProgress -= 1;
    this.walkPoseA = !this.walkPoseA;
  }
  const from = this.walkPoseA ? POSES.walkingA : POSES.walkingB;
  const to = this.walkPoseA ? POSES.walkingB : POSES.walkingA;
  const t = this.easeInOut(this.walkStepProgress);
  this.slerpJoints(from, to, t);
}

private updateWandering(elapsed: number): void {
  // Restless sway when lost: hips and spine oscillate irregularly
  const swayX = Math.sin(elapsed * 1.5) * 0.04;
  const swayZ = Math.cos(elapsed * 2.1) * 0.03;
  const hipsTarget = this.targetPose.joints["hips"];
  const spineTarget = this.targetPose.joints["spine"];
  if (hipsTarget && this.jointQuats["hips"]) {
    const wobble = new THREE.Quaternion().setFromEuler(new THREE.Euler(swayX, 0, swayZ));
    this.jointQuats["hips"].copy(hipsTarget).multiply(wobble);
  }
  if (spineTarget && this.jointQuats["spine"]) {
    const wobble = new THREE.Quaternion().setFromEuler(new THREE.Euler(-swayX * 0.5, swayZ, 0));
    this.jointQuats["spine"].copy(spineTarget).multiply(wobble);
  }
}

private updateIdle(elapsed: number): void {
  // Breathing wobble on spine
  const wobble = Math.sin(elapsed * (Math.PI * 2) / this.config.idleWobblePeriod)
    * this.config.idleWobbleAmp;
  const spineTarget = this.targetPose.joints["spine"];
  if (spineTarget && this.jointQuats["spine"]) {
    const wobbleQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(wobble, 0, 0));
    this.jointQuats["spine"].copy(spineTarget).multiply(wobbleQuat);
  }
}

private slerpJoints(from: PoseDef, to: PoseDef, t: number): void {
  for (const name of Object.keys(this.jointQuats)) {
    const fromQ = from.joints[name];
    const toQ = to.joints[name];
    if (fromQ && toQ) {
      this.jointQuats[name].slerpQuaternions(fromQ, toQ, t);
    }
  }
}

private easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
```

- [ ] **Step 4: Export the `activeProp` getter**

```ts
get activeProp(): PoseDef["prop"] {
  return this.targetPose.prop;
}

get facingDirection(): PoseDef["facing"] {
  return this.targetPose.facing;
}
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 6: Commit**

```bash
git add src/components/map/hiker/hikerAnimator.ts
git commit -m "feat(hiker): pose blending state machine with walk cycle and CRT glitch"
```

---

### Task 3: Skeleton Rig Rendering (`HikerRig3D.tsx`)

**Files:**
- Create: `src/components/map/hiker/HikerRig3D.tsx`

**Context:** R3F component. Renders the 11-joint skeleton with 3-layer hybrid hologram. Reads animation state from `HikerAnimator` each frame. Must import `{ Line }` from `@react-three/drei` for fat edges. Reference body proportions from spec Section 1.

- [ ] **Step 1: Create the component with skeleton group hierarchy**

Build the `THREE.Group` tree matching the spec skeleton:
- Root at feet (local origin 0,0,0)
- Hips offset upward (y=0.07)
- Spine, head, arms, legs as children
- Each body part: solid mesh + optional Line edge + joint glow sphere
- Use `useRef` for each joint group so animator can set quaternions

```tsx
// src/components/map/hiker/HikerRig3D.tsx
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import * as THREE from "three";
import { useGameStore } from "../../../store/gameStore.ts";
import { HikerAnimator } from "./hikerAnimator.ts";

// ... component props, body part geometries, color logic
```

- [ ] **Step 2: Implement body part geometries (memoized once)**

Create all geometries in `useMemo` — never regenerated:
- Head: `BoxGeometry(0.03, 0.035, 0.025)`
- Spine: `BoxGeometry(0.04, 0.06, 0.02)`
- Hips: `BoxGeometry(0.04, 0.02, 0.02)`
- Upper legs: `BoxGeometry(0.02, 0.05, 0.015)`
- Upper arms: `CylinderGeometry(0.006, 0.006, 0.04, 4)`
- Forearms: `CylinderGeometry(0.005, 0.005, 0.035, 4)`
- Shins: `CylinderGeometry(0.006, 0.006, 0.045, 4)`
- Pack: `BoxGeometry(0.025, 0.04, 0.015)`
- Joint glow: `SphereGeometry(0.006, 4, 4)`

Extract edge points from the 6 major part geometries for `<Line>` components (head, spine, hips, legL, legR, pack).

- [ ] **Step 3: Implement health color system**

```tsx
function useHealthColor(): THREE.Color {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const healthPercent = (energy + hydration + bodyTemp + o2 + morale) / 5;

  return useMemo(() => {
    if (healthPercent > 60) return new THREE.Color("#00ff41");
    if (healthPercent > 30) return new THREE.Color("#ffb000");
    return new THREE.Color("#ff2222");
  }, [healthPercent]);
}
```

- [ ] **Step 4: Implement the useFrame loop**

Each frame:
1. Call `animator.update(delta, elapsed, action, turnNumber, waypointIndex, isMoving, moveDuration, isLost, gamePhase)`
2. Copy `animator.jointQuats` to each joint group's `quaternion`
3. Apply glitch jitter to root position.x if `animator.glitchActive`
4. Apply glitch color shift: if `animator.glitchColorShift === "cyan"`, tint edge materials `#00ccdd`; if `"magenta"`, tint `#cc00dd`; else use health color
5. Update material colors/opacities based on health:
   - `> 60%`: normal opacity (solid 0.12, edges 0.9)
   - `30-60%`: edge opacity drops to 0.5, solid flickers (0.08 ↔ 0.15 at 8Hz via `Math.sin(elapsed * 50)`)
   - `< 30%`: edges flicker (0.4 ↔ 0.9 at 10Hz), joint glow pulses (opacity 0.6 ↔ 1.0 at 5Hz), solid flickers at 12-15Hz
6. Toggle prop visibility based on `animator.activeProp`
7. Apply bad-weather forced opacity: if fog/blizzard, clamp solid minimum to 0.4, edges to 1.0, joint glow radius scale to 0.008/0.006 = 1.33x
8. Apply night mode: if night, scale joint glow radius to 1.33x (0.006 → 0.008), increase joint glow opacity

- [ ] **Step 5: Add dispose cleanup in useEffect**

Dispose all geometries and materials on unmount:
```tsx
useEffect(() => {
  return () => {
    // Dispose all memoized geometries and materials
  };
}, []);
```

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 7: Commit**

```bash
git add src/components/map/hiker/HikerRig3D.tsx
git commit -m "feat(hiker): 3-layer hybrid hologram skeleton rig with 11 joints"
```

---

### Task 4: Wire Hiker into TacticalMap3D

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx:215-325` (HikerMarker function)

**Context:** Replace the sphere+cylinder (lines 312-320) with `<HikerRig3D>`. Remove the Y-axis bob (lines 275, 304). Add store selectors for `turnNumber`, health vitals, `gamePhase`, `weather`, `timeOfDay`.

- [ ] **Step 1: Add new imports and store selectors to HikerMarker**

```tsx
import { HikerRig3D } from "./hiker/HikerRig3D.tsx";

// Inside HikerMarker function, add selectors:
const turnNumber = useGameStore((s) => s.turnNumber);
const weather = useGameStore((s) => s.weather.current);
const timeOfDay = useGameStore((s) => s.time.timeOfDay);
const gamePhase = useGameStore((s) => s.gamePhase);
```

- [ ] **Step 2: Remove Y-axis bob from useFrame**

In the movement animation branch (line 275):
- Change `markerRef.current.position.y += 0.15 + Math.sin(clock.elapsedTime * 4) * 0.02;`
- To: `markerRef.current.position.y += 0.15;` (static offset, no bob — rig owns secondary motion)

In the idle/lost branch (line 304):
- Change `markerRef.current.position.y += 0.15 + Math.sin(clock.elapsedTime * 2) * 0.02;`
- To: `markerRef.current.position.y += 0.15;`

- [ ] **Step 3: Replace sphere+cylinder with HikerRig3D**

Replace lines 312-320:
```tsx
// OLD:
<mesh>
  <sphereGeometry args={[0.04, 8, 8]} />
  <meshBasicMaterial color="#00ff41" />
</mesh>
<mesh position={[0, 0.15, 0]}>
  <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
  <meshBasicMaterial color="#00ff41" transparent opacity={0.4} />
</mesh>

// NEW:
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
```

- [ ] **Step 4: Type check and visual test**

Run: `npx tsc --noEmit`
Then: `npm run dev` and verify the hiker renders on the terrain with correct positioning.
Test: change actions (eat, drink, camp, etc.) and confirm pose changes.
Test: push_forward and verify walk cycle plays during movement.
Test: lost state still works (displacement, search ring).

- [ ] **Step 5: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx
git commit -m "feat(hiker): wire HikerRig3D into TacticalMap3D, remove sphere"
```

---

### Task 5: Hiker Effects (`HikerEffects.tsx`)

**Files:**
- Create: `src/components/map/hiker/HikerEffects.tsx`
- Modify: `src/components/map/TacticalMap3D.tsx` (add HikerEffects next to HikerRig3D)

**Context:** Three effects: (1) CRT glitch overlay is already handled by HikerAnimator's `glitchActive` state in HikerRig3D. (2) Trail afterimages: ring buffer of 4 joint-only ghosts. (3) Radar ping: expanding ring on waypoint arrival. Both are R3F components.

- [ ] **Step 1: Create trail afterimage system**

```tsx
// src/components/map/hiker/HikerEffects.tsx
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface HikerEffectsProps {
  hikerPosRef: React.MutableRefObject<THREE.Vector3>;
  isMoving: boolean;
  currentWaypointIndex: number;
  healthPercent: number;  // for radar ping color (green/amber/red)
  isLost: boolean;
}
```

Afterimage implementation:
- Pre-create 4 groups, each with 11 small spheres (joint positions)
- Ring buffer index advances every 0.3s during movement
- Each ghost copies the hiker's world position + a small trail offset
- Opacity fades from 0.15 → 0 over 0.6s
- Material: `MeshBasicMaterial({ color: "#00ff41", transparent: true })`
- All hidden when not moving

- [ ] **Step 2: Create radar ping system**

Single reusable `RingGeometry` mesh:
- Triggered when `currentWaypointIndex` changes (tracked via `useRef`)
- Expands r=0 → r=1.5 over 0.8s with ease-out
- Opacity 0.4 → 0.0
- Color: health-driven (`#00ff41` green / `#ffb000` amber / `#ff2222` red) from `healthPercent` prop. If `isLost` was just resolved, use `#00ccdd` cyan to distinguish from red search ring.
- Position: flat on terrain surface at hiker position
- Sine-wave Y displacement: `ringMesh.position.y = 0.02 + Math.sin(ringProgress * Math.PI * 3) * 0.03` (makes terrain topology feel interactive)
- Reset and re-trigger on each waypoint change

- [ ] **Step 3: Wire into TacticalMap3D**

Add `<HikerEffects>` as sibling of `<HikerRig3D>` inside the markerRef group in `HikerMarker`:

```tsx
<group ref={markerRef}>
  <HikerRig3D ... />
  <HikerEffects
    hikerPosRef={hikerDisplayPos}
    isMoving={animRef.current.active}
    currentWaypointIndex={currentIndex}
    healthPercent={healthPercent}
    isLost={isLost}
  />
</group>
```

- [ ] **Step 4: Type check and visual test**

Run: `npx tsc --noEmit`
Then: `npm run dev` and test:
- Push forward → verify ghost dots trail behind the hiker
- Arrive at waypoint → verify expanding ring
- Lost → found → arrive → verify cyan ping doesn't overlap with red search ring

- [ ] **Step 5: Commit**

```bash
git add src/components/map/hiker/HikerEffects.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat(hiker): trail afterimages and radar ping on waypoint arrival"
```

---

## Track B: Procedural Terrain Detail

> Track B tasks are independent of Track A at the code level (no cross-imports). However, **Task 12 (wiring terrain into TacticalMap3D) should run AFTER Task 4 (wiring hiker)** to avoid merge conflicts — both modify `TacticalMap3D.tsx` and add store selectors. Tasks 6-11 can run in parallel with Track A.

### Task 6: Export Terrain Data (`terrainMesh.ts`)

**Files:**
- Modify: `src/components/map/terrainMesh.ts`

**Context:** The detail placement generator needs access to per-cell terrain type, grid constants, and the noise function. Currently these are local to `terrainMesh.ts`. We need to export them without changing existing behavior.

- [ ] **Step 1: Export grid constants and valueNoise**

At the top of `terrainMesh.ts`, change:
```ts
// BEFORE (lines 10-11):
const GRID_X = 128;
const GRID_Z = 64;

// AFTER:
export const GRID_X = 128;
export const GRID_Z = 64;
```

Export the `valueNoise` function (line 36):
```ts
// BEFORE:
function valueNoise(...)

// AFTER:
export function valueNoise(...)
```

- [ ] **Step 2: Add per-cell terrain type to TerrainMeshData**

Add to `TerrainMeshData` interface (line 94):
```ts
export interface TerrainMeshData {
  // ... existing fields ...
  cellTerrains: Uint8Array;   // terrain type index per grid cell (ix * GRID_Z + iz)
  elevations: Float32Array;   // elevation in meters per grid cell
}
```

Add terrain type encoding in `generateTerrainMesh` (inside the existing grid loop at line 114):
```ts
// After the existing grid loop variables, add:
const terrainTypes: TerrainType[] = ["forest", "meadow", "stone_sea", "ridge", "summit", "scree", "stream_valley"];
const cellTerrains = new Uint8Array(GRID_X * GRID_Z);
const elevationsOut = new Float32Array(GRID_X * GRID_Z);

// Inside the ix loop (after sampleTrail call on line 117):
const terrainIdx = terrainTypes.indexOf(terrain);

// Inside the iz loop:
const cellIdx = ix * GRID_Z + iz;
cellTerrains[cellIdx] = terrainIdx;
elevationsOut[cellIdx] = finalElev;
```

Add to return value (line 205):
```ts
return { positions, colors, indices, edgePositions, edgeColors, trailPoints, waypointPositions, cellTerrains, elevations: elevationsOut };
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors (new fields are additive, existing consumers just ignore them)

- [ ] **Step 4: Commit**

```bash
git add src/components/map/terrainMesh.ts
git commit -m "feat(terrain): export grid constants, valueNoise, and per-cell terrain data"
```

---

### Task 7: Detail Placement Generator (`terrainDetails.ts`)

**Files:**
- Create: `src/components/map/terrain/terrainDetails.ts`

**Context:** Pure TS module. Takes `WAYPOINTS` + `TerrainMeshData` and generates pre-computed instance matrices (Float32Array) for vegetation, rocks, and water, plus landmark definitions. All computed once at module load — no runtime regeneration.

- [ ] **Step 1: Create types and skeleton**

```ts
// src/components/map/terrain/terrainDetails.ts
import * as THREE from "three";
import type { Waypoint, TerrainType } from "../../../engine/types.ts";
import type { TerrainMeshData } from "../terrainMesh.ts";
import { GRID_X, GRID_Z, valueNoise } from "../terrainMesh.ts";

export type LandmarkType =
  | "trailhead_gate" | "shelter_marker" | "shrine"
  | "cairn" | "warning_sign" | "summit_beacon";

export interface LandmarkDef {
  waypointId: string;
  type: LandmarkType;
  position: THREE.Vector3;
  scale: number;
}

export interface TerrainDetailData {
  trees: { matrices: Float32Array; count: number };
  grass: { positions: Float32Array; count: number };
  rocks: { matrices: Float32Array; colors: Float32Array; count: number };
  water: { positions: Float32Array; count: number };
  landmarks: LandmarkDef[];
}
```

- [ ] **Step 2: Implement placement algorithm**

Core loop: iterate grid cells, look up terrain type, apply per-terrain density/probability, jitter position, exclude trail corridor (`|zNorm| < 0.10`), sample Y from mesh positions.

```ts
export function generateTerrainDetails(
  waypoints: Waypoint[],
  meshData: TerrainMeshData,
): TerrainDetailData {
  const terrainTypes: TerrainType[] = [
    "forest", "meadow", "stone_sea", "ridge", "summit", "scree", "stream_valley"
  ];

  // Per-terrain density configs
  const TREE_DENSITY: Partial<Record<TerrainType, number>> = { forest: 0.08, meadow: 0.01 };
  const ROCK_DENSITY: Partial<Record<TerrainType, number>> = {
    stone_sea: 0.06, scree: 0.07, ridge: 0.02, summit: 0.03,
  };
  const GRASS_DENSITY: Partial<Record<TerrainType, number>> = { meadow: 0.12, forest: 0.06 };

  // ... collect instances into typed arrays
  // ... build landmark defs from waypoint IDs
}
```

Key implementation details:
- Use `valueNoise` for consistent jitter (same seed system as terrain)
- Elevation-driven tree scaling: below 2500m=1.0, 2500-3200m=0.8, above 3200m=0.6
- Tree wind-lean: above 2500m lean 0.1 rad, above 3200m lean 0.2 rad
- Rock colors sampled from `meshData.colors` at placement position
- Trail corridor exclusion: `const zNorm = (iz / (GRID_Z - 1)) * 2 - 1; if (Math.abs(zNorm) < 0.10) continue;`

- [ ] **Step 3: Implement landmark definitions**

```ts
function buildLandmarks(waypoints: Waypoint[], meshData: TerrainMeshData): LandmarkDef[] {
  const landmarks: LandmarkDef[] = [];
  const wpPosMap = new Map<string, THREE.Vector3>();
  waypoints.forEach((wp, i) => {
    wpPosMap.set(wp.id, meshData.waypointPositions[i]);
  });

  const add = (id: string, type: LandmarkType, scale = 1) => {
    const pos = wpPosMap.get(id);
    if (pos) landmarks.push({ waypointId: id, type, position: pos.clone(), scale });
  };

  add("tangkou", "trailhead_gate");
  add("camp_2900", "shelter_marker");
  add("camp_2800", "shelter_marker");
  add("yaowangmiao", "shrine");
  add("daohangja", "cairn");
  add("maijianliang", "cairn");
  add("taibailiang", "cairn");
  add("nantianmen", "warning_sign");
  add("baxiantai", "summit_beacon", 1.5);

  return landmarks;
}
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add src/components/map/terrain/terrainDetails.ts
git commit -m "feat(terrain): detail placement generator with per-terrain density and landmarks"
```

---

### Task 8: Vegetation Renderer (`TerrainVegetation.tsx`)

**Files:**
- Create: `src/components/map/terrain/TerrainVegetation.tsx`

**Context:** R3F component. Renders trees as `InstancedMesh` (ConeGeometry) and grass/shrubs as merged `LineSegments`. Consumes pre-computed matrices from `TerrainDetailData.trees` and positions from `TerrainDetailData.grass`.

- [ ] **Step 1: Create the component with tree instancing**

```tsx
// src/components/map/terrain/TerrainVegetation.tsx
import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { TerrainDetailData } from "./terrainDetails.ts";
import type { TimeOfDay, WeatherCondition } from "../../../engine/types.ts";

interface Props {
  details: TerrainDetailData;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}
```

Trees: two `InstancedMesh` (tall and short cone variants).
Material: `MeshBasicMaterial({ transparent: true, opacity: 0.4, depthWrite: false })`, color terrain-tinted green.

- [ ] **Step 2: Create grass as merged LineSegments**

Build a single `BufferGeometry` from all grass tuft positions. Each tuft = 3 lines fanning from base point. Use `Float32Array` for positions, render as one `LineSegments` draw call.

Add subtle sway in `useFrame`: offset Y of grass tips by `sin(elapsed * 2 + x * 10) * 0.003`.

- [ ] **Step 3: Apply night/weather dimming**

In `useFrame`:
- Night: set tree material opacity to 0.24 (60% of 0.4), grass to 0.18
- Fog/blizzard: further reduce to 0.15 / 0.10

- [ ] **Step 4: Add dispose cleanup**

```tsx
useEffect(() => {
  return () => { /* dispose geometries and materials */ };
}, []);
```

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add src/components/map/terrain/TerrainVegetation.tsx
git commit -m "feat(terrain): instanced trees and merged-line grass with weather dimming"
```

---

### Task 9: Rocks Renderer (`TerrainRocks.tsx`)

**Files:**
- Create: `src/components/map/terrain/TerrainRocks.tsx`

**Context:** Similar pattern to vegetation. `InstancedMesh` with `OctahedronGeometry` / `TetrahedronGeometry` variants. Rock colors inherited from terrain elevation colors.

- [ ] **Step 1: Create the component**

Two `InstancedMesh` variants:
- Variant A: `OctahedronGeometry(0.04, 0)` — larger boulders
- Variant B: `TetrahedronGeometry(0.025, 0)` — smaller debris

Apply instance color from `TerrainDetailData.rocks.colors` via `instanceColor` attribute.

- [ ] **Step 2: Add debris lines**

Merged `LineSegments` for small broken fragments (scree/stone_sea zones). Short random-angle lines.

- [ ] **Step 3: Night/weather dimming (same pattern as vegetation)**

TerrainRocks needs `weather` prop (same as TerrainVegetation) for fog/blizzard dimming:
```tsx
interface Props {
  details: TerrainDetailData;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;  // needed for fog/blizzard dimming
}
```

- [ ] **Step 4: Type check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/components/map/terrain/TerrainRocks.tsx
git commit -m "feat(terrain): instanced rocks with elevation-sampled colors and debris lines"
```

---

### Task 10: Water Renderer (`TerrainWater.tsx`)

**Files:**
- Create: `src/components/map/terrain/TerrainWater.tsx`

**Context:** Simplest terrain component. 2 parallel `Line` objects per stream_valley zone with opacity pulsing.

- [ ] **Step 1: Create the component**

```tsx
// Two Line objects with LineBasicMaterial, color #2288aa, opacity 0.3
// useFrame: pulse opacity with sin(elapsed * PI / 1.0) * 0.1 + 0.25
// Only rendered for stream_valley zone positions from TerrainDetailData.water
```

- [ ] **Step 2: Night dimming**

Night: reduce max opacity to 0.2. Fog: reduce to 0.15.

- [ ] **Step 3: Type check and commit**

```bash
git add src/components/map/terrain/TerrainWater.tsx
git commit -m "feat(terrain): stream valley water ribbons with opacity pulse"
```

---

### Task 11: Landmarks Renderer (`TerrainLandmarks.tsx`)

**Files:**
- Create: `src/components/map/terrain/TerrainLandmarks.tsx`

**Context:** 6 unique landmark types, each a small hand-built `<group>`. Not instanced (small count). Each has subtle animation. Warning sign is the most aggressive visual. Summit beacon is the most prominent.

- [ ] **Step 1: Create the component and landmark builders**

```tsx
// src/components/map/terrain/TerrainLandmarks.tsx
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LandmarkDef } from "./terrainDetails.ts";
import type { TimeOfDay, WeatherCondition } from "../../../engine/types.ts";

interface Props {
  details: { landmarks: LandmarkDef[] };
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
  currentIndex: number;
}
```

- [ ] **Step 2: Build each landmark type**

6 builder functions, each returning JSX `<group>`:
- `TrailheadGate`: 2 vertical `BoxGeometry` posts + 1 horizontal bar, wireframe edges
- `ShelterMarker`: `ConeGeometry` tent pyramid + small amber `SphereGeometry` campfire
- `Shrine`: Torii-gate from boxes (2 posts + curved top box)
- `Cairn`: 3 stacked `OctahedronGeometry` (sizes 0.04, 0.03, 0.02)
- `WarningSign`: Tall `CylinderGeometry` post + `ConeGeometry` triangle sign, amber/red color, aggressive jitter + flicker in `useFrame`
- `SummitBeacon`: Tall `CylinderGeometry` pole + pulsing `SphereGeometry` (bright) + `RingGeometry` that rotates

- [ ] **Step 3: Add weather reactivity**

In `useFrame`:
- Blizzard: all landmarks gain `position.x += (Math.random() - 0.5) * 0.006` jitter + opacity fluctuation (0.3–0.7)
- Night: glow points (campfire, beacon, shrine) increase brightness
- Summit beacon pulse speeds up in blizzard

- [ ] **Step 4: Type check and visual test**

Run: `npx tsc --noEmit`
Then: `npm run dev` — navigate through all 13 waypoints, verify landmarks appear at correct positions.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/terrain/TerrainLandmarks.tsx
git commit -m "feat(terrain): 6 unique waypoint landmarks with weather reactivity"
```

---

### Task 12: Wire Terrain into TacticalMap3D

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx`

**Context:** Add `DETAIL_DATA` computation at module scope (right after `MESH_DATA` on line 16) and render terrain detail components as Canvas siblings.

- [ ] **Step 1: Compute DETAIL_DATA at module scope**

```tsx
import { generateTerrainDetails, type TerrainDetailData } from "./terrain/terrainDetails.ts";
import { TerrainVegetation } from "./terrain/TerrainVegetation.tsx";
import { TerrainRocks } from "./terrain/TerrainRocks.tsx";
import { TerrainWater } from "./terrain/TerrainWater.tsx";
import { TerrainLandmarks } from "./terrain/TerrainLandmarks.tsx";

// Line 16-17:
const MESH_DATA = generateTerrainMesh(WAYPOINTS);
const DETAIL_DATA = generateTerrainDetails(WAYPOINTS, MESH_DATA);
```

- [ ] **Step 2: Add terrain components inside Canvas**

After `<HikerMarker />` (line 414), before the closing `</Canvas>` tag:

```tsx
<TerrainVegetation details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} />
<TerrainRocks details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} />
<TerrainWater details={DETAIL_DATA} timeOfDay={timeOfDay} />
<TerrainLandmarks details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} currentIndex={currentIndex} />
```

Need to lift `timeOfDay`, `weather`, and `currentIndex` selectors to the `TacticalMap3D` parent component (or create a wrapper inside Canvas that reads them).

- [ ] **Step 3: Type check and full visual test**

Run: `npx tsc --noEmit`
Then: `npm run dev` — test across all 13 waypoints:
- Forest zones: cone trees + grass visible
- Stone_sea/scree: rocks and debris
- Stream_valley: blue water ribbons pulsing
- Ridge: cairns + rock teeth
- Summit: exposed rocks + debris
- Landmarks at correct waypoints
- Night mode: everything dims, beacons glow
- Fog: distant details fade
- Blizzard: landmarks jitter

- [ ] **Step 4: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx
git commit -m "feat(terrain): wire all terrain detail components into TacticalMap3D"
```

---

## Finalization

### Task 13: Documentation Update

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add v3.2 CHANGELOG entry**

```markdown
## [3.2] - 2026-03-18

### Features
- Animated 3D hiker with 11-joint skeleton, 9 action-driven poses, smooth blending
- Hybrid tactical hologram rendering (solid mesh + Line edges + joint glow)
- Walk cycle synced to movement animation (push_forward / descend)
- CRT glitch transitions on action change (opacity pulse + jitter + color shift)
- Trail afterimages during movement (4 joint-only ghost copies)
- Radar ping on waypoint arrival (expanding ring)
- Procedural terrain details: trees, grass, rocks, debris per terrain type
- Animated stream valley water ribbons
- 6 unique waypoint landmarks (trailhead gate, shelter, shrine, cairn, warning sign, summit beacon)
- Weather reactivity on landmarks (blizzard jitter, night glow)
- Elevation-driven vegetation scaling (smaller trees at altitude)
- Bad-weather hiker visibility enforcement

### Design Rationale
- "Hybrid Tactical Hologram" rendering chosen for readability at small scale + CRT aesthetic
- drei <Line> (Line2) for fixed 2px edge width regardless of zoom
- Joint-only afterimages instead of full rig clones for performance
- InstancedMesh for vegetation/rocks, merged LineSegments for wire details
- Landmarks bound by waypoint ID (not index) for stability
```

- [ ] **Step 2: Update CLAUDE.md architecture section**

Add to the `src/components/` section:
```markdown
  - `map/hiker/` — 3D hiker rig: skeleton, pose table, animator, effects
  - `map/terrain/` — Procedural map details: vegetation, rocks, water, landmarks
```

Update the 3D Map bullet:
```markdown
- **3D Map** — React Three Fiber wireframe heightmap with animated 11-joint hiker (hybrid hologram rendering), procedural terrain details (instanced trees/rocks, stream ribbons), 6 unique waypoint landmarks, and movement effects (afterimages, radar ping).
```

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md CLAUDE.md
git commit -m "docs: v3.2 changelog + CLAUDE.md — animated hiker and terrain detail"
```
