# High-Fidelity Tactical Survival Simulator Upgrade

**Date**: 2026-02-28
**Status**: Approved
**Architecture**: Approach B — Extract components, then build new systems

---

## Overview

Upgrade Ao Tai Cyber-Hike from a 2D prototype to a high-fidelity tactical survival simulator across three pillars:

1. **Tactical Topo Map** — Zoomable isometric contour map replacing the elevation profile
2. **Hardcore Ridge Mechanics** — Exposure, encumbrance, 10 new events, anti-camp-spam, punishment systems
3. **Atmospheric Vibe** — Dynamic vignette, procedural Web Audio synthesis (12+ sounds)

Target survival rate: <20% for a well-played game.

---

## Pillar 1: Tactical Topo Map

### Components

**`components/map/TacticalMap.tsx`**
- SVG canvas (viewBox ~600x400) with CSS isometric transform: `perspective(800px) rotateX(45deg) rotateZ(-10deg)`
- Concentric SVG `<path>` contour rings at elevation bands (2000m, 2500m, 3000m, 3500m)
- Each waypoint gets 3-4 elliptical contour rings scaled by prominence (ridges/peaks = tighter rings)
- Trail polyline: traversed portion glows neon-green, remainder dashed dim
- Waypoint markers: labeled diamonds at each position
- Zoom: `zoomLevel` local state (1 = full route, 2-3 = local). Scroll wheel or +/- buttons. `transform-origin` centers on current waypoint when zoomed.

**`components/map/HumanMarker.tsx`**
- Simplified 20x30 SVG hiking figure (head, torso, legs, backpack outline)
- CSS bob animation: `translateY(-3px) -> translateY(3px)` on 1.5s ease-in-out loop
- Smooth transition between waypoints: `transition: all 1.2s ease-in-out`
- Color shifts: green (healthy) -> amber (stressed) -> red (critical)

### Data Flow
- Reads `player.currentWaypointIndex` and vitals from store
- Reads `WAYPOINTS` array for positions/elevations
- Zoom is local component state (no store changes needed)

---

## Pillar 2: Hardcore Ridge Mechanics

### 2A. Exposure System

New field in `PlayerState`:
```
exposure: number  // 0-100, starts at 0
```

**Accumulation**: On any turn at ridge/summit terrain AND weather is blizzard/wind/snow:
- `exposure += 15 * weather.intensity`

**Decay**:
- In shelter or camping: exposure -= 20
- Resting (no camp): exposure -= 5

**Effects**:
- exposure > 30: bodyTemp drain 2x multiplier
- exposure > 60: bodyTemp drain 3x multiplier
- exposure > 80: energy drain also 2x multiplier

**Hidden**: Not shown as a UI bar. Log hints when climbing ("The wind cuts through your layers...").

New engine file: `engine/exposureSystem.ts`

### 2B. Encumbrance System

**Item Weights**:
| Item | Weight |
|------|--------|
| Food ration | 0.4 kg |
| Water (per liter) | 1.0 kg |
| Medicine dose | 0.2 kg |
| Gear (base, fixed) | 5.0 kg |

Starting weight: 8x0.4 + 6x1.0 + 3x0.2 + 5.0 = 14.8 kg

**Thresholds**:
- Over 15kg: +1h to push_forward time, +5 energy drain per movement
- Over 20kg: +2h to push_forward time, +10 energy drain

New engine file: `engine/encumbrance.ts`

### 2C. 10 New Hardcore Events (25 total)

| Event | Severity | Effects | Weighted Toward |
|-------|----------|---------|-----------------|
| Gear Tumble | critical | Lose 2 food OR 1L water (random) | scree +8, ridge +6, wind +4 |
| Whiteout | critical | disabledTurns: 1, only "wait" available | blizzard +12, snow +8, fog +6, ridge +4 |
| Pulmonary Edema | critical | energy -30, o2 -20, edemaCounter: 3 | summit +10, ridge +8, >3400m +5 |
| Frostbite | major | gear -30, energy -10, bodyTemp -15 | blizzard +10, snow +6, night +5, ridge +4 |
| Trail Collapse | major | energy -20, morale -20, forced descend 1 | rain +6, scree +8, stone_sea +6 |
| Lost Trail | major | +2h wasted, energy -15, morale -10 | fog +10, night +8, stone_sea +4 |
| Pack Strap Breaks | major | Lose 1 food, gear -15 | ridge +4, wind +4, scree +3 |
| Altitude Insomnia | minor | Camp recovery reduced to 50% | altitude>3000m +8 |
| Knee Injury | major | +15 energy per push_forward for 3 turns | scree +6, stone_sea +5, descend +4 |
| Companion Warning | minor | morale -5, mapRevealed = true | ridge +4, summit +6 |

### 2D. Anti-Camp-Spam: Camp Fatigue

Consecutive camp/rest at same waypoint gives diminishing returns:
- 1st: 100% recovery
- 2nd: 60% recovery
- 3rd: 30% recovery

Forces movement rather than camping forever.

### 2E. Resource Decay

Every midnight (day transition):
- 0.2L water evaporates
- 30% chance: 1 food ration spoils

Prevents hoarding.

### 2F. Weather Escalation

After Day 4: Markov matrix permanently shifts:
- clear/cloudy probabilities -15%
- snow/blizzard/wind probabilities +15%

The mountain gets meaner the longer you linger.

### 2G. New "Wait" Action

For whiteout events:
- Time cost: 1h
- Energy: -3, Hydration: -2
- No movement, no events
- Available only when `disabledTurns > 0` (all other actions disabled)

### 2H. Persistent Status Effects

New field in `PlayerState`:
```
statusEffects: StatusEffect[]
```

Where `StatusEffect = { id: string, turnsRemaining: number, effects: Partial<PlayerState> }`

Applied at step 6 of turn pipeline. Covers:
- Pulmonary Edema (3 turns): energy -10/turn
- Knee Injury (3 turns): +15 energy on push_forward
- Whiteout (1 turn): disables all actions except wait

### 2I. Extra Punishment Systems

**Gear Degradation Cascade**:
- Gear < 30%: bodyTemp drain +5 per action (no insulation)
- Gear < 10%: hydration drain +5 per action (water bottle cracked)
- Gear cannot be repaired

**Fog of War on Vitals**:
- Morale < 40%: UI displays vitals with +/-10% random jitter
- Engine still uses correct values internally
- Simulates mental fog of exhaustion

**Nightfall Trap**:
- If clock passes 19:00 during push_forward (mid-transit):
- Forced bivouac: bodyTemp -20, morale -15, energy -10

**No Retreat from Summit Push**:
- Past waypoint 10 (South Heaven Gate): DESCEND permanently disabled
- Point of no return, matches real Ao Tai Line

**Food Poisoning**:
- 15% chance when eating: energy -10 instead of +20

**Cascading Morale Collapse**:
- Morale < 20%: all recovery from rest/camp halved
- Creates death spiral

---

## Pillar 3: Atmospheric Vibe

### 3A. Vignette Effect

New component: `components/effects/Vignette.tsx`

- Fixed-position overlay with CSS `radial-gradient`
- Radius shrinks as worst vital drops:
  - All vitals > 60%: no vignette
  - Worst vital 30-60%: subtle edge darkening (70% transparent center)
  - Worst vital 10-30%: heavy tunnel vision (40% center)
  - Worst vital < 10%: nearly closed (20% center)
- Color tint: neutral (normal), blue (cold bodyTemp), red (low O2)
- 2s CSS transition for smooth changes
- z-index: above game panels, below scanlines

### 3B. Sound Manager (Web Audio API)

Singleton service: `services/soundManager.ts`

**UI Sounds**:
- `click()` — 800Hz->400Hz sweep, 50ms. On every action button.
- `alert()` — Two-tone 600Hz/900Hz, 200ms. On critical events.
- `boot()` — Rising tone sequence during title boot.
- `injury()` — Lower pitch alert (300Hz/500Hz), longer decay. On major/critical events.

**Ambient Loops**:
- `wind(altitude, intensity)` — Bandpass white noise (200-600Hz), LFO gusting. Scales with altitude + weather.
- `rain(intensity)` — Brown noise through high bandpass (800-2000Hz). Active during rain/blizzard.
- `thunder()` — Random trigger every 15-45s during rain/blizzard. 40Hz sine, 3s decay.
- `heartbeat(energyPercent)` — 60Hz sine pulse when energy < 30%. Rate increases as energy drops.
- `altitudeHum` — Faint 100Hz sine drone above 3200m. Barely audible, creates unease.
- `nightCrickets` — High-frequency chirps below 2800m at night. Dead silence above 2800m at night.

**Action Sounds**:
- `footstep(terrain)` — Short filtered noise bursts. Filter varies by terrain (crunchy for scree, soft for meadow, muffled for snow).
- `campfire()` — Brief 2s crackle (random noise bursts). On set_camp.
- `eatDrink()` — Quick low-pass filtered noise burst.

**Controls**:
- Global mute toggle (localStorage)
- Master volume slider
- Ambient sounds adjust in real-time via Zustand subscription

---

## Architecture: Component Extraction (Phase 0)

Before building new features, extract inline components from App.tsx (~450 lines) into:

```
components/
  game/
    Header.tsx
    StatusDashboard.tsx
    VitalBar.tsx
    InventoryPanel.tsx
    RiskMeter.tsx
    WeatherDisplay.tsx
    DayNightIndicator.tsx
    LogWindow.tsx
    LogEntry.tsx
    ActionButton.tsx
    NavigationConsole.tsx
    LocationInfo.tsx
    GameOverlay.tsx
  map/
    TacticalMap.tsx
    HumanMarker.tsx
  effects/
    Scanlines.tsx       (already exists)
    ParticleCanvas.tsx  (already exists)
    Vignette.tsx        (new)
  screens/
    TitleScreen.tsx     (already exists)
```

App.tsx becomes a thin shell that composes these components.

---

## New/Modified Files Summary

### New Files
- `engine/exposureSystem.ts` — Exposure accumulation/decay/effects
- `engine/encumbrance.ts` — Weight calculation + threshold effects
- `components/map/TacticalMap.tsx` — Isometric contour map
- `components/map/HumanMarker.tsx` — Animated player marker
- `components/effects/Vignette.tsx` — Dynamic tunnel vision overlay
- `services/soundManager.ts` — Web Audio API synthesis singleton
- `components/game/*.tsx` — Extracted from App.tsx (12+ files)

### Modified Files
- `engine/types.ts` — Add exposure, statusEffects, campFatigue to PlayerState; add "wait" to GameAction; add StatusEffect interface
- `engine/gameEngine.ts` — Integrate exposure, encumbrance, status effects into turn pipeline; add nightfall trap, camp fatigue, resource decay, weather escalation
- `engine/vitalCalculator.ts` — Apply exposure multipliers, morale collapse, gear cascade
- `data/events.ts` — Add 10 new hardcore events
- `data/weatherTransitions.ts` — Add Day 4+ escalation matrix
- `store/gameStore.ts` — Add soundManager integration, vitals jitter state, wait action
- `App.tsx` — Slim down to shell, import extracted components + new ones
- `App.css` — Add TacticalMap styles, vignette styles, sound control UI
- `index.css` — New animations for map, vignette transitions

### Type Changes to PlayerState
```typescript
// New fields
exposure: number;              // 0-100
statusEffects: StatusEffect[];
campFatigueCount: number;      // consecutive camps at same waypoint
lastCampWaypoint: number;      // track same-waypoint camping

// New type
interface StatusEffect {
  id: string;
  turnsRemaining: number;
  onTurnStart?: Partial<PlayerState>;   // applied each turn
  modifiers?: {                         // modifies action costs
    pushForwardEnergyCost?: number;
    disableActions?: boolean;
  };
}
```

### New GameAction
```typescript
type GameAction = "push_forward" | "set_camp" | "descend" | "check_map"
  | "rest" | "eat" | "drink" | "use_medicine" | "wait";
```
