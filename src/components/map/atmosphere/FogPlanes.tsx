/**
 * FogPlanes — 2-4 camera-facing noise planes for rolling fog bank effect.
 * Only active during fog/blizzard/snow weather. Zero cost during clear.
 */

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useVisualState } from '../VisualStateBridge.tsx';

const NUM_PLANES = 3;

// Simple noise-based fog plane shader
const fogPlaneVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fogPlaneFragment = `
uniform float uTime;
uniform float uOpacity;
varying vec2 vUv;

// Simple hash-based noise
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec2 uv = vUv * 3.0 + vec2(uTime * 0.05, uTime * 0.02);
  float n = noise(uv) * 0.5 + noise(uv * 2.0) * 0.3 + noise(uv * 4.0) * 0.2;
  // Fade edges
  float edgeFade = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x)
                 * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
  float alpha = n * edgeFade * uOpacity;
  gl_FragColor = vec4(0.7, 0.7, 0.75, alpha);
}
`;

export function FogPlanes() {
  const vsRef = useVisualState();
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const planes = useMemo(() => {
    const items: { geo: THREE.PlaneGeometry; mat: THREE.ShaderMaterial; offset: THREE.Vector3 }[] = [];
    for (let i = 0; i < NUM_PLANES; i++) {
      const geo = new THREE.PlaneGeometry(8, 4);
      const mat = new THREE.ShaderMaterial({
        vertexShader: fogPlaneVertex,
        fragmentShader: fogPlaneFragment,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      // Distribute at different depths and heights
      const offset = new THREE.Vector3(
        // eslint-disable-next-line react-hooks/purity
        (Math.random() - 0.5) * 2,
        -0.5 + i * 0.3,
        -2 - i * 1.5,
      );
      items.push({ geo, mat, offset });
    }
    return items;
  }, []);

  useEffect(() => {
    return () => {
      for (const p of planes) {
        p.geo.dispose();
        p.mat.dispose();
      }
    };
  }, [planes]);

  useFrame(({ clock }) => {
    const vs = vsRef.current;
    const isFoggy = vs.weather === 'fog' || vs.weather === 'blizzard' || vs.weather === 'snow';

    if (!groupRef.current) return;

    // Target opacity based on weather
    const targetOpacity = !isFoggy ? 0
      : vs.weather === 'blizzard' ? 0.06
      : vs.weather === 'fog' ? 0.04
      : 0.02; // snow

    for (let i = 0; i < planes.length; i++) {
      const p = planes[i];
      const mesh = groupRef.current.children[i] as THREE.Mesh;
      if (!mesh) continue;

      // Update shader uniforms
      // eslint-disable-next-line react-hooks/immutability
      p.mat.uniforms.uTime.value = clock.elapsedTime + i * 100;

      // Lerp opacity
      const currentOpacity = p.mat.uniforms.uOpacity.value as number;
      p.mat.uniforms.uOpacity.value = currentOpacity + (targetOpacity - currentOpacity) * 0.02;

      // Position relative to camera, slowly drifting
      const drift = Math.sin(clock.elapsedTime * 0.1 + i * 2) * 0.5;
      mesh.position.set(
        camera.position.x + p.offset.x + drift,
        camera.position.y + p.offset.y,
        camera.position.z + p.offset.z,
      );

      // Always face camera
      mesh.lookAt(camera.position);

      // Hide when no fog
      mesh.visible = (p.mat.uniforms.uOpacity.value as number) > 0.001;
    }
  });

  return (
    <group ref={groupRef}>
      {planes.map((p, i) => (
        <mesh key={i} geometry={p.geo} material={p.mat} frustumCulled={false} />
      ))}
    </group>
  );
}
