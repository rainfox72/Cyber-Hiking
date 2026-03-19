/**
 * Hiker pose table for the 3D TacticalMap hiker figure.
 * Pure data module — no React, no Three.js runtime rendering.
 *
 * 9 poses are defined as Euler rotation targets per joint, then
 * pre-converted to THREE.Quaternion at module load time for
 * zero-cost interpolation in the animator.
 */

import * as THREE from "three";
import type { GameAction } from "../../../engine/types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Raw Euler angles [x, y, z] in radians. */
export type EulerTarget = [number, number, number];

/**
 * All 11 joints on the hiker rig, as raw Euler targets.
 * Pack is a static attachment, not a joint.
 */
export interface PoseEulers {
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

/**
 * Prop held in the hiker's hand (or null for none).
 * "tent" is used during camping; "map", "bottle", "medkit", "food" for actions.
 */
export type HikerProp = "map" | "bottle" | "tent" | "medkit" | "food" | null;

/**
 * Which direction the hiker faces.
 * forward = ascending / push_forward
 * backward = descending
 */
export type HikerFacing = "forward" | "backward";

/** A fully resolved pose definition with Quaternions for each joint. */
export interface PoseDef {
  hips: THREE.Quaternion;
  spine: THREE.Quaternion;
  head: THREE.Quaternion;
  armL: THREE.Quaternion;
  forearmL: THREE.Quaternion;
  armR: THREE.Quaternion;
  forearmR: THREE.Quaternion;
  legL: THREE.Quaternion;
  shinL: THREE.Quaternion;
  legR: THREE.Quaternion;
  shinR: THREE.Quaternion;
  prop: HikerProp;
  facing: HikerFacing;
}

/** Union of all valid pose name strings. */
export type HikerPose =
  | "idle"
  | "walkingA"
  | "walkingB"
  | "camping"
  | "eating"
  | "drinking"
  | "resting"
  | "mapping"
  | "medicine";

// ---------------------------------------------------------------------------
// Conversion helper
// ---------------------------------------------------------------------------

/** Convert a PoseEulers + prop + facing definition into a PoseDef with Quaternions. */
function eulersToPose(
  eulers: PoseEulers,
  prop: HikerProp,
  facing: HikerFacing
): PoseDef {
  const toQ = ([x, y, z]: EulerTarget): THREE.Quaternion =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

  return {
    hips: toQ(eulers.hips),
    spine: toQ(eulers.spine),
    head: toQ(eulers.head),
    armL: toQ(eulers.armL),
    forearmL: toQ(eulers.forearmL),
    armR: toQ(eulers.armR),
    forearmR: toQ(eulers.forearmR),
    legL: toQ(eulers.legL),
    shinL: toQ(eulers.shinL),
    legR: toQ(eulers.legR),
    shinR: toQ(eulers.shinR),
    prop,
    facing,
  };
}

// ---------------------------------------------------------------------------
// Pose table (pre-computed at module load time)
// ---------------------------------------------------------------------------

/**
 * 9 hiker poses. All angles in radians.
 *
 * Hiker is 0.25 scene units tall — poses are intentionally EXAGGERATED
 * so silhouettes read clearly at small scale.
 *
 * Joint axis conventions (local space, Y-up rig):
 *   X = pitch (forward/back tilt)
 *   Y = yaw  (left/right twist)
 *   Z = roll (side-to-side lean)
 */
export const POSES: Record<HikerPose, PoseDef> = {
  // -------------------------------------------------------------------
  // idle: upright, slight forward lean, arms relaxed at sides
  // -------------------------------------------------------------------
  idle: eulersToPose(
    {
      hips:     [0,    0,    0   ],
      spine:    [0.08, 0,    0   ],   // gentle forward lean
      head:     [0,    0,    0   ],
      armL:     [0,    0,    0.2 ],   // arms slightly away from body
      forearmL: [0,    0,    0   ],
      armR:     [0,    0,   -0.2 ],
      forearmR: [0,    0,    0   ],
      legL:     [0,    0,    0   ],
      shinL:    [0,    0,    0   ],
      legR:     [0,    0,    0   ],
      shinR:    [0,    0,    0   ],
    },
    null,
    "forward"
  ),

  // -------------------------------------------------------------------
  // walkingA: stride A — left leg forward, right arm forward
  // -------------------------------------------------------------------
  walkingA: eulersToPose(
    {
      hips:     [0,     0,    0   ],
      spine:    [0.1,   0,    0   ],   // slight forward lean while moving
      head:     [0,     0,    0   ],
      armL:     [-0.35, 0,    0.15],   // left arm back
      forearmL: [0.2,   0,    0   ],
      armR:     [0.35,  0,   -0.15],   // right arm forward
      forearmR: [-0.15, 0,    0   ],
      legL:     [0.5,   0,    0   ],   // left leg forward
      shinL:    [-0.3,  0,    0   ],   // knee bent
      legR:     [-0.5,  0,    0   ],   // right leg back
      shinR:    [0,     0,    0   ],
    },
    null,
    "forward"
  ),

  // -------------------------------------------------------------------
  // walkingB: stride B — right leg forward, left arm forward (opposite)
  // -------------------------------------------------------------------
  walkingB: eulersToPose(
    {
      hips:     [0,     0,    0   ],
      spine:    [0.1,   0,    0   ],
      head:     [0,     0,    0   ],
      armL:     [0.35,  0,    0.15],   // left arm forward
      forearmL: [-0.15, 0,    0   ],
      armR:     [-0.35, 0,   -0.15],   // right arm back
      forearmR: [0.2,   0,    0   ],
      legL:     [-0.5,  0,    0   ],   // left leg back
      shinL:    [0,     0,    0   ],
      legR:     [0.5,   0,    0   ],   // right leg forward
      shinR:    [-0.3,  0,    0   ],   // knee bent
    },
    null,
    "forward"
  ),

  // -------------------------------------------------------------------
  // camping: deep hip crouch setting up tent, arms forward
  // -------------------------------------------------------------------
  camping: eulersToPose(
    {
      hips:     [-0.6,  0,    0   ],   // hips pitched forward = crouching down
      spine:    [0.4,   0,    0   ],   // spine compensates, leans forward
      head:     [-0.2,  0,    0   ],   // looking down at tent
      armL:     [0.7,   0,    0.1 ],   // arms reach forward/down
      forearmL: [0.4,   0,    0   ],
      armR:     [0.7,   0,   -0.1 ],
      forearmR: [0.4,   0,    0   ],
      legL:     [-0.6,  0,    0.1 ],   // squatting: legs bent
      shinL:    [1.1,   0,    0   ],
      legR:     [-0.6,  0,   -0.1 ],
      shinR:    [1.1,   0,    0   ],
    },
    "tent",
    "forward"
  ),

  // -------------------------------------------------------------------
  // eating: seated crouch, right hand raised to mouth
  // -------------------------------------------------------------------
  eating: eulersToPose(
    {
      hips:     [-0.5,  0,    0   ],
      spine:    [0.3,   0,    0   ],
      head:     [-0.1,  0,    0   ],   // slightly down, looking at food
      armL:     [0,     0,    0.25],   // left arm relaxed at side
      forearmL: [0,     0,    0   ],
      armR:     [1.1,   0,   -0.1 ],   // right arm raised, hand toward mouth
      forearmR: [-0.8,  0,    0   ],   // forearm folds up
      legL:     [-0.5,  0,    0.1 ],
      shinL:    [1.0,   0,    0   ],
      legR:     [-0.5,  0,   -0.1 ],
      shinR:    [1.0,   0,    0   ],
    },
    "food",
    "forward"
  ),

  // -------------------------------------------------------------------
  // drinking: standing, left arm raised with bottle
  // -------------------------------------------------------------------
  drinking: eulersToPose(
    {
      hips:     [0,     0,    0   ],
      spine:    [0.05,  0,    0   ],
      head:     [-0.3,  0,    0   ],   // head tilted back drinking
      armL:     [1.2,   0,    0.1 ],   // left arm raised with bottle
      forearmL: [-0.5,  0,    0   ],   // tipped up
      armR:     [0,     0,   -0.2 ],   // right arm at side
      forearmR: [0,     0,    0   ],
      legL:     [0,     0,    0.05],
      shinL:    [0,     0,    0   ],
      legR:     [0,     0,   -0.05],
      shinR:    [0,     0,    0   ],
    },
    "bottle",
    "forward"
  ),

  // -------------------------------------------------------------------
  // resting: seated on ground, slumped back, shoulders drooping
  // -------------------------------------------------------------------
  resting: eulersToPose(
    {
      hips:     [-0.7,  0,    0   ],   // hips fully pitched back = sitting
      spine:    [-0.3,  0,    0   ],   // spine leans back
      head:     [0.15,  0,    0   ],   // head droops forward
      armL:     [-0.2,  0,    0.5 ],   // arms drooped to sides
      forearmL: [0.1,   0,    0   ],
      armR:     [-0.2,  0,   -0.5 ],
      forearmR: [0.1,   0,    0   ],
      legL:     [-0.8,  0,    0.15],   // legs extended/splayed
      shinL:    [0.6,   0,    0   ],
      legR:     [-0.8,  0,   -0.15],
      shinR:    [0.6,   0,    0   ],
    },
    null,
    "forward"
  ),

  // -------------------------------------------------------------------
  // mapping: standing tall, both arms raised holding map out in front
  // -------------------------------------------------------------------
  mapping: eulersToPose(
    {
      hips:     [0,     0,    0   ],
      spine:    [0.05,  0,    0   ],
      head:     [-0.15, 0,    0   ],   // looking down at map
      armL:     [0.8,   0,    0.15],   // both arms raised forward
      forearmL: [0.5,   0,    0   ],   // forearms angled out holding map edges
      armR:     [0.8,   0,   -0.15],
      forearmR: [0.5,   0,    0   ],
      legL:     [0,     0,    0.05],
      shinL:    [0,     0,    0   ],
      legR:     [0,     0,   -0.05],
      shinR:    [0,     0,    0   ],
    },
    "map",
    "forward"
  ),

  // -------------------------------------------------------------------
  // medicine: crouched, left arm extended applying medkit
  // -------------------------------------------------------------------
  medicine: eulersToPose(
    {
      hips:     [-0.4,  0,    0   ],   // partial crouch
      spine:    [0.3,   0,    0   ],
      head:     [-0.1,  0,    0   ],
      armL:     [0.6,   0,    0.2 ],   // left arm extended with medkit
      forearmL: [0.3,   0,    0   ],
      armR:     [0.1,   0,   -0.2 ],   // right arm braced on knee
      forearmR: [0.4,   0,    0   ],
      legL:     [-0.45, 0,    0.1 ],
      shinL:    [0.9,   0,    0   ],
      legR:     [-0.3,  0,   -0.1 ],
      shinR:    [0.5,   0,    0   ],
    },
    "medkit",
    "forward"
  ),
};

// ---------------------------------------------------------------------------
// Action → pose mapping
// ---------------------------------------------------------------------------

/**
 * Map a GameAction (or null for idle) to a HikerPose name.
 * Walking uses walkingA — the animator will alternate to walkingB each stride.
 * Mirrors the logic in HumanMarker.tsx:actionToPose for consistency.
 */
export function actionToPose(action: GameAction | null): HikerPose {
  switch (action) {
    case "push_forward":
    case "descend":
      return "walkingA";
    case "set_camp":
      return "camping";
    case "eat":
      return "eating";
    case "drink":
      return "drinking";
    case "rest":
      return "resting";
    case "check_map":
      return "mapping";
    case "use_medicine":
      return "medicine";
    default:
      return "idle";
  }
}

/**
 * Map a GameAction to the hiker's facing direction.
 * Descending = backward; everything else = forward.
 * Mirrors the logic in HumanMarker.tsx:actionToFacing for consistency.
 */
export function actionToFacing(action: GameAction | null): HikerFacing {
  return action === "descend" ? "backward" : "forward";
}
