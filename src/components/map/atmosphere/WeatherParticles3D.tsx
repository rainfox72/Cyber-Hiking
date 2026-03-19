/**
 * WeatherParticles3D — 3D weather particle system replacing ParticleCanvas.
 *
 * Uses two render primitives:
 * - THREE.Points for round particles: snow, blizzard
 * - THREE.LineSegments for directional streaks: rain, wind
 *
 * Particles spawn in a camera-relative box and wrap on exit.
 * All updates via direct buffer writes in useFrame.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualState } from '../VisualStateBridge.tsx';

// ── Max counts ──
const MAX_POINTS = 1200;   // snow + blizzard
const MAX_SEGMENTS = 600;  // rain + wind (600 line pairs = 1200 vertices)

// ── Spawn box (camera-relative) ──
const BOX_SIZE = 6;
const BOX_HALF = BOX_SIZE / 2;

// ── Weather configs ──
interface WeatherConfig {
  type: 'points' | 'lines';
  count: number;
  speed: number;
  dirX: number;
  dirY: number;
  sizeOrLength: number;
}

const WEATHER_CONFIGS: Record<string, WeatherConfig | null> = {
  clear: null,
  cloudy: null,
  fog: null,
  rain:     { type: 'lines',  count: 500,  speed: 8,    dirX: -0.5, dirY: -1,  sizeOrLength: 0.15 },
  snow:     { type: 'points', count: 500,  speed: 0.6,  dirX: 0,    dirY: -1,  sizeOrLength: 2.0 },
  wind:     { type: 'lines',  count: 80,   speed: 6,    dirX: 1,    dirY: 0,   sizeOrLength: 0.3 },
  blizzard: { type: 'points', count: 1000, speed: 2.5,  dirX: -0.5, dirY: -1,  sizeOrLength: 2.5 },
};

export function WeatherParticles3D() {
  const vsRef = useVisualState();
  const { camera } = useThree();

  // ── Points geometry (snow/blizzard) ──
  const pointsGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_POINTS * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
    return geo;
  }, []);

  const pointsMat = useMemo(() => new THREE.PointsMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true,
    size: 0.03,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), []);

  const pointsRef = useRef<THREE.Points>(null);

  // ── Lines geometry (rain/wind) ──
  const linesGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(MAX_SEGMENTS * 2 * 3); // 2 vertices per segment
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.getAttribute('position').setUsage(THREE.DynamicDrawUsage);
    return geo;
  }, []);

  const linesMat = useMemo(() => new THREE.LineBasicMaterial({
    color: '#96c8ff',
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  }), []);

  const linesRef = useRef<THREE.LineSegments>(null);

  // ── Particle state (velocities stored separately) ──
  const pointVelocities = useRef(new Float32Array(MAX_POINTS * 3));
  const lineVelocities = useRef(new Float32Array(MAX_SEGMENTS * 3));
  const activePointCount = useRef(0);
  const activeLineCount = useRef(0);
  const initialized = useRef(false);

  // ── Initialize particles in camera box ──
  function initParticles(camPos: THREE.Vector3, config: WeatherConfig, isPoints: boolean) {
    const count = Math.min(config.count, isPoints ? MAX_POINTS : MAX_SEGMENTS);
    const positions = isPoints
      ? (pointsGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
      : (linesGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
    const velocities = isPoints ? pointVelocities.current : lineVelocities.current;

    for (let i = 0; i < count; i++) {
      const x = camPos.x + (Math.random() - 0.5) * BOX_SIZE;
      const y = camPos.y + (Math.random() - 0.5) * BOX_SIZE;
      const z = camPos.z + (Math.random() - 0.5) * BOX_SIZE;

      if (isPoints) {
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;
      } else {
        // Line segment: start + end
        const len = config.sizeOrLength;
        const nx = config.dirX / (Math.abs(config.dirX) + Math.abs(config.dirY) + 0.001);
        const ny = config.dirY / (Math.abs(config.dirX) + Math.abs(config.dirY) + 0.001);
        positions[i * 6] = x;
        positions[i * 6 + 1] = y;
        positions[i * 6 + 2] = z;
        positions[i * 6 + 3] = x + nx * len;
        positions[i * 6 + 4] = y + ny * len;
        positions[i * 6 + 5] = z;
      }

      // Add some randomness to velocity
      const speedVar = 0.7 + Math.random() * 0.6;
      velocities[i * 3] = config.dirX * config.speed * speedVar;
      velocities[i * 3 + 1] = config.dirY * config.speed * speedVar;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3 * config.speed;
    }

    if (isPoints) {
      activePointCount.current = count;
      (pointsGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    } else {
      activeLineCount.current = count;
      (linesGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  // ── Cleanup ──
  useEffect(() => {
    return () => {
      pointsGeo.dispose();
      pointsMat.dispose();
      linesGeo.dispose();
      linesMat.dispose();
    };
  }, [pointsGeo, pointsMat, linesGeo, linesMat]);

  // ── Per-frame update ──
  useFrame((_, delta) => {
    const vs = vsRef.current;
    const config = WEATHER_CONFIGS[vs.weather];
    const camPos = camera.position;

    // No particles for clear/cloudy/fog
    if (!config) {
      if (activePointCount.current > 0) {
        activePointCount.current = 0;
        pointsGeo.setDrawRange(0, 0);
      }
      if (activeLineCount.current > 0) {
        activeLineCount.current = 0;
        linesGeo.setDrawRange(0, 0);
      }
      initialized.current = false;
      return;
    }

    // Initialize on weather change
    if (!initialized.current) {
      activePointCount.current = 0;
      activeLineCount.current = 0;
      initParticles(camPos, config, config.type === 'points');
      initialized.current = true;
    }

    const isPoints = config.type === 'points';

    if (isPoints) {
      const positions = (pointsGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const velocities = pointVelocities.current;
      const count = activePointCount.current;

      for (let i = 0; i < count; i++) {
        // Update position
        positions[i * 3] += velocities[i * 3] * delta;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;

        // Snow sine wobble
        if (vs.weather === 'snow') {
          positions[i * 3] += Math.sin(positions[i * 3 + 1] * 3 + i) * 0.002;
        }

        // Blizzard turbulence
        if (vs.weather === 'blizzard') {
          positions[i * 3] += (Math.random() - 0.5) * 0.05;
          positions[i * 3 + 2] += (Math.random() - 0.5) * 0.05;
        }

        // Wrap around camera box
        if (positions[i * 3] > camPos.x + BOX_HALF) positions[i * 3] -= BOX_SIZE;
        if (positions[i * 3] < camPos.x - BOX_HALF) positions[i * 3] += BOX_SIZE;
        if (positions[i * 3 + 1] > camPos.y + BOX_HALF) positions[i * 3 + 1] -= BOX_SIZE;
        if (positions[i * 3 + 1] < camPos.y - BOX_HALF) positions[i * 3 + 1] += BOX_SIZE;
        if (positions[i * 3 + 2] > camPos.z + BOX_HALF) positions[i * 3 + 2] -= BOX_SIZE;
        if (positions[i * 3 + 2] < camPos.z - BOX_HALF) positions[i * 3 + 2] += BOX_SIZE;
      }

      (pointsGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      pointsGeo.setDrawRange(0, count);
      linesGeo.setDrawRange(0, 0);

      // Set material properties
      pointsMat.size = config.sizeOrLength * 0.015;
      pointsMat.opacity = vs.weather === 'blizzard' ? 0.8 : 0.7;
    } else {
      // Lines (rain/wind)
      const positions = (linesGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const velocities = lineVelocities.current;
      const count = activeLineCount.current;
      const len = config.sizeOrLength;
      const nx = config.dirX / (Math.abs(config.dirX) + Math.abs(config.dirY) + 0.001);
      const ny = config.dirY / (Math.abs(config.dirX) + Math.abs(config.dirY) + 0.001);

      for (let i = 0; i < count; i++) {
        // Move start point
        positions[i * 6] += velocities[i * 3] * delta;
        positions[i * 6 + 1] += velocities[i * 3 + 1] * delta;
        positions[i * 6 + 2] += velocities[i * 3 + 2] * delta;

        // End point = start + direction * length
        positions[i * 6 + 3] = positions[i * 6] + nx * len;
        positions[i * 6 + 4] = positions[i * 6 + 1] + ny * len;
        positions[i * 6 + 5] = positions[i * 6 + 2];

        // Wrap around camera box
        if (positions[i * 6] > camPos.x + BOX_HALF) positions[i * 6] -= BOX_SIZE;
        if (positions[i * 6] < camPos.x - BOX_HALF) positions[i * 6] += BOX_SIZE;
        if (positions[i * 6 + 1] > camPos.y + BOX_HALF) positions[i * 6 + 1] -= BOX_SIZE;
        if (positions[i * 6 + 1] < camPos.y - BOX_HALF) positions[i * 6 + 1] += BOX_SIZE;
        if (positions[i * 6 + 2] > camPos.z + BOX_HALF) positions[i * 6 + 2] -= BOX_SIZE;
        if (positions[i * 6 + 2] < camPos.z - BOX_HALF) positions[i * 6 + 2] += BOX_SIZE;
      }

      (linesGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      linesGeo.setDrawRange(0, count * 2); // 2 vertices per segment
      pointsGeo.setDrawRange(0, 0);

      // Set line color/opacity per weather
      if (vs.weather === 'rain') {
        linesMat.color.set('#96c8ff');
        linesMat.opacity = 0.4;
      } else {
        linesMat.color.set('#b4b496');
        linesMat.opacity = 0.3;
      }
    }
  });

  // Track weather changes for re-init
  const prevWeatherRef = useRef(vsRef.current.weather);
  useFrame(() => {
    if (vsRef.current.weather !== prevWeatherRef.current) {
      prevWeatherRef.current = vsRef.current.weather;
      initialized.current = false;
    }
  });

  return (
    <>
      <points ref={pointsRef} geometry={pointsGeo} material={pointsMat} frustumCulled={false} />
      <lineSegments ref={linesRef} geometry={linesGeo} material={linesMat} frustumCulled={false} />
    </>
  );
}
