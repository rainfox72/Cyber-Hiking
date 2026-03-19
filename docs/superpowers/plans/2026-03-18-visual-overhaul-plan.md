# Visual & Presentation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Ao Tai Cyber-Hike from a tactical dashboard with effects into a visually dramatic expedition console with a living hostile mountain environment, targeting <10% win rate.

**Architecture:** Hybrid rendering (SVG mountain structure + canvas atmosphere) with full-bleed mountain viewport behind floating translucent instrument panels. 9-phase implementation: Foundation → Layout → Scene MVP → Atmosphere → Hiker → Feedback → Screens/Replay/Route → Difficulty → Cleanup. Each phase produces a committable, type-safe increment.

**Tech Stack:** React 19, TypeScript 5.9, Zustand 5, Vite 7, Canvas 2D API, SVG, CSS custom properties, CSS animations/transitions.

**Spec:** `docs/superpowers/specs/2026-03-18-visual-overhaul-design.md`

**Verification:** `npx tsc --noEmit` after every task. Visual inspection via `npm run dev` at phase boundaries. No test framework — this project is visual-first.

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `src/data/terrainProfiles.ts` | Ridge point arrays, colors per terrain band, sky gradient data |
| `src/components/scene/MountainScene.tsx` | Full-viewport SVG with 5 parallax ridgeline layers |
| `src/components/scene/SkyLayer.tsx` | CSS gradient sky, time-of-day × weather reactive |
| `src/components/scene/SceneHiker.tsx` | Hiker figure rendered in mountain scene context |
| `src/components/effects/AtmosphereCanvas.tsx` | Canvas atmosphere (fog, snow, rain, lightning, whiteout) |
| `src/components/effects/DangerOverlay.tsx` | Condition-specific visual overlays (replaces Vignette) |
| `src/hooks/useActionFeedback.ts` | Action feedback hook — CSS class toggling on lastAction |
| `src/utils/hikerPose.ts` | Shared pose selection and condition priority logic for HumanMarker + SceneHiker |
| `src/utils/runSummary.ts` | Event timeline extraction, epitaph generation, codename generation |
| `src/components/game/RunSummary.tsx` | Post-run storytelling UI (route trace, timeline, epitaph) |

### Files to Modify (major changes)

| File | Changes |
|------|---------|
| `src/index.css` | Complete CSS variable overhaul, new palette, glow rules, panel classes |
| `src/App.css` | Layout restructure: full-bleed viewport, floating panel grid, z-index stack |
| `src/App.tsx` | New layer stack, swap ParticleCanvas→AtmosphereCanvas, add MountainScene/SkyLayer/DangerOverlay |
| `src/components/effects/Scanlines.tsx` | Reduce intensity, mask over text regions |
| `src/components/screens/TitleScreen.tsx` | Complete overhaul: mountain backdrop, route drawing, expedition dossier |
| `src/components/game/GameOverlay.tsx` | Death/victory redesign with mountain scene integration, run summary |
| `src/components/game/StatusDashboard.tsx` | Floating panel styling, danger-reactive borders |
| `src/components/game/VitalBar.tsx` | New color system, danger glow, crisis pulse |
| `src/components/game/NavigationConsole.tsx` | Floating panel, button styling refresh |
| `src/components/game/ActionButton.tsx` | New hover/active/disabled states, earned glow |
| `src/components/game/LogWindow.tsx` | Floating panel, scanline mask |
| `src/components/game/RiskMeter.tsx` | Danger-reactive styling, dramatic emphasis |
| `src/components/map/TacticalMap.tsx` | Route identity: line treatment, hazard zones, waypoint markers, lost state |
| `src/components/map/HumanMarker.tsx` | Condition modifiers, special moments, headlamp, breath |
| `src/store/gameStore.ts` | Add run event history tracking for run summary |
| `src/engine/weatherSystem.ts` | Day 3+ escalation, stronger snow/blizzard weighting |
| `src/engine/vitalCalculator.ts` | Night drain, morale decay, altitude drain above 3500m |
| `src/engine/navigationSystem.ts` | 8% base lost chance, stronger modifiers |
| `src/engine/gameEngine.ts` | Camp recovery 85%/30%/8% |
| `src/engine/fallSystem.ts` | Night fall risk +10% |

### Files to Delete

| File | Replaced By |
|------|------------|
| `src/components/effects/ParticleCanvas.tsx` | `AtmosphereCanvas.tsx` |
| `src/components/effects/Vignette.tsx` | `DangerOverlay.tsx` |

---

## Chunk 1: Foundation + Layout (Phases 1-2)

### Task 1: CSS Variable Overhaul

**Files:**
- Modify: `src/index.css` (lines 1-53, CSS custom properties)

- [ ] **Step 1: Replace all CSS custom property definitions in `:root`**

Replace the existing `:root` block in `src/index.css` with the new Tactical Alpine Nightmare palette. Map old variable names to new ones:

```css
:root {
  /* Base layer */
  --bg-abyss: #08090c;
  --bg-panel: #0d1117;
  --bg-panel-raised: #151b26;
  --bg-storm: #1c2333;

  /* Instrumentation (nominal) */
  --tactical-green: #3d8b37;
  --tactical-green-bright: #5ca854;
  --amber: #d4a843;
  --teal-muted: #1e5c6b;

  /* Danger states */
  --warning-orange: #c97a2e;
  --hazard-red: #c93838;
  --critical-red: #ff4444;
  --ice-blue: #6cb4d4;

  /* Environmental accents */
  --dawn-gold: #e8dcc0;
  --moonlight: #c4d6e8;
  --lightning-white: #f0f0ff;
  --night-purple: #2a1a2e;

  /* Legacy aliases (remove after migration) */
  --neon-green: var(--tactical-green);
  --neon-green-dim: var(--tactical-green);
  --danger: var(--hazard-red);
  --cyan: var(--teal-muted);
  --magenta: var(--warning-orange);
  --bg-dark: var(--bg-abyss);
  --bg-input: var(--bg-panel);
  --text-dim: rgba(61, 139, 55, 0.4);
  --text-muted: rgba(61, 139, 55, 0.5);

  /* Panel treatment */
  --panel-bg: rgba(13, 17, 23, 0.85);
  --panel-border: rgba(61, 139, 55, 0.15);
  --panel-border-alert: rgba(201, 168, 67, 0.4);
  --panel-border-danger: rgba(201, 56, 56, 0.5);
  --panel-blur: 8px;
  --panel-gap: 4px;
}
```

Also add `prefers-reduced-motion` media query at the end of the file:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Update body and base element styles**

In `src/index.css`, update body background from `var(--bg-dark)` to `var(--bg-abyss)`. Update base text color from `var(--neon-green)` to `var(--tactical-green)`. Remove any `text-shadow` glow on body-level text.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors (CSS changes don't affect TS)

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style: replace neon cyberpunk palette with Tactical Alpine Nightmare

New CSS variable system: obsidian/storm-blue bases, muted tactical greens,
earned glow philosophy, danger-reactive accent colors. Legacy aliases
preserved for incremental migration."
```

### Task 2: Migrate Component CSS Variable References

**Files:**
- Modify: All component files using old CSS variable names

- [ ] **Step 1: Search and replace old variable names in all `.tsx` and `.css` files**

Replace direct color references across components. The legacy aliases in `:root` provide a safety net, but inline styles and hardcoded colors in TSX files need updating:

- All instances of `#00ff41` → use `var(--tactical-green-bright)` or `var(--tactical-green)`
- All instances of `#00aa2a` → use `var(--tactical-green)`
- All instances of `#ff2222` → use `var(--hazard-red)`
- All instances of `#ffb000` → use `var(--amber)`
- All instances of `#00aaff` → use `var(--teal-muted)`
- All instances of `#ff00ff` → remove/replace with `var(--warning-orange)`
- All instances of `#0a0a0a` → use `var(--bg-abyss)`
- All instances of `#0d0d0d` → use `var(--bg-panel)`
- All instances of `#080808` → use `var(--bg-panel)`

Focus on: `HumanMarker.tsx`, `TacticalMap.tsx`, `GameOverlay.tsx`, `VitalBar.tsx`, `StatusDashboard.tsx`, `ActionButton.tsx`, `NavigationConsole.tsx`, `RiskMeter.tsx`, `TitleScreen.tsx`, `Header.tsx`, `LogEntry.tsx`.

- [ ] **Step 2: Remove excessive text-shadow glow from components**

Search all components for `text-shadow` with neon green glow values. Remove constant glow. Keep glow only on: active waypoint, critical vitals (pulsing), action hover, AI highlight, victory text. All other text should have zero glow.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "style: migrate all components to Tactical Alpine Nightmare palette

Replace hardcoded neon colors with CSS variables. Remove constant glow
from text elements. Glow now earned: active waypoints, critical alerts,
hover states, and victory moments only."
```

### Task 3: Layout Restructure — Full-Bleed Viewport

**Files:**
- Modify: `src/App.css` (layout grid)
- Modify: `src/App.tsx` (component structure)

- [ ] **Step 1: Restructure App.css for full-bleed mountain viewport**

Replace the current 3-column grid with a layered architecture. The game area becomes a `position: relative` full-viewport container. Side panels and center content become `position: absolute` floating overlays.

```css
.game-shell {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-abyss);
}

/* Scene layers (z:0-2) rendered by dedicated components */

/* Floating panel grid */
.panel-grid {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: 240px 1fr 220px;
  grid-template-rows: auto 1fr;
  gap: var(--panel-gap);
  padding: var(--panel-gap);
  pointer-events: none; /* panels re-enable individually */
  z-index: 4;
}

.panel {
  pointer-events: auto;
  background: var(--panel-bg);
  backdrop-filter: blur(var(--panel-blur));
  -webkit-backdrop-filter: blur(var(--panel-blur));
  border: 1px solid var(--panel-border);
  border-radius: 2px;
  overflow-y: auto;
  transition: border-color 0.5s ease;
}

.panel--left { grid-column: 1; grid-row: 2; }
.panel--center { grid-column: 2; grid-row: 2; }
.panel--right { grid-column: 3; grid-row: 2; }
.panel--header { grid-column: 1 / -1; grid-row: 1; }
```

- [ ] **Step 2: Update App.tsx to use layered structure**

Wrap game content in the new layer stack. Add placeholder divs for scene layers that will be filled in Phase 3:

```tsx
{/* z:0 - Sky gradient (placeholder) */}
<div className="sky-layer" />
{/* z:1 - Mountain SVG (placeholder) */}
<div className="mountain-layer" />
{/* z:2 - Atmosphere canvas (existing ParticleCanvas for now) */}
<ParticleCanvas />
{/* z:3 - Danger overlays (existing Vignette for now) */}
<Vignette />
{/* z:4 - Floating panel grid */}
<div className="panel-grid">
  <div className="panel panel--header"><Header /></div>
  <div className="panel panel--left">...</div>
  <div className="panel panel--center">...</div>
  <div className="panel panel--right">...</div>
</div>
{/* z:5 - Scanlines */}
<Scanlines />
```

- [ ] **Step 3: Add z-index values for layer stack in App.css**

```css
.sky-layer { position: absolute; inset: 0; z-index: 0; }
.mountain-layer { position: absolute; inset: 0; z-index: 1; }
.atmosphere-layer { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.danger-layer { position: absolute; inset: 0; z-index: 3; pointer-events: none; }
.panel-grid { z-index: 4; }
/* Scanlines already z-index: 9999, reduce to 5 */
/* Screen overlays already z-index: 100, keep as z-index: 6+ */
```

- [ ] **Step 4: Reduce Scanlines intensity**

Modify `src/components/effects/Scanlines.tsx`: reduce scanline opacity from `0.06` to `0.02`. Reduce sweep opacity from `0.04` to `0.015`. This keeps the CRT feel without degrading text readability.

- [ ] **Step 5: Type check and visual verification**

Run: `npx tsc --noEmit`
Expected: 0 errors

Start dev server: `npm run dev`
Verify: panels float with translucent backgrounds, game still playable, mountain placeholder visible as dark background behind panels.

- [ ] **Step 6: Commit**

```bash
git add src/App.css src/App.tsx src/components/effects/Scanlines.tsx
git commit -m "layout: full-bleed viewport with floating instrument panels

Restructure from 3-column grid to layered scene architecture. Panels
become translucent floating overlays with backdrop blur. Z-index stack:
sky → mountain → atmosphere → danger → panels → scanlines → modals.
Scanlines reduced to preserve readability."
```

### Task 4: Panel Styling Premium Pass

**Files:**
- Modify: `src/components/game/StatusDashboard.tsx`
- Modify: `src/components/game/VitalBar.tsx`
- Modify: `src/components/game/NavigationConsole.tsx`
- Modify: `src/components/game/ActionButton.tsx`
- Modify: `src/components/game/LogWindow.tsx`
- Modify: `src/components/game/InventoryPanel.tsx`
- Modify: `src/components/game/RiskMeter.tsx`
- Modify: `src/components/game/Header.tsx`
- Modify: `src/components/game/WeatherDisplay.tsx`
- Modify: `src/components/game/DayNightIndicator.tsx`
- Modify: `src/components/game/LocationInfo.tsx`

- [ ] **Step 1: Update all panel components to use `.panel` class styling**

Each component that renders a panel section should inherit the floating panel treatment. Remove individual component background/border declarations and let the parent `.panel` container handle it. Component-specific styling focuses on internal layout, typography, and spacing.

- [ ] **Step 2: Refine VitalBar danger-reactive styling**

Update color thresholds to use new palette:
- `> 60%`: `var(--tactical-green-bright)`
- `30-60%`: `var(--amber)`
- `< 30%`: `var(--hazard-red)` with `pulse-danger` animation
- `< 15%`: `var(--critical-red)` with intensified pulse and subtle glow: `box-shadow: 0 0 6px var(--critical-red)`

- [ ] **Step 3: Refine ActionButton hover/active/disabled states**

- Default: `background: var(--bg-panel-raised)`, `border: 1px solid var(--panel-border)`, no glow
- Hover: `border-color: var(--tactical-green)`, subtle `box-shadow: 0 0 4px rgba(61, 139, 55, 0.2)` — earned glow on interaction
- Active/pressed: brief brightness flash, `transform: scale(0.98)`
- Disabled: `opacity: 0.3`, `cursor: not-allowed`
- AI-selected: `border-color: var(--amber)`, amber glow

- [ ] **Step 4: Refine RiskMeter with dramatic emphasis**

- `< 30%`: `color: var(--tactical-green-bright)`, no glow
- `30-60%`: `color: var(--amber)`, faint amber border glow
- `> 60%`: `color: var(--critical-red)`, pulsing red glow on the meter, `animation: pulse-danger 1s infinite`
- Large percentage text with `font-variant-numeric: tabular-nums` for stable width

- [ ] **Step 5: Improve typography spacing across all panels**

Add consistent internal padding, section labels with `text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.08em; color: var(--tactical-green); opacity: 0.6`. Increase vertical gaps between sections. Labels and values should have clear hierarchy.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/components/game/
git commit -m "style: premium panel pass — danger-reactive vitals, refined buttons, typography

Floating panel treatment with translucent backplates. VitalBar uses new
4-tier color system with earned glow at critical. ActionButton gains
hover glow and press feedback. RiskMeter pulses at high danger.
Consistent typography hierarchy with uppercase section labels."
```

---

## Chunk 2: Mountain Scene MVP (Phase 3)

### Task 5: Terrain Profile Data

**Files:**
- Create: `src/data/terrainProfiles.ts`

- [ ] **Step 1: Create terrain profiles data file**

Create `src/data/terrainProfiles.ts` with the `TerrainProfile` type and 5 terrain band definitions. Each band has 5 layers of ridge points (normalized 0-1) and color sets for base/dawn/night/storm.

Design each band's ridge silhouette character:
- **Forest:** Rounded organic ridges, treeline bumps on layers 1-2
- **Rocky:** Jagged angular peaks, sharp edges, bare slopes
- **Plateau:** Wide flat ridgelines, minimal vertical variation, open sky
- **Storm:** Knife-edge narrow ridges, steep drop-offs, compressed
- **Summit:** Single dominant peak rising above all layers

Include a `getTerrainBand(waypointIndex: number)` helper that returns the band name for a given waypoint index.

Include a `getSkyGradient(timeOfDay: TimeOfDay, weather: WeatherCondition)` function returning CSS gradient strings for all 6 time periods × 2 weather classes (clear vs overcast/storm). Import `TimeOfDay` from the engine's `dayNightCycle.ts` (values: `'dawn' | 'morning' | 'midday' | 'afternoon' | 'dusk' | 'night'`) and `WeatherCondition` from `types.ts`.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/data/terrainProfiles.ts
git commit -m "data: terrain profiles — 5 bands × 5 ridge layers with sky gradients

Normalized ridge point arrays for Forest, Rocky, Plateau, Storm, Summit
terrain bands. Color sets for base/dawn/night/storm lighting conditions.
Sky gradient definitions for 6 time-of-day periods × clear/storm weather."
```

### Task 6: Sky Layer Component

**Files:**
- Create: `src/components/scene/SkyLayer.tsx`

- [ ] **Step 1: Create SkyLayer component**

Renders a full-viewport `div` with `position: absolute; inset: 0; z-index: 0`. Background is a CSS `linear-gradient` driven by `time.timeOfDay` and `weather.current` from game store.

```tsx
const SkyLayer: React.FC = () => {
  const timeOfDay = useGameStore((s) => s.time.timeOfDay)
  const weather = useGameStore((s) => s.weather.current)
  const gradient = getSkyGradient(timeOfDay, weather)

  return (
    <div
      className="sky-layer"
      style={{ background: gradient, transition: 'background 2.5s ease' }}
    />
  )
}
```

Subscribe only to `time.timeOfDay` and `weather.current` via Zustand selectors for minimal re-renders.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/scene/SkyLayer.tsx
git commit -m "feat: SkyLayer — time-of-day × weather reactive gradient sky

Full-viewport CSS gradient that transitions smoothly between dawn, morning,
midday, afternoon, dusk, and night. Weather modifiers flatten/darken the sky."
```

### Task 7: Mountain Scene Component

**Files:**
- Create: `src/components/scene/MountainScene.tsx`

- [ ] **Step 1: Create MountainScene component**

Full-viewport SVG with 5 `<path>` elements (one per ridge layer). Reads `currentWaypointIndex` from store, determines terrain band via `getTerrainBand()`, renders ridge paths scaled to viewport dimensions.

Key implementation details:
- SVG `viewBox="0 0 1000 600"` (fixed coordinate space, scaled to viewport via CSS `width: 100%; height: 100%`)
- Each layer is a closed polygon path: starts at bottom-left, follows ridge points, ends at bottom-right
- Ridge points from `terrainProfiles.ts` are scaled: `x * 1000`, `y * 600`
- Each layer gets `transform: translateX(${offset}px)` for parallax based on waypoint progress
- Layer opacity set per spec (0.15-0.85 range)
- Layer fill colors from terrain band's color set, selected by time-of-day
- `position: absolute; inset: 0; z-index: 1;`

Parallax formula: `offset = (waypointIndex / 12) * maxShift * parallaxFactor[layer]` where `maxShift = 150` (15% of 1000-unit viewBox) and `parallaxFactor = { 1: 1.0, 2: 0.7, 3: 0.45, 4: 0.25, 5: 0.1 }`.

Subscribe to: `player.currentWaypointIndex`, `time.timeOfDay`, `weather.current`.

**Terrain band transitions:** When the player moves across a terrain band boundary (e.g., waypoint 2→3, forest→rocky), do NOT hard-cut to new profiles. Instead, crossfade: render both the outgoing and incoming band's profiles simultaneously, fading the outgoing to `opacity: 0` and the incoming from `opacity: 0` over 1.5s using CSS transitions on the `<path>` elements' `opacity` and `fill`. After the transition completes, remove the outgoing paths. Store `previousBand` in local component state to manage the crossfade.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/scene/MountainScene.tsx
git commit -m "feat: MountainScene — 5-layer parallax SVG ridgeline system

Full-viewport SVG with terrain-band-specific ridge profiles. Parallax
shifts with waypoint progress. Ridge colors respond to time-of-day and
weather conditions. 5 terrain bands: forest → rocky → plateau → storm → summit."
```

### Task 8: Integrate Scene into App

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Replace placeholder scene layers with real components**

Import and render `SkyLayer` and `MountainScene` in the game shell, replacing the placeholder divs. Keep existing `ParticleCanvas` and `Vignette` in their current positions for now (they'll be replaced in later phases).

- [ ] **Step 2: Type check and visual verification**

Run: `npx tsc --noEmit`
Expected: 0 errors

Start dev server: `npm run dev`
**VISUAL CHECKPOINT (spec guardrail):** The mountain scene + layout restructure should already feel like a major upgrade. Verify:
- Mountain ridges visible behind translucent panels
- Sky gradient changes with time-of-day as game progresses
- Terrain bands visually distinct between early and late waypoints
- Parallax shifts when moving between waypoints
- Panels remain readable over the scene

If the scene doesn't feel like a significant upgrade yet, iterate on ridge shapes and colors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: integrate mountain scene — sky + ridgelines behind floating panels

Mountain viewport now visible behind all instrument panels. Scene responds
to waypoint progress, time-of-day, and weather. Visual checkpoint: the
game now looks fundamentally different from the flat dashboard layout."
```

---

## Chunk 3: Atmosphere + Hiker (Phases 4-5)

### Task 9: AtmosphereCanvas Component

**Files:**
- Create: `src/components/effects/AtmosphereCanvas.tsx`

- [ ] **Step 1: Create AtmosphereCanvas component**

Replaces `ParticleCanvas.tsx`. Full-viewport canvas at z-index 2, `pointer-events: none`. Single `requestAnimationFrame` render loop.

Implement 7 weather modes with the particle counts from the performance budget:
- Clear: 10 particles (faint haze motes)
- Cloudy: 30 particles + 2-3 gradient-filled cloud bank shapes (large translucent ovals that drift slowly)
- Fog: 25 particles + full-canvas gradient fog overlay (dense at bottom, fading upward)
- Rain: 120 streak particles (angled, fast, blue-gray)
- Snow: 100 particles (white, slow, gentle drift + slight horizontal wander)
- Wind: 80 particles (horizontal streaks, fast, with debris specks)
- Blizzard: 180 particles (chaotic, directional, dense) + whiteout gradient overlay (progressive white wash from edges)

Night overlay: `ctx.fillStyle = 'rgba(0, 0, 20, 0.15)'` when `timeOfDay === 'night'`.

Lightning system: During `weather === 'storm'` or `weather === 'blizzard'`, random chance per render frame to trigger a flash cluster. When triggered: 50ms white flash (`ctx.fillRect` with `rgba(240, 240, 255, 0.7)`), then 300ms fade. Clustered: 60% chance of 1 flash, 30% chance of 2, 10% chance of 3 in quick succession. Average: 1-2 clusters per 60 seconds of real time. Most frames have zero lightning.

Read from store: `weather.current`, `weather.intensity`, `time.timeOfDay`.

**UI Interference effects:** In addition to world-layer particles, AtmosphereCanvas must apply CSS classes to the panel grid for weather UI interference. After each weather change, set a data attribute on `.panel-grid`:
- Fog: `data-weather="fog"` → CSS: `.panel-grid[data-weather="fog"] .panel { box-shadow: inset 0 0 20px rgba(150,150,150,0.05); }`
- Rain: `data-weather="rain"` → CSS: occasional streak overlay via `::after` pseudo-element with animated gradient
- Snow/cold: `data-weather="snow"` → CSS: corner frost effect via `::before` with radial gradient at corners
- Wind: `data-weather="wind"` → CSS: `animation: panel-vibrate 0.1s ease-in-out` (very subtle)
- Blizzard: `data-weather="blizzard"` → CSS: heavy frost on panels, text flicker via `animation: text-flicker 0.3s steps(2) infinite` on `.panel` children, static noise on risk meter via SVG turbulence filter

Set the data attribute from the AtmosphereCanvas component using a `useEffect` that updates `document.querySelector('.panel-grid')?.setAttribute('data-weather', weather)`. Add corresponding CSS rules to `src/index.css`.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/components/effects/AtmosphereCanvas.tsx
git commit -m "feat: AtmosphereCanvas — 7 weather modes with lightning system

Replaces ParticleCanvas with dramatically expanded atmosphere rendering.
Fog collapses depth, rain darkens, snow accumulates, blizzard approaches
whiteout. Lightning clusters during severe storms. Performance budget:
<4ms/frame with capped particle counts per weather mode."
```

### Task 10: Swap ParticleCanvas for AtmosphereCanvas

**Files:**
- Modify: `src/App.tsx`
- Delete: `src/components/effects/ParticleCanvas.tsx`

- [ ] **Step 1: Replace ParticleCanvas import and usage in App.tsx with AtmosphereCanvas**

- [ ] **Step 2: Delete `src/components/effects/ParticleCanvas.tsx`**

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/effects/AtmosphereCanvas.tsx
git rm src/components/effects/ParticleCanvas.tsx
git commit -m "refactor: replace ParticleCanvas with AtmosphereCanvas

Remove old particle system. New atmosphere canvas handles all weather
rendering with expanded modes and performance-budgeted particle counts."
```

### Task 11: Hiker Condition Modifiers

**Files:**
- Modify: `src/components/map/HumanMarker.tsx`

- [ ] **Step 1: Add condition modifier system to HumanMarker**

Add props or store reads for condition triggers:
- `bodyTemp` (cold modifier at < 50)
- `energy` (exhaustion at < 35)
- `weather` (wind lean at wind/blizzard)
- `statusEffects` (injury check)
- `timeOfDay` (headlamp at night/dusk)
- All vitals (critical flicker at any < 15)

Implement a condition priority system: rank active conditions by danger, apply top 2-3 as posture modifiers, rest as color/accessory effects.

For each modifier, add SVG sub-elements:
- **Cold:** Offset shoulder polygon points upward (hunched). Add 2-3 `<circle>` breath particles with CSS `@keyframes breath-rise` (translateY upward + opacity fade, 2s).
- **Wind:** `transform: rotate(${windLean}deg)` on figure group (5-8° lean). Small animated line segment for jacket flutter.
- **Exhaustion:** Lower head position (polygon shift), slower bob animation class.
- **Injury:** Alternate limb position on walk pose for limp effect.
- **Night:** SVG `<polygon>` headlamp cone with `linearGradient` fill (amber → transparent), positioned at head, slight sway via CSS animation.
- **Critical:** Irregular opacity animation: `@keyframes signal-break` with steps at random opacity values between 0.4 and 1.0.

- [ ] **Step 2: Add special moment poses**

- **Summit pose:** New pose case for `waypointIndex === 12 && hasReachedSummit`. Arms raised wide, `<circle>` golden glow behind figure with `@keyframes summit-glow` (scale + opacity pulse).
- **Stumble:** Triggered by fall events (passed via `lastEvents`). Brief 300ms CSS animation: figure drops then catches.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/map/HumanMarker.tsx
git commit -m "feat: hiker condition modifiers — cold, wind, exhaustion, injury, night, critical

Additive condition system with 2-3 posture modifiers max. Breath vapor
in cold, wind lean in storms, headlamp at night, signal flicker at critical.
Summit pose for the rare victory. Hiker now reads as a person under stress."
```

### Task 12: Scene Hiker

**Files:**
- Create: `src/components/scene/SceneHiker.tsx`
- Modify: `src/components/scene/MountainScene.tsx`

- [ ] **Step 1: Create SceneHiker component**

A simplified version of HumanMarker rendered inside the MountainScene SVG. Positioned at 65-70% vertical, horizontal position interpolated by waypoint index matching layer 2 parallax offset. Size: scaled to ~2-3% of viewport height in SVG units.

**Logic sharing with HumanMarker:** Extract the pose selection logic and condition priority ranking into a shared utility: `src/utils/hikerPose.ts`. This utility exports `getActivePose(lastAction, waypointIndex, hasReachedSummit)` and `getConditionModifiers(player, weather, time)`. Both `HumanMarker.tsx` (map marker) and `SceneHiker.tsx` (scene figure) import from this utility but render their own SVG at different scales. SceneHiker renders a simplified silhouette (fewer polygon vertices) at ~2-3% viewport height. HumanMarker retains its current detail level for the map panel.

- [ ] **Step 2: Embed SceneHiker in MountainScene SVG**

Render SceneHiker as a `<g>` element within the MountainScene SVG, positioned between layers 2 and 1 (near terrain and foreground).

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/SceneHiker.tsx src/components/scene/MountainScene.tsx
git commit -m "feat: SceneHiker — tiny vulnerable hiker visible on the mountain

Small stylized figure rendered in the mountain scene between near terrain
and foreground layers. Position tracks waypoint progress. Condition
modifiers visible even at small scale. The player can see their hiker
against the hostile landscape."
```

---

## Chunk 4: Action Feedback + Danger Overlays (Phase 6)

### Task 13: Action Feedback Hook

**Files:**
- Create: `src/hooks/useActionFeedback.ts`

- [ ] **Step 1: Create useActionFeedback hook**

Watches `lastAction` and `lastEvents` from game store. When action changes, sets CSS classes on the game shell element via `document.documentElement.classList` and clears them after animation duration.

```typescript
interface FeedbackState {
  sceneClass: string | null    // applied to .game-shell
  uiClass: string | null       // applied to .panel-grid
  shakeIntensity: number       // 0 = none, 1 = light, 2 = medium, 3 = heavy
  duration: number             // ms
}
```

Map each action to its feedback:
- `push_forward`: `scene-push`, `ui-push`, shake 0, 400ms
- `set_camp`: `scene-camp`, `ui-camp`, shake 0, 600ms
- `check_map`: `scene-map`, `ui-map`, shake 0, 300ms
- `rest`: `scene-rest`, `ui-rest`, shake 0, 500ms
- `eat`/`drink`: `scene-consume`, `ui-consume`, shake 0, 300ms
- `use_medicine`: `scene-medicine`, `ui-medicine`, shake 0, 400ms

Event-triggered (from `lastEvents`):
- Fall/injury: `scene-injury`, `ui-injury`, shake 3, 200ms
- Getting lost: `scene-lost`, `ui-lost`, shake 1, 500ms

- [ ] **Step 2: Add feedback CSS classes to index.css**

```css
/* Action feedback — scene responses */
.scene-push .mountain-layer { transition: transform 0.4s ease; }
.scene-camp .sky-layer { filter: brightness(0.9); transition: filter 0.6s ease; }
.scene-map .mountain-layer { /* brief grid overlay handled by JS overlay div */ }
.scene-rest .mountain-layer { transform: scale(1.005); transition: transform 0.5s ease; }
.scene-consume { /* minimal scene change */ }
.scene-medicine .mountain-layer { filter: brightness(1.05); transition: filter 0.4s ease; }
.scene-injury .game-shell { animation: screen-shake 0.2s ease-in-out; }
.scene-lost .mountain-layer { filter: blur(2px); transition: filter 0.3s ease; }

/* Action feedback — UI responses */
.ui-push .panel--center { border-color: var(--tactical-green); transition: border-color 0.4s ease; }
.ui-camp .panel { border-color: var(--amber); opacity: 0.95; transition: all 0.6s ease; }
.ui-map .panel--center { border-color: var(--tactical-green-bright); transition: border-color 0.3s ease; }
.ui-rest .panel { opacity: 0.92; transition: opacity 0.5s ease; }
.ui-consume .panel--left { /* flash relevant inventory item via JS class */ }
.ui-medicine .panel--left { border-color: var(--tactical-green-bright); transition: border-color 0.4s ease; }
.ui-injury .panel { border-color: var(--critical-red); transition: border-color 0.15s ease; }
.ui-lost .panel--center { animation: panel-flicker 0.5s ease; }
```

- [ ] **Step 3: Integrate hook in App.tsx**

Call `useActionFeedback()` in the main App component.

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useActionFeedback.ts src/index.css src/App.tsx
git commit -m "feat: action feedback system — visual juice for every decision

useActionFeedback hook triggers scene + UI responses per action. Push
shifts parallax, camp dims scene, injury shakes screen, getting lost
blurs the mountain. Intensity tiers: minor actions restrained, major
events hit hard."
```

### Task 14: Danger Overlay System

**Files:**
- Create: `src/components/effects/DangerOverlay.tsx`
- Delete: `src/components/effects/Vignette.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create DangerOverlay component**

Replaces Vignette. Reads all player vitals and status effects. Determines the dominant danger condition (vital closest to zero below threshold) and renders its full-screen treatment. Other active conditions render as accent overlays (lower opacity, border-only effects).

Condition detection:
- Hypothermia: `bodyTemp < 40` (dominant below 25)
- Altitude: `o2Saturation < 50` (dominant below 30)
- Dehydration: `hydration < 40` (dominant below 25)
- Starvation: `energy < 30` (dominant below 20)
- Morale: `morale < 35` (dominant below 20)
- Navigation: `isLost === true`
- Fall risk: current terrain has `terrainType === 'ridge'` or `'scree'` and `energy < 50`

Each condition renders a positioned-absolute div:
- **Hypothermia (dominant):** `radial-gradient(ellipse at center, transparent 40%, rgba(108, 180, 212, 0.15) 70%, rgba(108, 180, 212, 0.3) 100%)` + corner frost SVG overlays
- **Altitude (dominant):** `radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, 0.4) 100%)` with `animation: heartbeat-pulse 1.2s infinite` (opacity modulation)
- **Dehydration (dominant):** `filter: contrast(1.2) saturate(0.8)` on game shell + faint static noise via inline SVG `<filter>` with `<feTurbulence type="fractal" baseFrequency="0.9" numOctaves="4" />` applied to an overlay div (no external asset needed)
- **Starvation (dominant):** `filter: brightness(0.85) saturate(0.7)` on game shell
- **Morale (dominant):** `animation: jitter 0.15s steps(2) infinite` on scene layers
- **Navigation:** fog overlay on scene + waypoint uncertainty CSS on map
- **Fall risk:** subtle `animation: vertigo-drift 3s ease-in-out infinite` on foreground layer

Memoize on vital threshold crossings (not every render). Use `useMemo` with vitals bucketed to 10-unit ranges.

- [ ] **Step 2: Swap Vignette for DangerOverlay in App.tsx**

Replace `<Vignette />` with `<DangerOverlay />`. Delete `src/components/effects/Vignette.tsx`.

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/effects/DangerOverlay.tsx src/App.tsx
git rm src/components/effects/Vignette.tsx
git commit -m "feat: DangerOverlay — condition-specific visual crisis language

Replaces Vignette with 7 distinct danger treatments: frost for hypothermia,
tunnel vision for altitude, static for dehydration, dimming for starvation,
jitter for morale, fog for navigation, vertigo for fall risk. Dominant-state
hierarchy prevents noise stacking."
```

---

## Chunk 5: Screens, Replay, Route Identity (Phase 7)

### Task 15: Title Screen Overhaul

**Files:**
- Modify: `src/components/screens/TitleScreen.tsx`

- [ ] **Step 1: Rebuild TitleScreen with mountain scene backdrop**

The title screen now renders over the mountain scene (which is always present in the game shell). Structure:

1. Initial state: black overlay fading to transparent over 2s (mountain reveals)
2. Boot sequence: floating console panel (translucent, same `.panel` styling) with boot lines at 200ms/line
3. Route drawing: SVG `<path>` with `stroke-dasharray` and `stroke-dashoffset` animation tracing the route across the mountain scene (2s)
4. Title reveal: "AO TAI CYBER-HIKE" with Chinese subtitle, route stats
5. Expedition dossier: rotating flavor text array, cycling every 4s
6. Prompt: "PRESS ENTER TO BEGIN EXPEDITION" with amber pulse

Set the mountain scene to dawn sky, Forest Approach terrain band during title.

**Route path for drawing animation:** The title screen route path is NOT the TacticalMap's isometric route. Instead, create a simple SVG `<polyline>` using the 13 waypoint positions mapped to the mountain scene's coordinate space. Calculate x positions as `waypointIndex / 12 * viewBoxWidth` and y positions from the layer 3 (primary spine) ridge profile at those x positions. This gives a route line that follows the mountain silhouette. Use `stroke-dasharray` equal to total path length and animate `stroke-dashoffset` from full length to 0 over 2s.

- [ ] **Step 2: Add dossier flavor text array**

```typescript
const dossierLines = [
  '// WARNING: Route officially closed since 2018',
  '// 47 confirmed fatalities on record',
  '// Weather window: unpredictable beyond Day 3',
  '// Solo traverse not recommended',
  '// Last signal received: Day 6, 金字塔 sector',
  '// Search and rescue response time: 48+ hours',
  '// Blizzard probability above 3400m: 60%+',
  '// No reliable communication past 都督门',
]
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add src/components/screens/TitleScreen.tsx
git commit -m "feat: title screen — expedition briefing over mountain scene

Mountain fades in from black, boot sequence runs in floating console,
route draws across the ridgeline, title reveals with stats, expedition
dossier cycles danger warnings. The first thing the player sees is the mountain."
```

### Task 16: Run Summary Utilities

**Files:**
- Create: `src/utils/runSummary.ts`

- [ ] **Step 1: Create run summary utility functions**

```typescript
// Extract 3-5 key events from game log
export function extractKeyEvents(log: LogEntry[], lastEvents: CriticalEvent[]): KeyEvent[]

// Generate expedition epitaph from run data
export function generateEpitaph(
  defeatCause: string | null,
  waypointIndex: number,
  day: number,
  weather: string
): string

// Generate run codename
export function generateCodename(
  weather: string,
  waypointIndex: number,
  defeatCause: string | null,
  rng: () => number
): string
```

Codename templates:
```typescript
const patterns = [
  (w: string, t: string) => `Operation ${w} ${t}`,
  (w: string, t: string) => `The ${t} ${getFate(defeatCause)}`,
  (w: string) => `${w} Protocol`,
]
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/utils/runSummary.ts
git commit -m "feat: run summary utilities — event extraction, epitaph, codename

Template-based expedition epitaph generation, key event timeline extraction
from game log, and run codename generator with weather/terrain/fate pools."
```

### Task 17: Game Over / Victory Overhaul + Run Summary

**Files:**
- Create: `src/components/game/RunSummary.tsx`
- Modify: `src/components/game/GameOverlay.tsx`
- Modify: `src/store/gameStore.ts`

- [ ] **Step 1: Add event history tracking to game store**

Add `eventHistory: Array<{ day: number; event: string; waypoint: string; severity: string }>` to game store state. In the `performAction` method, after the engine's `processAction` returns a `TurnResult`, check `turnResult.events` (the `CriticalEvent[]`). For each event with `severity === 'major'` or `severity === 'critical'`, push to `eventHistory` with the current day, event name, current waypoint name, and severity. Reset `eventHistory` to `[]` in `startGame`.

- [ ] **Step 2: Create RunSummary component**

Displays below the expedition report on death/victory screens:
- **Mini route trace:** Small inline SVG showing the 13 waypoints as dots with a line connecting traversed ones. Final position marked with X (death) or star (summit).
- **Event timeline:** 3-5 key events formatted as "Day N · Event at Waypoint"
- **Epitaph:** Single summary line
- **Codename:** "Operation [Name]" in dim text

- [ ] **Step 3: Rebuild GameOverlay for death screen**

Phase 1 (The Moment, 2s):
- Scene desaturates via CSS `filter: grayscale(0.9)` on `.game-shell`
- Cause text in center: large `var(--hazard-red)`, `font-size: 2rem`
- Brief static burst overlay (100ms white noise, then fade)

Phase 2 (The Report):
- Floating panel center-screen with expedition report text
- RunSummary component below
- "RESTART MISSION" button

Mountain scene remains frozen and desaturated in background.

- [ ] **Step 4: Rebuild GameOverlay for victory screens**

Summit: scene transitions to summit band, sky opens, "SUMMIT REACHED" in `var(--tactical-green-bright)` with `text-shadow: 0 0 30px` (only place this much glow is used). Full report.

Escape: scene transitions to forest band, "ESCAPE" in `var(--amber)`, no glow.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/components/game/RunSummary.tsx src/components/game/GameOverlay.tsx src/store/gameStore.ts
git commit -m "feat: death/victory screens — expedition report with run summary

Death freezes the mountain as a memorial. Expedition report shows last
known position, cause, stats. Run summary adds event timeline, epitaph,
and codename. Victory uses mountain scene transitions. Every run leaves
a record."
```

### Task 18: Tactical Map Route Identity

**Files:**
- Modify: `src/components/map/TacticalMap.tsx`

- [ ] **Step 1: Upgrade route line treatment**

Replace single-style trail line with danger-scaled treatment:
- Calculate per-segment danger from waypoint terrain type
- Safe segments (forest, meadow): `strokeWidth: 1`, `var(--tactical-green)`, no pulse
- Moderate segments (stone_sea, scree): `strokeWidth: 1.5`, `var(--amber)`, slow pulse
- Dangerous segments (ridge at high elevation): `strokeWidth: 2`, `var(--hazard-red)`, faster pulse

Traversed trail: solid with glow filter. Future trail: dashed with terrain-colored tint.

- [ ] **Step 2: Upgrade waypoint markers**

- Current: breathing ring animation (`@keyframes waypoint-breathe`: scale 1→1.3→1, opacity 0.6→0.3→0.6, 2s infinite)
- Passed: solid diamond (filled)
- Future: hollow diamond (stroke only)
- Shelter waypoints: tiny `△` icon inside diamond
- Camp-available: small dot below diamond

- [ ] **Step 3: Add terrain hazard zones**

Render subtle shaded SVG `<rect>` regions behind the route for high-danger terrain bands:
- Storm Ridge (waypoints 9-11): `fill: rgba(201, 56, 56, 0.06)`
- Exposed Plateau (waypoints 6-8): `fill: rgba(108, 180, 212, 0.04)`
- These are always visible, not reactive.

- [ ] **Step 4: Upgrade lost state visuals**

When `isLost`:
- Future route line: `opacity: 0.1` (nearly invisible)
- Future waypoint markers: add `filter: blur(2px)`
- Search radius ring: animated pulse, `var(--hazard-red)`
- Hiker marker on map: offset from trail line with slight random jitter

- [ ] **Step 5: Add point of no return marker**

At waypoint 10, render a small `|` barrier mark on the route with subtle label "NO RETURN" in `var(--hazard-red)` at low opacity. After passing waypoint 10, the descend portion of the route behind waypoint 10 gets `opacity: 0.05`.

- [ ] **Step 6: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 7: Commit**

```bash
git add src/components/map/TacticalMap.tsx
git commit -m "feat: tactical map route identity — danger-scaled lines, hazard zones, waypoint markers

Route line thickness and color scale with terrain danger. Traversed trail
glows, future trail dashed with terrain tint. Shelter and camp markers.
Terrain hazard zones for Storm Ridge and Exposed Plateau. Lost state
dissolves the route. Point of no return at waypoint 10."
```

---

## Chunk 6: Difficulty Retune + Cleanup (Phases 8-9)

### Task 19: Weather Escalation Tuning

**Files:**
- Modify: `src/engine/weatherSystem.ts`

- [ ] **Step 1: Shift escalation threshold from Day 4 to Day 3**

Find the day-based escalation check in the weather transition logic. Change the threshold from `day >= 4` to `day >= 3`. Increase the weighting toward snow and blizzard in the escalated transition matrix.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/engine/weatherSystem.ts
git commit -m "balance: earlier weather escalation — Day 3+ shift to hostile weather

Storms arrive a day earlier. Increased snow/blizzard weighting in
escalated Markov transition matrix."
```

### Task 20: Night, Camp, Morale, Navigation, Altitude Tuning

**Files:**
- Modify: `src/engine/vitalCalculator.ts`
- Modify: `src/engine/navigationSystem.ts`
- Modify: `src/engine/gameEngine.ts`
- Modify: `src/engine/fallSystem.ts`
- Modify: `src/engine/exposureSystem.ts`

- [ ] **Step 1: Night travel penalties in vitalCalculator.ts**

Add/increase night-specific drain multipliers:
- Energy drain at night: multiply base drain by 1.15 (was 1.0)
- Morale drain at night: add extra -2 per action (compounds with existing)
- Morale drain in bad weather (rain/snow/wind/blizzard): add extra -1 to -3 scaled by severity

- [ ] **Step 2: Navigation tuning in navigationSystem.ts**

- Base lost chance: 6% → 8%
- Night modifier: increase by +25% (multiplicative)
- Fall risk at night in fallSystem.ts: +10% additive

- [ ] **Step 3: Camp recovery in gameEngine.ts**

- First camp: 100% → 85%
- Second camp: 35% → 30%
- Third+ camp: 10% → 8%

- [ ] **Step 4: Altitude drain in vitalCalculator.ts**

Above 3500m, increase O2 drain curve steepness. Add compound effect: energy drain scales with `(1 + (altitude - 3500) / 1000)` multiplier when above 3500m and weather is bad. Also check `src/engine/exposureSystem.ts` — if it has separate altitude-based exposure accumulation, increase the rate above 3500m to compound with the vital drain changes.

- [ ] **Step 5: Type check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add src/engine/vitalCalculator.ts src/engine/navigationSystem.ts src/engine/gameEngine.ts src/engine/fallSystem.ts src/engine/exposureSystem.ts
git commit -m "balance: difficulty retune — night, camps, morale, navigation, altitude

Night travel: +15% energy drain, +25% lost chance, +10% fall risk.
Camp recovery: 85/30/8%. Morale decays faster in bad weather and at
night. Getting lost: 8% base. Altitude: steeper O2 above 3500m with
weather compound effect."
```

### Task 21: Playtest Validation

**Files:**
- Read/modify: `scripts/` playtest bot files

- [ ] **Step 1: Run 200+ heuristic bot simulations**

Use existing playtest scripts. Run at least 200 simulations and collect:
- Summit rate (target: 5-9%)
- Median waypoint reached (target: 5-7)
- Death cause distribution
- Death waypoint distribution (expect clustering at waypoints 9-11)

- [ ] **Step 2: Evaluate results and adjust if needed**

If summit rate > 9%: increase one or more tuning levers slightly.
If summit rate < 5%: reduce one lever (probably camp recovery or lost chance).
If median run < waypoint 5: game is too punishing early — reduce early-game pressure.
If deaths don't cluster at Storm Ridge: adjust altitude/weather interaction.

- [ ] **Step 3: Type check after any adjustments**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 4: Document final tuning values and results**

Record in a comment block at the top of the commit or in `.claude/docs/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "balance: validated difficulty — X% summit rate from N simulations

[Include results summary in commit message body]"
```

### Task 22: Final Cleanup and Documentation

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md` (minimal, only if user-facing features changed significantly)
- Remove: legacy CSS variable aliases from `src/index.css` if all components migrated

- [ ] **Step 1: Remove legacy CSS variable aliases**

If all component references have been migrated, remove the `--neon-green`, `--danger`, `--cyan`, `--bg-dark`, `--bg-input`, `--text-dim` aliases from `:root` in `index.css`.

- [ ] **Step 2: Update CLAUDE.md**

Add to Architecture section:
- Scene layer stack description
- New components: MountainScene, SkyLayer, SceneHiker, AtmosphereCanvas, DangerOverlay
- New data: terrainProfiles.ts
- New hooks: useActionFeedback
- Art direction name: "Tactical Alpine Nightmare"
- Updated win rate target

- [ ] **Step 3: Update README.md if needed**

Add brief mention of visual overhaul under features if appropriate. Keep concise.

- [ ] **Step 4: Type check final state**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Final visual verification**

Start dev server: `npm run dev`
Full playthrough verification checklist:
- [ ] Title screen shows mountain + boot sequence + route drawing
- [ ] Mountain scene visible behind panels during gameplay
- [ ] Terrain bands visually distinct across route
- [ ] Sky changes with time-of-day
- [ ] Weather modes produce distinct atmosphere effects
- [ ] Lightning clusters during storms (infrequent, dramatic)
- [ ] Hiker shows condition modifiers (cold, wind, night, exhaustion)
- [ ] Action feedback visible on push/camp/injury/lost
- [ ] Danger overlays activate at correct vital thresholds
- [ ] Death screen freezes mountain, shows expedition report + run summary
- [ ] Victory screen uses earned green glow
- [ ] Tactical map shows danger-scaled routes and hazard zones
- [ ] Panels remain readable in all conditions
- [ ] No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: update CLAUDE.md and README.md for v3.0 visual overhaul

Tactical Alpine Nightmare art direction. New scene layer stack, atmosphere
system, danger overlays, action feedback, run summary. Win rate tuned to
<10%."
```

---

## Execution Notes

- **Visual checkpoint after Task 8:** Per spec guardrail, the mountain scene + layout must already feel like a major upgrade before proceeding to atmosphere. If it doesn't, iterate on terrain profiles and sky gradients.
- **Ralph Loop iteration:** After each phase commit, critically review the visual result. Ask: does this feel more alive, dangerous, memorable, premium? If not, iterate before moving on.
- **Performance monitoring:** After Task 9 (AtmosphereCanvas), check frame rate during blizzard weather. If drops below 30fps, reduce particle counts.
- **Backdrop-filter fallback:** If `backdrop-filter: blur(8px)` causes frame drops, replace with `background: rgba(13, 17, 23, 0.92)`.
- **No test framework:** Verification is `npx tsc --noEmit` + visual inspection. Type safety is the guardrail.
