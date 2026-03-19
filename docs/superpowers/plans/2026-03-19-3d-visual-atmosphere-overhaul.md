# 3D Visual & Atmosphere Overhaul Implementation Plan

> **For agentic workers:** This plan is executed via **ralph-loop** with 30+ iterations and triple review (Claude + Codex + Gemini) at each checkpoint. Each phase ends with a `CHECKPOINT` marker — at that point, stop, commit, run `npx tsc --noEmit`, verify visually, and dispatch reviews before proceeding.

**Goal:** Transform the 3D tactical map from a panel-contained wireframe viewer into a full-viewport immersive scene with atmosphere, weather-as-environment, terrain identity, and danger-as-sensory-distortion.

**Architecture:** Full-bleed R3F Canvas owns the viewport. CSS effects (Skybox, ParticleCanvas, TerrainAtmosphere, Vignette) are retired and replaced by in-scene equivalents. DOM panels float over the 3D scene. Postprocessing handles danger/perception effects. A single VisualStateBridge component distributes derived visual state to all scene children via context + refs.

**Tech Stack:** React 19, Three.js r183, React Three Fiber 9, @react-three/drei 10, @react-three/postprocessing (new), Zustand 5, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-19-3d-visual-atmosphere-overhaul-design.md`

**Validation:** `npx tsc --noEmit` (zero errors policy) + visual verification at each checkpoint

---

## File Map

### New Files

| File | Purpose |
|------|---------|
| `src/store/visualState.ts` | VisualState interface, derived selector, band mapping |
| `src/components/map/VisualStateBridge.tsx` | Sole store subscriber, writes to shared ref via React context |
| `src/components/map/atmosphere/Skydome3D.tsx` | Gradient sky sphere + stars Points |
| `src/components/map/atmosphere/SceneLighting.tsx` | Ambient + directional lights, time/weather driven |
| `src/components/map/atmosphere/SceneFog.tsx` | FogExp2 continuous control |
| `src/components/map/atmosphere/WeatherParticles3D.tsx` | 3D weather: Points (snow/blizzard) + LineSegments (rain/wind) |
| `src/components/map/atmosphere/FogPlanes.tsx` | Rolling fog bank noise planes |
| `src/components/map/atmosphere/LightningController.tsx` | Event-driven lightning flashes |
| `src/components/map/CameraDirector.tsx` | Action/state-aware camera (replaces CameraController) |
| `src/components/map/PostFXController.tsx` | EffectComposer + event-triggered effects |
| `src/components/effects/DangerOverlay.tsx` | CSS frost edges + panel border escalation |

### Modified Files

| File | Changes |
|------|---------|
| `src/App.tsx` | Full-bleed Canvas, retire CSS effects, floating panels |
| `src/App.css` | Panel positioning → fixed overlays, remove panel-center map styles |
| `src/store/gameStore.ts` | Add `lastVisualEvent` to store state + dispatch in `performAction` |
| `src/engine/types.ts` | Add `VisualEvent` type |
| `src/components/map/TacticalMap3D.tsx` | Extract to scene-only children (remove Canvas wrapper, CameraController, FogController) |
| `src/components/map/terrain/TerrainRocks.tsx` | `MeshBasicMaterial` → `MeshLambertMaterial` |
| `src/components/map/terrain/TerrainVegetation.tsx` | `MeshBasicMaterial` → `MeshLambertMaterial` for trees |
| `src/components/map/terrain/TerrainLandmarks.tsx` | `MeshBasicMaterial` → `MeshLambertMaterial` |

### Retired Files (imports removed, files kept for fallback)

| File | Replaced By |
|------|-------------|
| `src/components/effects/Skybox.tsx` | `Skydome3D` |
| `src/components/effects/ParticleCanvas.tsx` | `WeatherParticles3D` |
| `src/components/effects/TerrainAtmosphere.tsx` | SceneFog + terrain tinting |
| `src/components/effects/Vignette.tsx` | PostFX Vignette |

---

## Phase 1: Foundation — Store, Types, Layout (Iterations 1–6)

### Task 1: Install postprocessing dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install @react-three/postprocessing**

```bash
npm install @react-three/postprocessing
```

- [ ] **Step 2: Verify install**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add @react-three/postprocessing dependency"
```

---

### Task 2: Add VisualEvent type and VisualState interface

**Files:**
- Modify: `src/engine/types.ts`
- Create: `src/store/visualState.ts`

- [ ] **Step 1: Add VisualEvent type to engine types**

Add to `src/engine/types.ts`:

```typescript
export interface VisualEvent {
  type: 'fall' | 'lost_start' | 'lost_resolve' | 'injury' | 'weather_change';
  timestamp: number;
}
```

- [ ] **Step 2: Create visualState.ts with interface, band mapping, and derived selector**

Create `src/store/visualState.ts`:

```typescript
import type { TimeOfDay, WeatherCondition } from '../engine/types.ts';

export type BandId = 'forest' | 'rocky' | 'plateau' | 'storm' | 'summit';

export interface VisualState {
  bandId: BandId;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
  weatherIntensity: number;
  fogDensity: number;
  fogColor: string;
  skyTop: string;
  skyBottom: string;
  ambientIntensity: number;
  ambientColor: string;
  sunColor: string;
  sunDirection: [number, number, number];
}

export function waypointToBand(index: number): BandId {
  if (index <= 2) return 'forest';
  if (index <= 5) return 'rocky';
  if (index <= 8) return 'plateau';
  if (index <= 11) return 'storm';
  return 'summit';
}

// Fog density per weather
const FOG_DENSITY = {
  clear: 0.02, cloudy: 0.04, fog: 0.12,
  rain: 0.06, snow: 0.08, wind: 0.03, blizzard: 0.18,
} satisfies Record<WeatherCondition, number>;

// Fog base color per weather
const FOG_COLOR = {
  clear: '#0a0a0a', cloudy: '#151515', fog: '#1a1a1a',
  rain: '#0a0a0a', snow: '#1a1a2a', wind: '#0a0a0a', blizzard: '#2a2a2a',
} satisfies Record<WeatherCondition, string>;

// Sky gradients per time of day
const SKY_GRADIENTS: Record<TimeOfDay, { top: string; bottom: string }> = {
  dawn:      { top: '#1a0a2e', bottom: '#4a2040' },
  morning:   { top: '#0d1a2d', bottom: '#1a3a4a' },
  midday:    { top: '#0a1520', bottom: '#152530' },
  afternoon: { top: '#0d1520', bottom: '#2a2a1a' },
  dusk:      { top: '#2a1525', bottom: '#1a0a0a' },
  night:     { top: '#050510', bottom: '#0a0a0a' },
};

// Ambient light per time of day
const AMBIENT: Record<TimeOfDay, { intensity: number; color: string }> = {
  dawn:      { intensity: 0.5, color: '#e8dcc0' },
  morning:   { intensity: 0.7, color: '#d0d8e0' },
  midday:    { intensity: 0.8, color: '#c0c8d0' },
  afternoon: { intensity: 0.7, color: '#d0c8b0' },
  dusk:      { intensity: 0.4, color: '#8a6a5a' },
  night:     { intensity: 0.3, color: '#4a5a6a' },
};

// Sun direction per time of day (x, y, z)
const SUN_DIR: Record<TimeOfDay, [number, number, number]> = {
  dawn:      [-1, 0.3, 0.5],
  morning:   [-0.5, 0.7, 0.5],
  midday:    [0, 1, 0.3],
  afternoon: [0.5, 0.7, 0.5],
  dusk:      [1, 0.3, 0.5],
  night:     [0, 0.5, -1],
};

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
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function deriveVisualState(
  waypointIndex: number,
  timeOfDay: TimeOfDay,
  weather: WeatherCondition,
  weatherIntensity: number,
): VisualState {
  const bandId = waypointToBand(waypointIndex);
  const sky = SKY_GRADIENTS[timeOfDay];
  const amb = AMBIENT[timeOfDay];

  // Weather modifier on sky
  let skyTop = sky.top;
  let skyBottom = sky.bottom;
  if (weather === 'cloudy' || weather === 'fog') {
    skyTop = blendHex(sky.top, '#151515', weatherIntensity * 0.3);
    skyBottom = blendHex(sky.bottom, '#151515', weatherIntensity * 0.2);
  } else if (weather === 'blizzard') {
    skyTop = blendHex(sky.top, '#303030', weatherIntensity * 0.4);
    skyBottom = blendHex(sky.bottom, '#202020', weatherIntensity * 0.3);
  }

  return {
    bandId,
    timeOfDay,
    weather,
    weatherIntensity,
    fogDensity: FOG_DENSITY[weather],
    fogColor: FOG_COLOR[weather],
    skyTop,
    skyBottom,
    ambientIntensity: amb.intensity,
    ambientColor: amb.color,
    sunColor: amb.color,
    sunDirection: SUN_DIR[timeOfDay],
  };
}
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/engine/types.ts src/store/visualState.ts
git commit -m "feat: add VisualState selector and VisualEvent type"
```

---

### Task 3: Add lastVisualEvent to game store

**Files:**
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Add lastVisualEvent to store state interface and initial state**

Add `lastVisualEvent: VisualEvent | null` to the store state, initialized as `null`. Import `VisualEvent` from `../engine/types.ts`.

- [ ] **Step 2: Dispatch visual events in performAction**

In the `performAction` method, after existing sound trigger logic, add:

```typescript
// Visual event dispatch
const prevLost = currentState.player.isLost;
const nowLost = result.newState.player.isLost;
if (!prevLost && nowLost) {
  set({ lastVisualEvent: { type: 'lost_start', timestamp: Date.now() } });
} else if (prevLost && !nowLost) {
  set({ lastVisualEvent: { type: 'lost_resolve', timestamp: Date.now() } });
}

const hadFall = currentState.player.statusEffects.some(e => e.id === 'fall_injury');
const hasFall = result.newState.player.statusEffects.some(e => e.id === 'fall_injury');
if (!hadFall && hasFall) {
  set({ lastVisualEvent: { type: 'fall', timestamp: Date.now() } });
}

if (currentState.weather.current !== result.newState.weather.current) {
  set({ lastVisualEvent: { type: 'weather_change', timestamp: Date.now() } });
}
```

- [ ] **Step 3: Reset in startGame**

Set `lastVisualEvent: null` in the `startGame` action.

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/store/gameStore.ts
git commit -m "feat: add lastVisualEvent dispatch to game store"
```

---

### Task 4: Create VisualStateBridge component

**Files:**
- Create: `src/components/map/VisualStateBridge.tsx`

- [ ] **Step 1: Create VisualStateBridge with context + ref pattern**

```typescript
import { createContext, useContext, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/gameStore.ts';
import { deriveVisualState } from '../../store/visualState.ts';
import type { VisualState } from '../../store/visualState.ts';

const defaultState: VisualState = deriveVisualState(0, 'night', 'clear', 0.5);

const VisualStateContext = createContext<React.MutableRefObject<VisualState>>(
  { current: defaultState } as React.MutableRefObject<VisualState>
);

export function useVisualState(): React.MutableRefObject<VisualState> {
  return useContext(VisualStateContext);
}

function VisualStateUpdater({ stateRef }: { stateRef: React.MutableRefObject<VisualState> }) {
  const waypointIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const weather = useGameStore((s) => s.weather.current);
  const intensity = useGameStore((s) => s.weather.intensity);

  useFrame(() => {
    stateRef.current = deriveVisualState(waypointIndex, timeOfDay, weather, intensity);
  });

  return null;
}

export function VisualStateBridge({ children }: { children: ReactNode }) {
  const stateRef = useRef<VisualState>(defaultState);

  return (
    <VisualStateContext.Provider value={stateRef}>
      <VisualStateUpdater stateRef={stateRef} />
      {children}
    </VisualStateContext.Provider>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/map/VisualStateBridge.tsx
git commit -m "feat: add VisualStateBridge with context + ref pattern"
```

---

### Task 5: Restructure layout — full-bleed Canvas + floating panels

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/components/map/TacticalMap3D.tsx`

This is the biggest migration task. The Canvas moves out of TacticalMap3D into App as a full-viewport element. TacticalMap3D becomes a "scene children" component without its own Canvas wrapper.

- [ ] **Step 1: Extract TacticalMap3D scene content into a SceneContent component**

In `TacticalMap3D.tsx`, extract everything inside `<Canvas>` into a new `SceneContent` component that can be used as a child of an external Canvas. Keep `WebGLErrorBoundary` and the zoom controls. Export both `SceneContent` (for the full-bleed canvas) and `TacticalMap3D` (for fallback).

- [ ] **Step 2: Modify App.tsx — full-bleed Canvas with floating panels**

Replace the current layout:
- Remove imports: `Skybox`, `ParticleCanvas`, `TerrainAtmosphere`, `Vignette`
- Add full-viewport `<Canvas>` as first child with config: `gl={{ alpha: false, antialias: false }}`, `dpr={Math.min(window.devicePixelRatio, 1.5)}`, `camera={{ fov: 45, near: 0.1, far: 50, position: [2, 3, 4] }}`, `frameloop="always"`, `onCreated={({ gl }) => gl.setClearColor('#050510')}`
- Inside Canvas: `<VisualStateBridge>` wrapping `<SceneContent />`
- Panels become `position: fixed` overlays
- Keep Scanlines as CSS overlay

- [ ] **Step 3: Update App.css for floating panels**

Change `.game-shell` from CSS Grid to `position: fixed; inset: 0; pointer-events: none; z-index: 1;`. Individual panels get `pointer-events: auto; background: rgba(13,17,23,0.85); backdrop-filter: blur(8px); border: 1px solid rgba(61,139,55,0.15);`. Position panels with absolute positioning within the fixed container.

- [ ] **Step 4: Handle WebGL fallback at app level**

Wrap the Canvas in a `WebGLErrorBoundary` that falls back to: retired CSS effects (Skybox + ParticleCanvas) + TacticalMapLegacy centered + same floating panels.

- [ ] **Step 5: Type check and verify dev server renders**

```bash
npx tsc --noEmit
npm run dev
```

Verify: Canvas fills viewport, panels float over it, existing terrain/hiker/trail visible.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/App.css src/components/map/TacticalMap3D.tsx
git commit -m "feat: full-bleed Canvas layout with floating panels"
```

---

### Task 6: Remove old CameraController and FogController from TacticalMap3D

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx`

- [ ] **Step 1: Remove CameraController and FogController components**

Delete the `CameraController` and `FogController` function components from TacticalMap3D.tsx. Remove their usage from SceneContent. The camera and fog will be handled by new dedicated components in later tasks.

For now, add a temporary static camera position so the scene is still viewable:

```typescript
// Temporary — will be replaced by CameraDirector
function TempCamera() {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(2, 3, 4);
    camera.lookAt(0, 0.5, 0);
  }, [camera]);
  return null;
}
```

- [ ] **Step 2: Type check and verify**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx
git commit -m "refactor: remove CameraController and FogController from TacticalMap3D"
```

---

### 🔴 CHECKPOINT 1 — Foundation Complete

**Verify:**
- `npx tsc --noEmit` — zero errors
- Dev server shows full-bleed canvas with floating panels
- Terrain, hiker, trail visible (no camera animation yet, no fog)
- No CSS sky/particle/vignette layers rendering

**Triple review:** Dispatch Codex (technical) + Gemini (visual) + self-review before proceeding.

---

## Phase 2: Atmosphere — Sky, Light, Fog (Iterations 7–12)

### Task 7: Create Skydome3D

**Files:**
- Create: `src/components/map/atmosphere/Skydome3D.tsx`

- [ ] **Step 1: Create Skydome3D with ShaderMaterial gradient sphere**

Large inverted sphere (radius 20) with custom vertex/fragment shader. Uniforms: `uTopColor`, `uBottomColor`. Fragment shader interpolates by normalized Y. Stars as separate `THREE.Points` child with ~40 points in upper hemisphere. Transitions via uniform lerp in `useFrame`. Read visual state from `useVisualState()` ref.

- [ ] **Step 2: Add to SceneContent**

Import and add `<Skydome3D />` as first child in SceneContent.

- [ ] **Step 3: Type check + visual verify**

```bash
npx tsc --noEmit
```

Verify: Sky gradient visible behind terrain. Changes with time-of-day. Stars visible at night.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/atmosphere/Skydome3D.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: add Skydome3D with gradient shader + stars"
```

---

### Task 8: Create SceneLighting

**Files:**
- Create: `src/components/map/atmosphere/SceneLighting.tsx`

- [ ] **Step 1: Create SceneLighting with ambient + directional**

Read visual state from context ref. Set ambient light intensity/color and directional light color/direction per frame via refs. No shadow maps.

- [ ] **Step 2: Migrate terrain detail materials to MeshLambertMaterial**

In `TerrainRocks.tsx`, `TerrainVegetation.tsx`, `TerrainLandmarks.tsx`: change `new THREE.MeshBasicMaterial` to `new THREE.MeshLambertMaterial` (same props, just different class). Keep hiker rig as `MeshBasicMaterial`.

- [ ] **Step 3: Add SceneLighting to SceneContent**

- [ ] **Step 4: Type check + visual verify**

```bash
npx tsc --noEmit
```

Verify: Terrain details respond to light direction. Dawn = warm, night = dim blue. Hiker hologram unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/atmosphere/SceneLighting.tsx src/components/map/terrain/TerrainRocks.tsx src/components/map/terrain/TerrainVegetation.tsx src/components/map/terrain/TerrainLandmarks.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: add SceneLighting + migrate terrain details to MeshLambertMaterial"
```

---

### Task 9: Create SceneFog

**Files:**
- Create: `src/components/map/atmosphere/SceneFog.tsx`

- [ ] **Step 1: Create SceneFog with continuous FogExp2**

Read visual state from context ref. In `useFrame`, lerp `scene.fog` density and color toward target values. Use `THREE.FogExp2`. Initialize fog on mount.

- [ ] **Step 2: Add to SceneContent**

- [ ] **Step 3: Type check + visual verify**

```bash
npx tsc --noEmit
```

Verify: Fog visible, density changes with weather state. Blizzard = near-whiteout. Clear = subtle depth fade.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/atmosphere/SceneFog.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: add SceneFog with continuous FogExp2"
```

---

### 🔴 CHECKPOINT 2 — Atmosphere Complete

**Verify:**
- `npx tsc --noEmit` — zero errors
- Sky gradient renders behind terrain, transitions with time-of-day
- Stars visible at night/dusk only
- Lighting responds to time: warm dawn, cool midday, dim night
- Terrain details (rocks/trees/landmarks) respond to directional light
- Fog density varies by weather, smooth transitions
- Hiker hologram stays unlit green

**Triple review:** Dispatch Codex + Gemini + self-review.

---

## Phase 3: Terrain Band Identity (Iterations 13–17)

### Task 10: Terrain color compositor

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx` (TerrainWireframe component)

- [ ] **Step 1: Implement terrain color compositor pipeline**

In `TerrainWireframe`, replace the current per-frame color logic with a single compositor:
1. Start from immutable `meshData.edgeColors` (base elevation)
2. Apply band tinting (lerp toward band palette)
3. Apply weather tinting (snow → white, rain → darken 20%)
4. Apply lost-state red flicker (existing logic, applied last)
5. Write to GPU buffer once

Track band transition progress via a ref that lerps 0→1 over 1.5s when band changes.

- [ ] **Step 2: Type check + visual verify**

Verify: Wireframe colors shift when crossing terrain band boundaries. Forest = green-tinted. Storm = dark blue-gray with red edges.

- [ ] **Step 3: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx
git commit -m "feat: terrain color compositor with band/weather/lost layering"
```

---

### Task 11: Band-aware detail density

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx` (TerrainDetailLayer)
- Modify: `src/components/map/terrain/TerrainVegetation.tsx`
- Modify: `src/components/map/terrain/TerrainRocks.tsx`

- [ ] **Step 1: Pass bandId to TerrainDetailLayer**

Read `bandId` from visual state context. Pass as prop to detail components.

- [ ] **Step 2: Add bandVisibility multiplier to vegetation and rocks**

In `TerrainVegetation`: multiply tree instance count by band density (1.0 forest → 0 plateau+). Same for grass.
In `TerrainRocks`: multiply by rock density (0.3 forest → 1.0 rocky → 0.3 summit).

Implementation: adjust `instancedMesh.count` based on `Math.floor(totalInstances * bandMultiplier)`.

- [ ] **Step 3: Type check + visual verify**

Verify: Forest has full trees. Rocky has rocks but few trees. Plateau/Storm have minimal detail. Summit is nearly bare.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx src/components/map/terrain/TerrainVegetation.tsx src/components/map/terrain/TerrainRocks.tsx
git commit -m "feat: band-aware terrain detail density multipliers"
```

---

### Task 12: Band-specific ambient effects

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx` (add BandAmbientEffects component)

- [ ] **Step 1: Create BandAmbientEffects component**

A lightweight component inside SceneContent that renders:
- **Forest**: 8-12 slow dust motes (Points near camera)
- **Rocky/Plateau**: 20-40 wind streak LineSegments moving horizontally
- **Storm Ridge**: Permanent wind streaks + terrain vertex flicker
- **Summit (clear)**: 2-3 additive billboard quads for golden light rays
- **Summit (storm)**: Distorted red strobe beacon (8Hz flicker, position jitter)

All use pre-allocated geometries, switching visibility by band.

- [ ] **Step 2: Type check + visual verify**

Verify: Each band has distinct ambient character. Storm Ridge feels windy. Summit clear has light rays.

- [ ] **Step 3: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx
git commit -m "feat: band-specific ambient effects (dust, wind, rays, beacon)"
```

---

### 🔴 CHECKPOINT 3 — Terrain Bands Complete

**Verify:**
- `npx tsc --noEmit` — zero errors
- Wireframe colors shift per band (green → amber → gray → dark → stark)
- Tree/rock density varies by band
- Forest has dust motes, Storm Ridge has wind streaks
- Summit shows golden rays (clear) or red strobe (storm)
- Band transitions are smooth (1.5s lerp), not hard cuts

**Triple review:** Dispatch Codex + Gemini + self-review.

---

## Phase 4: Weather as 3D Environment (Iterations 18–23)

### Task 13: WeatherParticles3D — Snow and Blizzard (Points)

**Files:**
- Create: `src/components/map/atmosphere/WeatherParticles3D.tsx`

- [ ] **Step 1: Create WeatherParticles3D with Points for snow/blizzard**

Pre-allocate `BufferGeometry` with max 1200 positions. In `useFrame`, update position buffer based on weather type. Snow: slow drift + sine wobble. Blizzard: high-speed + turbulence. Spawn in camera-relative box, wrap on exit. `depthWrite: false`, `AdditiveBlending`.

- [ ] **Step 2: Add to SceneContent, verify snow renders during snow weather**

- [ ] **Step 3: Type check + visual verify**

- [ ] **Step 4: Commit**

```bash
git add src/components/map/atmosphere/WeatherParticles3D.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: WeatherParticles3D — snow and blizzard via Points"
```

---

### Task 14: WeatherParticles3D — Rain and Wind (LineSegments)

**Files:**
- Modify: `src/components/map/atmosphere/WeatherParticles3D.tsx`

- [ ] **Step 1: Add LineSegments for rain and wind streaks**

Pre-allocate `BufferGeometry` with max 600 segment pairs (1200 vertices). Rain: fast downward + wind angle, segment length ~0.15. Wind: fast horizontal, segment length ~0.3. Same camera-relative spawn box. `NormalBlending` for rain, `AdditiveBlending` for wind.

- [ ] **Step 2: Weather transitions — count lerping**

When weather changes, lerp active particle/segment count over 1s. Unused entries set to zero-length.

- [ ] **Step 3: Type check + visual verify**

Verify: Rain = directional streaks. Wind = horizontal streaks. Snow = floating dots. Blizzard = chaotic dense dots. Transitions smooth.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/atmosphere/WeatherParticles3D.tsx
git commit -m "feat: WeatherParticles3D — rain/wind via LineSegments + transitions"
```

---

### Task 15: FogPlanes

**Files:**
- Create: `src/components/map/atmosphere/FogPlanes.tsx`

- [ ] **Step 1: Create FogPlanes with noise shader quads**

2-4 large camera-facing quads with `ShaderMaterial`. Fragment shader: animated Simplex noise → alpha mask. Only active during fog/blizzard/snow. Opacity: 0.02 (fog) → 0.06 (blizzard). Position between camera and mid-terrain, slowly drifting.

- [ ] **Step 2: Add to SceneContent, conditional on weather**

- [ ] **Step 3: Type check + visual verify**

Verify: Rolling fog banks visible during fog/blizzard weather. Subtle, not obstructive.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/atmosphere/FogPlanes.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: FogPlanes with noise shader for rolling fog banks"
```

---

### Task 16: Terrain surface weather

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx` (TerrainWireframe color compositor)

- [ ] **Step 1: Add snow accumulation to terrain color compositor**

Track a `snowLevel` ref (0→1) that increases 0.15 per frame during snow/blizzard, decreases 0.05 per frame during clear (gradual melt over ~3 turns). In the compositor pipeline step 3, blend vertex colors toward white by `snowLevel`.

- [ ] **Step 2: Add rain darkening**

During rain, multiply vertex colors by 0.8 in compositor step 3.

- [ ] **Step 3: Amplify grass sway during wind**

In `TerrainVegetation.tsx`, read weather from visual state context. If wind/blizzard, multiply sway amplitude by 3.

- [ ] **Step 4: Type check + visual verify**

Verify: Snow builds up on terrain over time, melts when clear. Rain darkens terrain. Grass whips in wind.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx src/components/map/terrain/TerrainVegetation.tsx
git commit -m "feat: terrain surface weather — snow accumulation, rain darkening, wind sway"
```

---

### Task 17: Lightning system

**Files:**
- Create: `src/components/map/atmosphere/LightningController.tsx`

- [ ] **Step 1: Create LightningController**

Watches weather from visual state context. During storm/blizzard, schedules 0-2 flashes per weather change via `setTimeout`. Flash sequence: sky uniform spike (50ms) + directional light intensity 0→3→0 (300ms) + 30% chance second flash 200ms later. Uses refs for all animation in `useFrame`. Needs access to the directional light ref (passed as prop or found via scene traversal).

- [ ] **Step 2: Add to SceneContent**

- [ ] **Step 3: Type check + visual verify**

Verify: Occasional dramatic lightning flashes during storms. Terrain details illuminate briefly. Not every turn.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/atmosphere/LightningController.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: LightningController — event-driven storm lightning"
```

---

### 🔴 CHECKPOINT 4 — Weather Complete

**Verify:**
- `npx tsc --noEmit` — zero errors
- Snow/blizzard particles render in 3D space around camera
- Rain streaks are directional lines, not dots
- Wind streaks are horizontal
- Fog planes create rolling bank effect during fog/blizzard
- Snow accumulates on terrain over turns, melts during clear
- Lightning illuminates terrain briefly during storms
- All weather transitions are smooth (no pop-in/pop-out)

**Triple review:** Dispatch Codex + Gemini + self-review.

---

## Phase 5: Danger & Drama (Iterations 24–30)

### Task 18: CameraDirector — baseline + action impulses

**Files:**
- Create: `src/components/map/CameraDirector.tsx`

- [ ] **Step 1: Create CameraDirector with baseline orbit**

Port existing orbit logic from deleted CameraController. Add impulse stack: array of `{ type, progress, duration, easing }` objects. On action change, push impulse. In `useFrame`, advance all impulses, compute blended camera position/target/FOV additively. Remove completed impulses.

Action impulses:
- `push_forward`: dolly 0.3 forward, low-angle dip, 2.5s
- `set_camp`: lower 0.5, tighten orbit 20%, 3s
- Fall/injury: 200ms shake + 100ms freeze + settle (600ms total)
- `get_lost`: orbit speed 2x, axis wobble ±15deg, lookAt drift
- `rest/eat/drink`: FOV pulse ±0.5, 1s
- Summit: FOV 45→55, crane up 1, orbit slow, 4s

- [ ] **Step 2: Add state modifications (continuous)**

Heartbeat FOV pulse (vital < 30), night orbit tighten, blizzard micro-jitter, lost lookAt offset.

- [ ] **Step 3: Replace TempCamera with CameraDirector in SceneContent**

- [ ] **Step 4: Type check + visual verify**

Verify: Camera orbits hiker. Push forward = dolly. Camp = lower + closer. Lost = wobbly orbit. Summit = wide reveal.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/CameraDirector.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: CameraDirector with action impulses + state modifications"
```

---

### Task 19: PostFXController — always-on effects

**Files:**
- Create: `src/components/map/PostFXController.tsx`

- [ ] **Step 1: Create PostFXController with EffectComposer**

Import from `@react-three/postprocessing`: `EffectComposer`, `Bloom`, `Vignette`. Always-on: Bloom (threshold 0.9, intensity 0.3, radius 0.4) + Vignette (darkness driven by worst vital, 0.0→0.6).

- [ ] **Step 2: Add to SceneContent (after all scene children)**

- [ ] **Step 3: Type check + visual verify**

Verify: Subtle bloom on hiker glow joints and landmarks. Vignette closes in as vitals drop. Wireframe terrain does NOT bloom.

- [ ] **Step 4: Commit**

```bash
git add src/components/map/PostFXController.tsx src/components/map/TacticalMap3D.tsx
git commit -m "feat: PostFXController with always-on Bloom + Vignette"
```

---

### Task 20: PostFXController — event-triggered effects (Lost blur, Fall shock)

**Files:**
- Modify: `src/components/map/PostFXController.tsx`

- [ ] **Step 1: Add DepthOfField for lost state**

Watch `isLost` from store. When lost, enable DOF with bokehScale 4→6 (scaling with lostTurns). Focus distance = camera-to-hiker distance, updated per frame. On resolve, fade DOF off over 500ms.

- [ ] **Step 2: Add ChromaticAberration for fall/injury**

Watch `lastVisualEvent`. On `fall` or `injury` event, spike ChromaticAberration offset to [0.008, 0.008], ease to [0,0] over 400ms. On `lost_resolve`, flash cyan ChromaticAberration briefly.

- [ ] **Step 3: Add Noise for critical vitals**

When any vital < 15, enable Noise with opacity 0.08. Disable when all vitals ≥ 15.

- [ ] **Step 4: Add Glitch for low morale**

When morale < 20, trigger 200ms Glitch bursts every 2-3s.

- [ ] **Step 5: Add fall desaturation**

On fall event, briefly desaturate scene (saturation 1.0→0.3→1.0 over 300ms) via `HueSaturation` effect.

- [ ] **Step 6: Type check + visual verify**

Verify: Getting lost = world goes blurry except hiker. Fall = sharp chromatic + desaturation shock. Critical vitals = subtle static. Low morale = intermittent glitch.

- [ ] **Step 7: Commit**

```bash
git add src/components/map/PostFXController.tsx
git commit -m "feat: event-triggered PostFX — DOF (lost), ChromAb (fall), Noise, Glitch"
```

---

### Task 21: DangerOverlay (CSS frost + panel borders)

**Files:**
- Create: `src/components/effects/DangerOverlay.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create DangerOverlay**

CSS-only component. Reads vitals from store:
- Frost edges: white radial gradient from viewport corners when `bodyTemp < 30`. Opacity scales with severity.
- Panel border escalation: sets CSS variable `--panel-border-color` based on worst vital (green > 60% → amber 30-60% → red < 30%).

`position: fixed; inset: 0; pointer-events: none; z-index: 3;`

- [ ] **Step 2: Add to App.tsx, replacing retired Vignette import**

- [ ] **Step 3: Type check + visual verify**

Verify: Frost edges appear when cold. Panel borders shift color with danger level.

- [ ] **Step 4: Commit**

```bash
git add src/components/effects/DangerOverlay.tsx src/App.tsx
git commit -m "feat: DangerOverlay — CSS frost edges + panel border escalation"
```

---

### Task 22: Clean up retired components

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Remove all imports of retired CSS effect components**

Ensure `Skybox`, `ParticleCanvas`, `TerrainAtmosphere`, `Vignette` are not imported or rendered in the main app flow (keep files for WebGL fallback path).

- [ ] **Step 2: Remove old CSS for .vignette class**

Clean up unused CSS rules for `.vignette` in `App.css`.

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "refactor: remove retired CSS effect imports from main app flow"
```

---

### 🔴 CHECKPOINT 5 — Danger & Drama Complete

**Verify:**
- `npx tsc --noEmit` — zero errors
- Camera responds to actions: push = dolly, camp = lower, fall = shake, lost = wobbly, summit = wide reveal
- Lost state: world blurs (DOF), camera wobbles, chromatic spike on entry, cyan flash on resolve
- Fall: sharp shake + chromatic spike + desaturation flash + noise burst
- Bloom only on hiker joints/landmarks/lightning (NOT wireframe)
- Frost edges on cold, panel borders escalate with danger
- No old CSS effects rendering (no Skybox div, no ParticleCanvas, no Vignette div)

**Triple review:** Dispatch Codex + Gemini + self-review.

---

## Phase 6: Polish & Integration (Iterations 31–33)

### Task 23: Final integration pass

- [ ] **Step 1: Full playthrough test — start game, advance through multiple waypoints**

Verify all systems work together: sky transitions, fog, weather particles, terrain band changes, action feedback, danger states.

- [ ] **Step 2: Performance check**

Open browser devtools Performance tab. Verify frame time stays under budget during blizzard (worst case). If over budget, apply graceful degradation steps from spec.

- [ ] **Step 3: prefers-reduced-motion**

Add media query check. When reduced motion preferred: disable FOV pulse, camera shake, jitter, vertex flicker. Use static indicators instead.

- [ ] **Step 4: Update CLAUDE.md with new architecture**

Update the Architecture and Key Patterns sections to reflect the full-bleed canvas, VisualStateBridge pattern, and new component locations.

- [ ] **Step 5: Update CHANGELOG.md**

Add entry for the visual atmosphere overhaul.

- [ ] **Step 6: Final type check + commit**

```bash
npx tsc --noEmit
git add -A
git commit -m "feat: 3D visual atmosphere overhaul — complete integration"
```

---

### 🔴 CHECKPOINT 6 — Final Review

**Verify the success criteria from the spec:**
- A blizzard at waypoint 10 looks and feels fundamentally different from clear weather at waypoint 2
- Getting lost feels disorienting (blur + camera drift + red flicker)
- A fall feels shocking (shake + chromatic + desaturation)
- The mountain feels enormous and the hiker feels small
- Environmental hostility escalates through the scene, not UI overlays

**Triple review:** Final Codex + Gemini + self-review.

---

## Execution: Ralph Loop Configuration

This plan executes via ralph-loop with the following configuration:

```
/ralph-loop --max-iterations 33 --completion-promise "OVERHAUL COMPLETE"
```

**Prompt for ralph-loop:**

```
You are implementing the 3D Visual Atmosphere Overhaul for Ao Tai Cyber-Hike.

Read the plan: docs/superpowers/plans/2026-03-19-3d-visual-atmosphere-overhaul.md
Read the spec: docs/superpowers/specs/2026-03-19-3d-visual-atmosphere-overhaul-design.md
Read CLAUDE.md for project conventions.

Find the next unchecked task (- [ ]) in the plan. Implement it. Mark it done (- [x]).
After each step, run `npx tsc --noEmit` to verify.

At CHECKPOINT markers: stop, commit all work, verify visually. Then dispatch Codex and Gemini for review using the codex-agent and gemini-agent skills. Also perform your own code review. Fix any issues found before proceeding to the next phase.

When all tasks and checkpoints are complete, output: <promise>OVERHAUL COMPLETE</promise>
```
