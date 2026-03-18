/**
 * TerrainLandmarks — 6 unique waypoint landmark types rendered as R3F meshes.
 * Each type has distinct geometry, color, and animation (opacity breathe,
 * campfire flicker, warning jitter, summit beacon pulse/rotate).
 * Weather reactivity: blizzard degrades all landmarks + speeds beacon pulse.
 * Night mode: glow points brighter, others dim.
 */

import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { LandmarkDef } from "./terrainDetails.ts";
import type { TimeOfDay, WeatherCondition } from "../../../engine/types.ts";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  details: { landmarks: LandmarkDef[] };
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
  currentIndex: number;
}

// ---------------------------------------------------------------------------
// Shared geometry factories — created once in module scope for reuse
// ---------------------------------------------------------------------------

// Each landmark sub-component owns its own useMemo so geometries are shared
// within that component but not recreated across instances of the same type.

// ---------------------------------------------------------------------------
// TrailheadGate — 2 vertical posts + 1 horizontal bar, green wireframe
// ---------------------------------------------------------------------------

function TrailheadGate({
  landmark,
  timeOfDay,
  weather,
}: {
  landmark: LandmarkDef;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}) {
  const postGeo = useMemo(() => new THREE.BoxGeometry(0.01, 0.08, 0.01), []);
  const barGeo = useMemo(() => new THREE.BoxGeometry(0.06, 0.005, 0.01), []);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#00ff41",
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
    [],
  );

  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();

    let opacity: number;

    if (weather === "blizzard") {
      // Blizzard: degrade + position jitter
      opacity = 0.3 + Math.random() * 0.4; // 0.3-0.7
      groupRef.current.position.x =
        landmark.position.x + (Math.random() - 0.5) * 0.006;
      groupRef.current.position.z =
        landmark.position.z + (Math.random() - 0.5) * 0.006;
    } else {
      // Slow breathe 0.4-0.6 at 0.5Hz
      opacity = 0.5 + Math.sin(elapsed * Math.PI * 2 * 0.5) * 0.1;
      if (timeOfDay === "night") opacity *= 0.7;
      groupRef.current.position.x = landmark.position.x;
      groupRef.current.position.z = landmark.position.z;
    }

    mat.opacity = Math.max(0, Math.min(1, opacity));
  });

  useEffect(() => {
    return () => {
      postGeo.dispose();
      barGeo.dispose();
      mat.dispose();
    };
  }, [postGeo, barGeo, mat]);

  const { x, y, z } = landmark.position;
  const s = landmark.scale;
  const postHeight = 0.08 * s;

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      scale={[s, s, s]}
    >
      {/* Left post */}
      <mesh geometry={postGeo} material={mat} position={[-0.02, postHeight / 2, 0]} />
      {/* Right post */}
      <mesh geometry={postGeo} material={mat} position={[0.02, postHeight / 2, 0]} />
      {/* Horizontal bar at top */}
      <mesh geometry={barGeo} material={mat} position={[0, postHeight, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// ShelterMarker — tent pyramid wireframe + campfire glow sphere
// ---------------------------------------------------------------------------

function ShelterMarker({
  landmark,
  timeOfDay,
  weather,
}: {
  landmark: LandmarkDef;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}) {
  const tentGeo = useMemo(() => new THREE.ConeGeometry(0.025, 0.03, 4), []);
  const fireGeo = useMemo(() => new THREE.SphereGeometry(0.005, 4, 4), []);

  const tentMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#00ff41",
        transparent: true,
        opacity: 0.4,
        wireframe: true,
      }),
    [],
  );
  const fireMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ffb000",
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );

  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();

    let tentOpacity: number;
    let fireOpacity: number;

    if (weather === "blizzard") {
      tentOpacity = 0.3 + Math.random() * 0.4;
      fireOpacity = 0.3 + Math.random() * 0.4;
      groupRef.current.position.x =
        landmark.position.x + (Math.random() - 0.5) * 0.006;
      groupRef.current.position.z =
        landmark.position.z + (Math.random() - 0.5) * 0.006;
    } else {
      tentOpacity = 0.4;
      if (timeOfDay === "night") tentOpacity *= 0.7;
      // Campfire flicker at 6Hz (0.4-0.8)
      fireOpacity =
        timeOfDay === "night"
          ? 0.85 + Math.sin(elapsed * Math.PI * 2 * 6) * 0.1 // 0.75-0.95 at night
          : 0.6 + Math.sin(elapsed * Math.PI * 2 * 6) * 0.2; // 0.4-0.8 day
      groupRef.current.position.x = landmark.position.x;
      groupRef.current.position.z = landmark.position.z;
    }

    tentMat.opacity = Math.max(0, Math.min(1, tentOpacity));
    fireMat.opacity = Math.max(0, Math.min(1, fireOpacity));
  });

  useEffect(() => {
    return () => {
      tentGeo.dispose();
      fireGeo.dispose();
      tentMat.dispose();
      fireMat.dispose();
    };
  }, [tentGeo, fireGeo, tentMat, fireMat]);

  const { x, y, z } = landmark.position;
  const s = landmark.scale;

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      scale={[s, s, s]}
    >
      {/* Tent pyramid */}
      <mesh geometry={tentGeo} material={tentMat} position={[0, 0.015, 0]} />
      {/* Campfire glow */}
      <mesh geometry={fireGeo} material={fireMat} position={[0, 0.005, 0.03]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Shrine — torii gate: 2 posts + curved top bar, warm red-orange
// ---------------------------------------------------------------------------

function Shrine({
  landmark,
  timeOfDay,
  weather,
}: {
  landmark: LandmarkDef;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}) {
  const postGeo = useMemo(() => new THREE.BoxGeometry(0.008, 0.06, 0.008), []);
  const topGeo = useMemo(() => new THREE.BoxGeometry(0.05, 0.005, 0.01), []);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ff6644",
        transparent: true,
        opacity: 0.4,
        wireframe: true,
      }),
    [],
  );

  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();

    let opacity: number;

    if (weather === "blizzard") {
      opacity = 0.3 + Math.random() * 0.4;
      groupRef.current.position.x =
        landmark.position.x + (Math.random() - 0.5) * 0.006;
      groupRef.current.position.z =
        landmark.position.z + (Math.random() - 0.5) * 0.006;
    } else {
      // Slow breathe 0.3-0.5 at 0.3Hz
      opacity = 0.4 + Math.sin(elapsed * Math.PI * 2 * 0.3) * 0.1;
      if (timeOfDay === "night") opacity *= 0.7;
      groupRef.current.position.x = landmark.position.x;
      groupRef.current.position.z = landmark.position.z;
    }

    mat.opacity = Math.max(0, Math.min(1, opacity));
  });

  useEffect(() => {
    return () => {
      postGeo.dispose();
      topGeo.dispose();
      mat.dispose();
    };
  }, [postGeo, topGeo, mat]);

  const { x, y, z } = landmark.position;
  const s = landmark.scale;
  const postHeight = 0.06 * s;

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      scale={[s, s, s]}
    >
      {/* Left post */}
      <mesh geometry={postGeo} material={mat} position={[-0.02, postHeight / 2, 0]} />
      {/* Right post */}
      <mesh geometry={postGeo} material={mat} position={[0.02, postHeight / 2, 0]} />
      {/* Top bar (slightly wider than posts, at top of posts) */}
      <mesh geometry={topGeo} material={mat} position={[0, postHeight + 0.003, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// Cairn — 3 stacked octahedra, gray, static
// ---------------------------------------------------------------------------

function Cairn({
  landmark,
  timeOfDay,
  weather,
}: {
  landmark: LandmarkDef;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}) {
  const geoLarge = useMemo(() => new THREE.OctahedronGeometry(0.02, 0), []);
  const geoMid = useMemo(() => new THREE.OctahedronGeometry(0.015, 0), []);
  const geoSmall = useMemo(() => new THREE.OctahedronGeometry(0.01, 0), []);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#888888",
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
    [],
  );

  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;

    if (weather === "blizzard") {
      // Blizzard jitter
      const baseOpacity = 0.3 + Math.random() * 0.4;
      mat.opacity = Math.max(0, Math.min(1, baseOpacity));
      groupRef.current.position.x =
        landmark.position.x + (Math.random() - 0.5) * 0.006;
      groupRef.current.position.z =
        landmark.position.z + (Math.random() - 0.5) * 0.006;
    } else {
      // Static — reset position, apply night dimming
      let opacity = 0.5;
      if (timeOfDay === "night") opacity *= 0.7;
      mat.opacity = Math.max(0, Math.min(1, opacity));
      groupRef.current.position.x = landmark.position.x;
      groupRef.current.position.z = landmark.position.z;
    }
  });

  useEffect(() => {
    return () => {
      geoLarge.dispose();
      geoMid.dispose();
      geoSmall.dispose();
      mat.dispose();
    };
  }, [geoLarge, geoMid, geoSmall, mat]);

  const { x, y, z } = landmark.position;
  const s = landmark.scale;

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      scale={[s, s, s]}
    >
      {/* Bottom stone */}
      <mesh geometry={geoLarge} material={mat} position={[0, 0.02, 0]} />
      {/* Middle stone */}
      <mesh geometry={geoMid} material={mat} position={[0, 0.055, 0]} />
      {/* Top stone */}
      <mesh geometry={geoSmall} material={mat} position={[0, 0.082, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// WarningSign — tall post + triangle top, aggressive animation
// ---------------------------------------------------------------------------

function WarningSign({
  landmark,
  timeOfDay,
  weather,
}: {
  landmark: LandmarkDef;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}) {
  const postGeo = useMemo(() => new THREE.CylinderGeometry(0.004, 0.004, 0.08, 4), []);
  const triangleGeo = useMemo(() => new THREE.ConeGeometry(0.02, 0.025, 3), []);

  const mat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#ff4400",
        transparent: true,
        opacity: 0.7,
      }),
    [],
  );

  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();

    // Aggressive constant jitter regardless of weather
    groupRef.current.position.x =
      landmark.position.x + (Math.random() - 0.5) * 0.006;
    groupRef.current.position.z =
      landmark.position.z + (Math.random() - 0.5) * 0.006;

    let opacity: number;

    if (weather === "blizzard") {
      // Even more aggressive in blizzard
      opacity = 0.3 + Math.random() * 0.4;
    } else {
      // Flicker 0.5-1.0 at 8Hz
      opacity = 0.75 + Math.sin(elapsed * Math.PI * 2 * 8) * 0.25;
      if (timeOfDay === "night") opacity *= 0.7;
    }

    // Color flash between #ff4400 and #ff0000
    const isFlashOn = Math.sin(elapsed * Math.PI * 2 * 8) > 0;
    mat.color.set(isFlashOn ? "#ff4400" : "#ff0000");
    mat.opacity = Math.max(0, Math.min(1, opacity));
  });

  useEffect(() => {
    return () => {
      postGeo.dispose();
      triangleGeo.dispose();
      mat.dispose();
    };
  }, [postGeo, triangleGeo, mat]);

  const { x, y, z } = landmark.position;
  const s = landmark.scale;

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      scale={[s, s, s]}
    >
      {/* Post */}
      <mesh geometry={postGeo} material={mat} position={[0, 0.04, 0]} />
      {/* Triangle warning sign at top */}
      <mesh geometry={triangleGeo} material={mat} position={[0, 0.0925, 0]} />
    </group>
  );
}

// ---------------------------------------------------------------------------
// SummitBeacon — tall pole + pulsing sphere + rotating ring
// ---------------------------------------------------------------------------

function SummitBeacon({
  landmark,
  timeOfDay,
  weather,
}: {
  landmark: LandmarkDef;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
}) {
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.003, 0.003, 0.12, 4), []);
  const sphereGeo = useMemo(() => new THREE.SphereGeometry(0.008, 6, 6), []);
  const ringGeo = useMemo(() => new THREE.RingGeometry(0.03, 0.035, 16), []);

  const poleMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#00ff41",
        transparent: true,
        opacity: 0.6,
      }),
    [],
  );
  const sphereMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#00ff41",
        transparent: true,
        opacity: 0.8,
      }),
    [],
  );
  const ringMat = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: "#00ff41",
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      }),
    [],
  );

  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();

    // Rotate ring at 0.5 rad/s
    if (ringRef.current) {
      ringRef.current.rotation.y = elapsed * 0.5;
    }

    if (weather === "blizzard") {
      // Blizzard: degrade opacity, speed up beacon pulse (4Hz)
      const baseOpacity = 0.3 + Math.random() * 0.4;
      groupRef.current.position.x =
        landmark.position.x + (Math.random() - 0.5) * 0.006;
      groupRef.current.position.z =
        landmark.position.z + (Math.random() - 0.5) * 0.006;
      sphereMat.opacity = Math.max(0, Math.min(1, baseOpacity));
      poleMat.opacity = Math.max(0, Math.min(1, baseOpacity * 0.8));
      ringMat.opacity = Math.max(0, Math.min(1, baseOpacity * 0.7));
    } else {
      groupRef.current.position.x = landmark.position.x;
      groupRef.current.position.z = landmark.position.z;

      // Pulse at 2Hz (0.6-1.0)
      const pulseFreq = 2;
      const pulseBase = 0.8 + Math.sin(elapsed * Math.PI * 2 * pulseFreq) * 0.2;

      if (timeOfDay === "night") {
        // Night: glow points brighter (0.9-1.0)
        sphereMat.opacity = Math.min(1, 0.9 + Math.sin(elapsed * Math.PI * 2 * pulseFreq) * 0.1);
      } else {
        sphereMat.opacity = Math.max(0, Math.min(1, pulseBase));
      }

      const dimFactor = timeOfDay === "night" ? 0.7 : 1.0;
      poleMat.opacity = Math.max(0, Math.min(1, 0.6 * dimFactor));
      ringMat.opacity = Math.max(0, Math.min(1, 0.5 * dimFactor));
    }
  });

  useEffect(() => {
    return () => {
      poleGeo.dispose();
      sphereGeo.dispose();
      ringGeo.dispose();
      poleMat.dispose();
      sphereMat.dispose();
      ringMat.dispose();
    };
  }, [poleGeo, sphereGeo, ringGeo, poleMat, sphereMat, ringMat]);

  const { x, y, z } = landmark.position;
  const s = landmark.scale; // 1.5 for summit beacon

  return (
    <group
      ref={groupRef}
      position={[x, y, z]}
      scale={[s, s, s]}
    >
      {/* Pole */}
      <mesh geometry={poleGeo} material={poleMat} position={[0, 0.06, 0]} />
      {/* Pulsing beacon sphere at top of pole */}
      <mesh geometry={sphereGeo} material={sphereMat} position={[0, 0.124, 0]} />
      {/* Slowly rotating ring around base of beacon */}
      <mesh
        ref={ringRef}
        geometry={ringGeo}
        material={ringMat}
        position={[0, 0.124, 0]}
        rotation={[Math.PI / 2, 0, 0]}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------
// TerrainLandmarks — parent that maps over all landmark defs
// ---------------------------------------------------------------------------

export function TerrainLandmarks({
  details,
  timeOfDay,
  weather,
  currentIndex: _currentIndex,
}: Props) {
  const { landmarks } = details;
  if (landmarks.length === 0) return null;

  return (
    <>
      {landmarks.map((lm) => {
        switch (lm.type) {
          case "trailhead_gate":
            return (
              <TrailheadGate
                key={lm.waypointId}
                landmark={lm}
                timeOfDay={timeOfDay}
                weather={weather}
              />
            );
          case "shelter_marker":
            return (
              <ShelterMarker
                key={lm.waypointId}
                landmark={lm}
                timeOfDay={timeOfDay}
                weather={weather}
              />
            );
          case "shrine":
            return (
              <Shrine
                key={lm.waypointId}
                landmark={lm}
                timeOfDay={timeOfDay}
                weather={weather}
              />
            );
          case "cairn":
            return (
              <Cairn
                key={lm.waypointId}
                landmark={lm}
                timeOfDay={timeOfDay}
                weather={weather}
              />
            );
          case "warning_sign":
            return (
              <WarningSign
                key={lm.waypointId}
                landmark={lm}
                timeOfDay={timeOfDay}
                weather={weather}
              />
            );
          case "summit_beacon":
            return (
              <SummitBeacon
                key={lm.waypointId}
                landmark={lm}
                timeOfDay={timeOfDay}
                weather={weather}
              />
            );
          default: {
            // Exhaustive check — TypeScript will error if a new type is added without handling it
            const _exhaustive: never = lm.type;
            return null;
          }
        }
      })}
    </>
  );
}
