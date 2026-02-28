# Ao Tai Cyber-Hike | 鳌太线

A turn-based survival simulation of the dangerous Ao Tai Line (鳌太线) — an 80km high-altitude ridge traverse in China's Qinling Mountains, from Tangkou (1,740m) to Baxian Platform (3,767m).

## Status

**v2.0 — High-Fidelity Tactical Survival Simulator**

## Features

- **Turn-based survival** — Manage energy, hydration, body temperature, O2 saturation, and morale
- **Real Ao Tai route** — 13 waypoints based on the actual trail (officially banned since 2018)
- **Tactical topo map** — Isometric contour lines with 1-3x zoom and diamond waypoint markers
- **Hardcore survival** — Sub-20% survival rate target with exposure, encumbrance, camp fatigue, and morale collapse
- **25 critical events** — Hypothermia, altitude sickness, whiteout, pulmonary edema, frostbite, gear failure, trail collapse, and more
- **Weather escalation** — Markov chain weather system with Day 4+ shift toward snow, blizzard, and wind
- **Dynamic weather** — Markov chain weather system: clear, fog, rain, snow, blizzard, wind
- **Risk engine** — Risk % calculated from altitude, weather, vitals, terrain, time of day
- **Dynamic vignette overlay** — Tunnel vision effect as vitals drop, with blue/red tinting
- **Procedural audio** — Web Audio API sound synthesis for footsteps, weather, UI, and ambient loops
- **Fog-of-war vitals** — Vitals display jitters when morale drops below 40%
- **AI narration** — Ollama (llama3.1:8b) generates atmospheric descriptions; offline fallback included
- **Tactical GPS aesthetic** — Dark mode, neon green/amber accents, scanlines, weather particles, typewriter text
- **Boot-up title screen** — Simulated terminal boot sequence with ASCII mountain art
- **Game over/victory screens** — Enhanced with static noise (defeat) and glow effects (victory)

## Tech Stack

- React 19 + TypeScript + Vite 7
- Zustand 5 (state management with selector subscriptions)
- Ollama llama3.1:8b (local AI narration, async non-blocking)
- Pure CSS/Canvas visual effects (scanlines, particles, screen shake, typewriter)
- Pure TS game engine (zero React deps, testable independently)

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Or double-click on Windows
start.bat
```

### Ollama Setup (optional, for AI narration)

```bash
# Install Ollama: https://ollama.com
ollama pull llama3.1:8b

# If CORS issues in browser, set:
# Windows: set OLLAMA_ORIGINS=*
# Linux/Mac: OLLAMA_ORIGINS=* ollama serve
```

The game works fully without Ollama — fallback narratives are built in. The header shows a green/red dot indicating Ollama connection status.

## Route: 鳌太线 (Ao Tai Line)

Standard west-to-east traverse:

```
塘口 (1740m) -> 西花沟 -> 2900营地 -> 盆景园 -> 导航架 (鳌山顶)
-> 药王庙 -> 麦秸梁 -> 水窝子 -> 飞机梁 -> 2800营地
-> 南天门 -> 太白梁 -> 拔仙台 (3767m)
```

Total: ~80km, 5-6 days, crossing multiple peaks above 3,400m.

## Controls

| Action | Effect | Time Cost |
|--------|--------|-----------|
| Push Forward | Advance to next waypoint | 3-5h |
| Set Camp | Rest and recover vitals (campable waypoints only) | 4h |
| Descend | Retreat to previous waypoint | 2h |
| Check Map | Reveal risk info for next segment | 1h |
| Rest | Partial energy recovery | 2h |
| Eat Ration | Energy +20, consumes 1 food | 0.5h |
| Drink Water | Hydration +25, consumes 0.5L | 0.5h |
| Use Medicine | O2 +15, temp normalize, consumes 1 dose | 0.5h |
| Wait | Endure whiteout conditions | 1h |

## Project Structure

```
src/
  engine/           # Pure TS game logic (types, gameEngine, risk, weather, vitals, dayNight)
  data/             # Waypoint data, events, weather transitions
  store/            # Zustand store (gameStore.ts)
  services/         # Ollama client, fallback narrator, SoundManager
  components/
    effects/        # Scanlines, ParticleCanvas, Vignette
    game/           # StatusDashboard, NavigationConsole, LogWindow, etc.
    map/            # TacticalMap, HumanMarker
    screens/        # TitleScreen
  hooks/            # useTypewriter
  utils/            # Seeded PRNG (random.ts)
DOC/                # README, TASKS, CLAUDE_INSTRUCTIONS
start.bat           # Windows launcher
```

## Architecture

- **Game Engine** — Pure TypeScript, no React imports. 12-step turn pipeline: validate -> time cost -> clock -> weather -> movement -> vitals -> risk -> events -> win check -> defeat check -> narrative -> log entry.
- **Store** — Zustand with selector-based subscriptions. Synchronous engine updates, async Ollama narration.
- **Visual Effects** — CSS scanlines overlay, HTML5 Canvas weather particles (snow/rain/fog/wind), CSS screen shake on critical events, typewriter hook for narrative text.
- **Ollama** — Async POST to localhost:11434/api/generate. Non-blocking: game never waits for AI. Falls back to template-based narratives on timeout/error.

## Historical Note

The 鳌太线 (Ao Tai Line) has been officially banned since 2018 due to numerous fatalities. This game is an educational simulation honoring the route's history and the challenge it represents. 拔仙台 (Baxian Platform, 3,767m) is the summit of Mount Taibai and the highest point of the entire Qinling range.
