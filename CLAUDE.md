# Ao Tai Cyber-Hike

Turn-based survival simulation of the 鳌太线 (Ao Tai Line): Vite 7 + React 19 + TypeScript + Zustand 5 + Ollama llama3.1:8b

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
- `src/components/` — React UI (game panels, map, effects, screens)
  - `effects/Skybox.tsx` — Time-of-day gradient backgrounds with star canvas (z-index: 0)
  - `effects/TerrainAtmosphere.tsx` — Terrain-type SVG noise/gradient overlays (z-index: 1)
  - `map/TacticalMap3D.tsx` — Three.js WebGL wireframe heightmap (replaces SVG map)
  - `map/terrainMesh.ts` — Pure TS heightmap mesh generation from waypoint data
  - `map/TacticalMapLegacy.tsx` — Original SVG isometric map (WebGL fallback)
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
- **Visual atmosphere layers** — Skybox (time-of-day gradients) + TerrainAtmosphere (terrain SVG noise) + TacticalMap3D (Three.js wireframe) compose via z-index stacking behind semi-transparent panels
- **3D Map** — React Three Fiber with `frameloop="always"`, per-vertex elevation colors, custom auto-orbit camera, fog/lost/reveal effects, smooth movement animation (2.5s push, 1.5s descend), lost-state hiker displacement with pulsing search ring. Falls back to SVG map on WebGL failure. Note: drei OrbitControls crashes R3F Canvas — drag/scale deferred.

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
