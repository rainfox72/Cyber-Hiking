# Visual Atmosphere Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three composable visual atmosphere layers (Skybox, TerrainAtmosphere, 3D TacticalMap) to deepen the CRT tactical aesthetic.

**Architecture:** Three independent `position: fixed` overlay layers read from `useGameStore` and compose via z-index stacking. Panel backgrounds become semi-transparent so lower layers show through. ParticleCanvas night overlay is removed (Skybox owns night atmosphere). TacticalMap3D replaces the SVG map inside the existing `.tactical-map` container using React Three Fiber.

**Tech Stack:** React 19, TypeScript, Zustand 5, Three.js, @react-three/fiber v9, @react-three/drei v10, CSS gradients, SVG filters.

**Spec:** `docs/superpowers/specs/2026-03-17-visual-atmosphere-overhaul-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/effects/Skybox.tsx` | Create | Time-of-day gradient background + star canvas |
| `src/components/effects/TerrainAtmosphere.tsx` | Create | Terrain-type SVG noise/gradient overlay |
| `src/components/map/TacticalMap3D.tsx` | Create | R3F canvas, camera, scene, game-state effects |
| `src/components/map/terrainMesh.ts` | Create | Pure TS heightmap mesh generation |
| `src/components/map/TacticalMapLegacy.tsx` | Rename | Current SVG map preserved as fallback |
| `src/components/effects/ParticleCanvas.tsx` | Modify | Remove night/dusk overlay (lines 80-86) |
| `src/App.tsx` | Modify | Add Skybox + TerrainAtmosphere, swap map import |
| `src/App.css` | Modify | Panel transparency, tactical-map CSS updates |
| `src/index.css` | Modify | Add `--sky-tint`, `--terrain-tint` CSS variables |

---

## Task 1: Panel Transparency + ParticleCanvas Night Removal

**Files:**
- Modify: `src/index.css:93-99`
- Modify: `src/App.css:2-11,20,170-178,425-433`
- Modify: `src/components/effects/ParticleCanvas.tsx:80-86`

This is the prerequisite CSS change that makes the lower layers visible.

- [ ] **Step 1: Add CSS variables to `src/index.css`**

In `:root` block, after `--border-radius: 2px;` (line 39), add:

```css
  /* Atmosphere tinting (set by Skybox.tsx and TerrainAtmosphere.tsx) */
  --sky-tint: rgba(0, 0, 0, 0);
  --terrain-tint: rgba(0, 0, 0, 0);
```

- [ ] **Step 2: Make `.panel` background semi-transparent in `src/index.css`**

Change line 94 from:
```css
  background: var(--bg-panel);
```
to:
```css
  background: rgba(13, 13, 13, 0.85);
```

- [ ] **Step 3: Make `.game-shell` background transparent in `src/App.css`**

Change line 10 from:
```css
  background: var(--bg-dark);
```
to:
```css
  background: transparent;
```

- [ ] **Step 4: Make `.game-header` background semi-transparent in `src/App.css`**

Change line 20 from:
```css
  background: linear-gradient(180deg, #0d0d0d 0%, #0a0a0a 100%);
```
to:
```css
  background: linear-gradient(180deg, rgba(13, 13, 13, 0.90) 0%, rgba(10, 10, 10, 0.90) 100%);
```

- [ ] **Step 5: Make `.log-window` background semi-transparent in `src/App.css`**

Change line 175 from:
```css
  background: var(--bg-panel);
```
to:
```css
  background: rgba(13, 13, 13, 0.85);
```

- [ ] **Step 6: Make `.tactical-map` background semi-transparent in `src/App.css`**

Change line 427 from:
```css
  background: var(--bg-panel);
```
to:
```css
  background: rgba(13, 13, 13, 0.85);
```

- [ ] **Step 7: Remove night overlay from `ParticleCanvas.tsx`**

In `src/components/effects/ParticleCanvas.tsx`, replace lines 80-86:
```typescript
      // Night overlay
      const isNight = timeOfDay === "night" || timeOfDay === "dusk";
      ctx.clearRect(0, 0, w, h);
      if (isNight) {
        ctx.fillStyle = `rgba(0, 0, 10, ${timeOfDay === "night" ? 0.15 : 0.06})`;
        ctx.fillRect(0, 0, w, h);
      }
```
with:
```typescript
      ctx.clearRect(0, 0, w, h);
```

- [ ] **Step 8: Verify type check passes**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 9: Visual smoke test**

Run dev server (use configured port). Open browser. Confirm:
- Panels are visible with slightly transparent backgrounds
- No night overlay tint from ParticleCanvas
- Weather particles still render normally
- All panels readable against the `#0a0a0a` body background

- [ ] **Step 10: Commit**

```bash
git add src/index.css src/App.css src/components/effects/ParticleCanvas.tsx
git commit -m "feat: panel transparency + remove ParticleCanvas night overlay

Prepare for atmosphere layers: panels now use rgba backgrounds,
game-shell is transparent, night tinting moved to upcoming Skybox."
```

---

## Task 2: Skybox Component

**Files:**
- Create: `src/components/effects/Skybox.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/effects/Skybox.tsx`**

```tsx
/**
 * Skybox — Full-screen time-of-day gradient background.
 * Uses opacity crossfade between two stacked gradient divs for smooth transitions.
 * Renders a star canvas overlay during night phase.
 */

import { useRef, useEffect, useState, useMemo } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import type { TimeOfDay, WeatherCondition } from "../../engine/types.ts";

interface GradientDef {
  top: string;
  bottom: string;
}

const TIME_GRADIENTS: Record<TimeOfDay, GradientDef> = {
  dawn:      { top: "#1a0a2e", bottom: "#4a2040" },
  morning:   { top: "#0d1a2d", bottom: "#1a3a4a" },
  midday:    { top: "#0a1520", bottom: "#152530" },
  afternoon: { top: "#0d1520", bottom: "#2a2a1a" },
  dusk:      { top: "#2a1525", bottom: "#1a0a0a" },
  night:     { top: "#050510", bottom: "#0a0a0a" },
};

const SKY_TINTS: Record<TimeOfDay, string> = {
  dawn:      "rgba(74, 32, 64, 0.03)",
  morning:   "rgba(26, 58, 74, 0.02)",
  midday:    "rgba(0, 0, 0, 0)",
  afternoon: "rgba(42, 42, 26, 0.02)",
  dusk:      "rgba(42, 21, 37, 0.03)",
  night:     "rgba(5, 5, 16, 0.04)",
};

function getWeatherModifiedGradient(
  base: GradientDef,
  weather: WeatherCondition,
  intensity: number,
): GradientDef {
  if (weather === "cloudy" || weather === "fog") {
    const gray = Math.round(intensity * 15);
    const grayHex = gray.toString(16).padStart(2, "0");
    return {
      top: blendHex(base.top, `#${grayHex}${grayHex}${grayHex}`, intensity * 0.3),
      bottom: blendHex(base.bottom, `#${grayHex}${grayHex}${grayHex}`, intensity * 0.2),
    };
  }
  if (weather === "blizzard") {
    return {
      top: blendHex(base.top, "#303030", intensity * 0.4),
      bottom: blendHex(base.bottom, "#202020", intensity * 0.3),
    };
  }
  return base;
}

function blendHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  twinkleOffset: number;
  twinklePeriod: number;
}

function generateStars(w: number, h: number, count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.4,
      size: 0.5 + Math.random() * 1.5,
      baseOpacity: 0.3 + Math.random() * 0.3,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinklePeriod: 2000 + Math.random() * 2000,
    });
  }
  return stars;
}

export function Skybox() {
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const weather = useGameStore((s) => s.weather.current);
  const intensity = useGameStore((s) => s.weather.intensity);
  const gamePhase = useGameStore((s) => s.gamePhase);

  // Use a single state object to avoid stale closures between activeLayer and gradients
  const [state, setState] = useState(() => {
    const g = TIME_GRADIENTS.night;
    const bg = `linear-gradient(180deg, ${g.top} 0%, ${g.bottom} 100%)`;
    return { gradients: [bg, bg] as [string, string], activeLayer: 0 };
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);

  // Determine effective time
  const effectiveTime = gamePhase === "title" ? "night" as TimeOfDay : timeOfDay;

  // Update gradient on time/weather change
  useEffect(() => {
    const base = TIME_GRADIENTS[effectiveTime];
    const modified = getWeatherModifiedGradient(base, weather, intensity);
    const bg = `linear-gradient(180deg, ${modified.top} 0%, ${modified.bottom} 100%)`;

    setState((prev) => {
      const newActive = prev.activeLayer === 0 ? 1 : 0;
      const gradients: [string, string] = [...prev.gradients];
      gradients[newActive] = bg;
      return { gradients, activeLayer: newActive };
    });

    // Update CSS variable
    document.documentElement.style.setProperty("--sky-tint", SKY_TINTS[effectiveTime]);
  }, [effectiveTime, weather, intensity]);

  // Star canvas
  const isNight = effectiveTime === "night" || effectiveTime === "dusk";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      starsRef.current = generateStars(canvas.width, canvas.height, 40);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isNight) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      const now = performance.now();
      for (const star of starsRef.current) {
        const twinkle = Math.sin((now + star.twinkleOffset) / star.twinklePeriod * Math.PI * 2);
        const opacity = star.baseOpacity + twinkle * 0.15;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, opacity)})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isNight]);

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
    transition: "opacity 2s ease",
  };

  return (
    <>
      <div style={{ ...baseStyle, background: state.gradients[0], opacity: state.activeLayer === 0 ? 1 : 0 }} />
      <div style={{ ...baseStyle, background: state.gradients[1], opacity: state.activeLayer === 1 ? 1 : 0 }} />
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: isNight ? 1 : 0,
          transition: "opacity 2s ease",
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Add Skybox to `src/App.tsx`**

Add import after line 11:
```typescript
import { Skybox } from "./components/effects/Skybox.tsx";
```

Add `<Skybox />` inside the title screen branch (after `<Scanlines />`):
```tsx
  if (gamePhase === "title") {
    return (
      <>
        <Skybox />
        <Scanlines />
        <TitleScreen />
      </>
    );
  }
```

Add `<Skybox />` as the first child of the playing branch (before `<Scanlines />`):
```tsx
  return (
    <>
      <Skybox />
      <Scanlines />
      <ParticleCanvas />
      ...
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 4: Visual test**

Open browser at localhost:3100. Start a game. Confirm:
- Background shows subtle gradients instead of pure black
- Gradients change as time of day advances (use auto-play to progress turns)
- Stars appear and twinkle during night/dusk phases
- Gradients cross-fade smoothly on phase change
- Title screen shows night gradient behind boot sequence
- Panels remain readable with semi-transparent backgrounds

- [ ] **Step 5: Commit**

```bash
git add src/components/effects/Skybox.tsx src/App.tsx
git commit -m "feat: add Skybox time-of-day gradient system

6-phase gradient backgrounds with opacity crossfade transitions,
twinkling star canvas at night, weather-modified gradients,
--sky-tint CSS variable for ambient panel toning."
```

---

## Task 3: TerrainAtmosphere Component

**Files:**
- Create: `src/components/effects/TerrainAtmosphere.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/effects/TerrainAtmosphere.tsx`**

```tsx
/**
 * TerrainAtmosphere — terrain-type visual overlay between Skybox and UI panels.
 * Uses SVG noise filters and CSS gradients per terrain type with crossfade transitions.
 */

import { useRef, useEffect, useState } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import type { TerrainType } from "../../engine/types.ts";

interface TerrainEffect {
  background: string;
  filter?: string;
  terrainTint: string;
}

const HIGH_ALTITUDE_THRESHOLD = 3200;

const TERRAIN_EFFECTS: Record<TerrainType, TerrainEffect> = {
  stream_valley: {
    background: "radial-gradient(ellipse at 50% 100%, rgba(20, 80, 70, 0.08) 0%, transparent 60%)",
    terrainTint: "rgba(20, 80, 70, 0.03)",
  },
  forest: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(10, 40, 15, 0.08) 100%)",
    filter: "url(#terrain-noise-forest)",
    terrainTint: "rgba(10, 40, 15, 0.03)",
  },
  meadow: {
    background: "linear-gradient(180deg, transparent 60%, rgba(40, 50, 20, 0.06) 100%)",
    terrainTint: "rgba(40, 50, 20, 0.02)",
  },
  stone_sea: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(60, 60, 60, 0.04) 100%)",
    filter: "url(#terrain-noise-stone)",
    terrainTint: "rgba(60, 60, 60, 0.03)",
  },
  scree: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(80, 70, 50, 0.04) 100%)",
    filter: "url(#terrain-noise-stone)",
    terrainTint: "rgba(80, 70, 50, 0.03)",
  },
  ridge: {
    background: "linear-gradient(180deg, rgba(10, 20, 40, 0.06) 0%, transparent 40%)",
    terrainTint: "rgba(10, 20, 40, 0.04)",
  },
  summit: {
    background: "radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(200, 200, 200, 0.04) 100%)",
    terrainTint: "rgba(100, 100, 100, 0.03)",
  },
};

export function TerrainAtmosphere() {
  const waypointIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const gamePhase = useGameStore((s) => s.gamePhase);

  // Single state object to avoid stale closures between activeLayer and effects
  const [state, setState] = useState(() => {
    const e = TERRAIN_EFFECTS.stream_valley;
    return { effects: [e, e] as [TerrainEffect, TerrainEffect], activeLayer: 0 };
  });

  const prevTerrainRef = useRef<TerrainType>("stream_valley");

  useEffect(() => {
    if (gamePhase === "title") return;
    const wp = WAYPOINTS[waypointIndex];
    if (!wp) return;
    const terrain = wp.terrain;

    if (terrain === prevTerrainRef.current) return;
    prevTerrainRef.current = terrain;

    let effect = { ...TERRAIN_EFFECTS[terrain] };

    // High altitude modifier: desaturate and cold-shift
    if (wp.elevation > HIGH_ALTITUDE_THRESHOLD) {
      const factor = Math.min((wp.elevation - HIGH_ALTITUDE_THRESHOLD) / 600, 1);
      effect.terrainTint = `rgba(40, 50, 70, ${0.02 + factor * 0.03})`;
    }

    setState((prev) => {
      const newActive = prev.activeLayer === 0 ? 1 : 0;
      const effects: [TerrainEffect, TerrainEffect] = [...prev.effects];
      effects[newActive] = effect;
      return { effects, activeLayer: newActive };
    });

    // Update CSS variable
    document.documentElement.style.setProperty("--terrain-tint", effect.terrainTint);
  }, [waypointIndex, gamePhase]);

  if (gamePhase === "title") return null;

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 1,
    transition: "opacity 1.5s ease",
  };

  return (
    <>
      {/* SVG filter definitions */}
      <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0 }}>
        <defs>
          <filter id="terrain-noise-forest" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="3" seed="42" result="noise" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.04  0 0 0 0 0.16  0 0 0 0 0.06  0 0 0 0.08 0" in="noise" />
          </filter>
          <filter id="terrain-noise-stone" x="0%" y="0%" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="99" result="noise" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.24  0 0 0 0 0.24  0 0 0 0 0.24  0 0 0 0.04 0" in="noise" />
          </filter>
        </defs>
      </svg>

      {/* Two crossfade layers */}
      <div
        style={{
          ...baseStyle,
          background: state.effects[0].background,
          filter: state.effects[0].filter,
          opacity: state.activeLayer === 0 ? 1 : 0,
        }}
      />
      <div
        style={{
          ...baseStyle,
          background: state.effects[1].background,
          filter: state.effects[1].filter,
          opacity: state.activeLayer === 1 ? 1 : 0,
        }}
      />
    </>
  );
}
```

- [ ] **Step 2: Add TerrainAtmosphere to `src/App.tsx`**

Add import:
```typescript
import { TerrainAtmosphere } from "./components/effects/TerrainAtmosphere.tsx";
```

Add `<TerrainAtmosphere />` after `<Skybox />` in the playing branch:
```tsx
  return (
    <>
      <Skybox />
      <TerrainAtmosphere />
      <Scanlines />
      ...
```

(NOT in the title branch — TerrainAtmosphere returns `null` for title, but no need to mount it.)

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 4: Visual test**

Open browser. Start a game and advance through waypoints. Confirm:
- Subtle green fog at forest waypoints
- Moisture haze at stream_valley
- Stone noise at stone_sea/scree
- Blue tint at ridge
- White haze at summit
- Smooth crossfade when terrain changes
- All effects very subtle (not distracting)

- [ ] **Step 5: Commit**

```bash
git add src/components/effects/TerrainAtmosphere.tsx src/App.tsx
git commit -m "feat: add TerrainAtmosphere terrain-type visual overlay

SVG noise filters + CSS gradients per terrain with crossfade,
altitude-driven desaturation above 3200m, --terrain-tint CSS var."
```

---

## Task 4: Install Three.js Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Three.js + React Three Fiber + Drei**

```bash
npm install three @react-three/fiber @react-three/drei
```

- [ ] **Step 2: Install Three.js types**

```bash
npm install -D @types/three
```

- [ ] **Step 3: Verify type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add three.js, react-three-fiber, drei for 3D map"
```

---

## Task 5: Terrain Mesh Generator

**Files:**
- Create: `src/components/map/terrainMesh.ts`

This is pure TS with zero React deps — generates the heightmap geometry from waypoint data.

- [ ] **Step 1: Create `src/components/map/terrainMesh.ts`**

```typescript
/**
 * Terrain mesh generation for the 3D TacticalMap.
 * Generates a heightmap grid from waypoint elevation data with
 * terrain-type-driven ridge profiles and procedural noise.
 */

import type { Waypoint, TerrainType } from "../../engine/types.ts";
import * as THREE from "three";

const GRID_X = 128;
const GRID_Z = 64;

/** Lateral falloff width per terrain type (0 = narrow ridge, 1 = wide valley) */
const RIDGE_WIDTH: Record<TerrainType, number> = {
  ridge: 0.15,
  summit: 0.2,
  scree: 0.35,
  stone_sea: 0.3,
  forest: 0.5,
  meadow: 0.7,
  stream_valley: 0.8,
};

/** Noise amplitude per terrain type */
const NOISE_AMP: Record<TerrainType, number> = {
  ridge: 0.02,
  summit: 0.015,
  scree: 0.06,
  stone_sea: 0.05,
  forest: 0.025,
  meadow: 0.01,
  stream_valley: 0.008,
};

/** Simple mulberry32-based value noise for terrain displacement */
function valueNoise(x: number, z: number, seed: number): number {
  let state = (Math.floor(x * 100) * 73856093 ^ Math.floor(z * 100) * 19349663 ^ seed) | 0;
  state = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296 - 0.5;
}

/** Cubic Hermite interpolation for smooth elevation between waypoints */
function cubicInterp(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
  const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
  const c = -0.5 * p0 + 0.5 * p2;
  const d = p1;
  return a * t * t * t + b * t * t + c * t + d;
}

/** Get interpolated elevation and terrain type at a given distance along the trail */
function sampleTrail(
  waypoints: Waypoint[],
  distance: number,
  maxDist: number,
): { elevation: number; terrain: TerrainType } {
  const norm = (distance / maxDist) * (waypoints.length - 1);
  const i = Math.floor(norm);
  const t = norm - i;

  const clampIdx = (idx: number) => Math.max(0, Math.min(waypoints.length - 1, idx));

  const e0 = waypoints[clampIdx(i - 1)].elevation;
  const e1 = waypoints[clampIdx(i)].elevation;
  const e2 = waypoints[clampIdx(i + 1)].elevation;
  const e3 = waypoints[clampIdx(i + 2)].elevation;

  return {
    elevation: cubicInterp(e0, e1, e2, e3, t),
    terrain: waypoints[clampIdx(i)].terrain,
  };
}

/** Elevation color: green < 2500, amber 2500-3200, red > 3500 */
export function elevationColor(elevation: number): THREE.Color {
  const green = new THREE.Color("#00ff41");
  const amber = new THREE.Color("#ffb000");
  const red = new THREE.Color("#ff2222");

  if (elevation < 2500) return green;
  if (elevation < 3200) {
    const t = (elevation - 2500) / 700;
    return green.clone().lerp(amber, t);
  }
  if (elevation < 3500) {
    const t = (elevation - 3200) / 300;
    return amber.clone().lerp(red, t);
  }
  return red;
}

export interface TerrainMeshData {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  /** Edge geometry for wireframe rendering */
  edgePositions: Float32Array;
  edgeColors: Float32Array;
  /** Trail points on the surface */
  trailPoints: THREE.Vector3[];
  /** Waypoint positions on the surface */
  waypointPositions: THREE.Vector3[];
}

export function generateTerrainMesh(waypoints: Waypoint[]): TerrainMeshData {
  const maxDist = waypoints[waypoints.length - 1].distanceFromStart;
  const minElev = 1500;
  const maxElev = 3800;
  const elevRange = maxElev - minElev;

  const positions = new Float32Array(GRID_X * GRID_Z * 3);
  const colors = new Float32Array(GRID_X * GRID_Z * 3);
  const elevations: number[] = [];

  // Generate vertex positions
  for (let ix = 0; ix < GRID_X; ix++) {
    const distNorm = ix / (GRID_X - 1);
    const dist = distNorm * maxDist;
    const { elevation: centerElev, terrain } = sampleTrail(waypoints, dist, maxDist);
    const ridgeW = RIDGE_WIDTH[terrain];
    const noiseAmp = NOISE_AMP[terrain];

    for (let iz = 0; iz < GRID_Z; iz++) {
      const zNorm = (iz / (GRID_Z - 1)) * 2 - 1; // -1 to 1
      const lateralDist = Math.abs(zNorm);

      // Ridge falloff: elevation drops off laterally
      const falloff = Math.max(0, 1 - lateralDist / ridgeW);
      const falloffCurve = falloff * falloff * (3 - 2 * falloff); // smoothstep
      const baseElev = minElev + (centerElev - minElev) * falloffCurve;

      // Add noise
      const noise = valueNoise(distNorm * 20, zNorm * 20, 12345) * noiseAmp * elevRange;
      const finalElev = Math.max(minElev, baseElev + noise);

      const idx = (ix * GRID_Z + iz) * 3;
      positions[idx] = distNorm * 10 - 5;     // x: -5 to 5
      positions[idx + 1] = (finalElev - minElev) / elevRange * 2; // y: 0 to 2
      positions[idx + 2] = zNorm * 3;          // z: -3 to 3

      elevations.push(finalElev);

      const color = elevationColor(finalElev);
      colors[idx] = color.r;
      colors[idx + 1] = color.g;
      colors[idx + 2] = color.b;
    }
  }

  // Generate triangle indices
  const indexCount = (GRID_X - 1) * (GRID_Z - 1) * 6;
  const indices = new Uint32Array(indexCount);
  let ii = 0;
  for (let ix = 0; ix < GRID_X - 1; ix++) {
    for (let iz = 0; iz < GRID_Z - 1; iz++) {
      const a = ix * GRID_Z + iz;
      const b = a + GRID_Z;
      const c = a + 1;
      const d = b + 1;
      indices[ii++] = a; indices[ii++] = b; indices[ii++] = c;
      indices[ii++] = c; indices[ii++] = b; indices[ii++] = d;
    }
  }

  // Generate edge geometry for wireframe (LineSegments)
  const edgeSet = new Set<string>();
  const edgeList: [number, number][] = [];

  const addEdge = (a: number, b: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edgeList.push([a, b]);
    }
  };

  for (let i = 0; i < indexCount; i += 3) {
    addEdge(indices[i], indices[i + 1]);
    addEdge(indices[i + 1], indices[i + 2]);
    addEdge(indices[i + 2], indices[i]);
  }

  const edgePositions = new Float32Array(edgeList.length * 6);
  const edgeColors = new Float32Array(edgeList.length * 6);

  for (let i = 0; i < edgeList.length; i++) {
    const [a, b] = edgeList[i];
    const ai = a * 3;
    const bi = b * 3;
    const oi = i * 6;
    edgePositions[oi] = positions[ai]; edgePositions[oi + 1] = positions[ai + 1]; edgePositions[oi + 2] = positions[ai + 2];
    edgePositions[oi + 3] = positions[bi]; edgePositions[oi + 4] = positions[bi + 1]; edgePositions[oi + 5] = positions[bi + 2];
    edgeColors[oi] = colors[ai]; edgeColors[oi + 1] = colors[ai + 1]; edgeColors[oi + 2] = colors[ai + 2];
    edgeColors[oi + 3] = colors[bi]; edgeColors[oi + 4] = colors[bi + 1]; edgeColors[oi + 5] = colors[bi + 2];
  }

  // Trail points (center of the ridge at each grid X step)
  const centerZ = Math.floor(GRID_Z / 2);
  const trailPoints: THREE.Vector3[] = [];
  for (let ix = 0; ix < GRID_X; ix++) {
    const idx = (ix * GRID_Z + centerZ) * 3;
    trailPoints.push(new THREE.Vector3(positions[idx], positions[idx + 1] + 0.02, positions[idx + 2]));
  }

  // Waypoint positions on the surface
  const waypointPositions: THREE.Vector3[] = waypoints.map((wp) => {
    const xNorm = wp.distanceFromStart / maxDist;
    const ix = Math.round(xNorm * (GRID_X - 1));
    const idx = (ix * GRID_Z + centerZ) * 3;
    return new THREE.Vector3(positions[idx], positions[idx + 1] + 0.05, positions[idx + 2]);
  });

  return { positions, colors, indices, edgePositions, edgeColors, trailPoints, waypointPositions };
}
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/map/terrainMesh.ts
git commit -m "feat: add terrain mesh generator for 3D map

Cubic spline elevation interpolation, terrain-type ridge profiles,
mulberry32-based value noise, per-vertex elevation coloring,
edge geometry for wireframe LineSegments rendering."
```

---

## Task 6: TacticalMap3D Component

**Files:**
- Create: `src/components/map/TacticalMap3D.tsx`
- Rename: `src/components/map/TacticalMap.tsx` → `src/components/map/TacticalMapLegacy.tsx`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

- [ ] **Step 1: Rename current SVG map to legacy**

```bash
git mv src/components/map/TacticalMap.tsx src/components/map/TacticalMapLegacy.tsx
```

Then update the export name inside the file — change `export function TacticalMap()` to `export function TacticalMapLegacy()`.

- [ ] **Step 2: Create `src/components/map/TacticalMap3D.tsx`**

```tsx
/**
 * TacticalMap3D — Three.js WebGL terrain map with CRT wireframe aesthetic.
 * Replaces the SVG isometric map. Falls back to TacticalMapLegacy on WebGL failure.
 */

import { useRef, useMemo, useState, useEffect, Component } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import { generateTerrainMesh } from "./terrainMesh.ts";
import { TacticalMapLegacy } from "./TacticalMapLegacy.tsx";

// Compute terrain mesh once at module load (WAYPOINTS is static)
const MESH_DATA = generateTerrainMesh(WAYPOINTS);

// ── Error boundary for WebGL fallback ──────────

interface ErrorBoundaryState { hasError: boolean }

class WebGLErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ── Terrain wireframe mesh ─────────────────────

function TerrainWireframe() {
  const meshData = MESH_DATA;
  const lineRef = useRef<THREE.LineSegments>(null);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const isLost = useGameStore((s) => s.player.isLost);
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const prevIndexRef = useRef(0);
  const revealProgressRef = useRef(1); // 0→1 fade for reveal

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(meshData.edgePositions.slice(), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(meshData.edgeColors.slice(), 3));
    return geo;
  }, [meshData]);

  // Terrain reveal: fade in new section when waypoint changes
  useFrame((_, delta) => {
    if (currentIndex !== prevIndexRef.current) {
      prevIndexRef.current = currentIndex;
      revealProgressRef.current = 0;
    }
    if (revealProgressRef.current < 1) {
      revealProgressRef.current = Math.min(1, revealProgressRef.current + delta * 1.5);
    }

    // Lost state: tint wireframe red in local area
    if (isLost && lineRef.current) {
      const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
      const baseColors = meshData.edgeColors;
      const arr = colors.array as Float32Array;
      const flickerR = 0.8 + Math.random() * 0.2;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i] = baseColors[i] * (1 - 0.5) + flickerR * 0.5;
        arr[i + 1] = baseColors[i + 1] * 0.3;
        arr[i + 2] = baseColors[i + 2] * 0.3;
      }
      colors.needsUpdate = true;
    }
  });

  // Dim wireframe at night
  const opacity = timeOfDay === "night" ? 0.6 : timeOfDay === "dusk" ? 0.8 : 1.0;

  return (
    <lineSegments ref={lineRef} geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={opacity * revealProgressRef.current} />
    </lineSegments>
  );
}

// ── Grid floor ─────────────────────────────────

function GridFloor() {
  return (
    <gridHelper args={[10, 40, "#112211", "#0a150a"]} position={[0, 0, 0]} />
  );
}

// ── Trail line ─────────────────────────────────

function TrailLine() {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);

  const traversedPoints = useMemo(() => {
    const maxDist = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
    const endDist = WAYPOINTS[Math.min(currentIndex, WAYPOINTS.length - 1)].distanceFromStart;
    const endNorm = endDist / maxDist;
    const endIdx = Math.round(endNorm * (meshData.trailPoints.length - 1));
    return meshData.trailPoints.slice(0, endIdx + 1);
  }, [currentIndex, meshData]);

  const futurePoints = useMemo(() => {
    const maxDist = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
    const startDist = WAYPOINTS[Math.min(currentIndex, WAYPOINTS.length - 1)].distanceFromStart;
    const startNorm = startDist / maxDist;
    const startIdx = Math.round(startNorm * (meshData.trailPoints.length - 1));
    return meshData.trailPoints.slice(startIdx);
  }, [currentIndex, meshData]);

  const traversedGeo = useMemo(() => {
    if (traversedPoints.length < 2) return null;
    const pts = new Float32Array(traversedPoints.length * 3);
    traversedPoints.forEach((p, i) => { pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return geo;
  }, [traversedPoints]);

  const futureGeo = useMemo(() => {
    if (futurePoints.length < 2) return null;
    const pts = new Float32Array(futurePoints.length * 3);
    futurePoints.forEach((p, i) => { pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pts, 3));
    return geo;
  }, [futurePoints]);

  const traversedLine = useMemo(() => {
    if (!traversedGeo) return null;
    const mat = new THREE.LineBasicMaterial({ color: "#00ff41", transparent: true, opacity: 0.9 });
    return new THREE.Line(traversedGeo, mat);
  }, [traversedGeo]);

  const futureLine = useMemo(() => {
    if (!futureGeo) return null;
    futureGeo.computeBoundingSphere();
    const line = new THREE.Line(futureGeo, new THREE.LineDashedMaterial({
      color: "#335533", dashSize: 0.1, gapSize: 0.05, transparent: true, opacity: 0.4,
    }));
    line.computeLineDistances(); // Required for dashed material
    return line;
  }, [futureGeo]);

  return (
    <>
      {traversedLine && <primitive object={traversedLine} />}
      {futureLine && <primitive object={futureLine} />}
    </>
  );
}

// ── Waypoint markers ───────────────────────────

function WaypointMarkers() {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);

  return (
    <>
      {meshData.waypointPositions.map((pos, i) => {
        let color = "#335533"; // future
        if (i < currentIndex) color = "#00ff41"; // visited
        if (i === currentIndex) color = "#ffb000"; // current
        const scale = i === currentIndex ? 0.12 : 0.08;
        return (
          <mesh key={i} position={pos} scale={[scale, scale * 1.5, scale]}>
            <octahedronGeometry args={[1, 0]} />
            <meshBasicMaterial color={color} transparent opacity={i === currentIndex ? 1 : 0.7} />
          </mesh>
        );
      })}
    </>
  );
}

// ── Hiker marker ───────────────────────────────

function HikerMarker() {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const markerRef = useRef<THREE.Group>(null);

  const pos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];

  useFrame(({ clock }) => {
    if (markerRef.current) {
      markerRef.current.position.y = pos.y + 0.15 + Math.sin(clock.elapsedTime * 2) * 0.02;
    }
  });

  return (
    <group ref={markerRef} position={[pos.x, pos.y + 0.15, pos.z]}>
      {/* Glowing point */}
      <mesh>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshBasicMaterial color="#00ff41" />
      </mesh>
      {/* Scan beam */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
        <meshBasicMaterial color="#00ff41" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ── Camera controller ──────────────────────────

function CameraController() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const isLost = useGameStore((s) => s.player.isLost);
  const meshData = MESH_DATA;
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3(0, 1, 0));
  const orbitAngleRef = useRef(0);

  useEffect(() => {
    const pos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];
    targetRef.current.set(pos.x, pos.y + 0.5, pos.z);
  }, [currentIndex, meshData]);

  useFrame((_, delta) => {
    const target = targetRef.current;

    // Auto-orbit: ~0.5 deg/s
    orbitAngleRef.current += delta * 0.5 * (Math.PI / 180);
    const orbitRadius = 3.3;
    const orbitX = Math.sin(orbitAngleRef.current) * orbitRadius;
    const orbitZ = Math.cos(orbitAngleRef.current) * orbitRadius;

    const camPos = new THREE.Vector3(target.x + orbitX, target.y + 2, target.z + orbitZ);

    // Lost state: camera shake
    if (isLost) {
      camPos.x += (Math.random() - 0.5) * 0.05;
      camPos.y += (Math.random() - 0.5) * 0.03;
    }

    camera.position.lerp(camPos, 0.03);
    camera.lookAt(target);
  });

  return null;
}

// ── Fog controller ─────────────────────────────

function FogController() {
  const weather = useGameStore((s) => s.weather.current);
  const { scene } = useThree();

  useEffect(() => {
    if (weather === "fog") {
      scene.fog = new THREE.Fog("#0a0a0a", 3, 6);
    } else if (weather === "blizzard") {
      scene.fog = new THREE.Fog("#1a1a1a", 4, 8);
    } else {
      scene.fog = null;
    }
  }, [weather, scene]);

  return null;
}

// ── Zoom controls ──────────────────────────────

function ZoomControls({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  return (
    <div className="tactical-map__zoom-controls">
      <button onClick={() => setZoom(Math.max(1, zoom - 1))}>-</button>
      <span>{zoom}x</span>
      <button onClick={() => setZoom(Math.min(3, zoom + 1))}>+</button>
    </div>
  );
}

// ── Main component ─────────────────────────────

export function TacticalMap3D() {
  const [zoom, setZoom] = useState(1);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) setZoom((z) => Math.min(3, z + 1));
    else setZoom((z) => Math.max(1, z - 1));
  };

  return (
    <div className="tactical-map" onWheel={handleWheel}>
      <ZoomControls zoom={zoom} setZoom={setZoom} />
      <WebGLErrorBoundary fallback={<TacticalMapLegacy />}>
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 45 + (zoom - 1) * -10, near: 0.1, far: 50, position: [2, 3, 4] }}
          frameloop="always"
        >
          <CameraController />
          <FogController />
          <GridFloor />
          <TerrainWireframe />
          <TrailLine />
          <WaypointMarkers />
          <HikerMarker />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 3: Update `src/App.css` — remove perspective transform from `.tactical-map`**

Remove `.tactical-map__perspective` and `.tactical-map__svg` CSS rules (lines 435-446). Keep `.tactical-map` container, `.tactical-map__zoom-controls`, and zoom button styles.

- [ ] **Step 4: Update `src/App.tsx` — swap map import**

Change import from:
```typescript
import { TacticalMap } from "./components/map/TacticalMap.tsx";
```
to:
```typescript
import { TacticalMap3D } from "./components/map/TacticalMap3D.tsx";
```

Change usage from `<TacticalMap />` to `<TacticalMap3D />` (line 105).

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 6: Visual test**

Open browser. Start game. Confirm:
- 3D wireframe terrain renders inside the map panel
- Wireframe colors shift green → amber → red by altitude
- Trail line shows traversed (bright) and future (dim dashed)
- Waypoint octahedra visible at correct positions
- Hiker marker bobs at current position
- Camera slowly orbits (~0.5 deg/s auto-orbit)
- Camera smoothly follows player as they advance
- Zoom +/- buttons work (3 discrete steps)
- Fog effect activates during fog/blizzard weather
- Lost state: camera shakes, wireframe tints red
- New terrain section fades in when arriving at a waypoint
- Skybox and TerrainAtmosphere visible through transparent canvas background
- If WebGL fails, SVG legacy map renders instead

- [ ] **Step 7: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx src/components/map/TacticalMapLegacy.tsx src/App.tsx src/App.css
git commit -m "feat: 3D TacticalMap with CRT wireframe terrain

Three.js heightmap with per-vertex elevation colors, trail line,
waypoint octahedra, hiker scan beam, camera tracking, fog effects.
WebGL error boundary falls back to SVG legacy map.
Replaces SVG isometric map in the center panel."
```

---

## Task 7: Final Integration Verification

- [ ] **Step 1: Full type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 2: Build check**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Full playthrough test**

Open browser. Play a full game (or use auto-play). Verify:
- Title screen: night sky gradient behind boot sequence
- Game start: sky matches dawn, terrain shows stream_valley haze
- Advancing: terrain atmosphere crossfades between waypoints
- Day/night: sky gradients transition smoothly, stars twinkle at night
- Weather: sky shifts toward gray in cloudy/fog, 3D map fog activates
- 3D map: wireframe renders correctly, camera tracks, zoom works
- Defeat/victory: GameOverlay covers everything, atmosphere layers invisible underneath
- No visual flickering, z-index fights, or readability issues

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: integration adjustments from full playthrough test"
```

---

## Summary

| Task | Description | Est. Complexity |
|------|-------------|----------------|
| 1 | Panel transparency + ParticleCanvas night removal | Easy |
| 2 | Skybox component | Easy-Medium |
| 3 | TerrainAtmosphere component | Easy-Medium |
| 4 | Install Three.js deps | Trivial |
| 5 | Terrain mesh generator | Medium |
| 6 | TacticalMap3D component | Hard |
| 7 | Final integration verification | Easy |
