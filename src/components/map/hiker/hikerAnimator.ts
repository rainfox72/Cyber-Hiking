/**
 * HikerAnimator — pose blending state machine for the 3D hiker rig.
 *
 * Pure TypeScript / Three.js — no React.
 * Called from useFrame() in HikerRig3D.tsx each frame.
 *
 * State machine:
 *   idle        — breathing wobble on spine
 *   glitch      — 50ms CRT-style jitter before any transition
 *   blending    — 200ms slerp from currentPose → targetPose
 *   walking     — alternates walkingA ↔ walkingB, synced to moveDuration
 *   wandering   — restless sway (lost hiker not making progress)
 */

import * as THREE from "three";
import type { GameAction } from "../../../engine/types.ts";
import type { GamePhase } from "../../../engine/types.ts";
import { POSES, actionToPose, actionToFacing } from "./hikerPoses.ts";
import type { PoseDef } from "./hikerPoses.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnimatorState =
  | "idle"
  | "glitch"
  | "blending"
  | "walking"
  | "wandering";

export interface AnimatorConfig {
  glitchDuration: number;   // seconds (default 0.05)
  blendDuration: number;    // seconds (default 0.2)
  idleWobbleAmp: number;    // radians  (default 0.02)
  idleWobblePeriod: number; // seconds  (default 3.0)
}

const DEFAULT_CONFIG: AnimatorConfig = {
  glitchDuration: 0.05,
  blendDuration: 0.2,
  idleWobbleAmp: 0.02,
  idleWobblePeriod: 3.0,
};

/** All 11 joint names on the rig. */
const JOINT_NAMES: ReadonlyArray<keyof Omit<PoseDef, "prop" | "facing">> = [
  "hips",
  "spine",
  "head",
  "armL",
  "forearmL",
  "armR",
  "forearmR",
  "legL",
  "shinL",
  "legR",
  "shinR",
];

// ---------------------------------------------------------------------------
// Ease-in-out helper
// ---------------------------------------------------------------------------

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ---------------------------------------------------------------------------
// HikerAnimator class
// ---------------------------------------------------------------------------

export class HikerAnimator {
  // Config
  private readonly cfg: AnimatorConfig;

  // Current state
  private _state: AnimatorState = "idle";
  private stateTimer = 0;

  // Next state after glitch completes (used when glitch bridges two states)
  private afterGlitch: AnimatorState = "idle";

  // Pending state to transition into once blending completes
  private afterBlend: AnimatorState = "idle";

  // Trigger key to detect action / waypoint changes
  private lastTrigger = "";

  // Per-joint quaternions — mutated in place, read by the renderer
  public readonly jointQuats: Record<string, THREE.Quaternion> = {};

  // Snapshot of joint quats at blend-start (used as slerp "from")
  private currentPose: Record<string, THREE.Quaternion> = {};

  // Target pose for blending
  private targetPoseDef: PoseDef = POSES["idle"];

  // Walk cycle state
  private walkStep = 0;           // 0 = walkingA, 1 = walkingB, ...
  private stepDuration = 0;       // seconds per step
  private stepTimer = 0;

  // Exposed glitch state (read by renderer)
  public glitchActive = false;
  public glitchJitterX = 0;
  public glitchColorShift: "none" | "cyan" | "magenta" = "none";

  // Cache of current action/waypoint for prop/facing getters
  private _lastAction: GameAction | null = null;

  // Scratch quaternion — reused to avoid per-frame allocations
  private _scratchQ = new THREE.Quaternion();

  constructor(config?: Partial<AnimatorConfig>) {
    this.cfg = { ...DEFAULT_CONFIG, ...config };

    // Pre-allocate all joint quats from the idle pose
    for (const joint of JOINT_NAMES) {
      const src = POSES["idle"][joint] as THREE.Quaternion;
      this.jointQuats[joint] = src.clone();
      this.currentPose[joint] = src.clone();
    }

    this.targetPoseDef = POSES["idle"];
  }

  // ---------------------------------------------------------------------------
  // Public getters
  // ---------------------------------------------------------------------------

  get state(): AnimatorState {
    return this._state;
  }

  /** The prop held in the current target pose. */
  get activeProp() {
    return this.targetPoseDef.prop;
  }

  /** The facing direction of the current target pose. */
  get facingDirection() {
    return this.targetPoseDef.facing;
  }

  // ---------------------------------------------------------------------------
  // Main update method — called from useFrame
  // ---------------------------------------------------------------------------

  update(
    delta: number,
    elapsed: number,
    action: GameAction | null,
    turnNumber: number,
    waypointIndex: number,
    isMoving: boolean,
    moveDuration: number,
    isLost: boolean,
    gamePhase: GamePhase
  ): void {
    // Freeze when not playing
    if (gamePhase !== "playing") return;

    this._lastAction = action;

    // Build trigger key and detect transitions
    const triggerKey = `${turnNumber}-${action}-${waypointIndex}`;
    if (triggerKey !== this.lastTrigger) {
      this._handleTrigger(triggerKey, action, waypointIndex, isMoving, moveDuration, isLost);
      this.lastTrigger = triggerKey;
    }

    // Dispatch to current state handler
    switch (this._state) {
      case "glitch":
        this._tickGlitch(delta);
        break;
      case "blending":
        this._tickBlending(delta);
        break;
      case "walking":
        this._tickWalking(delta, isMoving);
        break;
      case "wandering":
        this._tickWandering(elapsed);
        break;
      case "idle":
        this._tickIdle(elapsed);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Trigger detection
  // ---------------------------------------------------------------------------

  private _handleTrigger(
    _key: string,
    action: GameAction | null,
    _waypointIndex: number,
    isMoving: boolean,
    moveDuration: number,
    isLost: boolean
  ): void {
    const isPushLost =
      isLost &&
      !isMoving &&
      (action === "push_forward" || action === "descend");

    if (isPushLost) {
      // Push while lost: snap to wandering (no glitch preamble needed)
      this._enterWandering();
      return;
    }

    if (isMoving) {
      // Movement: GLITCH → WALKING
      this._setTargetPose(action);
      this.afterGlitch = "walking";
      this._setupWalkCycle(action, moveDuration);
      this._enterGlitch("walking");
    } else {
      // Action change: GLITCH → BLENDING → IDLE
      this._setTargetPose(action);
      this.afterGlitch = "blending";
      this.afterBlend = "idle";
      this._enterGlitch("blending");
    }
  }

  // ---------------------------------------------------------------------------
  // State entry helpers
  // ---------------------------------------------------------------------------

  private _enterGlitch(_nextState: AnimatorState): void {
    this._state = "glitch";
    this.stateTimer = 0;
    this.glitchActive = true;
    this.glitchJitterX = (Math.random() - 0.5) * 0.01; // ±0.005
    this.glitchColorShift = Math.random() < 0.5 ? "cyan" : "magenta";
  }

  private _enterBlending(): void {
    this._snapshotCurrent();
    this._state = "blending";
    this.stateTimer = 0;
    this.glitchActive = false;
    this.glitchColorShift = "none";
  }

  private _enterWalking(): void {
    this._state = "walking";
    this.stateTimer = 0;
    this.walkStep = 0;
    this.stepTimer = 0;
    this.glitchActive = false;
    this.glitchColorShift = "none";
    // Apply walkingA immediately as the starting pose
    this._applyPoseDirect(POSES["walkingA"]);
  }

  private _enterWandering(): void {
    this._state = "wandering";
    this.stateTimer = 0;
    this.glitchActive = false;
    this.glitchColorShift = "none";
  }

  private _enterIdle(): void {
    this._state = "idle";
    this.stateTimer = 0;
    this.glitchActive = false;
    this.glitchColorShift = "none";
  }

  // ---------------------------------------------------------------------------
  // State tick handlers
  // ---------------------------------------------------------------------------

  private _tickGlitch(delta: number): void {
    this.stateTimer += delta;

    // Re-randomize jitter each frame for a jittery look
    this.glitchJitterX = (Math.random() - 0.5) * 0.01;

    if (this.stateTimer >= this.cfg.glitchDuration) {
      // Glitch complete — transition to afterGlitch state
      if (this.afterGlitch === "blending") {
        this._enterBlending();
      } else if (this.afterGlitch === "walking") {
        this._enterWalking();
      } else {
        this._enterIdle();
      }
    }
  }

  private _tickBlending(delta: number): void {
    this.stateTimer += delta;

    const rawT = Math.min(this.stateTimer / this.cfg.blendDuration, 1);
    const t = easeInOut(rawT);

    for (const joint of JOINT_NAMES) {
      const from = this.currentPose[joint];
      const to = this.targetPoseDef[joint] as THREE.Quaternion;
      // Slerp in-place into jointQuats (uses static method via instance call trick)
      this.jointQuats[joint].slerpQuaternions(from, to, t);
    }

    if (rawT >= 1) {
      // Blend complete
      if (this.afterBlend === "idle") {
        this._enterIdle();
      } else {
        this._enterIdle(); // default fallback
      }
    }
  }

  private _tickWalking(delta: number, isMoving: boolean): void {
    if (!isMoving) {
      // Movement ended — exit via glitch → blend → idle
      this._setTargetPose(this._lastAction);
      this.afterGlitch = "blending";
      this.afterBlend = "idle";
      this._enterGlitch("blending");
      return;
    }

    this.stepTimer += delta;

    if (this.stepTimer >= this.stepDuration && this.stepDuration > 0) {
      this.stepTimer -= this.stepDuration;
      this._advanceWalkStep();
    }
  }

  private _tickWandering(elapsed: number): void {
    // Restless sway: irregular sine on hips and spine
    // Two slightly out-of-phase oscillators for organic feel
    const sway1 = Math.sin(elapsed * 1.7) * 0.03;
    const sway2 = Math.sin(elapsed * 2.3 + 1.2) * 0.04;
    const lean  = Math.sin(elapsed * 0.9 + 0.5) * 0.025;

    // Start from idle pose and apply sway on top
    const idlePose = POSES["idle"];
    for (const joint of JOINT_NAMES) {
      this.jointQuats[joint].copy(idlePose[joint] as THREE.Quaternion);
    }

    // Apply sway as incremental Z-roll rotation on hips and Y-twist on spine
    this._scratchQ.setFromEuler(new THREE.Euler(lean, sway1, sway2));
    this.jointQuats["hips"].multiply(this._scratchQ);

    this._scratchQ.setFromEuler(new THREE.Euler(lean * 0.5, sway2 * 0.6, sway1 * 0.5));
    this.jointQuats["spine"].multiply(this._scratchQ);
  }

  private _tickIdle(elapsed: number): void {
    // Breathing: gentle sine on spine X (pitch), 3s period
    const wobble =
      Math.sin((elapsed / this.cfg.idleWobblePeriod) * Math.PI * 2) *
      this.cfg.idleWobbleAmp;

    // Start from target pose for this action
    for (const joint of JOINT_NAMES) {
      this.jointQuats[joint].copy(this.targetPoseDef[joint] as THREE.Quaternion);
    }

    // Apply wobble to spine only
    this._scratchQ.setFromEuler(new THREE.Euler(wobble, 0, 0));
    this.jointQuats["spine"].multiply(this._scratchQ);
  }

  // ---------------------------------------------------------------------------
  // Walk cycle helpers
  // ---------------------------------------------------------------------------

  private _setupWalkCycle(action: GameAction | null, moveDuration: number): void {
    // 4 steps for push_forward (2.5s), 3 steps for descend (1.5s)
    const stepCount = action === "descend" ? 3 : 4;
    this.stepDuration = moveDuration / stepCount;
    this.walkStep = 0;
    this.stepTimer = 0;
  }

  private _advanceWalkStep(): void {
    this.walkStep++;
    const pose = this.walkStep % 2 === 0 ? POSES["walkingA"] : POSES["walkingB"];
    this._applyPoseDirect(pose);
  }

  // ---------------------------------------------------------------------------
  // Pose helpers
  // ---------------------------------------------------------------------------

  /** Set the target pose based on action (for blending towards). */
  private _setTargetPose(action: GameAction | null): void {
    const poseName = actionToPose(action);
    const facingDir = actionToFacing(action);
    // Clone the pose to get the correct facing, then adjust facing on it
    const base = POSES[poseName];
    // We wrap in a new object preserving quaternion refs (no alloc for quats)
    this.targetPoseDef = {
      ...base,
      facing: facingDir,
    };
  }

  /** Copy all pose quaternions directly into jointQuats (no blending). */
  private _applyPoseDirect(pose: PoseDef): void {
    for (const joint of JOINT_NAMES) {
      this.jointQuats[joint].copy(pose[joint] as THREE.Quaternion);
    }
  }

  /** Snapshot current jointQuats into currentPose (before blending starts). */
  private _snapshotCurrent(): void {
    for (const joint of JOINT_NAMES) {
      this.currentPose[joint].copy(this.jointQuats[joint]);
    }
  }
}
