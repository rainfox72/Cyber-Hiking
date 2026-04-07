/**
 * VectorScene — R3F scene renderer for CRT vector art popups.
 *
 * Takes a scene definition and renders the appropriate Three.js
 * geometry primitives. Used inside the VectorTerminal overlay.
 */

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import {
  EffectComposer,
  Bloom,
} from "@react-three/postprocessing";
import type { VectorSceneDef, VectorElement, VectorLabel } from "./types.ts";
import {
  TerrainPrimitive,
  LinePrimitive,
  WireframeMeshPrimitive,
  PointsPrimitive,
  RingPrimitive,
  HikerPrimitive,
  MotionGhostsPrimitive,
  GridPrimitive,
} from "./vectorPrimitives.tsx";

// ── Element renderer ──

function RenderElement({ element, index }: { element: VectorElement; index: number }) {
  switch (element.type) {
    case "terrain":
      return <TerrainPrimitive key={index} {...element} />;
    case "line":
      return <LinePrimitive key={index} {...element} />;
    case "wireframe-mesh":
      return <WireframeMeshPrimitive key={index} {...element} />;
    case "points":
      return <PointsPrimitive key={index} {...element} />;
    case "ring":
      return <RingPrimitive key={index} {...element} />;
    case "hiker":
      return <HikerPrimitive key={index} {...element} />;
    case "motion-ghosts":
      return <MotionGhostsPrimitive key={index} {...element} />;
    case "grid":
      return <GridPrimitive key={index} {...element} />;
    default:
      return null;
  }
}

// ── Label renderer ──

function RenderLabel({ label }: { label: VectorLabel }) {
  const color = label.color || "#00ff41";
  const fontSize = label.fontSize || 14;
  const animClass = label.animate === "blink" ? "vt-label-blink"
    : label.animate === "pulse" ? "vt-label-pulse"
    : "";

  return (
    <Html position={label.position} center style={{ pointerEvents: "none" }}>
      <div
        className={animClass}
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: `${fontSize}px`,
          fontWeight: label.bold ? "bold" : "normal",
          color,
          letterSpacing: `${label.letterSpacing ?? 2}px`,
          textShadow: `0 0 8px ${color}88, 0 0 16px ${color}44`,
          whiteSpace: "nowrap",
          userSelect: "none",
        }}
      >
        {label.text}
      </div>
    </Html>
  );
}

// ── Scene container with optional slow rotation ──

function SceneGroup({
  scene,
  children,
}: {
  scene: VectorSceneDef;
  children: React.ReactNode;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (scene.animateRotation && groupRef.current) {
      groupRef.current.rotation.y += scene.animateRotation * delta;
    }
  });

  return <group ref={groupRef}>{children}</group>;
}

// ── Main scene component ──

export function VectorScene({ scene }: { scene: VectorSceneDef }) {
  return (
    <>
      {/* Camera setup handled by Canvas orthographic prop */}

      {/* Scene elements */}
      <SceneGroup scene={scene}>
        {scene.elements.map((el, i) => (
          <RenderElement key={i} element={el} index={i} />
        ))}
      </SceneGroup>

      {/* Labels (not rotated) */}
      {scene.labels.map((label, i) => (
        <RenderLabel key={`label-${i}`} label={label} />
      ))}

      {/* Post-processing: bloom for phosphor glow */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.1}
          luminanceSmoothing={0.9}
          intensity={1.2}
        />
      </EffectComposer>
    </>
  );
}
