/**
 * SceneLighting — ambient + directional lights driven by time-of-day/weather.
 * No shadow maps. Minimal rig for atmosphere color shifts.
 */

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualState } from '../VisualStateBridge.tsx';

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

export function SceneLighting() {
  const vsRef = useVisualState();
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const dirRef = useRef<THREE.DirectionalLight>(null);

  // Lerp targets
  const targetAmbColor = useRef(new THREE.Color());
  const targetDirColor = useRef(new THREE.Color());

  useFrame((_, delta) => {
    const vs = vsRef.current;
    const lerpSpeed = delta * 0.8;

    // Update ambient light
    if (ambientRef.current) {
      targetAmbColor.current.copy(hexToColor(vs.ambientColor));
      ambientRef.current.color.lerp(targetAmbColor.current, lerpSpeed);
      ambientRef.current.intensity += (vs.ambientIntensity - ambientRef.current.intensity) * lerpSpeed;
    }

    // Update directional light
    if (dirRef.current) {
      targetDirColor.current.copy(hexToColor(vs.sunColor));
      dirRef.current.color.lerp(targetDirColor.current, lerpSpeed);
      // Directional intensity: dimmer at night
      const dirIntensity = vs.timeOfDay === 'night' ? 0.2 : 0.5;
      dirRef.current.intensity += (dirIntensity - dirRef.current.intensity) * lerpSpeed;
      // Sun direction
      dirRef.current.position.set(
        vs.sunDirection[0] * 10,
        vs.sunDirection[1] * 10,
        vs.sunDirection[2] * 10,
      );
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.5} color="#c0c8d0" />
      <directionalLight ref={dirRef} intensity={0.5} color="#c0c8d0" position={[0, 10, 3]} />
    </>
  );
}
