/**
 * CameraDirector — action/state-aware camera with drag & zoom.
 *
 * Baseline: slow orbit around hiker.
 * User input: left-drag rotates orbit, scroll/pinch zooms.
 * Auto-return: after 4s inactivity, camera smoothly returns to auto-orbit.
 * Impulses: per-action camera movements layer on top of user's orbit.
 * State mods: heartbeat, night tighten, blizzard jitter, lost wobble.
 *
 * No drei OrbitControls — pure pointer math to avoid known R3F crash.
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore.ts';
import { useVisualState } from './VisualStateBridge.tsx';
import type { GameAction } from '../../engine/types.ts';

interface Impulse {
  type: string;
  progress: number;
  duration: number;
  dollyDir?: THREE.Vector3;
  shakeAmplitude?: number;
  fovDelta?: number;
  yOffset?: number;
  orbitTighten?: number;
}

// ── Constants ──
const DEFAULT_RADIUS = 3.3;
const MIN_RADIUS = 1.5;
const MAX_RADIUS = 10.0;
const DEFAULT_PITCH = 65 * (Math.PI / 180); // 65 degrees — steeper look-down keeps hiker above log window
const MIN_PITCH = 10 * (Math.PI / 180);
const MAX_PITCH = 80 * (Math.PI / 180);
const DRAG_SENSITIVITY = 0.005;
const ZOOM_SENSITIVITY = 0.3;
const AUTO_RETURN_DELAY = 4000; // ms
const AUTO_RETURN_SPEED = 0.8; // lerp factor per second

export function CameraDirector({ hikerPosRef }: { hikerPosRef: { current: THREE.Vector3 } }) {
  const { camera, gl } = useThree();
  const vsRef = useVisualState();

  const lastAction = useGameStore((s) => s.lastAction);
  const isLost = useGameStore((s) => s.player.isLost);
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);

  // ── Orbit state ──
  const orbitAngleRef = useRef(0);        // horizontal angle (radians)
  const orbitPitchRef = useRef(DEFAULT_PITCH); // vertical angle from horizontal
  const orbitRadiusRef = useRef(DEFAULT_RADIUS);
  const autoOrbitAngleRef = useRef(0);    // auto-advancing angle (continues even during drag)

  // ── Drag state ──
  const isDraggingRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const lastInteractionRef = useRef(0);   // timestamp of last user input
  const userControllingRef = useRef(false); // true when user has overridden auto-orbit

  // ── Impulses ──
  const impulsesRef = useRef<Impulse[]>([]);
  const prevActionRef = useRef<GameAction | null>(null);
  const prevIndexRef = useRef(currentIndex);
  const baseFovRef = useRef(45);

  // ── Pointer event handlers ──
  useEffect(() => {
    const domElement = gl.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // left click only
      isDraggingRef.current = true;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
      lastInteractionRef.current = Date.now();
      userControllingRef.current = true;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - lastPointerRef.current.x;
      const dy = e.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: e.clientX, y: e.clientY };

      // Update orbit angle and pitch
      orbitAngleRef.current -= dx * DRAG_SENSITIVITY;
      orbitPitchRef.current = Math.max(MIN_PITCH,
        Math.min(MAX_PITCH, orbitPitchRef.current + dy * DRAG_SENSITIVITY));

      lastInteractionRef.current = Date.now();
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Normalize: trackpad pinch sends small deltas, mouse wheel sends larger
      const delta = e.deltaY > 0 ? ZOOM_SENSITIVITY : -ZOOM_SENSITIVITY;
      orbitRadiusRef.current = Math.max(MIN_RADIUS,
        Math.min(MAX_RADIUS, orbitRadiusRef.current + delta));

      lastInteractionRef.current = Date.now();
      userControllingRef.current = true;
    };

    domElement.addEventListener('pointerdown', onPointerDown);
    domElement.addEventListener('pointermove', onPointerMove);
    domElement.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('pointerleave', onPointerUp);
    domElement.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      domElement.removeEventListener('pointerdown', onPointerDown);
      domElement.removeEventListener('pointermove', onPointerMove);
      domElement.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('pointerleave', onPointerUp);
      domElement.removeEventListener('wheel', onWheel);
    };
  }, [gl.domElement]);

  // ── Detect action changes → push impulses ──
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

  // ── Fall events ──
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

  // ── Summit detection ──
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

  // ── Per-frame update ──
  useFrame(({ clock }, delta) => {
    const target = hikerPosRef.current;
    const vs = vsRef.current;
    const elapsed = clock.elapsedTime;
    const now = Date.now();

    // ── Auto-orbit angle always advances ──
    const lostSpeedMult = isLost ? 2.0 : 1.0;
    autoOrbitAngleRef.current += delta * 0.5 * (Math.PI / 180) * lostSpeedMult;

    // ── Auto-return: after 4s inactivity, resume orbit from current position ──
    const timeSinceInteraction = now - lastInteractionRef.current;
    if (userControllingRef.current && timeSinceInteraction > AUTO_RETURN_DELAY) {
      // Sync auto-orbit to user's current angle and resume from there
      autoOrbitAngleRef.current = orbitAngleRef.current;
      userControllingRef.current = false;
    }

    // ── If not user-controlling, sync to auto-orbit ──
    if (!userControllingRef.current) {
      orbitAngleRef.current = autoOrbitAngleRef.current;
    }

    // ── Build camera position from orbit params ──
    let orbitRadius = orbitRadiusRef.current;
    let yOffset = 0; // computed from pitch now
    let fovTarget = baseFovRef.current;
    let shakeX = 0;
    let shakeY = 0;
    let lookAtDelay = 0.03;

    // ── State modifications ──
    const worstVital = Math.min(energy, hydration, bodyTemp, o2, morale);

    if (worstVital < 30) {
      fovTarget += Math.sin(elapsed * 1.2 * Math.PI * 2) * 1.5;
    }

    if (vs.timeOfDay === 'night') {
      orbitRadius *= 0.85;
    }

    if (vs.weather === 'blizzard') {
      shakeX += (Math.random() - 0.5) * 0.01;
      shakeY += (Math.random() - 0.5) * 0.01;
    }

    if (isLost) {
      shakeX += (Math.random() - 0.5) * 0.05;
      shakeY += (Math.random() - 0.5) * 0.03;
      lookAtDelay = 0.01;
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
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
            const amp = imp.shakeAmplitude ?? 0.05;
            shakeX += (Math.random() - 0.5) * amp * 2;
            shakeY += (Math.random() - 0.5) * amp * 2;
          } else if (t < 0.5) {
            lookAtDelay = 0;
          }
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

    // ── Compute camera position with pitch ──
    const pitch = orbitPitchRef.current;
    const angle = orbitAngleRef.current;

    const orbitX = Math.sin(angle) * Math.cos(pitch) * orbitRadius;
    const orbitY = Math.sin(pitch) * orbitRadius;
    const orbitZ = Math.cos(angle) * Math.cos(pitch) * orbitRadius;

    const camTarget = new THREE.Vector3(
      target.x + orbitX + shakeX,
      target.y + orbitY + yOffset + shakeY,
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
