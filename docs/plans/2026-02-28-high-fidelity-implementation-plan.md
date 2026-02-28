# High-Fidelity Tactical Survival Simulator — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Ao Tai Cyber-Hike with a zoomable isometric topo map, hardcore survival mechanics (<20% survival rate), and atmospheric sound/visual effects.

**Architecture:** Approach B — Extract 12 inline components from App.tsx into separate files first, then build three new systems (TacticalMap, Hardcore Mechanics, Atmosphere) as clean modules. Pure TS engine additions stay React-free. Web Audio API for procedural sound.

**Tech Stack:** React 19 + TypeScript + Vite 7, Zustand 5, Web Audio API, SVG, CSS transforms

**Design Doc:** `docs/plans/2026-02-28-high-fidelity-upgrade-design.md`

---

## Phase 0: Component Extraction (Refactor)

### Task 0.1: Extract VitalBar and StatusDashboard

**Files:**
- Create: `src/components/game/VitalBar.tsx`
- Create: `src/components/game/StatusDashboard.tsx`
- Modify: `src/App.tsx`

**Step 1:** Create `src/components/game/VitalBar.tsx` — extract the `VitalBar` component (App.tsx lines 61-75) and the `vitalColor` helper (lines 23-27) into this file. Export both.

**Step 2:** Create `src/components/game/StatusDashboard.tsx` — extract the `StatusDashboard` component (App.tsx lines 104-119). Import `VitalBar` from `./VitalBar.tsx` and `useGameStore` from store.

**Step 3:** Update `src/App.tsx` — remove the extracted functions, import `StatusDashboard` from `./components/game/StatusDashboard.tsx`. Remove `VitalBar` and `vitalColor` definitions.

**Step 4:** Run `npx tsc --noEmit` — expected: zero errors.

**Step 5:** Verify in browser at localhost:5173 — vitals panel should render identically.

**Step 6:** Commit: `git add src/components/game/VitalBar.tsx src/components/game/StatusDashboard.tsx src/App.tsx && git commit -m "refactor: extract VitalBar and StatusDashboard components"`

### Task 0.2: Extract InventoryPanel, RiskMeter, WeatherDisplay, DayNightIndicator

**Files:**
- Create: `src/components/game/InventoryPanel.tsx`
- Create: `src/components/game/RiskMeter.tsx`
- Create: `src/components/game/WeatherDisplay.tsx`
- Create: `src/components/game/DayNightIndicator.tsx`
- Modify: `src/App.tsx`

**Step 1:** Extract each component from App.tsx into its own file:
- `InventoryPanel` (lines 77-102) — imports `useGameStore`, uses `vitalColor` (import from VitalBar)
- `RiskMeter` (lines 121-143) — imports `useGameStore`, `calculateRisk`, `WAYPOINTS`
- `WeatherDisplay` (lines 145-156) — imports `useGameStore`, uses `WEATHER_ICONS` (move to this file)
- `DayNightIndicator` (lines 158-167) — imports `useGameStore`, uses `TIME_ICONS` (move to this file)

**Step 2:** Update App.tsx — remove extracted components and their icon maps. Import from new files.

**Step 3:** Run `npx tsc --noEmit` — zero errors.

**Step 4:** Browser verify — left panel and bottom HUD render identically.

**Step 5:** Commit: `git add src/components/game/*.tsx src/App.tsx && git commit -m "refactor: extract InventoryPanel, RiskMeter, WeatherDisplay, DayNightIndicator"`

### Task 0.3: Extract LogEntry, LogWindow, ActionButton, NavigationConsole

**Files:**
- Create: `src/components/game/LogEntry.tsx`
- Create: `src/components/game/LogWindow.tsx`
- Create: `src/components/game/ActionButton.tsx`
- Create: `src/components/game/NavigationConsole.tsx`
- Modify: `src/App.tsx`

**Step 1:** Extract:
- `LogEntryComponent` (lines 169-184) — imports `useTypewriter`, `LogEntry` type
- `LogWindow` (lines 186-220) — imports `LogEntryComponent`, `useGameStore`
- `ActionButton` (lines 222-233) — imports `useGameStore`, `GameAction` type
- `NavigationConsole` (lines 235-244) — imports `ActionButton`, uses `ACTION_CONFIG` (move to this file)

**Step 2:** Update App.tsx — remove extracted, import from new files.

**Step 3:** Run `npx tsc --noEmit` — zero errors.

**Step 4:** Browser verify — log window and right panel render identically.

**Step 5:** Commit: `git commit -m "refactor: extract LogWindow, ActionButton, NavigationConsole"`

### Task 0.4: Extract Header, LocationInfo, GameOverlay, OllamaPoller

**Files:**
- Create: `src/components/game/Header.tsx`
- Create: `src/components/game/LocationInfo.tsx`
- Create: `src/components/game/GameOverlay.tsx`
- Create: `src/components/game/OllamaPoller.tsx`
- Modify: `src/App.tsx`

**Step 1:** Extract:
- `Header` (lines 319-335)
- `LocationInfo` (lines 299-317)
- `GameOverlay` (lines 337-415) — this is the enhanced version with static-noise, glow-pulse, stats rows
- `OllamaPoller` (lines ~390-401)

**Step 2:** App.tsx should now be a thin shell (~50 lines): imports + the `App` function composing extracted components.

**Step 3:** Run `npx tsc --noEmit` — zero errors.

**Step 4:** Full browser test — title screen boot, press Enter, game plays, all panels work.

**Step 5:** Commit: `git commit -m "refactor: extract remaining components, App.tsx is now a thin shell"`

---

## Phase 1: Type System & Engine Foundation

### Task 1.1: Extend types.ts with new fields

**Files:**
- Modify: `src/engine/types.ts`

**Step 1:** Add `"wait"` to the `GameAction` union (line 32-40):

```typescript
export type GameAction =
  | "push_forward"
  | "set_camp"
  | "descend"
  | "check_map"
  | "rest"
  | "eat"
  | "drink"
  | "use_medicine"
  | "wait";
```

**Step 2:** Add `StatusEffect` interface after `CriticalEvent` (after line 94):

```typescript
export interface StatusEffect {
  id: string;
  turnsRemaining: number;
  /** Additive vital deltas applied each turn start. */
  onTurnStart?: Partial<PlayerState>;
  /** Modifiers that affect action costs and availability. */
  modifiers?: {
    pushForwardEnergyCost?: number;
    disableActions?: boolean;
  };
}
```

**Step 3:** Add new fields to `PlayerState` (after line 71, before `isAlive`):

```typescript
  exposure: number;
  statusEffects: StatusEffect[];
  campFatigueCount: number;
  lastCampWaypoint: number;
```

**Step 4:** Run `npx tsc --noEmit` — expect errors in files that construct `PlayerState` (gameEngine.ts, gameStore.ts). This is expected and will be fixed in the next task.

**Step 5:** Commit: `git commit -m "feat: extend types with exposure, statusEffects, encumbrance, wait action"`

### Task 1.2: Update createInitialState and cloneState

**Files:**
- Modify: `src/engine/gameEngine.ts` (lines 53-88 for createInitialState, lines 254-265 for cloneState)

**Step 1:** Add new fields to `createInitialState()` player object (after line 68):

```typescript
      exposure: 0,
      statusEffects: [],
      campFatigueCount: 0,
      lastCampWaypoint: -1,
```

**Step 2:** Update `cloneState()` to deep-copy statusEffects (line 256):

```typescript
function cloneState(state: GameState): GameState {
  return {
    player: {
      ...state.player,
      statusEffects: state.player.statusEffects.map((e) => ({ ...e })),
    },
    weather: { ...state.weather },
    time: { ...state.time },
    turnNumber: state.turnNumber,
    log: [...state.log],
    gamePhase: state.gamePhase,
    defeatCause: state.defeatCause,
    mapRevealed: state.mapRevealed,
  };
}
```

**Step 3:** Add `"wait"` to `BASE_TIME_COSTS` (after line 36):

```typescript
  wait: 1,
```

**Step 4:** Add `"wait"` case to `validateAction()` (before `default:` on line 129):

```typescript
    case "wait":
      return state.player.statusEffects.some(
        (e) => e.modifiers?.disableActions,
      );
```

**Step 5:** Add `"wait"` to `actionLabels` in `createLogEntry` (line 161):

```typescript
    wait: "Wait",
```

**Step 6:** Add `"wait"` to `generateNarrative` switch (before `default:` on line 215):

```typescript
    case "wait":
      return "You hunker down and wait for the whiteout to pass. Visibility: zero.";
```

**Step 7:** Run `npx tsc --noEmit` — expect fewer errors (gameStore.ts may still error). Fix any remaining.

**Step 8:** Commit: `git commit -m "feat: update initial state and validation for new mechanics"`

### Task 1.3: Create exposureSystem.ts

**Files:**
- Create: `src/engine/exposureSystem.ts`

**Step 1:** Create the file:

```typescript
/**
 * Exposure system for the Ao Tai Cyber-Hike.
 * Tracks cumulative exposure to harsh ridge conditions.
 * Hidden from UI — affects bodyTemp and energy drain multipliers.
 */

import type { GameAction, GameState, TerrainType, WeatherCondition } from "./types.ts";

/** Terrain types that accumulate exposure. */
const EXPOSED_TERRAIN: TerrainType[] = ["ridge", "summit"];

/** Weather conditions that accumulate exposure. */
const EXPOSURE_WEATHER: WeatherCondition[] = ["blizzard", "wind", "snow"];

/**
 * Calculates the new exposure value after an action.
 * Accumulates on exposed terrain in harsh weather; decays during rest/camp.
 */
export function updateExposure(
  state: GameState,
  action: GameAction,
  terrain: TerrainType,
  shelterAvailable: boolean,
): number {
  let exposure = state.player.exposure;

  const isExposedTerrain = EXPOSED_TERRAIN.includes(terrain);
  const isHarshWeather = EXPOSURE_WEATHER.includes(state.weather.current);

  if (isExposedTerrain && isHarshWeather) {
    exposure += 15 * state.weather.intensity;
  }

  // Decay during rest/camp
  if (action === "set_camp") {
    exposure -= shelterAvailable ? 25 : 20;
  } else if (action === "rest") {
    exposure -= 5;
  }

  return Math.min(Math.max(exposure, 0), 100);
}

/**
 * Returns the bodyTemp drain multiplier based on current exposure.
 * 1x = normal, 2x = moderate exposure, 3x = severe.
 */
export function getExposureTempMultiplier(exposure: number): number {
  if (exposure > 60) return 3;
  if (exposure > 30) return 2;
  return 1;
}

/**
 * Returns the energy drain multiplier based on current exposure.
 * 1x = normal, 2x = extreme exposure (>80).
 */
export function getExposureEnergyMultiplier(exposure: number): number {
  if (exposure > 80) return 2;
  return 1;
}
```

**Step 2:** Run `npx tsc --noEmit` — zero errors (this is a standalone module).

**Step 3:** Commit: `git commit -m "feat: add exposure system for ridge hazard tracking"`

### Task 1.4: Create encumbrance.ts

**Files:**
- Create: `src/engine/encumbrance.ts`

**Step 1:** Create the file:

```typescript
/**
 * Encumbrance system for the Ao Tai Cyber-Hike.
 * Calculates total pack weight and its effect on travel speed and energy.
 */

import type { PlayerState } from "./types.ts";

/** Weight constants in kilograms. */
const WEIGHT_PER_FOOD = 0.4;
const WEIGHT_PER_WATER_LITER = 1.0;
const WEIGHT_PER_MEDICINE = 0.2;
const BASE_GEAR_WEIGHT = 5.0;

/** Encumbrance thresholds. */
const THRESHOLD_HEAVY = 15;
const THRESHOLD_OVERBURDENED = 20;

/**
 * Calculates the total weight the player is carrying in kg.
 */
export function calculateWeight(player: PlayerState): number {
  return (
    player.food * WEIGHT_PER_FOOD +
    player.water * WEIGHT_PER_WATER_LITER +
    player.medicine * WEIGHT_PER_MEDICINE +
    BASE_GEAR_WEIGHT
  );
}

/**
 * Returns extra hours added to push_forward travel time due to weight.
 * 0h under 15kg, +1h at 15-20kg, +2h over 20kg.
 */
export function getEncumbranceTimePenalty(player: PlayerState): number {
  const weight = calculateWeight(player);
  if (weight > THRESHOLD_OVERBURDENED) return 2;
  if (weight > THRESHOLD_HEAVY) return 1;
  return 0;
}

/**
 * Returns extra energy drained per push_forward due to weight.
 * 0 under 15kg, +5 at 15-20kg, +10 over 20kg.
 */
export function getEncumbranceEnergyPenalty(player: PlayerState): number {
  const weight = calculateWeight(player);
  if (weight > THRESHOLD_OVERBURDENED) return 10;
  if (weight > THRESHOLD_HEAVY) return 5;
  return 0;
}
```

**Step 2:** Run `npx tsc --noEmit` — zero errors.

**Step 3:** Commit: `git commit -m "feat: add encumbrance system with weight thresholds"`

### Task 1.5: Add 10 new hardcore events to events.ts

**Files:**
- Modify: `src/data/events.ts`

**Step 1:** Add 10 new events to `EVENT_CATALOG` array (after the existing `rope_section` entry, before the closing `];` on line 135). Each event follows the existing `CriticalEvent` interface:

```typescript
  {
    id: "gear_tumble",
    name: "Gear Tumble",
    description: "A misstep sends your pack tumbling down the slope. Supplies scatter across the rocks below.",
    effects: { food: -2 },
    severity: "critical",
  },
  {
    id: "whiteout_event",
    name: "Total Whiteout",
    description: "Snow and fog merge into a featureless white void. You cannot move — you must wait it out.",
    effects: { morale: -15 },
    severity: "critical",
  },
  {
    id: "pulmonary_edema",
    name: "Pulmonary Edema",
    description: "A wet, rattling cough. Fluid is filling your lungs. Each breath is a drowning struggle.",
    effects: { energy: -30, o2Saturation: -20 },
    severity: "critical",
  },
  {
    id: "frostbite",
    name: "Frostbite",
    description: "Your fingers and toes turn waxy white. The numbness gives way to searing pain as tissue dies.",
    effects: { gear: -30, energy: -10, bodyTemp: -15 },
    severity: "major",
  },
  {
    id: "trail_collapse",
    name: "Trail Collapse",
    description: "The path crumbles beneath your feet. You slide downhill, clawing at loose earth and rock.",
    effects: { energy: -20, morale: -20 },
    severity: "major",
  },
  {
    id: "lost_trail",
    name: "Lost Trail",
    description: "The trail vanishes into a maze of identical boulder fields. Hours pass before you find the route.",
    effects: { energy: -15, morale: -10 },
    severity: "major",
  },
  {
    id: "pack_strap_breaks",
    name: "Pack Strap Breaks",
    description: "A shoulder strap snaps under the weight. Food spills from the top compartment as you scramble to catch it.",
    effects: { food: -1, gear: -15 },
    severity: "major",
  },
  {
    id: "altitude_insomnia",
    name: "Altitude Insomnia",
    description: "The thin air makes sleep impossible. You lie awake gasping, drifting between consciousness and panic.",
    effects: { energy: -10, morale: -5 },
    severity: "minor",
  },
  {
    id: "knee_injury",
    name: "Knee Injury",
    description: "A sharp pop in your knee followed by swelling. Every downward step sends lightning through the joint.",
    effects: { energy: -15 },
    severity: "major",
  },
  {
    id: "companion_warning",
    name: "Memorial Cairn",
    description: "A pile of stones with a faded photo and dates. Someone else did not make it past this point.",
    effects: { morale: -5 },
    severity: "minor",
  },
```

**Step 2:** Add corresponding weight entries to `EVENT_WEIGHTS` (after `rope_section` entry):

```typescript
  gear_tumble: {
    baseWeight: 3,
    weatherBonus: { wind: 4 },
    terrainBonus: { scree: 8, ridge: 6, stone_sea: 4 },
  },
  whiteout_event: {
    baseWeight: 1,
    weatherBonus: { blizzard: 12, snow: 8, fog: 6 },
    terrainBonus: { ridge: 4, summit: 4 },
  },
  pulmonary_edema: {
    baseWeight: 1,
    weatherBonus: {},
    terrainBonus: { summit: 10, ridge: 8 },
  },
  frostbite: {
    baseWeight: 2,
    weatherBonus: { blizzard: 10, snow: 6 },
    terrainBonus: { ridge: 4, summit: 3 },
  },
  trail_collapse: {
    baseWeight: 2,
    weatherBonus: { rain: 6 },
    terrainBonus: { scree: 8, stone_sea: 6, ridge: 3 },
  },
  lost_trail: {
    baseWeight: 2,
    weatherBonus: { fog: 10 },
    terrainBonus: { stone_sea: 4, scree: 3 },
  },
  pack_strap_breaks: {
    baseWeight: 2,
    weatherBonus: { wind: 4 },
    terrainBonus: { ridge: 4, scree: 3 },
  },
  altitude_insomnia: {
    baseWeight: 3,
    weatherBonus: {},
    terrainBonus: { summit: 5, ridge: 4 },
  },
  knee_injury: {
    baseWeight: 2,
    weatherBonus: { rain: 2 },
    terrainBonus: { scree: 6, stone_sea: 5 },
  },
  companion_warning: {
    baseWeight: 3,
    weatherBonus: {},
    terrainBonus: { ridge: 4, summit: 6 },
  },
```

**Step 3:** Run `npx tsc --noEmit` — zero errors.

**Step 4:** Commit: `git commit -m "feat: add 10 hardcore events (25 total)"`

### Task 1.6: Integrate hardcore mechanics into game engine pipeline

**Files:**
- Modify: `src/engine/gameEngine.ts`
- Modify: `src/engine/vitalCalculator.ts`

This is the biggest task. Integrate all new systems into the turn pipeline.

**Step 1:** Add imports to `gameEngine.ts` (after line 22):

```typescript
import { updateExposure, getExposureTempMultiplier, getExposureEnergyMultiplier } from "./exposureSystem.ts";
import { getEncumbranceTimePenalty, getEncumbranceEnergyPenalty } from "./encumbrance.ts";
import type { StatusEffect } from "./types.ts";
```

**Step 2:** Add `"wait"` handling to the `processAction` pipeline. After step 1 (validate), add whiteout/status-effect awareness:

In step 2 (time cost, around line 308), add encumbrance penalty:

```typescript
  // 2. Calculate time cost
  const currentWaypoint = waypoints[newState.player.currentWaypointIndex];
  let timeCost: number;
  if (action === "push_forward") {
    timeCost = PUSH_FORWARD_TIME[currentWaypoint.terrain];
    timeCost += getEncumbranceTimePenalty(newState.player);
  } else {
    timeCost = BASE_TIME_COSTS[action];
  }
```

**Step 3:** After step 3 (advance clock), add nightfall trap check. Insert after line 315:

```typescript
  // 3b. Nightfall trap — if push_forward crosses into night (19:00)
  const crossedIntoNight =
    action === "push_forward" &&
    previousState.time.hour < 19 &&
    newState.time.hour >= 19;
  if (crossedIntoNight) {
    newState.player.bodyTemp -= 20;
    newState.player.morale -= 15;
    newState.player.energy -= 10;
    const bivouacEntry: LogEntry = {
      turnNumber: newState.turnNumber,
      text: "[FORCED BIVOUAC] Nightfall caught you between waypoints. You spend a miserable night exposed on the mountain.",
      type: "event",
      timestamp: formatTimestamp(newState.time.day, newState.time.hour),
    };
    newState.log.push(bivouacEntry);
  }
```

**Step 4:** After step 5 (movement), add camp fatigue tracking. Insert after the movement block:

```typescript
  // 5b. Camp fatigue tracking
  if (action === "set_camp" || action === "rest") {
    if (newState.player.lastCampWaypoint === newState.player.currentWaypointIndex) {
      newState.player.campFatigueCount += 1;
    } else {
      newState.player.campFatigueCount = 1;
      newState.player.lastCampWaypoint = newState.player.currentWaypointIndex;
    }
  } else if (action === "push_forward" || action === "descend") {
    newState.player.campFatigueCount = 0;
  }
```

**Step 5:** After step 6 (vital changes), add exposure update and status effect processing:

```typescript
  // 6b. Update exposure
  const wpForExposure = waypoints[newState.player.currentWaypointIndex];
  newState.player.exposure = updateExposure(
    newState, action, wpForExposure.terrain, wpForExposure.shelterAvailable,
  );

  // 6c. Apply persistent status effects
  newState.player.statusEffects = newState.player.statusEffects
    .map((effect) => {
      // Apply per-turn effects
      if (effect.onTurnStart) {
        for (const [key, value] of Object.entries(effect.onTurnStart)) {
          const k = key as keyof typeof newState.player;
          if (typeof newState.player[k] === "number" && typeof value === "number") {
            (newState.player[k] as number) += value;
          }
        }
      }
      return { ...effect, turnsRemaining: effect.turnsRemaining - 1 };
    })
    .filter((effect) => effect.turnsRemaining > 0);

  // 6d. Resource decay at midnight
  const crossedMidnight = previousState.time.day < newState.time.day;
  if (crossedMidnight) {
    newState.player.water = Math.max(0, newState.player.water - 0.2);
    if (rng.chance(0.3)) {
      newState.player.food = Math.max(0, newState.player.food - 1);
    }
  }
```

**Step 6:** In step 8 (events), add whiteout and knee injury status-effect creation. After the existing event application (line 370), add:

```typescript
    // Apply status effects from special events
    if (event.id === "whiteout_event") {
      newState.player.statusEffects.push({
        id: "whiteout",
        turnsRemaining: 1,
        modifiers: { disableActions: true },
      });
    } else if (event.id === "pulmonary_edema") {
      newState.player.statusEffects.push({
        id: "pulmonary_edema",
        turnsRemaining: 3,
        onTurnStart: { energy: -10 },
      });
    } else if (event.id === "knee_injury") {
      newState.player.statusEffects.push({
        id: "knee_injury",
        turnsRemaining: 3,
        modifiers: { pushForwardEnergyCost: 15 },
      });
    } else if (event.id === "trail_collapse") {
      // Forced descend
      if (newState.player.currentWaypointIndex > 0) {
        newState.player.currentWaypointIndex -= 1;
      }
    } else if (event.id === "gear_tumble") {
      // Randomly lose food or water
      if (rng.chance(0.5)) {
        newState.player.water = Math.max(0, newState.player.water - 1);
      }
    }
```

**Step 7:** In `validateAction`, add no-retreat-from-summit-push (descend case, around line 107):

```typescript
    case "descend":
      // Cannot descend below first waypoint or past point-of-no-return (waypoint 10+)
      return state.player.currentWaypointIndex > 0 &&
        state.player.currentWaypointIndex <= 10;
```

**Step 8:** In `validateAction`, disable all actions except wait when whiteout active. Add at the top of the function (after line 99):

```typescript
  // Whiteout: only wait is allowed
  const hasWhiteout = state.player.statusEffects.some(
    (e) => e.modifiers?.disableActions,
  );
  if (hasWhiteout && action !== "wait") return false;
```

**Step 9:** Now update `vitalCalculator.ts`. Import new systems at the top:

```typescript
import { getExposureTempMultiplier, getExposureEnergyMultiplier } from "./exposureSystem.ts";
import { getEncumbranceEnergyPenalty } from "./encumbrance.ts";
```

**Step 10:** In `applyVitalChanges`, modify the `push_forward` case to apply exposure/encumbrance/gear-cascade multipliers:

```typescript
    case "push_forward": {
      const terrainCost = TERRAIN_ENERGY_COST[waypoint.terrain];
      const exposureEnergyMult = getExposureEnergyMultiplier(player.exposure);
      const encumbrancePenalty = getEncumbranceEnergyPenalty(player);
      const kneeInjuryPenalty = state.player.statusEffects
        .filter((e) => e.modifiers?.pushForwardEnergyCost)
        .reduce((sum, e) => sum + (e.modifiers!.pushForwardEnergyCost ?? 0), 0);

      player.energy -= (terrainCost + encumbrancePenalty + kneeInjuryPenalty) * exposureEnergyMult;
      player.hydration -= 10;
      player.gear -= 3;

      // Gear degradation cascade
      if (player.gear < 30) player.bodyTemp -= 5;
      if (player.gear < 10) player.hydration -= 5;

      // Body temp with exposure multiplier
      const exposureTempMult = getExposureTempMultiplier(player.exposure);
      player.bodyTemp += bodyTempDelta * 0.4 * exposureTempMult;

      player.o2Saturation += (o2Baseline - player.o2Saturation) * 0.3;
      break;
    }
```

**Step 11:** In the `set_camp` case, apply camp fatigue:

```typescript
    case "set_camp": {
      // Camp fatigue: diminishing returns
      const fatigueMultiplier =
        state.player.campFatigueCount <= 1 ? 1.0 :
        state.player.campFatigueCount === 2 ? 0.6 : 0.3;

      // Morale collapse halves recovery
      const moraleCollapseMult = player.morale < 20 ? 0.5 : 1.0;
      const recoveryMult = fatigueMultiplier * moraleCollapseMult;

      player.energy += 30 * recoveryMult;
      if (waypoint.shelterAvailable) {
        player.bodyTemp += 15 * recoveryMult;
      } else {
        player.bodyTemp += 5 * recoveryMult;
      }
      player.bodyTemp += (50 - player.bodyTemp) * 0.1;
      break;
    }
```

**Step 12:** In the `rest` case, apply morale collapse:

```typescript
    case "rest": {
      const moraleCollapseMult = player.morale < 20 ? 0.5 : 1.0;
      player.energy += 15 * moraleCollapseMult;
      player.bodyTemp += 5;
      player.bodyTemp += (50 - player.bodyTemp) * 0.05;
      break;
    }
```

**Step 13:** In the `eat` case, add food poisoning chance:

```typescript
    case "eat": {
      if (player.food > 0) {
        // 15% food poisoning chance
        // Use a simple deterministic check based on turn number
        const poisoned = (state.turnNumber * 7 + player.food * 13) % 100 < 15;
        if (poisoned) {
          player.energy -= 10;
        } else {
          player.energy += 20;
        }
        player.food -= 1;
      }
      break;
    }
```

**Step 14:** Add `"wait"` case to the switch:

```typescript
    case "wait": {
      player.energy -= 3;
      player.hydration -= 2;
      break;
    }
```

**Step 15:** Run `npx tsc --noEmit` — zero errors.

**Step 16:** Commit: `git commit -m "feat: integrate all hardcore mechanics into game engine pipeline"`

### Task 1.7: Add weather escalation to weatherSystem.ts

**Files:**
- Modify: `src/engine/weatherSystem.ts`

**Step 1:** Read current `rollWeather` function signature. It currently takes `(current: WeatherState, altitude: number, rng: RNG)`. Add a `day` parameter:

```typescript
export function rollWeather(
  current: WeatherState,
  altitude: number,
  rng: RNG,
  day: number = 1,
): WeatherState {
```

**Step 2:** Inside `rollWeather`, after the existing high-altitude shift, add Day 4+ escalation:

```typescript
  // Day 4+ weather escalation
  if (day >= 4) {
    for (const condition of HIGH_ALTITUDE_REDUCED) {
      probs[condition] = Math.max(0, probs[condition] - 0.075);
    }
    for (const condition of HIGH_ALTITUDE_FAVORED) {
      probs[condition] += 0.05;
    }
    // Renormalize
    const escalationTotal = Object.values(probs).reduce((s, p) => s + p, 0);
    for (const key of Object.keys(probs) as WeatherCondition[]) {
      probs[key] /= escalationTotal;
    }
  }
```

**Step 3:** Update the call site in `gameEngine.ts` `processAction` (line ~318) to pass day:

```typescript
  newState.weather = rollWeather(
    newState.weather,
    currentWaypoint.elevation,
    rng,
    newState.time.day,
  );
```

**Step 4:** Run `npx tsc --noEmit` — zero errors.

**Step 5:** Commit: `git commit -m "feat: add Day 4+ weather escalation"`

### Task 1.8: Update Zustand store for new mechanics

**Files:**
- Modify: `src/store/gameStore.ts`

**Step 1:** Add `"wait"` to the action config in `NavigationConsole.tsx` (or wherever ACTION_CONFIG was moved):

```typescript
  { action: "wait", label: "WAIT", cost: "1h | Endure the whiteout" },
```

**Step 2:** In `gameStore.ts`, add `vitalsJitter` UI state to the store interface and implementation. This is for the fog-of-war on vitals display:

```typescript
  // In interface GameStore, add:
  vitalsJitter: Record<string, number>;

  // In the store creation, add initial:
  vitalsJitter: {},

  // In initGame/startGame, add:
  vitalsJitter: {},
```

**Step 3:** In `performAction`, after the engine processes, compute jitter if morale < 40:

```typescript
      // Fog of war: jitter vitals display when morale is low
      const jitter: Record<string, number> = {};
      if (result.newState.player.morale < 40) {
        for (const vital of ["energy", "hydration", "bodyTemp", "o2Saturation", "morale"]) {
          jitter[vital] = (Math.random() - 0.5) * 20; // ±10
        }
      }

      set({
        ...stateFromGameState(result.newState),
        isProcessing: false,
        lastRiskPercent: result.riskPercent,
        lastEvents: result.events,
        isShaking: hasEvents,
        vitalsJitter: jitter,
      });
```

**Step 4:** Run `npx tsc --noEmit` — zero errors.

**Step 5:** Commit: `git commit -m "feat: update store for wait action and vitals jitter"`

---

## Phase 2: Tactical Topo Map

### Task 2.1: Create HumanMarker.tsx

**Files:**
- Create: `src/components/map/HumanMarker.tsx`

**Step 1:** Create the SVG hiking figure component:

```typescript
/**
 * Animated SVG hiking figure marker for the TacticalMap.
 * Bobs up and down, color shifts with health status.
 */

interface HumanMarkerProps {
  x: number;
  y: number;
  healthPercent: number; // 0-100, average of vitals
}

export function HumanMarker({ x, y, healthPercent }: HumanMarkerProps) {
  const color =
    healthPercent > 60 ? "var(--neon-green)" :
    healthPercent > 30 ? "var(--amber)" :
    "var(--danger)";

  return (
    <g
      className="human-marker"
      transform={`translate(${x}, ${y})`}
      style={{ transition: "transform 1.2s ease-in-out" }}
    >
      {/* Head */}
      <circle cx="0" cy="-12" r="3" fill={color} />
      {/* Body */}
      <line x1="0" y1="-9" x2="0" y2="0" stroke={color} strokeWidth="2" />
      {/* Arms */}
      <line x1="-4" y1="-6" x2="4" y2="-6" stroke={color} strokeWidth="1.5" />
      {/* Legs */}
      <line x1="0" y1="0" x2="-3" y2="6" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="3" y2="6" stroke={color} strokeWidth="1.5" />
      {/* Backpack */}
      <rect x="1" y="-9" width="3" height="5" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
      {/* Pulsing glow */}
      <circle cx="0" cy="-3" r="8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4">
        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}
```

**Step 2:** Add CSS for the bobbing animation in `src/App.css`:

```css
.human-marker {
  animation: marker-bob 1.5s ease-in-out infinite;
}

@keyframes marker-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
```

Note: The `transform` in the SVG `<g>` sets position, the CSS animation adds the bob. This approach is correct because the `<g>` element's `transform` attribute handles positioning while the CSS animation class handles the bob (they compose).

**Step 3:** Run `npx tsc --noEmit` — zero errors.

**Step 4:** Commit: `git commit -m "feat: add HumanMarker SVG component with bob animation"`

### Task 2.2: Create TacticalMap.tsx

**Files:**
- Create: `src/components/map/TacticalMap.tsx`

**Step 1:** Create the main topo map component. This is a large component — key features:

- SVG viewBox of 600x300 with contour lines
- CSS isometric transform on container
- Zoom state (1, 2, 3) with scroll wheel handler
- Contour ring generation: for each waypoint, draw 2-3 concentric ellipses whose radii scale inversely with elevation (higher = tighter contours)
- Trail polyline connecting waypoints
- Waypoint diamond markers with labels
- HumanMarker at current position

The waypoint positions on the map should be laid out left-to-right based on `distanceFromStart`, with Y position based on elevation (higher = further up on the map).

```typescript
/**
 * TacticalMap — Isometric contour map replacing the flat elevation profile.
 * Shows the full Ao Tai route with topographic contour rings,
 * trail line, waypoint markers, and animated human marker.
 */

import { useState, useMemo, useCallback } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import { HumanMarker } from "./HumanMarker.tsx";

const VIEW_W = 600;
const VIEW_H = 300;
const PADDING = 40;
const MAX_DIST = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
const MIN_ELEV = 1500;
const MAX_ELEV = 4000;

function toMapX(km: number): number {
  return PADDING + ((km / MAX_DIST) * (VIEW_W - PADDING * 2));
}

function toMapY(elev: number): number {
  return VIEW_H - PADDING - (((elev - MIN_ELEV) / (MAX_ELEV - MIN_ELEV)) * (VIEW_H - PADDING * 2));
}

/** Generate contour ellipses for a waypoint based on its prominence. */
function generateContours(x: number, y: number, elevation: number) {
  const prominence = (elevation - MIN_ELEV) / (MAX_ELEV - MIN_ELEV);
  const rings = prominence > 0.6 ? 4 : prominence > 0.3 ? 3 : 2;
  const baseRx = 18 - prominence * 8; // tighter for higher peaks
  const baseRy = baseRx * 0.6; // squash vertically for perspective

  return Array.from({ length: rings }, (_, i) => {
    const scale = 1 + i * 0.5;
    return { rx: baseRx * scale, ry: baseRy * scale, opacity: 0.3 - i * 0.06 };
  });
}

export function TacticalMap() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);

  const [zoomLevel, setZoomLevel] = useState(1);

  const healthPercent = useMemo(
    () => (energy + hydration + bodyTemp + o2 + morale) / 5,
    [energy, hydration, bodyTemp, o2, morale],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoomLevel((z) => {
      if (e.deltaY < 0) return Math.min(z + 1, 3);
      return Math.max(z - 1, 1);
    });
  }, []);

  // Current waypoint position for zoom focus
  const focusX = toMapX(WAYPOINTS[currentIndex].distanceFromStart);
  const focusY = toMapY(WAYPOINTS[currentIndex].elevation);

  // Compute viewBox based on zoom
  const vbW = VIEW_W / zoomLevel;
  const vbH = VIEW_H / zoomLevel;
  const vbX = Math.max(0, Math.min(focusX - vbW / 2, VIEW_W - vbW));
  const vbY = Math.max(0, Math.min(focusY - vbH / 2, VIEW_H - vbH));

  // Trail polyline points
  const trailPoints = WAYPOINTS.map(
    (wp) => `${toMapX(wp.distanceFromStart)},${toMapY(wp.elevation)}`,
  ).join(" ");

  const traversedPoints = WAYPOINTS.slice(0, currentIndex + 1)
    .map((wp) => `${toMapX(wp.distanceFromStart)},${toMapY(wp.elevation)}`)
    .join(" ");

  return (
    <div className="tactical-map" onWheel={handleWheel}>
      <div className="tactical-map__zoom-controls">
        <button onClick={() => setZoomLevel((z) => Math.min(z + 1, 3))}>+</button>
        <span>{zoomLevel}x</span>
        <button onClick={() => setZoomLevel((z) => Math.max(z - 1, 1))}>-</button>
      </div>
      <div className="tactical-map__perspective">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          className="tactical-map__svg"
        >
          <defs>
            <filter id="topo-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Elevation band lines */}
          {[2000, 2500, 3000, 3500].map((elev) => (
            <line
              key={elev}
              x1={PADDING}
              y1={toMapY(elev)}
              x2={VIEW_W - PADDING}
              y2={toMapY(elev)}
              stroke="var(--bg-panel-border)"
              strokeWidth="0.5"
              strokeDasharray="4,4"
              opacity="0.3"
            />
          ))}

          {/* Contour rings around each waypoint */}
          {WAYPOINTS.map((wp) => {
            const cx = toMapX(wp.distanceFromStart);
            const cy = toMapY(wp.elevation);
            const contours = generateContours(cx, cy, wp.elevation);
            return contours.map((c, j) => (
              <ellipse
                key={`${wp.id}-${j}`}
                cx={cx}
                cy={cy}
                rx={c.rx}
                ry={c.ry}
                fill="none"
                stroke="var(--neon-green)"
                strokeWidth="0.5"
                opacity={c.opacity}
              />
            ));
          })}

          {/* Future trail (dashed) */}
          <polyline
            points={trailPoints}
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />

          {/* Traversed trail (glowing) */}
          {currentIndex > 0 && (
            <polyline
              points={traversedPoints}
              fill="none"
              stroke="var(--neon-green)"
              strokeWidth="1.5"
              filter="url(#topo-glow)"
            />
          )}

          {/* Waypoint markers */}
          {WAYPOINTS.map((wp, i) => {
            const x = toMapX(wp.distanceFromStart);
            const y = toMapY(wp.elevation);
            const fill =
              i < currentIndex ? "var(--neon-green)" :
              i === currentIndex ? "var(--amber)" :
              "var(--text-muted)";
            return (
              <g key={wp.id}>
                {/* Diamond marker */}
                <polygon
                  points={`${x},${y - 4} ${x + 3},${y} ${x},${y + 4} ${x - 3},${y}`}
                  fill={fill}
                  stroke={fill}
                  strokeWidth="0.5"
                />
                {/* Label (only at zoom 2+, or every other at zoom 1) */}
                {(zoomLevel >= 2 || i % 2 === 0) && (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    fill="var(--text-dim)"
                    fontSize={zoomLevel >= 2 ? "7" : "5"}
                    fontFamily="monospace"
                  >
                    {wp.nameCN}
                  </text>
                )}
              </g>
            );
          })}

          {/* Human marker */}
          <HumanMarker
            x={toMapX(WAYPOINTS[currentIndex].distanceFromStart)}
            y={toMapY(WAYPOINTS[currentIndex].elevation) - 10}
            healthPercent={healthPercent}
          />
        </svg>
      </div>
    </div>
  );
}
```

**Step 2:** Add CSS for the tactical map in `src/App.css`:

```css
/* Tactical Topo Map */
.tactical-map {
  position: relative;
  background: var(--bg-panel);
  border: 1px solid var(--bg-panel-border);
  border-radius: var(--border-radius);
  overflow: hidden;
  height: 200px;
}

.tactical-map__perspective {
  width: 100%;
  height: 100%;
  transform: perspective(800px) rotateX(45deg) rotateZ(-10deg);
  transform-origin: center center;
  transition: transform 0.5s ease;
}

.tactical-map__svg {
  width: 100%;
  height: 100%;
}

.tactical-map__zoom-controls {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 10;
  display: flex;
  gap: 4px;
  align-items: center;
  font-size: 9px;
  color: var(--text-dim);
  font-family: var(--font-mono);
}

.tactical-map__zoom-controls button {
  background: var(--bg-input);
  border: 1px solid var(--bg-panel-border);
  color: var(--neon-green);
  width: 18px;
  height: 18px;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tactical-map__zoom-controls button:hover {
  background: var(--neon-green);
  color: var(--bg-dark);
}
```

**Step 3:** Replace the `ElevationProfile` import in the center panel of `App.tsx` (or wherever the game shell renders the center panel) with `TacticalMap`:

```typescript
import { TacticalMap } from "./components/map/TacticalMap.tsx";
```

Replace `<ElevationProfile />` with `<TacticalMap />`.

**Step 4:** Run `npx tsc --noEmit` — zero errors.

**Step 5:** Browser verify — topo map renders with isometric perspective, contour rings, trail, markers.

**Step 6:** Commit: `git commit -m "feat: add TacticalMap with isometric contours, zoom, and HumanMarker"`

---

## Phase 3: Atmospheric Effects

### Task 3.1: Create Vignette.tsx

**Files:**
- Create: `src/components/effects/Vignette.tsx`

**Step 1:** Create the vignette overlay:

```typescript
/**
 * Dynamic vignette overlay that closes in as player vitals drop.
 * Simulates tunnel vision during critical states.
 */

import { useMemo } from "react";
import { useGameStore } from "../../store/gameStore.ts";

export function Vignette() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);

  const { radius, tintColor } = useMemo(() => {
    const worstVital = Math.min(energy, hydration, bodyTemp, o2, morale);

    let r: number;
    if (worstVital > 60) r = 0;        // no vignette
    else if (worstVital > 30) r = 70;   // subtle
    else if (worstVital > 10) r = 40;   // heavy
    else r = 20;                         // near blackout

    // Color tint based on which vital is worst
    let tint = "rgba(0,0,0,0)";
    if (worstVital <= 30) {
      if (bodyTemp <= worstVital + 5) tint = "rgba(0,50,120,0.15)";      // cold = blue
      else if (o2 <= worstVital + 5) tint = "rgba(120,0,0,0.15)";        // low O2 = red
    }

    return { radius: r, tintColor: tint };
  }, [energy, hydration, bodyTemp, o2, morale]);

  if (radius === 0) return null;

  return (
    <div
      className="vignette"
      style={{
        background: `radial-gradient(ellipse ${radius}% ${radius}% at center, transparent 0%, ${tintColor} 40%, rgba(0,0,0,0.85) 100%)`,
      }}
    />
  );
}
```

**Step 2:** Add CSS in `src/App.css`:

```css
.vignette {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9990;
  transition: background 2s ease;
}
```

**Step 3:** Add `<Vignette />` to the game shell in App.tsx (after `<ParticleCanvas />`, before the game-shell div).

**Step 4:** Run `npx tsc --noEmit` — zero errors.

**Step 5:** Commit: `git commit -m "feat: add Vignette overlay that darkens as vitals drop"`

### Task 3.2: Create SoundManager

**Files:**
- Create: `src/services/soundManager.ts`

**Step 1:** Create the Web Audio API singleton. This is a large file with all synthesized sounds:

```typescript
/**
 * SoundManager — Procedural audio synthesis using Web Audio API.
 * All sounds are generated in real-time, no audio files required.
 * Singleton pattern: import { soundManager } from this module.
 */

type TerrainSound = "forest" | "meadow" | "stone_sea" | "ridge" | "summit" | "scree" | "stream_valley";

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean;
  private volume: number;

  // Active ambient nodes
  private windNode: OscillatorNode | null = null;
  private windGain: GainNode | null = null;
  private rainNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private humNode: OscillatorNode | null = null;
  private humGain: GainNode | null = null;

  constructor() {
    this.muted = localStorage.getItem("ao-tai-muted") === "true";
    this.volume = parseFloat(localStorage.getItem("ao-tai-volume") ?? "0.5");
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getMaster(): GainNode {
    this.ensureContext();
    return this.masterGain!;
  }

  // ── UI Sounds ──

  click(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  alert(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  injury(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.setValueAtTime(500, ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  }

  boot(): void {
    const ctx = this.ensureContext();
    const notes = [200, 300, 400, 500, 600, 700, 800, 900, 1000];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.28;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(this.getMaster());
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  footstep(terrain: TerrainSound): void {
    const ctx = this.ensureContext();
    // Generate 2-3 quick noise bursts filtered by terrain
    const filterFreq: Record<TerrainSound, number> = {
      forest: 1200,
      meadow: 800,
      stream_valley: 600,
      scree: 3000,
      stone_sea: 2500,
      ridge: 2000,
      summit: 1800,
    };

    for (let i = 0; i < 3; i++) {
      const bufferSize = 1024;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = filterFreq[terrain];
      filter.Q.value = 2;
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      source.connect(filter).connect(gain).connect(this.getMaster());
      source.start(t);
      source.stop(t + 0.08);
    }
  }

  campfire(): void {
    const ctx = this.ensureContext();
    // Random short noise bursts
    for (let i = 0; i < 8; i++) {
      const bufferSize = 512;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 800 + Math.random() * 2000;
      const gain = ctx.createGain();
      const t = ctx.currentTime + Math.random() * 1.5;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + Math.random() * 0.1);
      source.connect(filter).connect(gain).connect(this.getMaster());
      source.start(t);
      source.stop(t + 0.2);
    }
  }

  eatDrink(): void {
    const ctx = this.ensureContext();
    const bufferSize = 2048;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    source.connect(filter).connect(gain).connect(this.getMaster());
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + 0.15);
  }

  thunder(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 40;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 3.5);
  }

  // ── Ambient Loops ──

  updateWind(altitude: number, weatherIntensity: number, weatherCondition: string): void {
    const ctx = this.ensureContext();
    const targetVolume = Math.max(0, (altitude - 2000) / 1767) * 0.3 *
      (weatherCondition === "wind" || weatherCondition === "blizzard" ? 2 : 1) *
      weatherIntensity;

    if (!this.windNode) {
      // Create white noise source
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 400;
      filter.Q.value = 0.5;

      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;

      source.connect(filter).connect(this.windGain).connect(this.getMaster());
      source.start();
      this.windNode = source as unknown as OscillatorNode;
    }

    if (this.windGain) {
      this.windGain.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 1);
    }
  }

  updateAltitudeHum(altitude: number): void {
    const ctx = this.ensureContext();
    const targetVolume = altitude > 3200 ? ((altitude - 3200) / 567) * 0.05 : 0;

    if (!this.humNode && targetVolume > 0) {
      this.humNode = ctx.createOscillator();
      this.humNode.type = "sine";
      this.humNode.frequency.value = 100;
      this.humGain = ctx.createGain();
      this.humGain.gain.value = 0;
      this.humNode.connect(this.humGain).connect(this.getMaster());
      this.humNode.start();
    }

    if (this.humGain) {
      this.humGain.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 2);
    }
  }

  // ── Controls ──

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem("ao-tai-muted", String(muted));
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        muted ? 0 : this.volume,
        (this.ctx?.currentTime ?? 0) + 0.1,
      );
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem("ao-tai-volume", String(this.volume));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.volume,
        (this.ctx?.currentTime ?? 0) + 0.1,
      );
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }
}

export const soundManager = new SoundManager();
```

**Step 2:** Run `npx tsc --noEmit` — zero errors.

**Step 3:** Commit: `git commit -m "feat: add SoundManager with Web Audio API procedural synthesis"`

### Task 3.3: Integrate SoundManager into game flow

**Files:**
- Modify: `src/store/gameStore.ts`
- Modify: `src/components/game/ActionButton.tsx` (or wherever action buttons are)
- Modify: `src/components/game/NavigationConsole.tsx`
- Modify: `src/components/screens/TitleScreen.tsx`
- Modify: `src/App.tsx` — add a SoundController component or mute button to Header

**Step 1:** In `ActionButton.tsx`, import soundManager and call `soundManager.click()` in the click handler:

```typescript
import { soundManager } from "../../services/soundManager.ts";

// In the click handler:
const handleClick = useCallback(() => {
  soundManager.click();
  performAction(action);
}, [performAction, action]);
```

**Step 2:** In `gameStore.ts` `performAction`, add sound triggers after processing:

```typescript
import { soundManager } from "../services/soundManager.ts";

// After events check:
if (hasEvents) {
  const hasCritical = result.events.some((e) => e.severity === "critical" || e.severity === "major");
  if (hasCritical) soundManager.injury();
  else soundManager.alert();
}

// Play terrain footstep on movement
if (action === "push_forward" || action === "descend") {
  const wpTerrain = waypoints[result.newState.player.currentWaypointIndex].terrain;
  soundManager.footstep(wpTerrain);
} else if (action === "set_camp") {
  soundManager.campfire();
} else if (action === "eat" || action === "drink") {
  soundManager.eatDrink();
}
```

**Step 3:** In `TitleScreen.tsx`, add `soundManager.boot()` call when boot sequence starts.

**Step 4:** Create a `SoundControls` component in the Header or as a standalone. Simple mute toggle button:

```typescript
function SoundControls() {
  const [muted, setMutedState] = useState(soundManager.isMuted());
  const toggle = () => {
    const next = !muted;
    soundManager.setMuted(next);
    setMutedState(next);
  };
  return (
    <button className="sound-toggle" onClick={toggle} title={muted ? "Unmute" : "Mute"}>
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
```

**Step 5:** Add ambient sound updates. Create a `SoundAmbience` component that subscribes to store and updates wind/hum:

```typescript
function SoundAmbience() {
  const altitude = useGameStore(
    (s) => WAYPOINTS[s.player.currentWaypointIndex].elevation,
  );
  const weather = useGameStore((s) => s.weather);

  useEffect(() => {
    soundManager.updateWind(altitude, weather.intensity, weather.current);
    soundManager.updateAltitudeHum(altitude);
  }, [altitude, weather]);

  return null;
}
```

Add `<SoundAmbience />` to the game shell in App.tsx.

**Step 6:** Run `npx tsc --noEmit` — zero errors.

**Step 7:** Browser verify — click buttons produce beep, wind audible at altitude, campfire crackle on camp.

**Step 8:** Commit: `git commit -m "feat: integrate SoundManager with UI, ambient loops, and game events"`

---

## Phase 4: UI Polish & Vitals Jitter

### Task 4.1: Apply vitals jitter to StatusDashboard

**Files:**
- Modify: `src/components/game/StatusDashboard.tsx`

**Step 1:** Read `vitalsJitter` from store. Apply jitter to displayed values (not actual store values):

```typescript
const vitalsJitter = useGameStore((s) => s.vitalsJitter);

// Display energy with jitter:
const displayEnergy = Math.round(
  Math.min(100, Math.max(0, energy + (vitalsJitter.energy ?? 0)))
);
```

Pass `displayEnergy` to VitalBar instead of raw `energy`. Repeat for all 5 vitals.

**Step 2:** Run `npx tsc --noEmit` — zero errors.

**Step 3:** Commit: `git commit -m "feat: apply fog-of-war vitals jitter when morale < 40%"`

### Task 4.2: Add Wait action to NavigationConsole

**Files:**
- Modify: `src/components/game/NavigationConsole.tsx`

**Step 1:** Add the wait action to `ACTION_CONFIG`:

```typescript
  { action: "wait" as GameAction, label: "WAIT", cost: "1h | Endure the whiteout" },
```

**Step 2:** Run `npx tsc --noEmit` — zero errors.

**Step 3:** Browser verify — wait button appears (disabled unless whiteout is active).

**Step 4:** Commit: `git commit -m "feat: add Wait action button to NavigationConsole"`

### Task 4.3: Update documentation

**Files:**
- Modify: `DOC/TASKS.md`
- Modify: `DOC/README.md`

**Step 1:** Update TASKS.md to add Phase 7-9 (Map, Mechanics, Atmosphere) with all tasks marked complete.

**Step 2:** Update README.md to document new features: TacticalMap, hardcore mechanics, sound, vignette.

**Step 3:** Commit: `git commit -m "docs: update TASKS.md and README.md for v2.0 upgrade"`

---

## Phase 5: Final Verification

### Task 5.1: Full integration test

**Step 1:** Run `npx tsc --noEmit` — zero errors.

**Step 2:** Run `npx vite build` — clean production build.

**Step 3:** Browser test full flow:
- Title screen boot (with boot sound)
- Press Enter → game loads with TacticalMap
- Push Forward × 3 → verify map updates, contours visible, marker moves, wind audible
- Check vitals display changes, exposure logs appear at ridges
- Camp twice at same waypoint → verify diminishing returns
- Scroll zoom on map → verify zoom levels
- Get to a ridge in blizzard → verify rapid bodyTemp drain
- Verify vignette appears when vitals drop
- Let game defeat → verify SIGNAL LOST screen

**Step 4:** Commit any final fixes.

**Step 5:** Final commit: `git commit -m "feat: Ao Tai Cyber-Hike v2.0 — High-Fidelity Tactical Survival Simulator"`
