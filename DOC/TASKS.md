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

## Phase 10: Oregon Trail Meets Death Stranding — COMPLETE

- [x] Background music (HTML5 Audio, loop, fade-in, mute toggle)
- [x] Starting supplies reduced (food 8→6, water 6→4L)
- [x] Camp recovery halved (energy +30→+15, fatigue 100/60/30→100/35/10)
- [x] Rest recovery halved (energy +15→+8)
- [x] Resource-dependent camp recovery (no food: ×0.3, no water: ×0.2)
- [x] Passive hydration drain on all actions (-2 per hour)
- [x] Passive energy drain at altitude (-1 per hour above 3000m)
- [x] Eat/drink boosted and made essential (+25/+30, morale bonuses)
- [x] Starvation cascade (food=0: energy -5, morale -3 per action)
- [x] Dehydration cascade (water=0: energy -8, bodyTemp -3, O2 -3 per action)
- [x] Morale isolation drain (-1 per action, Death Stranding loneliness)
- [x] Low morale movement penalty (+25% energy cost when morale < 40%)
- [x] Altitude O2 continuous drain (-2/-4/-6 per push above 3000/3400/3600m)
- [x] Weather force multiplier (blizzard/wind/snow extra drains)
- [x] lastAction tracking in store for hiker pose
- [x] NavigationConsole updated action descriptions
- [x] InventoryPanel resource warnings ([STARVING]/[DEHYDRATED] indicators)
- [x] Animated HumanMarker with 8 SVG poses (idle, walk, camp, eat, drink, rest, map, medicine)

## Phase 11: "The Mountain Doesn't Care" (v2.2) — COMPLETE

- [x] Expand tactical map area (flex-based height)
- [x] Fix vignette effect — shift clear zone to cover log area
- [x] Flip hiker walking direction to face right
- [x] Shorten Ollama narration to 1-2 sentences
- [x] Remove WAIT action (REST absorbs its role)
- [x] Smart camp duration (4h day / until-dawn night)
- [x] CHECK MAP overhaul — navigation accuracy mechanic
- [x] Getting lost system (10% base, terrain/weather/night modifiers)
- [x] Find-way-back mechanic (15% base, +25% per map check)
- [x] Fall/drop system (terrain-based, weather/night amplified)
- [x] Fall damage (50% vital reduction, fatal at avg ≤25%)
- [x] Fall recovery via medicine (+25% all vitals)
- [x] Lost map visualization (off-trail marker, pulsing ?, red tint)
- [x] Lost state action restrictions (no camp/descend when lost)
- [x] Updated navigation console descriptions and lost/injury banners
- [x] Sound triggers for lost/fall events

## Phase 12: "Visibility Patch" (v2.3) — COMPLETE

- [x] Vignette readability fix — raised radius thresholds (80/60/40%), reduced max opacity to 0.6
- [x] "Dying breath" overlay — 2s red flash showing death cause before SIGNAL LOST screen
- [x] Dying phase type extension (GamePhase "dying", dyingCause field, DefeatResult interface)
- [x] Death cause strings: EXHAUSTION, DEHYDRATION, HYPOTHERMIA, ALTITUDE SICKNESS, DESPAIR, FATAL FALL
- [x] Getting-lost probability reduced (6% base, 10% no-map penalty, -4% map bonus)
- [x] Bold "LOST" label on map replacing small "?"
- [x] Stronger red tint when lost (0.15 opacity, was 0.08)
- [x] Dashed red search radius ring around lost hiker
- [x] Cyberpunk hiker redesign — geometric polygon silhouettes replacing stick figures
- [x] Glitch scanline overlay on hiker (CRT/hologram effect, intensifies at low health)
- [x] Diamond-shaped scan field replacing circular glow ring
- [x] Signal corruption jitter animation at critically low health (<=10%)

## Phase 13: "Alternate Ending" (v2.4) — COMPLETE

- [x] Ending 1: Escape — descend to Tangkou after 4+ turns triggers bittersweet victory
- [x] Ending 2: Summit — existing Baxian Platform victory, now labeled "ENDING 2"
- [x] `endingType` field added to GameState, store, and overlay
- [x] Amber-toned escape victory screen (distinct from green summit screen)
- [x] Escape win condition: waypoint 0 + descend action + turnNumber >= 4

## Phase 14: "Balance + AI Auto-Play" (v2.5) — COMPLETE

- [x] Balance: Starting body temp 50 → 70
- [x] Balance: Camp body temp recovery (shelter 8→12, no-shelter 3→5)
- [x] Balance: Rest body temp recovery 3 → 5
- [x] Balance: Passive altitude energy drain halved (-1→-0.5/hour)
- [x] Balance: Weather force multiplier reduced (energy/temp -3→-2)
- [x] Balance: Camp fatigue 2nd camp 35% → 50% recovery
- [x] Balance: Hydration drain on push_forward -15 → -10
- [x] AI Decision Service: Ollama-powered action selection + heuristic fallback
- [x] AI Auto-Play: Store loop with 3.5s delay, auto-stop on game end
- [x] AI Log entries: [AI] prefix with cyan styling
- [x] AUTO button: Toggle in Navigation Console, dimmed manual buttons during auto-play
