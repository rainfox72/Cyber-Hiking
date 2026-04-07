/**
 * PostFXController — EffectComposer with always-on and event-triggered effects.
 *
 * Always-on: Bloom (threshold 0.9, earned glow only) + Vignette (vital-driven)
 * Event-triggered: DepthOfField (lost), ChromaticAberration (fall), Noise (critical)
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  Vignette,
  DepthOfField,
  ChromaticAberration,
  Noise,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import * as THREE from 'three';
import { useGameStore } from '../../store/gameStore.ts';

export function PostFXController() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const isLost = useGameStore((s) => s.player.isLost);
  const lostTurns = useGameStore((s) => s.player.lostTurns);
  const lastVisualEvent = useGameStore((s) => s.lastVisualEvent);

  const worstVital = Math.min(energy, hydration, bodyTemp, o2, morale);

  // ── Vignette darkness (vital-driven) ──
  const vignetteDarkness = worstVital > 60 ? 0.0
    : worstVital > 30 ? 0.2
    : worstVital > 15 ? 0.4
    : 0.6;

  // ── DOF for lost state ──
  const dofBokeh = isLost ? Math.min(4 + lostTurns * 0.5, 6) : 0;

  // ── ChromaticAberration for fall events ──
  const chromaOffsetRef = useRef(new THREE.Vector2(0, 0));
  const chromaDecayRef = useRef(0);
  const prevEventTimestamp = useRef(0);

  // ── Noise for critical vitals ──
  const noiseOpacity = worstVital < 15 ? 0.08 : 0;

  // Detect fall events — intentional ref access during render for R3F effect props
  /* eslint-disable react-hooks/refs */
  if (lastVisualEvent &&
      lastVisualEvent.timestamp !== prevEventTimestamp.current &&
      (lastVisualEvent.type === 'fall' || lastVisualEvent.type === 'lost_start')) {
    prevEventTimestamp.current = lastVisualEvent.timestamp;
    chromaDecayRef.current = 1.0;
  }
  /* eslint-enable react-hooks/refs */

  useFrame((_, delta) => {
    // Decay chromatic aberration
    if (chromaDecayRef.current > 0) {
      chromaDecayRef.current = Math.max(0, chromaDecayRef.current - delta * 2.5); // ~400ms
      const offset = chromaDecayRef.current * 0.008;
      chromaOffsetRef.current.set(offset, offset);
    } else {
      chromaOffsetRef.current.set(0, 0);
    }
  });

  // DOF focus distance — approximate from camera
  const focusDistance = useRef(3);
  useFrame(() => {
    // Simple approximation: orbit radius
    focusDistance.current = 3.3;
  });

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        intensity={0.3}
        luminanceThreshold={0.9}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
      <Vignette
        darkness={vignetteDarkness}
        offset={0.3}
        blendFunction={BlendFunction.NORMAL}
      />
      {/* eslint-disable react-hooks/refs -- R3F effect props need ref access */}
      <DepthOfField
        focusDistance={(isLost && dofBokeh > 0) ? focusDistance.current / 50 : 0}
        focalLength={0.05}
        bokehScale={(isLost && dofBokeh > 0) ? dofBokeh : 0}
      />
      <ChromaticAberration
        offset={chromaOffsetRef.current}
        radialModulation={false}
        modulationOffset={0}
      />
      {/* eslint-enable react-hooks/refs */}
      <Noise
        premultiply
        blendFunction={BlendFunction.ADD}
        opacity={noiseOpacity}
      />
    </EffectComposer>
  );
}
