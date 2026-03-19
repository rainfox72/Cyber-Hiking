# 3D Visual & Atmosphere Overhaul

**Date:** 2026-03-19
**Art Direction:** Tactical Alpine Nightmare — 3D Edition
**Scope:** Atmosphere, terrain band identity, weather-as-environment, danger distortion, event drama
**Out of scope:** Hiker condition modifiers, screen overhauls (title/death/victory), difficulty retune, run summary/replay

## Design Context

This spec adapts the 2D visual overhaul (PR #1, `2026-03-18-visual-overhaul-design.md`) to the existing 3D WebGL scene. Rather than a 1:1 port, effects are split into three layers:

1. **World-space** (inside R3F): sky, fog, weather particles, lighting, terrain identity
2. **Screen-space** (postprocessing): vignette, blur, chromatic aberration, noise, glitch
3. **UI-space** (DOM): frost edges, panel border escalation, scanlines

Reviewed by Codex (technical feasibility) and Gemini (art direction) before design finalization.

---

## 1. Architecture — Full-Bleed Unified Scene

### Current State

```
z:0     Skybox (CSS gradient divs)
z:1     TerrainAtmosphere (CSS/SVG noise)
z:9998  ParticleCanvas (2D canvas particles)
        ┌─────────────────────────────┐
        │ panel-left │ panel-center  │ panel-right │
        │            │  TacticalMap3D│             │
        │            │  (R3F Canvas) │             │
        └─────────────────────────────┘
z:9999  Vignette (CSS radial-gradient)
z:10000 Scanlines (CSS)
```

### Proposed State

```
z:0     R3F Canvas (FULL VIEWPORT)
        ├── Skydome3D (ShaderMaterial gradient sphere + stars Points)
        ├── SceneLighting (ambient + directional, time/weather driven)
        ├── SceneFog (FogExp2, weather/band driven)
        ├── TerrainWireframe (existing, + band-reactive colors)
        ├── TerrainDetailLayer (existing vegetation/rocks/water/landmarks)
        ├── WeatherParticles3D (Points/InstancedMesh in world space)
        ├── HikerMarker (existing rig + effects)
        ├── TrailLine + WaypointMarkers (existing)
        ├── CameraDirector (replaces CameraController, action-aware)
        └── EffectComposer (postprocessing)
            ├── Bloom (always on, subtle)
            ├── Vignette (replaces CSS Vignette)
            ├── Noise (event-triggered)
            ├── DepthOfField (event-triggered: lost blur)
            └── ChromaticAberration (event-triggered: fall shock)

z:1     DOM Floating Panels (pointer-events: auto on panels only)
        ├── panel-left (vitals, inventory, risk)
        ├── panel-center-top (location info)
        ├── panel-center-bottom (log window, weather/time)
        └── panel-right (navigation console)
        Style: background rgba(13,17,23,0.85), backdrop-filter blur(8px)

z:2     Scanlines (CSS, kept thin)
z:3     DangerOverlay (CSS — frost edges, panel border escalation only)
z:4     Screen overlays (title, death, victory)
```

### Components Retired

| Old Component | Replaced By |
|---------------|-------------|
| `Skybox.tsx` (CSS gradient divs) | `Skydome3D` inside R3F |
| `ParticleCanvas.tsx` (2D canvas) | `WeatherParticles3D` inside R3F |
| `TerrainAtmosphere.tsx` (SVG/CSS noise) | Scene fog color + terrain material tinting |
| `Vignette.tsx` (CSS radial-gradient) | postprocessing Vignette effect |
| `CameraController` (in TacticalMap3D) | `CameraDirector` (action/state-aware) |
| `FogController` (in TacticalMap3D) | `SceneFog` (continuous, band/weather driven) |

### Layout Change

The `<Canvas>` moves from inside `panel-center` to a direct child of `App`, filling the viewport. Panels become `position: fixed` overlays with `pointer-events: none` on the container, `pointer-events: auto` on individual panels. Panel style: `background: rgba(13, 17, 23, 0.85)`, `backdrop-filter: blur(8px)`, `border: 1px solid rgba(61, 139, 55, 0.15)`.

### Canvas Configuration

- `alpha: false` — scene owns the full viewport, no CSS behind it. Skydome3D provides the background.
- `gl={{ alpha: false, antialias: false }}` — antialias disabled when EffectComposer is active (SMAA pass handles AA instead)
- `dpr={Math.min(window.devicePixelRatio, 1.5)}` — cap at 1.5x to keep postprocessing affordable on Retina
- Clear color: `#050510` (matches darkest sky gradient, prevents flash on load)

### WebGL Fallback

If WebGL fails, `WebGLErrorBoundary` renders a full-viewport fallback: the retired CSS atmosphere stack (Skybox + ParticleCanvas) plus `TacticalMapLegacy` centered in the viewport. Panels overlay the same way. This is a degraded but functional experience.

---

## 2. Atmosphere System

Three sub-systems driven by a shared `VisualState` selector.

### 2a. Skydome3D

Inverted sphere with `ShaderMaterial` gradient.

- Fragment shader interpolates `uTopColor` → `uBottomColor` by normalized Y
- Time-of-day palettes (migrated from current Skybox CSS values):
  - Dawn: `#1a0a2e` → `#4a2040`
  - Morning: `#0d1a2d` → `#1a3a4a`
  - Midday: `#0a1520` → `#152530`
  - Afternoon: `#0d1520` → `#2a2a1a`
  - Dusk: `#2a1525` → `#1a0a0a`
  - Night: `#050510` → `#0a0a0a`
- Weather modifiers blend toward gray/dark (same `blendHex` logic as current Skybox)
- Stars: `THREE.Points` child, ~40 points in upper hemisphere, opacity 0 (day) → 1 (night), twinkle via sine per-point
- Lightning flash: sky top → `#f0f0ff` for 50ms, fade 300ms
- Transitions: uniforms lerp over 2s via refs in useFrame

### 2b. SceneLighting

Minimal lighting rig (no shadow maps):

- `ambientLight`: intensity 0.3 (night) → 0.8 (midday), color shifts warm→cool
- `directionalLight`: sun/moon direction, color driven by time-of-day:
  - Dawn: warm gold `#e8dcc0`
  - Midday: cool white `#c0c8d0`
  - Night: blue-gray `#4a5a6a`, intensity 0.2

Material migration:
- Terrain details (rocks, vegetation, landmarks): `MeshBasicMaterial` → `MeshLambertMaterial`
- Terrain wireframe: stays `LineBasicMaterial` (wireframe is unlit by design)
- Hiker rig: stays `MeshBasicMaterial` (hologram aesthetic)
- Water: stays unlit line material

### 2c. SceneFog

Continuous `FogExp2` replacing binary `FogController`:

| Weather | Density | Color Base |
|---------|---------|------------|
| Clear | 0.02 | band-tinted dark |
| Cloudy | 0.04 | gray-tinted |
| Fog | 0.12 | `#1a1a1a` warm gray |
| Rain | 0.06 | `#0a0a0a` dark |
| Snow | 0.08 | `#1a1a2a` cold blue |
| Wind | 0.03 | band-tinted |
| Blizzard | 0.18 | `#2a2a2a` whiteout |

Fog color shifts with terrain band (forest = green-tinted, summit = gray-white) and time-of-day (night = near-black, dawn = warm). Density and color lerp over 1.5s via refs.

### 2d. VisualState Selector

Single derived Zustand selector computing the visual profile:

```typescript
interface VisualState {
  bandId: 'forest' | 'rocky' | 'plateau' | 'storm' | 'summit';
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
```

Band mapping:
- Waypoints 0–2: `forest`
- Waypoints 3–5: `rocky`
- Waypoints 6–8: `plateau`
- Waypoints 9–11: `storm`
- Waypoint 12: `summit`

**Ref distribution pattern:** A single `VisualStateBridge` component subscribes to the Zustand selector and writes the derived `VisualState` into a shared `useRef<VisualState>`. This ref is passed via React context (`VisualStateContext`) to all atmosphere children. Scene components read `ctx.current.fogDensity` etc. in their `useFrame` callbacks — zero additional subscriptions, zero re-renders. The bridge is the sole owner of the store subscription.

---

## 3. Terrain Band Identity

Each band has four coordinated identity channels.

### Band Visual Profiles

| Band | Wireframe Palette | Detail Character | Fog Behavior | Lighting Tone |
|------|-------------------|------------------|--------------|---------------|
| **Forest** (0–2) | Muted greens `#1a4a1a`→`#2a6a2a` | Dense trees + grass + stream water | Low density, green-tinted, valley-clinging | Warm amber fill |
| **Rocky** (3–5) | Gray-amber `#4a4a3a`→`#6a5a3a` | Trees thin→gone, rocks dominate, scree | Medium, neutral gray | Cooler, harsher directional |
| **Plateau** (6–8) | Desaturated gray-blue `#3a3a4a`→`#4a4a5a` | Sparse rocks, no vegetation | Medium-high, blue-gray | Cold, flat, low contrast |
| **Storm** (9–11) | Dark blue-gray `#2a2a3a`→`#3a3a4a`, red edges | Minimal rocks, warning landmarks | High baseline, weather amplifies | Dark, oppressive, red-shifted |
| **Summit** (12) | Stark white-gray `#5a5a5a`→`#7a7a7a`, `#ff2222` peak | Almost nothing, summit beacon only | Clears if weather permits, else maximum | Golden (clear) or void-black (storm) |

### Detail Density Multipliers

| Detail Type | Forest | Rocky | Plateau | Storm | Summit |
|-------------|--------|-------|---------|-------|--------|
| Trees | 1.0 | 0.3 | 0 | 0 | 0 |
| Grass | 1.0 | 0.5 | 0.1 | 0 | 0 |
| Rocks | 0.3 | 1.0 | 0.7 | 0.5 | 0.3 |
| Water | stream zones | 0 | 0 | 0 | 0 |

Implementation: `TerrainDetailLayer` components receive `bandVisibility` multiplier driving instance count or opacity. No geometry regeneration — instanced mesh count adjusts.

### Band Transition

- `terrainMesh.ts` base elevation colors remain as the immutable source-of-truth
- **Terrain color compositor** (single pipeline, applied once per frame in `TerrainWireframe.useFrame`):
  1. Start from `baseElevationColors` (immutable Float32Array from `terrainMesh.ts`)
  2. Apply band tinting: blend toward band palette (lerp factor 0→1 over 1.5s)
  3. Apply weather tinting: snow accumulation (blend toward white), rain darkening (multiply 0.8)
  4. Apply transient effects: lost-state red flicker (existing logic, applied last)
  5. Write final colors to GPU buffer once
  This prevents multiple systems stomping the same vertex color buffer.
- Terrain detail visibility fades in/out over 1s on band change

### Band-Specific Ambient Effects (in-scene)

- **Forest**: 8-12 slow dust motes (Points near camera)
- **Rocky/Plateau**: 20-40 wind streak line segments, speed scales with weather
- **Storm Ridge**: Permanent wind streaks + terrain vertex flicker (random vertices pulse 0.8–1.0 at 2Hz)
- **Summit (clear)**: 2-3 additive billboard quads angled from sun = golden light rays
- **Summit (storm)**: Summit beacon persists as a distorted red strobe — high-frequency flicker (8Hz), position jitters ±0.05 units. The goal exists but the environment is actively trying to erase it.

---

## 4. Weather as 3D Environment

### 4a. WeatherParticles3D

Replaces `ParticleCanvas.tsx`. Uses two render primitives:
- **`THREE.Points`** for round particles: snow, dust, blizzard, stars
- **`THREE.LineSegments`** for directional streaks: rain, wind

Stock `Points` cannot render elongated streaks — rain and wind require `LineSegments` with per-segment start/end positions updated in `useFrame`.

| Weather | Primitive | Count | Behavior | Color |
|---------|-----------|-------|----------|-------|
| Clear | — | 0 | — | — |
| Cloudy | — | 0 | Fog density only | — |
| Rain | `LineSegments` | 400–600 segments | Fast down + wind angle, segment length ~0.15 | `rgba(150,200,255)` |
| Snow | `Points` | 300–800 | Slow drift, sine wobble X/Z | `rgba(255,255,255)` |
| Fog | — | 0 | FogExp2 + fog planes only | — |
| Wind | `LineSegments` | 60–120 segments | Fast horizontal, segment length ~0.3 | `rgba(180,180,150, 0.3)` |
| Blizzard | `Points` | 600–1200 | High-speed directional + turbulence | `rgba(255,255,255, 0.6-0.9)` |

- Particles/segments spawn in a box around the camera, wrap on exit
- Updated via direct buffer writes in `useFrame`
- `depthWrite: false`, `AdditiveBlending` for snow/wind, `NormalBlending` for rain
- Weather transitions: target count lerps over 1s
- Both geometries pre-allocated at max count, unused entries set to zero-length / invisible

### 4b. Fog Planes

2–4 camera-facing noise planes for fog/blizzard rolling bank effect:

- Large quads (~8x4 world units) with `ShaderMaterial`
- Fragment shader: Simplex noise → alpha mask, animated UV scroll
- Opacity: 0.02 (fog) → 0.06 (blizzard)
- Only active during fog/blizzard/snow. Zero cost during clear.

### 4c. Terrain Surface Weather

- **Snow accumulation**: terrain vertex colors blend toward white during snow/blizzard, intensity per turn. Resets during clear.
- **Rain darkening**: terrain vertex colors darken 20% during rain.
- **Wind response**: grass sway amplitude 3x during wind/blizzard (existing `TerrainVegetation` sway — amplify multiplier).

### 4d. Lightning System

Event-driven, not per-frame.

- Frequency: 0–2 flashes per weather change during storm/blizzard. Most turns = zero.
- Sequence: 50ms sky flash (`#f0f0ff`) + directional light spike (intensity 0→3→0, 300ms) + 30% chance clustered double-flash (second flash 200ms later)
- Illuminates terrain details (now `MeshLambertMaterial`)
- No camera shake (lightning is visual, not impact)
- `LightningController` component: watches weather state, schedules flashes via `setTimeout`, animates in `useFrame`

---

## 5. Danger as Sensory Distortion

### 5a. Postprocessing Stack

**Always-on (cheap):**
- `Bloom`: threshold **0.9**, intensity 0.3, radius 0.4. At 0.9 threshold, the unlit wireframe terrain does NOT bloom — only hiker joint glow spheres, lightning flashes, and summit beacon earn bloom. This enforces the "Earned Glow" philosophy.
- `Vignette`: darkness 0.0 (healthy) → 0.6 (critical), vital-driven

**Event-triggered:**

| Effect | Trigger | Parameters | Duration |
|--------|---------|------------|----------|
| DepthOfField | `isLost = true` | bokehScale 4→6 (scales with lostTurns), focus distance updated per-frame from camera-to-hiker depth | Sustained while lost |
| ChromaticAberration | Fall/injury event | offset [0.008, 0.008] → [0,0] | 400ms ease-out |
| Noise | Any vital < 15 | premultiply: true, opacity: 0.08 | Sustained while critical |
| Glitch | Morale < 20 | dtSize: 32, columns: 0.05 | 200ms bursts every 2–3s |

### 5a-ii. Visual Events API

Event-triggered postprocessing needs a stable trigger source. The store currently has durable state (`lastAction`, `isLost`) but no transient edge-detection tokens. Add to `gameStore.ts`:

```typescript
interface VisualEvent {
  type: 'fall' | 'lost_start' | 'lost_resolve' | 'injury' | 'weather_change';
  timestamp: number; // Date.now()
}

// In store state:
lastVisualEvent: VisualEvent | null;
```

`PostFXController` watches `lastVisualEvent` via a Zustand selector. On each new event (detected by timestamp change), it fires the corresponding one-shot effect and ignores stale events (timestamp older than effect duration). The store sets `lastVisualEvent` in `performAction()` alongside existing sound triggers.

Sustained effects (DOF while lost, Noise while critical) still read durable state (`isLost`, vitals) directly.

### 5b. CameraDirector

Replaces `CameraController`. Same slow orbit baseline + impulses + state modifications.

**Action impulses:**

| Action | Camera Response | Duration |
|--------|----------------|----------|
| `push_forward` | Forward dolly 0.3 + low-angle dip | 2.5s |
| `set_camp` | Lower 0.5 + tighten orbit 20% | 3s, holds |
| Fall/injury | 200ms shake (amplitude 0.08) + 100ms freeze + settle | 600ms |
| `get_lost` | Orbit doubles speed, axis wobbles ±15deg, lookAt drifts 0.5s delay | While lost |
| `rest`/`eat`/`drink` | FOV pulse ±0.5 | 1s |
| Summit (wp 12) | FOV 45→55, crane up 1 unit, orbit slows 0.2 deg/s | 4s |

**State modifications (continuous):**

| State | Modification |
|-------|-------------|
| Any vital < 30 | Heartbeat FOV pulse ±1.5 at 1.2Hz |
| Night | Orbit radius tightens 15% |
| Blizzard | Micro-jitter 0.01 continuous |
| `isLost` | lookAt offset 0.1–0.3 units (delayed re-centering) |

Implementation: `baseOrbit` + `impulseStack` (array of active impulses blended additively) + `stateModifiers` (continuous per-frame). All refs, zero React re-renders.

### 5c. Lost State — The Blur

1. **Immediate**: ChromaticAberration spike (0.01 → 0, 300ms)
2. **Sustained**: DepthOfField — everything except hiker goes soft, bokehScale increases with `lostTurns`
3. **Camera**: orbit destabilizes, lookAt drifts
4. **Terrain**: red-tinted wireframe flicker (existing, kept)
5. **Search ring**: pulsing red ring (existing, kept)
6. **Resolution**: DOF snaps off over 500ms, ChromaticAberration flashes cyan, camera stabilizes

### 5d. Fall/Injury — The Shock

1. **0–200ms**: Camera shake (amplitude 0.08)
2. **50ms**: ChromaticAberration spike
3. **100–200ms**: Camera freeze (lerp → 0)
4. **200–600ms**: Camera settles with heavy damping
5. **Hiker**: existing stumble animation
6. **Postprocessing**: Noise burst (opacity 0.15, 200ms) + brief world desaturation (saturation 1.0→0.3→1.0 over 300ms) to simulate impact "blacking out"

### 5e. DangerOverlay (DOM, minimal)

CSS-only, above canvas, `pointer-events: none`:

- **Frost edges**: white radial gradient from viewport corners when `bodyTemp < 30`, opacity scales with severity
- **Panel border escalation**: borders shift `--tactical-green` → `--amber` → `--hazard-red` based on worst vital

No full-screen CSS overlays. Perception effects are all in postprocessing.

---

## New Components Summary

| Component | Location | Purpose |
|-----------|----------|---------|
| `Skydome3D` | `src/components/map/atmosphere/Skydome3D.tsx` | Gradient sky sphere + stars |
| `SceneLighting` | `src/components/map/atmosphere/SceneLighting.tsx` | Ambient + directional lights |
| `SceneFog` | `src/components/map/atmosphere/SceneFog.tsx` | FogExp2 continuous control |
| `WeatherParticles3D` | `src/components/map/atmosphere/WeatherParticles3D.tsx` | 3D weather particle system |
| `FogPlanes` | `src/components/map/atmosphere/FogPlanes.tsx` | Rolling fog bank noise planes |
| `LightningController` | `src/components/map/atmosphere/LightningController.tsx` | Event-driven lightning flashes |
| `CameraDirector` | `src/components/map/CameraDirector.tsx` | Action/state-aware camera |
| `PostFXController` | `src/components/map/PostFXController.tsx` | EffectComposer + event triggers |
| `VisualStateSelector` | `src/store/visualState.ts` | Derived visual state from game store |
| `VisualStateBridge` | `src/components/map/VisualStateBridge.tsx` | Sole store subscriber, writes to shared ref via context |
| `DangerOverlay` | `src/components/effects/DangerOverlay.tsx` | CSS frost edges + panel borders |

## Dependencies

- `@react-three/postprocessing` — EffectComposer, Bloom, Vignette, DepthOfField, ChromaticAberration, Noise, Glitch
- `three` (already present) — FogExp2, ShaderMaterial, Points, BufferGeometry
- `@react-three/drei` (already present) — used selectively

## Performance Budget

- Weather particles: max 1200 Points (blizzard). Zero during clear.
- Fog planes: max 4 quads. Zero during clear.
- Postprocessing: Bloom + Vignette always-on. DOF/Noise/Glitch event-only.
- No shadow maps. No per-fragment raymarching.
- All animation via refs + useFrame. No React state in render loops.
- Target: <4ms/frame for all atmosphere systems combined.
- `frameloop="always"` retained. If postprocessing pushes budget, disable event-triggered effects first before considering `frameloop="demand"`.

## Graceful Degradation

If postprocessing degrades performance below budget:
1. Disable event-triggered effects (DOF, ChromaticAberration, Noise, Glitch) first
2. If still over budget, disable Bloom (keep only Vignette)
3. If EffectComposer itself is the bottleneck, remove it entirely and fall back to CSS Vignette (re-enable retired `Vignette.tsx`)
4. Weather particles: reduce count by 50% as first mitigation step

Snow accumulation on terrain resets gradually over 3 turns of clear weather (not instant).

## Constraints

- Engine stays pure TS, zero visual dependencies
- Hiker hologram aesthetic stays unlit. Note: hiker currently uses `depthWrite: false` which makes it visible through terrain, reducing the mountain's perceived scale. Consider adding weighted occlusion in a future pass (dim to 5-10% when behind ridges) — not in scope for this spec but flagged as a known visual issue.
- Text readability non-negotiable — panels maintain WCAG AA contrast
- Desktop-only, minimum viewport 1024x768
- `prefers-reduced-motion`: disable FOV pulse, shake, jitter. Use static indicators.

## Success Criteria

The player should feel environmental hostility escalate through the camera and scene itself — not through UI overlays painted on top. A blizzard at waypoint 10 should look and feel fundamentally different from clear weather at waypoint 2. Getting lost should feel disorienting. A fall should feel shocking. The mountain should feel enormous and the hiker should feel small.
