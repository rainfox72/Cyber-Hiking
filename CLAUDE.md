# Ao Tai Cyber-Hike

Turn-based survival simulation of the 鳌太线 (Ao Tai Line): Vite 7 + React 19 + TypeScript + Zustand 5 + Ollama llama3.1:8b

## Commands

```bash
npm run dev          # Vite dev server on :5173
npx tsc --noEmit     # Type check (zero errors policy)
```

## Architecture

**Art direction:** "Tactical Alpine Nightmare" — muted military-green instrumentation over layered mountain vistas with atmospheric weather effects and danger overlays.

**Scene layer stack** (back to front): sky gradient → SVG mountain ridgelines → atmosphere canvas → danger overlays → floating panels → scanlines → modals

- `src/engine/` — Pure TS game logic (12-step turn pipeline, vitals, risk, weather, navigation, falls). Zero React deps.
- `src/data/` — Static data: waypoints (13 real Ao Tai stops), events (25), weather transitions (7x7 Markov chain), terrainProfiles (5 terrain bands, ridge profiles, sky gradients)
- `src/store/gameStore.ts` — Zustand: wraps engine, async Ollama narration, auto-play loop
- `src/services/` — Ollama HTTP client, fallback narrator, SoundManager (Web Audio API synthesis)
- `src/components/scene/` — MountainScene (5-layer SVG ridgelines), SkyLayer (terrain-driven gradients), SceneHiker (condition-reactive figure with headlamp/breath/summit pose)
- `src/components/effects/` — Scanlines, AtmosphereCanvas (7 weather modes, lightning), DangerOverlay (dominant-state hierarchy with frost/vignette/desaturation)
- `src/components/game/` — Status panels, navigation console, log, map, RunSummary (post-game stats), GameOverlay (action feedback)
- `src/components/screens/` — TitleScreen (mountain backdrop boot sequence)
- `src/components/map/` — TacticalMap (danger-scaled route, hazard zones, point-of-no-return marker)
- `src/hooks/` — useTypewriter (character-by-character text reveal), useActionFeedback (scene + UI action juice)
- `src/utils/` — random.ts (seeded PRNG), hikerPose.ts (condition-driven pose selection), runSummary.ts (post-game statistics)
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

## Internal Docs

Internal development docs (task tracker, design plans, legacy instructions) live in `.claude/docs/` — gitignored but locally accessible to Claude Code. Do NOT commit internal plans or task trackers to the public repo.

- `.claude/docs/TASKS.md` — Phase-based task tracker (16 phases)
- `.claude/docs/plans/` — 12+ design docs and implementation plans
- `.claude/docs/CLAUDE_INSTRUCTIONS_LEGACY.md` — Original project instructions (superseded by this file)

## Constants

- 13 waypoints: 塘口 (1740m) → 拔仙台 (3767m)
- Starting supplies: 14 food, 5L water, 80% gear, 2 medicine
- Food caches at shelter waypoints (+2 each), water resupply at stream valleys (refill to 6L)
- ~5% heuristic bot summit rate (validated from 500 simulations)

## Gotchas

- Weather uses Markov chain with Day 3+ escalation (half-strength Day 3, full Day 4+) toward snow/blizzard/wind
- Camp fatigue has diminishing returns (95%/30%/8% recovery on repeated camps)
- Rest shares camp fatigue counter — prevents 4x rest replacing 1x camp
- Getting lost: 5% base chance per push, modified by terrain/weather/night/map-checking
- Night penalties: +15% energy drain on push, -1 morale per action, +25% lost multiplier, +5% additive fall risk
- O2 baseline drops steeply above 3500m (1 per 25m vs 1 per 40m below)
- Altitude energy drain compounds with bad weather above 3500m
- Exposure accumulation rate increases above 3500m (proportional to elevation)
- No retreat past waypoint 10 (point of no return)
- Background music is gitignored (unattributed MP3) — game has full procedural audio fallback via Web Audio API
