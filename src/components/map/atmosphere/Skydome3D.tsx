/**
 * Skydome3D — Gradient sky sphere + twinkling stars inside the R3F scene.
 * Replaces the CSS-based Skybox component.
 *
 * Uses a large inverted sphere with a custom ShaderMaterial for the gradient.
 * Stars rendered as a separate THREE.Points child, visible during night/dusk.
 * All transitions happen via uniform lerping in useFrame — zero React re-renders.
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualState } from '../VisualStateBridge.tsx';

// ── Sky gradient shader ─────────────────────────

const skyVertexShader = `
varying float vNormalizedY;
void main() {
  // Normalized Y from 0 (bottom) to 1 (top) on the inverted sphere
  vNormalizedY = clamp(position.y / 20.0 + 0.5, 0.0, 1.0);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragmentShader = `
uniform vec3 uTopColor;
uniform vec3 uBottomColor;
varying float vNormalizedY;
void main() {
  gl_FragColor = vec4(mix(uBottomColor, uTopColor, vNormalizedY), 1.0);
}
`;

function hexToVec3(hex: string): THREE.Vector3 {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return new THREE.Vector3(r, g, b);
}

// ── Star data ───────────────────────────────────

interface StarData {
  positions: Float32Array;
  sizes: Float32Array;
  twinkleOffsets: Float32Array;
  twinklePeriods: Float32Array;
}

function generateStarData(count: number): StarData {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const twinkleOffsets = new Float32Array(count);
  const twinklePeriods = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Distribute on upper hemisphere of large sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI * 0.4; // upper 40% only
    const r = 18;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi); // Y = up
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    sizes[i] = 0.5 + Math.random() * 1.5;
    twinkleOffsets[i] = Math.random() * Math.PI * 2;
    twinklePeriods[i] = 2 + Math.random() * 2;
  }

  return { positions, sizes, twinkleOffsets, twinklePeriods };
}

// ── Component ───────────────────────────────────

export function Skydome3D() {
  const vsRef = useVisualState();

  // ── Sky dome ──
  const skyGeo = useMemo(() => new THREE.SphereGeometry(20, 32, 16), []);
  const skyMat = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      vertexShader: skyVertexShader,
      fragmentShader: skyFragmentShader,
      uniforms: {
        uTopColor: { value: new THREE.Vector3(0.02, 0.02, 0.04) },
        uBottomColor: { value: new THREE.Vector3(0.04, 0.04, 0.04) },
      },
      side: THREE.BackSide,
      depthWrite: false,
    });
    return m;
  }, []);

  // Current lerp targets (stored as refs for smooth transitions)
  const targetTopRef = useRef(new THREE.Vector3());
  const targetBottomRef = useRef(new THREE.Vector3());

  // ── Stars ──
  const starData = useMemo(() => generateStarData(40), []);
  const starGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(starData.positions, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(starData.sizes, 1));
    return geo;
  }, [starData]);

  const starMat = useMemo(() => new THREE.PointsMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    sizeAttenuation: false,
    size: 1.5,
    depthWrite: false,
  }), []);

  const starOpacityRef = useRef(0);

  // ── Per-frame update ──
  useFrame((_, delta) => {
    const vs = vsRef.current;

    // Update sky gradient targets
    const top = hexToVec3(vs.skyTop);
    const bottom = hexToVec3(vs.skyBottom);
    targetTopRef.current.copy(top);
    targetBottomRef.current.copy(bottom);

    // Lerp uniforms toward targets
    const lerpSpeed = delta * 0.8; // ~2s transition
    const uTop = skyMat.uniforms.uTopColor.value as THREE.Vector3;
    const uBottom = skyMat.uniforms.uBottomColor.value as THREE.Vector3;
    uTop.lerp(targetTopRef.current, lerpSpeed);
    uBottom.lerp(targetBottomRef.current, lerpSpeed);

    // Stars opacity: visible only at night/dusk
    const isNight = vs.timeOfDay === 'night' || vs.timeOfDay === 'dusk';
    const targetStarOpacity = isNight ? 0.6 : 0;
    starOpacityRef.current += (targetStarOpacity - starOpacityRef.current) * lerpSpeed;
    starMat.opacity = starOpacityRef.current;

    // Star twinkle: modulate individual star sizes
    if (isNight) {
      const sizes = starGeo.getAttribute('size') as THREE.BufferAttribute;
      const arr = sizes.array as Float32Array;
      const elapsed = performance.now() / 1000;
      for (let i = 0; i < starData.sizes.length; i++) {
        const twinkle = Math.sin(elapsed / starData.twinklePeriods[i] + starData.twinkleOffsets[i]);
        arr[i] = starData.sizes[i] * (0.7 + twinkle * 0.3);
      }
      sizes.needsUpdate = true;
    }
  });

  return (
    <>
      <mesh geometry={skyGeo} material={skyMat} renderOrder={-1000} />
      <points geometry={starGeo} material={starMat} renderOrder={-999} />
    </>
  );
}
