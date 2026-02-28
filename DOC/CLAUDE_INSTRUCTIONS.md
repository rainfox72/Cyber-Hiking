# Ao Tai Cyber-Hike — Claude Instructions

## Project Overview

Turn-based survival simulation of the 鳌太线 (Ao Tai Line). React + Vite + TypeScript with Zustand state management and local Ollama AI narration.

## Architecture

- **Game engine** (`src/engine/`) — Pure TypeScript, zero React imports. All game logic is deterministic pure functions: `processAction(state, action) -> TurnResult`
- **Data** (`src/data/`) — Waypoints, events, weather transitions. Static data arrays/objects.
- **Store** (`src/store/`) — Zustand store wraps engine. Async Ollama calls happen here.
- **Services** (`src/services/`) — Ollama HTTP client, prompt builder, fallback narrator.
- **Components** (`src/components/`) — React UI. Read state from Zustand selectors. No game logic in components.
- **Hooks** (`src/hooks/`) — Visual effect hooks (typewriter, screen shake, particles, Ollama health).
- **Utils** (`src/utils/`) — Seeded PRNG, formatting helpers.

## Key Patterns

- Game state updates are synchronous (engine). Ollama narration is async (non-blocking).
- Zustand selectors prevent cross-panel re-renders.
- All vitals clamped 0-100. Inventory items clamped to min 0.
- Risk capped at 95%.
- Weather uses Markov chain transitions, altitude-modified.

## Route Data

Standard west-to-east 鳌太线: 13 waypoints from 塘口 (1740m) to 拔仙台 (3767m).
拔仙台 = 太白山顶 (same location, the Taibai summit).

## Testing

- Engine tests: `npx vitest run`
- Dev server: `npm run dev`
- All engine functions should be testable without React

## Styling

- CSS custom properties in `src/index.css`
- Tactical GPS aesthetic: dark (#0a0a0a), neon green (#00ff41), amber (#ffb000)
- Monospace font: Courier New / Consolas
- 3-panel CSS Grid layout

## Ollama

- Model: llama3.1:8b at http://localhost:11434/api/generate
- May need OLLAMA_ORIGINS=* for CORS
- Fallback narratives ensure offline play
