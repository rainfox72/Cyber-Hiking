/**
 * CameraDirector — action/state-aware camera replacing CameraController.
 *
 * Baseline: slow orbit around hiker (same as old controller).
 * Impulses: per-action camera movements (dolly, shake, freeze, crane).
 * State mods: continuous modifications (heartbeat, night tighten, blizzard jitter).
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore.ts';
import { useVisualState } from './VisualStateBridge.tsx';
import type { GameAction } from '../../engine/types.ts';

// Shared ref for camera to follow displaced hiker position
// Must match the one in TacticalMap3D
declare const hikerDisplayPos: { current: THREE.Vector3 };

interface Impulse {
  type: string;
  progress: number;
  duration: number;
  // Per-impulse data
  dollyDir?: THREE.Vector3;
  shakeAmplitude?: number;
  fovDelta?: number;
  yOffset?: number;
  orbitTighten?: number;
}

export function CameraDirector({ hikerPosRef }: { hikerPosRef: { current: THREE.Vector3 } }) {
  const { camera } = useThree();
  const vsRef = useVisualState();

  const lastAction = useGameStore((s) => s.lastAction);
  const isLost = useGameStore((s) => s.player.isLost);
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);

  const orbitAngleRef = useRef(0);
  const impulsesRef = useRef<Impulse[]>([]);
  const prevActionRef = useRef<GameAction | null>(null);
  const prevIndexRef = useRef(currentIndex);
  const baseFovRef = useRef(45);

  // Detect action changes and push impulses
  useEffect(() => {
    if (lastAction === prevActionRef.current) return;
    prevActionRef.current = lastAction;
    if (!lastAction) return;

    switch (lastAction) {
      case 'push_forward':
        impulsesRef.current.push({
          type: 'dolly', progress: 0, duration: 2.5,
          dollyDir: new THREE.Vector3(0, 0, -0.3),
          yOffset: -0.3,
        });
        break;
      case 'set_camp':
        impulsesRef.current.push({
          type: 'camp', progress: 0, duration: 3,
          yOffset: -0.5,
          orbitTighten: 0.2,
        });
        break;
      case 'rest':
      case 'eat':
      case 'drink':
        impulsesRef.current.push({
          type: 'breathe', progress: 0, duration: 1,
          fovDelta: 0.5,
        });
        break;
    }
  }, [lastAction]);

  // Detect fall events via visual events
  const lastVisualEvent = useGameStore((s) => s.lastVisualEvent);
  const prevEventTimestamp = useRef(0);

  useEffect(() => {
    if (!lastVisualEvent || lastVisualEvent.timestamp === prevEventTimestamp.current) return;
    prevEventTimestamp.current = lastVisualEvent.timestamp;

    if (lastVisualEvent.type === 'fall') {
      impulsesRef.current.push({
        type: 'shake', progress: 0, duration: 0.6,
        shakeAmplitude: 0.08,
      });
    }
  }, [lastVisualEvent]);

  // Summit detection
  useEffect(() => {
    if (currentIndex === 12 && prevIndexRef.current !== 12) {
      impulsesRef.current.push({
        type: 'summit', progress: 0, duration: 4,
        fovDelta: 10,
        yOffset: 1,
      });
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  useFrame(({ clock }, delta) => {
    const target = hikerPosRef.current;
    const vs = vsRef.current;
    const elapsed = clock.elapsedTime;

    // ── Baseline orbit ──
    const lostSpeedMult = isLost ? 2.0 : 1.0;
    orbitAngleRef.current += delta * 0.5 * (Math.PI / 180) * lostSpeedMult;

    let orbitRadius = 3.3;
    let yOffset = 2;
    let fovTarget = baseFovRef.current;
    let shakeX = 0;
    let shakeY = 0;
    let lookAtDelay = 0.03; // base lerp speed

    // ── State modifications ──
    const worstVital = Math.min(energy, hydration, bodyTemp, o2, morale);

    // Heartbeat FOV pulse when vital < 30
    if (worstVital < 30) {
      fovTarget += Math.sin(elapsed * 1.2 * Math.PI * 2) * 1.5;
    }

    // Night: tighter orbit
    if (vs.timeOfDay === 'night') {
      orbitRadius *= 0.85;
    }

    // Blizzard: micro-jitter
    if (vs.weather === 'blizzard') {
      shakeX += (Math.random() - 0.5) * 0.01;
      shakeY += (Math.random() - 0.5) * 0.01;
    }

    // Lost: orbit wobble + lookAt delay
    if (isLost) {
      shakeX += (Math.random() - 0.5) * 0.05;
      shakeY += (Math.random() - 0.5) * 0.03;
      lookAtDelay = 0.01; // slower tracking = disorienting
    }

    // ── Process impulses ──
    const activeImpulses = impulsesRef.current;
    for (let i = activeImpulses.length - 1; i >= 0; i--) {
      const imp = activeImpulses[i];
      imp.progress += delta / imp.duration;

      if (imp.progress >= 1) {
        activeImpulses.splice(i, 1);
        continue;
      }

      const t = imp.progress;
      // Ease-in-out
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      // Bell curve (peaks at 0.5, zero at 0 and 1)
      const bell = Math.sin(t * Math.PI);

      switch (imp.type) {
        case 'dolly':
          yOffset += (imp.yOffset ?? 0) * bell;
          break;
        case 'camp':
          yOffset += (imp.yOffset ?? 0) * eased;
          orbitRadius *= 1 - (imp.orbitTighten ?? 0) * eased;
          break;
        case 'shake':
          if (t < 0.33) {
            // Shake phase
            const amp = imp.shakeAmplitude ?? 0.05;
            shakeX += (Math.random() - 0.5) * amp * 2;
            shakeY += (Math.random() - 0.5) * amp * 2;
          } else if (t < 0.5) {
            // Freeze phase
            lookAtDelay = 0;
          }
          // else: settle phase (natural lerp handles it)
          break;
        case 'breathe':
          fovTarget += (imp.fovDelta ?? 0) * bell;
          break;
        case 'summit':
          fovTarget += (imp.fovDelta ?? 0) * eased;
          yOffset += (imp.yOffset ?? 0) * eased;
          break;
      }
    }

    // ── Apply camera position ──
    const orbitX = Math.sin(orbitAngleRef.current) * orbitRadius;
    const orbitZ = Math.cos(orbitAngleRef.current) * orbitRadius;

    const camTarget = new THREE.Vector3(
      target.x + orbitX + shakeX,
      target.y + yOffset + shakeY,
      target.z + orbitZ,
    );

    camera.position.lerp(camTarget, lookAtDelay);
    camera.lookAt(target);

    // FOV
    const perspCam = camera as THREE.PerspectiveCamera;
    perspCam.fov += (fovTarget - perspCam.fov) * delta * 2;
    perspCam.updateProjectionMatrix();
  });

  return null;
}
