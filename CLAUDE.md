# Ao Tai Cyber-Hike

Turn-based survival simulation of the 鳌太线 (Ao Tai Line): Vite 7 + React 19 + TypeScript + Zustand 5 + Ollama Gemma4 27B

## Commands

```bash
npm run dev          # Vite dev server on :3100
npx tsc --noEmit     # Type check (zero errors policy)
```

## Architecture

- `src/engine/` — Pure TS game logic (12-step turn pipeline, vitals, risk, weather, navigation, falls). Zero React deps.
- `src/data/` — Static data: waypoints (13 real Ao Tai stops), events (25), weather transitions (7x7 Markov chain)
- `src/store/gameStore.ts` — Zustand: wraps engine, async Ollama narration, auto-play loop
- `src/services/` — Ollama HTTP client, fallback narrator, SoundManager (Web Audio API synthesis)
- `src/store/visualState.ts` — Derived visual state (VisualState interface, band mapping, fog/sky/lighting tables)
- `src/components/` — React UI (game panels, map, effects, screens)
  - `effects/Scanlines.tsx` — CRT scanline overlay
  - `effects/DangerOverlay.tsx` — CSS frost edges + panel border escalation
  - `effects/Skybox.tsx` — (retired from main flow, kept for title screen + WebGL fallback)
  - `map/TacticalMap3D.tsx` — SceneContent (all 3D scene children) + legacy panel fallback
  - `map/VisualStateBridge.tsx` — Sole Zustand subscriber for visual state, distributes via context + ref
  - `map/CameraDirector.tsx` — Action/state-aware camera with drag/zoom + impulse stack
  - `map/PostFXController.tsx` — EffectComposer: Bloom, Vignette, DOF, ChromaticAberration, Noise
  - `map/SceneAlerts.tsx` — 3D event warnings near hiker (OFF TRAIL, BLIZZARD, FALL, etc.)
  - `map/terrainMesh.ts` — Pure TS heightmap mesh generation from waypoint data
  - `map/TacticalMapLegacy.tsx` — Original SVG isometric map (WebGL fallback)
  - `map/hiker/` — 3D hiker rig: skeleton, pose table, animator, effects
  - `map/terrain/` — Procedural map details: vegetation, rocks, water, landmarks (MeshLambertMaterial)
  - `map/atmosphere/Skydome3D.tsx` — Gradient sky sphere + twinkling stars (replaces CSS Skybox)
  - `map/atmosphere/SceneLighting.tsx` — Ambient + directional lights, time/weather driven
  - `map/atmosphere/SceneFog.tsx` — FogExp2 continuous control
  - `map/atmosphere/WeatherParticles3D.tsx` — 3D weather: Points (snow/blizzard) + LineSegments (rain/wind)
  - `map/atmosphere/FogPlanes.tsx` — Rolling fog bank noise planes for fog/blizzard
  - `map/atmosphere/LightningController.tsx` — Event-driven storm lightning flashes
- `src/components/vector-terminal/` — CRT vector art popup system
  - `VectorTerminal.tsx` — Overlay component (lifecycle: boot → scene → fadeout, auto-dismiss ~4s)
  - `VectorTerminal.css` — CRT bezel frame, scanlines, fade animations
  - `VectorScene.tsx` — R3F renderer for scene definitions (orthographic camera, bloom postFX)
  - `sceneDefinitions.ts` — 13 location scenes + 12 event scenes (pure data)
  - `vectorPrimitives.tsx` — Reusable geometry: terrain, wireframe meshes, hiker, motion ghosts, rings
  - `types.ts` — VectorSceneDef, VectorElement, PopupRequest interfaces
- `src/components/map/MapHUD.tsx` — 2D tactical overlay (compass rose, scan metadata, direction arrow)
- `src/hooks/` — useTypewriter (character-by-character text reveal)
- `src/utils/random.ts` — Seeded PRNG (mulberry32)
- `scripts/` — Playtest bots (Ollama AI + heuristic)
- `configs/` — YAML configuration (if present)

## Key Patterns

- **Engine is pure math** — `processAction(state, action) -> TurnResult`, no React imports
- **12-step turn pipeline** — validate → time → clock → weather → movement → vitals → risk → events → win → defeat → narrative → log
- **Store drives everything** — synchronous engine updates, async Ollama narration (non-blocking)
- **Zustand selectors** — `useGameStore((s) => s.property)` prevents cross-panel re-renders
- **Ollama** — POST to `localhost:11434/api/generate`, 15s timeout, stream: false. Falls back to template narratives.
- **All vitals clamped 0-100**, inventory items clamped to min 0, risk capped at 95%
- **Auto-play** — Ollama AI decisions with heuristic fallback, 3.5s delay between turns
- **Full-bleed unified scene** — R3F Canvas fills viewport (z:0), DOM panels float over it (z:1) with `backdrop-filter: blur(8px)` and semi-transparent backgrounds. Retired CSS effects (Skybox, ParticleCanvas, TerrainAtmosphere, Vignette) replaced by in-scene equivalents.
- **VisualStateBridge pattern** — Single Zustand subscriber writes derived `VisualState` to a shared ref via React context. All atmosphere/scene children read the ref in `useFrame` — zero re-renders, zero additional subscriptions.
- **Terrain color compositor** — Single pipeline writes vertex colors once per frame: base elevation → band tinting → snow accumulation → rain darkening → lost-state red flicker. Prevents buffer stomping.
- **3D Map** — React Three Fiber with `frameloop="always"`, per-vertex elevation colors, CameraDirector (drag/zoom + action impulses + state mods), FogExp2, Skydome3D, SceneLighting, WeatherParticles3D, FogPlanes, LightningController, PostFXController (Bloom/Vignette/DOF/ChromAb/Noise), SceneAlerts (3D event text). Smooth movement animation (2.5s push, 1.5s descend), lost-state hiker displacement with pulsing search ring + DOF blur. Animated 3D hiker (11-joint skeleton, 9 poses, CRT glitch transitions, trail afterimages, radar ping). Procedural terrain details (instanced trees/rocks, grass, animated water ribbons, 6 landmark types) with band-aware density. Falls back to CSS atmosphere + SVG map on WebGL failure.
- **Map drag/zoom** — Left-click drag rotates orbit, scroll/pinch zooms (1.5-10x radius). Pure pointer math, no drei OrbitControls (known crash). Auto-orbit resumes from user's position after 4s inactivity. Action impulses layer on top. Camera lookAt offset (-0.6 Y) keeps hiker in upper viewport above log terminal.
- **Hiker orientation** — Hiker faces travel direction (toward next waypoint when idle, toward destination during movement). Walking animation (walkingA/walkingB) plays during waypoint transitions via React state `isMoving`.
- **CRT log terminal** — LogWindow wrapped in `.crt-monitor` bezel frame with scanline overlay, phosphor glow, SIGNAL RECV header, amber signal bars. Physical CRT monitor aesthetic.
- **Vector Terminal monitor** — Small CRT bezel monitor (320x240) in upper-right corner with secondary R3F Canvas (orthographic, bloom). Triggers on waypoint arrival (13 location scenes) and critical/major events (12 event scenes). Non-blocking — game continues while monitor shows. Lifecycle: boot text (500ms) → vector art scene (5s) → fade out (600ms). Click to dismiss early. Scene definitions are pure data (heightmaps, wireframe meshes, lines, points, hiker poses, rings). Store dispatches `activePopup` with timestamp-based dedup.
- **Map HUD overlay** — DOM overlay (z-index 1) with compass rose SVG, scan metadata (SCAN: 60Hz / RES / MODE / ALT), directional arrow (TOWARD PEAK), trail name label. All pointer-events: none.
- **3D waypoint labels** — drei `<Html>` labels at each waypoint showing Chinese name, English name, elevation. Nearby ±3 waypoints visible, current waypoint brighter/larger.

## Internal Docs

Internal development docs (task tracker, design plans, legacy instructions) live in `.claude/docs/` — gitignored but locally accessible to Claude Code. Do NOT commit internal plans or task trackers to the public repo.

- `.claude/docs/TASKS.md` — Phase-based task tracker (16 phases)
- `.claude/docs/plans/` — 12+ design docs and implementation plans
- `.claude/docs/CLAUDE_INSTRUCTIONS_LEGACY.md` — Original project instructions (superseded by this file)

## Constants

- 13 waypoints: 塘口 (1740m) → 拔仙台 (3767m)
- Starting supplies: 14 food, 5L water, 80% gear, 2 medicine
- Food caches at shelter waypoints (+2 each), water resupply at stream valleys (refill to 6L)
- ~15% AI summit rate (calibrated from 220+ Ollama playtest games)

## Gotchas

- Weather uses Markov chain with Day 4+ escalation shift toward snow/blizzard/wind
- Camp fatigue has diminishing returns (100%/35%/10% recovery on repeated camps)
- Rest shares camp fatigue counter — prevents 4x rest replacing 1x camp
- Getting lost: 6% base chance per push, modified by terrain/weather/night/map-checking
- No retreat past waypoint 10 (point of no return)
- Background music is gitignored (unattributed MP3) — game has full procedural audio fallback via Web Audio API
