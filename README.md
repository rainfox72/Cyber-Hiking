# Ao Tai Cyber-Hike | 鳌太线

A turn-based survival simulation of China's most dangerous ridge traverse — the Ao Tai Line (鳌太线), 80km through the Qinling Mountains from Tangkou (1,740m) to Baxian Platform (3,767m). Officially banned since 2018 due to numerous fatalities.

Built with React 19, Three.js, TypeScript, Zustand, and Ollama (Gemma4 27B).

## Features

- **13 real waypoints** along the actual Ao Tai route with authentic terrain and elevations
- **Full 3D tactical map** — Wireframe terrain with drag/zoom, dynamic weather, fog, lightning, and post-processing
- **Animated 3D hiker** — 11-joint skeleton, 9 poses, CRT glitch transitions
- **CRT vector art monitor** — Location-specific wireframe scenes on arrival, event illustrations
- **AI narration** — Local Ollama generates atmospheric descriptions; works fully offline with fallback narratives
- **AI auto-play** — Watch the AI attempt the traverse with strategic decision-making
- **Hardcore survival** — Manage energy, hydration, body temperature, O2 saturation, and morale
- **25 critical events** — Hypothermia, altitude sickness, whiteout, frostbite, trail collapse, and more
- **Two endings** — Escape (retreat to Tangkou) or Summit (reach Baxian Platform at 3,767m)
- **~15% AI summit rate** — Calibrated from 220+ automated playtest games
- **Procedural audio** — All sounds synthesized via Web Audio API, no audio files required

## Quick Start

```bash
npm install
npm run dev
```

Opens at [http://localhost:3100](http://localhost:3100).

### Windows

Double-click `start.bat`.

### Ollama Setup (optional)

AI narration requires [Ollama](https://ollama.com) running locally:

```bash
ollama pull gemma4:27b
ollama serve
```

If you see CORS errors, set `OLLAMA_ORIGINS=*` before running `ollama serve`.

The game works fully without Ollama — the header dot shows green (connected) or red (offline).

## How to Play

You are hiking the Ao Tai Line. Each turn you choose an action:

| Action | What it does | Time |
|--------|-------------|------|
| **Push Forward** | Advance to next waypoint (may get lost) | 3-5h |
| **Set Camp** | Major recovery, costs 1 food. Sleeps until dawn at night | 4-13h |
| **Descend** | Retreat to previous waypoint | 2h |
| **Check Map** | Reduces chance of getting lost | 1h |
| **Rest** | Minor recovery, costs 0.3L water | 2h |
| **Eat Ration** | Energy +50, Morale +8 | 0.5h |
| **Drink Water** | Hydration +40, Morale +3 | 0.5h |
| **Use Medicine** | Heals O2 or treats fall injury | 0.5h |

### Survival Tips

- **Eat and drink early** — starvation and dehydration trigger rapid cascading vital loss
- **Camp at shelters** — free food caches at 2900 Camp, Water Pit Camp, and 2800 Camp
- **Check your map** before pushing through fog or at night — getting lost can be fatal
- **Watch the weather** — blizzard and wind amplify all vital drain rates
- **Past waypoint 10 (South Heaven Gate), there is no retreat**

## The Route

```
塘口 Tangkou        1740m ── Start
西花沟 West Flower   2400m
2900营地 2900 Camp   2900m ── Shelter, food cache
盆景园 Bonsai Garden 3276m
导航架 Nav Tower     3431m ── Ridge begins
药王庙 Medicine King 3327m ── Stone sea
麦秸岭 Wheat Straw   3528m ── Exposed ridge
水窝子 Water Pit     3235m ── Shelter, water, food
飞机梁 Airplane Ridge 3400m ── Scree
2800营地 2800 Camp   2800m ── Shelter, food cache
南天门 South Heaven  3300m ── No retreat beyond
太白梁 Taibai Ridge  3523m
拔仙台 Baxian Tai    3767m ── Summit (goal)
```

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite 7
- **3D**: Three.js via React Three Fiber + drei + postprocessing
- **State**: Zustand 5
- **AI**: Ollama (Gemma4 27B) — local, async, non-blocking
- **Audio**: Web Audio API procedural synthesis
- **Engine**: Pure TypeScript game logic (zero React dependencies)

## Deploy to Vercel

```bash
npm run build    # outputs to dist/
```

The project is a static Vite SPA — deploy the `dist/` folder to any static host. For Vercel:

1. Connect the GitHub repo to [vercel.com](https://vercel.com)
2. Framework preset: **Vite**
3. Build command: `npm run build`
4. Output directory: `dist`

Note: Ollama narration requires a local server and won't work in a hosted deployment. The game falls back to built-in template narratives automatically.

## Historical Note

The 鳌太线 (Ao Tai Line) has been officially banned since 2018 due to numerous fatalities. This game is an educational simulation honoring the route's history and the extreme challenge it represents. 拔仙台 (Baxian Platform, 3,767m) is the highest point of the Qinling range.
