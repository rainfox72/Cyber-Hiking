/**
 * LightningController — event-driven lightning flashes during storms.
 *
 * Watches weather state. During storm/blizzard, schedules 0-2 flashes
 * per weather change. Flash = sky uniform spike + directional light burst.
 * Not per-frame — event-driven via setTimeout + useFrame animation.
 */

import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualState } from '../VisualStateBridge.tsx';

export function LightningController() {
  const vsRef = useVisualState();
  const { scene } = useThree();

  // Flash state
  const flashActiveRef = useRef(false);
  const flashProgressRef = useRef(0);
  const flashDurationRef = useRef(0.3);
  const prevWeatherRef = useRef('clear');

  // Find directional light in scene
  const dirLightRef = useRef<THREE.DirectionalLight | null>(null);
  const baseDirIntensityRef = useRef(0.5);

  useEffect(() => {
    // Find the directional light added by SceneLighting
    scene.traverse((child) => {
      if (child instanceof THREE.DirectionalLight && !dirLightRef.current) {
        dirLightRef.current = child;
        baseDirIntensityRef.current = child.intensity;
      }
    });
  }, [scene]);

  // Schedule flashes on weather change to storm/blizzard
  useEffect(() => {
    const checkWeather = () => {
      const vs = vsRef.current;
      if (vs.weather === prevWeatherRef.current) return;
      prevWeatherRef.current = vs.weather;

      if (vs.weather !== 'blizzard' && vs.weather !== 'wind') return;

      // 0-2 flashes, randomly timed
      const flashCount = Math.floor(Math.random() * 3); // 0, 1, or 2
      for (let i = 0; i < flashCount; i++) {
        const delay = 500 + Math.random() * 2000 + i * 1500;
        setTimeout(() => {
          flashActiveRef.current = true;
          flashProgressRef.current = 0;
          flashDurationRef.current = 0.3;

          // 30% chance of double flash
          if (Math.random() < 0.3) {
            setTimeout(() => {
              flashActiveRef.current = true;
              flashProgressRef.current = 0;
              flashDurationRef.current = 0.2;
            }, 200);
          }
        }, delay);
      }
    };

    const interval = setInterval(checkWeather, 500);
    return () => clearInterval(interval);
  }, [vsRef]);

  useFrame((_, delta) => {
    if (!flashActiveRef.current) return;

    flashProgressRef.current += delta / flashDurationRef.current;

    if (flashProgressRef.current >= 1) {
      flashActiveRef.current = false;
      flashProgressRef.current = 0;

      // Restore directional light
      if (dirLightRef.current) {
        dirLightRef.current.intensity = baseDirIntensityRef.current;
        dirLightRef.current.color.set('#c0c8d0');
      }
      return;
    }

    const t = flashProgressRef.current;

    // Flash curve: spike fast then fade
    // Peak at t=0.15, fade to 0 by t=1
    let flashIntensity: number;
    if (t < 0.15) {
      flashIntensity = t / 0.15; // ramp up
    } else {
      flashIntensity = 1 - (t - 0.15) / 0.85; // fade out
    }

    // Spike directional light
    if (dirLightRef.current) {
      dirLightRef.current.intensity = baseDirIntensityRef.current + flashIntensity * 3;
      // Flash white
      dirLightRef.current.color.setRGB(
        0.94 * flashIntensity + (1 - flashIntensity) * 0.75,
        0.94 * flashIntensity + (1 - flashIntensity) * 0.78,
        1.0 * flashIntensity + (1 - flashIntensity) * 0.82,
      );
    }
  });

  return null;
}
