# Ao Tai Cyber-Hike — Task Tracker

## Phase 0: Project Scaffolding — COMPLETE

- [x] Initialize Vite + React + TypeScript project
- [x] Install Zustand dependency
- [x] Create folder structure (engine, data, store, services, components, hooks, utils)
- [x] Set up CSS theme (neon green/amber tactical palette)
- [x] Create DOC files (README, TASKS, CLAUDE_INSTRUCTIONS)
- [x] Static App.tsx shell with 3-panel layout

## Phase 1: Game Engine — COMPLETE

- [x] types.ts — All TypeScript interfaces
- [x] waypoints.ts — 13 real Ao Tai waypoints with elevations
- [x] events.ts — 15 critical events with weighted selection
- [x] weatherTransitions.ts — 7x7 Markov chain matrix
- [x] random.ts — Seeded PRNG (mulberry32)
- [x] riskCalculator.ts — Risk % formula (altitude + weather + vitals + night + terrain + gear)
- [x] weatherSystem.ts — Markov chain weather state machine with altitude modifiers
- [x] dayNightCycle.ts — Time tracking + temperature modifiers
- [x] vitalCalculator.ts — Vital drain/recovery per action + defeat conditions
- [x] gameEngine.ts — Core 12-step turn resolution pipeline

## Phase 2: Zustand Store + Core UI — COMPLETE

- [x] gameStore.ts — Zustand store wrapping engine with async Ollama narration
- [x] GameShell 3-panel CSS Grid layout (240px / 1fr / 220px)
- [x] Header with turn counter + Ollama status dot
- [x] StatusDashboard with 5 VitalBar components (color-coded, pulsing when critical)
- [x] InventoryPanel (food, water, gear, medicine)
- [x] NavigationConsole with 8 ActionButton components (disabled when invalid)
- [x] LogWindow with LogEntry components (auto-scroll, typewriter on latest)
- [x] Functional turn loop (click action -> engine update -> log entry -> narrative)

## Phase 3: Elevation Profile + HUD — COMPLETE

- [x] SVG ElevationProfile with bezier path, waypoint markers, glow filter, pulsing position dot
- [x] LocationInfo panel (waypoint name, Chinese name, elevation, terrain, camp/shelter status)
- [x] RiskMeter display (color-coded: green/amber/red)
- [x] WeatherDisplay (icon + condition + intensity + wind speed)
- [x] DayNightIndicator (day number, hour, period icon)

## Phase 4: Ollama Integration — COMPLETE

- [x] ollamaService.ts — HTTP client (POST to localhost:11434, 15s timeout, stream: false)
- [x] Prompt builder with context-aware injection (location, weather, vitals, events)
- [x] fallbackNarrator.ts — Template-based offline narratives (terrain x weather x action fragments)
- [x] OllamaPoller component — 30s health check, green/red status dot in header
- [x] Async non-blocking narration (game never waits for LLM response)

## Phase 5: Visual Effects — COMPLETE

- [x] Scanlines.tsx — CRT overlay with animated sweep line
- [x] useTypewriter hook — Character-by-character text reveal (25ms default)
- [x] Screen shake on critical events (CSS keyframes, 600ms duration)
- [x] ParticleCanvas.tsx — Canvas weather particles (snow, rain, fog, blizzard, wind, dust)
- [x] Night dimming overlay on particle canvas
- [x] Pulsing vital bars when value < 30% (pulse-danger animation)
- [x] SVG glow filter on elevation profile traveled path

## Phase 6: Game Screens + Polish — COMPLETE

- [x] TitleScreen with boot-up terminal animation (9 sequential boot lines)
- [x] ASCII mountain silhouette art
- [x] "PRESS ENTER TO BEGIN" with blinking cursor
- [x] GamePhase "title" state in store with startGame() transition
- [x] Enhanced defeat screen with static noise effect + "TRANSMISSION TERMINATED"
- [x] Enhanced victory screen with green glow pulse + "THE ROOF OF QINLING"
- [x] Structured stat displays on both game-over screens
- [x] start.bat Windows launcher
- [x] Final documentation update

## Phase 7: Component Extraction — COMPLETE

- [x] Extract VitalBar, StatusDashboard, InventoryPanel to separate files
- [x] Extract RiskMeter, WeatherDisplay, DayNightIndicator
- [x] Extract LogEntry, LogWindow, ActionButton, NavigationConsole
- [x] Extract Header, LocationInfo, GameOverlay, OllamaPoller
- [x] App.tsx reduced to thin shell (~80 lines)

## Phase 8: Hardcore Survival Mechanics — COMPLETE

- [x] Extended types: StatusEffect, exposure, campFatigueCount, wait action
- [x] Exposure system: hidden stat, ridge/summit accumulation, 2x/3x multipliers
- [x] Encumbrance system: weight thresholds at 15kg/20kg, time + energy penalties
- [x] 10 new hardcore events (25 total): gear tumble, whiteout, pulmonary edema, frostbite, trail collapse, lost trail, pack strap breaks, altitude insomnia, knee injury, memorial cairn
- [x] Integrated hardcore mechanics into game engine pipeline
  - Nightfall trap (forced bivouac crossing 19:00)
  - Camp fatigue (diminishing returns: 100%/60%/30%)
  - Persistent status effects (whiteout lock, edema drain, knee injury)
  - Resource decay at midnight (water evaporation, food spoilage)
  - No-retreat past waypoint 10 (point of no return)
  - Gear degradation cascade (low gear → bodyTemp/hydration penalties)
  - Food poisoning (15% chance on eat)
  - Morale collapse (recovery halved below 20%)
- [x] Day 4+ weather escalation (shift toward snow/blizzard/wind)
- [x] Zustand store: vitals jitter state, wait action support
- [x] Fog-of-war vitals jitter when morale < 40%

## Phase 9: Tactical Map + Atmosphere — COMPLETE

- [x] HumanMarker SVG component with bob animation and health-based color
- [x] TacticalMap with isometric contour rings, zoom (1-3x), diamond waypoint markers
- [x] CSS 3D perspective transform (rotateX 45° rotateZ -10°)
- [x] Replaced flat ElevationProfile with TacticalMap
- [x] Vignette overlay (tunnel vision as vitals drop, blue/red tinting)
- [x] SoundManager with Web Audio API procedural synthesis
  - UI sounds: click, alert, injury, boot sequence
  - Game sounds: footstep by terrain, campfire, eat/drink, thunder
  - Ambient loops: wind (altitude-scaled), altitude hum (>3200m)
- [x] Sound integration: action buttons, game events, title screen, ambient
- [x] Mute/unmute toggle with localStorage persistence
- [x] Wait action button in NavigationConsole
