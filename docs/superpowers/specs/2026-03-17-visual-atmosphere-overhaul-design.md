# Visual Atmosphere Overhaul — Design Spec

**Date**: 2026-03-17
**Status**: Implemented (branch: feature/visual-atmosphere-overhaul)
**Scope**: Visual/atmosphere enhancement — deepening the CRT tactical aesthetic with three independent rendering layers

## Overview

The Cyber-Hiking game has solid mechanics and a strong CRT/neon tactical identity. This overhaul adds environmental depth by introducing three composable visual layers — Sky System, Terrain Atmosphere, and 3D TacticalMap — so that every waypoint, time of day, and weather state feels distinct and immersive.

**What's in scope**: Sky gradients, terrain-aware backgrounds, 3D WebGL map replacement, panel transparency changes, ParticleCanvas night-overlay consolidation.
**What's NOT in scope**: Gameplay/engine changes, sound, typography, AI narrative, playability features (achievements, risk breakdown, journal, difficulty modes).

## Architecture

The three layers are **independent** — each reads from `useGameStore` and renders its own visual layer. No layer depends on another. They compose via z-index stacking:

```
z-index stack (bottom to top):
  1. Skybox              — position: fixed, z-index: 0 (full-screen gradient background)
  2. TerrainAtmosphere   — position: fixed, z-index: 1 (full-screen SVG noise / gradient overlay)
  3. .game-shell         — position: relative, z-index: auto (existing 3-panel grid, NOW with semi-transparent backgrounds)
  4. TacticalMap3D       — LOCAL to .tactical-map container (child of panel-center, not a global overlay)
  5. ParticleCanvas      — position: fixed, z-index: 9998 (weather particles ONLY — night overlay REMOVED)
  6. Vignette            — position: fixed, z-index: 9990 (unchanged)
  7. Scanlines           — position: fixed, z-index: 9999 (unchanged)
```

**Critical integration change**: ParticleCanvas currently draws a full-screen night/dusk dark overlay (`rgba(0, 0, 10, 0.15)` at night, `0.06` at dusk). This must be **removed** from ParticleCanvas — the Skybox now owns all time-of-day atmosphere. ParticleCanvas retains weather particles only.

**Panel transparency**: `.game-shell`, `.panel`, and panel children must switch from opaque `#0a0a0a`/`#0d0d0d` backgrounds to semi-transparent `rgba(10, 10, 10, 0.85)` / `rgba(13, 13, 13, 0.85)` so that Skybox and TerrainAtmosphere show through the gaps and faintly behind panels.

**Title screen**: Skybox renders during `gamePhase: "title"` with a static `night` gradient for atmospheric boot sequence. TerrainAtmosphere does NOT render during title (no waypoint data). TacticalMap3D does not render during title.

**Build order**: Sky (easy) → Terrain (easy-medium) → 3D Map (hard). Each can be shipped independently.

## Section 1: Sky System

### Component

`src/components/effects/Skybox.tsx`

### Purpose

Full-screen background layer that reflects the current time of day. Replaces the static `#0a0a0a` black background with atmospheric gradients that transition smoothly between 6 time phases.

### Data Source

- `useGameStore((s) => s.time.timeOfDay)` — one of: `dawn`, `morning`, `midday`, `afternoon`, `dusk`, `night`
- `useGameStore((s) => s.weather.current)` — modifies gradient (overcast pushes toward gray, blizzard toward white)
- `useGameStore((s) => s.weather.intensity)` — scales weather modification strength
- `useGameStore((s) => s.gamePhase)` — render static `night` during title phase

### Time-of-Day Gradient Map

Each phase maps to a CSS `linear-gradient` (top → bottom):

| Time | Top Color | Bottom Color | Feel |
|------|-----------|--------------|------|
| `dawn` | `#1a0a2e` (deep indigo) | `#4a2040` (dusty rose) | Cold mountain pre-sunrise |
| `morning` | `#0d1a2d` (dark steel) | `#1a3a4a` (muted teal) | Clear high-altitude morning |
| `midday` | `#0a1520` (cold charcoal) | `#152530` (dark slate) | Thin bright air |
| `afternoon` | `#0d1520` (charcoal) | `#2a2a1a` (warm shadow) | Fading warmth |
| `dusk` | `#2a1525` (bruised purple) | `#1a0a0a` (near-black) | Mountain sunset dying |
| `night` | `#050510` (void blue) | `#0a0a0a` (black) | Deep mountain dark |

### Transition Strategy

Instead of `transition: background` (which interpolates gradients inconsistently), use **opacity crossfade between two stacked gradient divs**:
- Two absolutely positioned gradient layers
- Active layer at `opacity: 1`, previous at `opacity: 0`
- `transition: opacity 2s ease` on both
- Swap which layer is "active" on time-of-day change

### Key Details

- Gradients are **subtle and dark** — panels remain readable. Maximum brightness is ~`#4a2040` at dawn; most values stay in the `#0a`-`#2a` range.
- **Night stars**: Canvas overlay with ~40 tiny white dots (1-2px, 0.3-0.6 opacity, randomly placed in top 40% of screen). Rendered once on mount, faded in/out with night phase. Stars have slow randomized opacity oscillation (twinkle, ~3s period per star) for liveliness.
- **Weather modifiers**: Cloudy/fog pushes gradients toward gray midtones. Blizzard adds a white wash overlay. (Note: `WeatherCondition` type uses `"cloudy"`, not `"overcast"`.)
- Sets CSS variable `--sky-tint` on `:root` so panel borders and `box-shadow` can subtly pick up the ambient tone (e.g., slightly warm at dusk, slightly blue at night). Usage is opt-in.

### Files

- **New**: `src/components/effects/Skybox.tsx`
- **Modified**:
  - `src/App.tsx` — add Skybox as first child in render tree (renders during both title and playing phases)
  - `src/index.css` — add `--sky-tint` CSS variable
  - `src/components/effects/ParticleCanvas.tsx` — **remove** the night/dusk overlay (`fillRect` with dark rgba at night/dusk); Skybox now owns this
  - `src/App.css` — change `.game-shell` background from `var(--bg-dark)` to `transparent`; change `.panel` backgrounds to `rgba(13, 13, 13, 0.85)`

## Section 2: Terrain Atmosphere

### Component

`src/components/effects/TerrainAtmosphere.tsx`

### Purpose

A visual layer between the Skybox and UI panels that gives each terrain type a distinct atmospheric feel. Changes when the player arrives at a new waypoint.

### Data Source

- `useGameStore((s) => s.player.currentWaypointIndex)` → look up `WAYPOINTS[index].terrain` and `WAYPOINTS[index].elevation`
- `useGameStore((s) => s.gamePhase)` — only render when `gamePhase !== "title"`

### Terrain → Atmosphere Map

| Terrain | Effect | Technique |
|---------|--------|-----------|
| `stream_valley` | Soft moisture haze at bottom 30% of screen, faint blue-green tint | CSS radial gradient from bottom |
| `forest` | Dark green fog wisps at edges, organic vignette | SVG `feTurbulence` noise filter, green-tinted, low opacity (0.06-0.10) |
| `meadow` | Open feel — lighter bottom gradient, faint grass-tone warmth | CSS linear gradient, slightly warmer `--sky-tint` |
| `stone_sea` | Harsh, granular noise texture across edges, cold gray | SVG `feTurbulence` (high frequency, low amplitude), gray overlay at 0.04 opacity |
| `scree` | Similar to stone_sea but with slight dust-amber shift | Same SVG noise, amber-shifted |
| `ridge` | Exposed — no edge effects, stronger cold blue tint | Minimal overlay, pushes `--terrain-tint` toward cold blue |
| `summit` | Thin air feel — slight white haze at edges, desaturated via overlay | Light white radial vignette from edges inward, desaturation applied as a semi-transparent gray overlay on the TerrainAtmosphere layer itself (NOT on panels — keeping this layer purely additive) |

### Key Details

- All effects are **very subtle** (0.04-0.10 opacity range) — they tint the atmosphere, not obscure the UI.
- Transition between terrain types uses a **1.5s CSS crossfade** (opacity out old, opacity in new) — same dual-layer approach as Skybox.
- **Elevation modifier**: Above 3200m, all terrain effects get slightly more desaturated and cold-shifted regardless of terrain type.
- SVG filters are defined once in a hidden `<svg><defs>` block within the component, referenced by CSS `filter: url(#terrain-noise-forest)` etc.
- **SVG filter performance fallback**: If `feTurbulence` causes frame drops (detectable via `requestAnimationFrame` timing), fall back to CSS-only radial gradients for forest/stone_sea/scree terrains. This is a graceful degradation, not a hard requirement.
- Sets CSS variable `--terrain-tint` on `:root` for optional panel border/box-shadow color pickup.
- **This layer is purely additive** — it does NOT modify panel styles, filters, or any existing component's CSS. All effects are contained within the TerrainAtmosphere overlay div.

### Files

- **New**: `src/components/effects/TerrainAtmosphere.tsx`
- **Modified**: `src/App.tsx` (add between Skybox and game-shell, only during playing/dying/victory/defeat phases), `src/index.css` (add `--terrain-tint` variable)

## Section 3: 3D TacticalMap

### Components

- `src/components/map/TacticalMap3D.tsx` — React Three Fiber canvas, camera, scene
- `src/components/map/terrainMesh.ts` — pure TS terrain mesh generation logic (no React deps)

### Purpose

Replace the current SVG isometric map with a Three.js WebGL terrain mesh. The Ao Tai ridge becomes a real 3D heightmap rendered as a CRT-styled wireframe.

### DOM Placement

**TacticalMap3D is LOCAL to the `.tactical-map` container** — it is a child of `panel-center`, NOT a global overlay. The R3F `<Canvas>` replaces the current SVG content inside the existing `.tactical-map` div. This preserves the current panel layout, sizing, and overflow behavior.

### Terrain Mesh Generation (`terrainMesh.ts`)

- Interpolate elevation between the 13 waypoints using **cubic spline** along the trail axis.
- Generate a grid mesh: **128x64 vertices** where:
  - X axis = distance along trail (0-80km, normalized)
  - Z axis = lateral spread (ridge width/shape)
  - Y axis = elevation (1500m-3800m, normalized)
- **Ridge profile by terrain type**: Controls lateral falloff shape:
  - `ridge`: Narrow, sharp drop-off
  - `meadow`: Wide, gentle slopes
  - `stone_sea`: Jagged with procedural noise displacement
  - `forest`: Moderate slopes with slight noise
  - `stream_valley`: Wide valley depression
  - `scree`: Moderate with high-frequency noise
  - `summit`: Peaked with steep sides
- **Noise source**: Use a simple inline implementation (mulberry32-based value noise, consistent with the project's existing seeded PRNG in `src/utils/random.ts`). No external noise library dependency.

### Visual Style (CRT Tactical Aesthetic)

| Element | Rendering |
|---------|-----------|
| **Wireframe grid** | Custom `LineSegments` geometry with per-vertex colors — NOT `MeshBasicMaterial({ wireframe: true })` (which only supports one color). Build edge geometry from the terrain mesh and assign vertex colors based on altitude. |
| **Elevation color banding** | Per-vertex color: green `#00ff41` below 2500m, amber `#ffb000` 2500-3200m, danger red `#ff2222` above 3500m, with smooth interpolation between bands |
| **Trail line** | Bright glowing line traced along the ridge surface. Traversed = solid, future = dashed. Uses `Line2` from drei with `LineMaterial` for width control |
| **Waypoint markers** | 3D octahedra at each waypoint position. Green = visited, amber = current, dim gray = future |
| **Hiker marker** | Small glowing point on the trail with a vertical scan beam (thin cylinder) above it |
| **Grid floor** | Faint grid plane at base elevation (1500m) with subtle scanline pattern |
| **Background** | Transparent (`alpha: true` on R3F Canvas) — Skybox and TerrainAtmosphere show through |

### Camera

- **Default view**: 30 deg pitch, looking along the trail direction, slightly elevated.
- **Auto-orbit**: Very subtle ~0.5 deg/s rotation for liveliness. Can be disabled.
- **Zoom**: **Discrete 3-step zoom** (1x, 2x, 3x) matching current SVG map UX — NOT continuous OrbitControls zoom. Zoom buttons rendered as HTML overlay above the canvas (same position as current). Mouse wheel mapped to discrete steps.
- **Focus tracking**: Camera smoothly pans to center on the current waypoint section as the player advances.

### Game-State-Driven Effects

| Game State | Trigger | Effect on 3D Map |
|------------|---------|-----------------|
| `timeOfDay: night` | `useGameStore((s) => s.time.timeOfDay)` | Wireframe dims to 60% brightness via vertex alpha, waypoint markers glow brighter (emissive), subtle `THREE.Fog` |
| `timeOfDay: dawn/dusk` | Same selector | Wireframe tinted slightly warm |
| `weather: fog` | `useGameStore((s) => s.weather.current)` | `THREE.Fog` near-plane closes in, distant terrain fades to background |
| `weather: blizzard` | Same + `s.weather.intensity` | White particle system on the terrain surface, wireframe alpha flickers randomly |
| `weather: rain` | Same | Slight blue tint on wireframe |
| `isLost` | `useGameStore((s) => s.player.isLost)` | Camera shakes slightly (random offset), wireframe turns red in local area, pulsing dashed search radius ring on terrain surface |
| Movement | `useGameStore((s) => s.lastAction)` — when `push_forward`, camera pans forward; when `descend`, camera pans backward | Camera smoothly transitions over 1s. Component tracks `prevWaypointIndex` via `useRef` to detect direction |
| Terrain reveal | `useGameStore((s) => s.player.currentWaypointIndex)` | Wireframe for next section fades from `opacity: 0` to `1` when player arrives at a waypoint. Tracked via `useRef` comparing previous vs current index |

### Dependencies

- `three` — Three.js core (^0.170)
- `@react-three/fiber` — React renderer for Three.js (^9.x required for React 19 compatibility)
- `@react-three/drei` — Helpers, Line2, etc. (^10.x required for R3F v9)

### Performance

- 128x64 grid = ~8,192 vertices — trivial for any GPU, including Apple Silicon integrated.
- Custom `LineSegments` with vertex colors is lightweight (no lighting, no textures).
- R3F rendering strategy: **`frameloop="demand"`** by default. Invalidate on state changes (camera pan, weather change, time-of-day shift, lost state toggle). This prevents continuous rendering when the game is idle between turns, saving battery.
- **Multiple animation loops**: R3F manages its own rAF loop. ParticleCanvas has a separate rAF loop. Scanlines are pure CSS. Total GPU cost is low but not zero — the spec acknowledges multiple concurrent animated layers. On lower-end devices, auto-orbit can be disabled and `frameloop="demand"` further reduces load.

### Fallback

- Current SVG map preserved as `src/components/map/TacticalMapLegacy.tsx`.
- Use R3F's built-in error boundary: wrap `<Canvas>` in a React `<ErrorBoundary>` that catches WebGL initialization failures and renders `<TacticalMapLegacy>` instead. This handles both WebGL1-only and no-WebGL scenarios without manual context checking.
- No user-facing error — seamless degradation.

### Files

- **New**: `src/components/map/TacticalMap3D.tsx`, `src/components/map/terrainMesh.ts`
- **Modified**:
  - `src/App.tsx` — swap `TacticalMap` → `TacticalMap3D` import
  - `src/App.css` — update `.tactical-map` styles: remove `perspective` transform (R3F handles its own perspective), keep container sizing/overflow/border
  - `package.json` — add `three`, `@react-three/fiber`, `@react-three/drei`
- **Renamed**: `src/components/map/TacticalMap.tsx` → `src/components/map/TacticalMapLegacy.tsx`
- **Preserved**: `src/components/map/HumanMarker.tsx` — no longer used by the 3D map (hiker is rendered as a 3D mesh point), but kept for legacy fallback

## CSS Changes Summary

### New CSS Variables (`src/index.css`)

```css
:root {
  --sky-tint: rgba(0, 0, 0, 0);      /* updated by Skybox.tsx */
  --terrain-tint: rgba(0, 0, 0, 0);   /* updated by TerrainAtmosphere.tsx */
}
```

### Panel Transparency (`src/App.css`)

```css
/* BEFORE */
.game-shell { background: var(--bg-dark); }

/* AFTER */
.game-shell { background: transparent; }
```

Panel and sub-panel backgrounds change from opaque to semi-transparent:
- `--bg-dark` usages in `.game-shell` → `transparent`
- `--bg-panel` usages in `.panel`, `.tactical-map`, `.log-window`, etc. → `rgba(13, 13, 13, 0.85)`
- `.game-header` background → `rgba(13, 13, 13, 0.90)` (slightly more opaque for readability)

### ParticleCanvas Change (`src/components/effects/ParticleCanvas.tsx`)

Remove the night/dusk overlay block that paints a full-screen dark rectangle. Weather particles continue rendering unchanged.

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Three.js bundle size (~150KB gzipped) | Tree-shaking via Vite; only import used modules. Acceptable for a game. |
| WebGL not available | R3F error boundary falls back to SVG legacy map |
| Performance with multiple animated layers | `frameloop="demand"` on R3F; auto-orbit can be disabled; SVG turbulence has CSS-only fallback |
| Panel transparency breaking readability | 0.85 opacity preserves contrast; game-header at 0.90. Tested against all 6 sky gradients |
| Night double-tinting | Night overlay removed from ParticleCanvas; Skybox is single source of truth |
| GameOverlay (z-index: 100) covers everything during defeat/victory | Skybox and TerrainAtmosphere continue running underneath but are invisible — acceptable since they are lightweight CSS/SVG layers |
| Visual consistency | CRT wireframe with vertex colors matches existing neon-green aesthetic |
| Build order dependency | None — all three layers are independent and can be built/shipped in any order |

## Out of Scope (Future Work)

These were discussed during brainstorming but are explicitly deferred:
- Weather particle upgrades (multi-layer, lens rain, frost edges)
- Altitude/hypoxia visual distortion (desaturation, chromatic aberration)
- Risk breakdown / action preview UI
- Achievement/milestone system
- Journal/photo mechanic
- Difficulty modes
- Soundscape evolution
- Typography changes
- Compass/mini-map HUD
