/**
 * SceneFog — continuous FogExp2 driven by weather and terrain band.
 * Replaces the binary FogController that was in TacticalMap3D.
 * Density and color lerp smoothly via refs in useFrame.
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualState } from '../VisualStateBridge.tsx';

export function SceneFog() {
  const vsRef = useVisualState();
  const { scene } = useThree();
  const fogRef = useRef<THREE.FogExp2 | null>(null);
  const targetDensityRef = useRef(0.02);
  const targetColorRef = useRef(new THREE.Color('#0a0a0a'));

  // Initialize fog on mount
  useEffect(() => {
    const fog = new THREE.FogExp2('#0a0a0a', 0.02);
    // eslint-disable-next-line react-hooks/immutability
    scene.fog = fog;
    fogRef.current = fog;
    return () => { scene.fog = null; };
  }, [scene]);

  useFrame((_, delta) => {
    const fog = fogRef.current;
    if (!fog) return;

    const vs = vsRef.current;
    const lerpSpeed = delta * 1.0; // ~1.5s transition

    // Update targets from visual state
    targetDensityRef.current = vs.fogDensity;
    targetColorRef.current.set(vs.fogColor);

    // Lerp density
    fog.density += (targetDensityRef.current - fog.density) * lerpSpeed;

    // Lerp color
    fog.color.lerp(targetColorRef.current, lerpSpeed);
  });

  return null;
}
