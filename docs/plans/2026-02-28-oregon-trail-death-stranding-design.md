# V2.1 Design: Oregon Trail Meets Death Stranding

**Date:** 2026-02-28
**Status:** Approved

## Overview

Four improvements to Ao Tai Cyber-Hike based on playtesting feedback:

1. **Animated hiker figure** with pose-based SVG states
2. **Game balance overhaul** — camping/resting nerfed, food/water made essential
3. **Background music** from .mp3 file
4. **Store & UI updates** to support new mechanics

Core philosophy: "At altitude, you are always deteriorating. Resources slow the decline. Camping doesn't magically restore you — it buys time."

---

## Section 1: Animated Hiker Figure

Replace the pulsing-dot stick figure in `HumanMarker.tsx` with pose-based SVG states reflecting the last action taken.

### Poses

| Action | Pose | Animation |
|--------|------|-----------|
| idle (default) | Standing upright with backpack | Subtle breathing bob |
| push_forward / descend | Walking stride, arms forward | 2-frame walk cycle (CSS) |
| set_camp | Sitting on ground, small campfire dots | Flickering fire animation |
| eat | Sitting, arm to mouth | Eating motion |
| drink | Standing, arm raised with bottle | Drinking motion |
| rest | Leaning/hunched, head down | Slow breathing |
| check_map | Standing, holding map out | Static |
| use_medicine | Kneeling with med kit | Static |
| wait | Hunched against wind, hood up | Wind sway |

### Implementation

- Each pose is an SVG `<g>` group inside `HumanMarker.tsx`
- New `pose` prop (derived from `lastAction` in the store) controls which group renders
- Keep health-based color system (green >60%, amber 30-60%, red <30%)
- Keep CSS transition for smooth map position changes
- Prop flow: `gameStore.lastAction` -> `TacticalMap` -> `HumanMarker`

---

## Section 2: Game Balance Overhaul

Research: at 3500m+, mountaineers burn 6,000-10,000 cal/day, can only consume 30-70%. Need 3-5L water/day. Appetite suppression is real. Sleep quality is poor.

### A. Camp/Rest Recovery Nerfed

| Mechanic | Old | New |
|----------|-----|-----|
| Camp energy recovery | +30 | +15 |
| Camp bodyTemp (shelter) | +15 | +8 |
| Camp bodyTemp (no shelter) | +5 | +3 |
| Rest energy recovery | +15 | +8 |
| Camp fatigue multiplier | 100%/60%/30% | 100%/35%/10% |

3rd camp at same waypoint: 15 -> 5.25 -> 1.5 energy (effectively useless).

### B. Passive Hydration Drain

Every action drains hydration: **-2 x time_cost_hours**.

| Action | Time | Base Drain | Passive Drain | Total |
|--------|------|------------|---------------|-------|
| push_forward | 4h | -15 | -8 | -23 |
| set_camp | 4h | 0 | -8 | -8 |
| rest | 2h | 0 | -4 | -4 |
| eat | 0.5h | 0 | -1 | -1 |
| drink | 0.5h | +30 | -1 | +29 |

Forces drinking ~5-6 times across the game.

### C. Passive Energy Drain at Altitude

Above 3000m: energy **-1 per hour** of action time (altitude metabolic cost).

- Camp 4h at 3400m: +15 recovery - 4 altitude = **+11 net** (was +30)
- Push forward 4h at 3400m: -20 base - 4 altitude = **-24** (was -20)

### D. Starting Supplies Reduced

| Resource | Old | New |
|----------|-----|-----|
| Food | 8 | 6 |
| Water | 6L | 4L |

### E. Eat/Drink Actions Made Essential

| Action | Old | New |
|--------|-----|-----|
| Eat | energy +20, 15% food poison | energy +25, morale +5, 10% food poison |
| Drink | hydration +25 | hydration +30, morale +3 |

### F. Starvation/Dehydration Cascade

- **Food = 0 (starvation):** energy -5/action, morale -3/action
- **Water = 0 (dehydration):** energy -8/action, bodyTemp -3/action, O2 -3/action
- Both = rapid death spiral within 3-4 actions

### G. Resource-Dependent Camp Recovery

- Camp with food=0: recovery x0.3
- Camp with water=0: recovery x0.2
- Both=0: recovery x0.1

### H. Morale Isolation Drain (Death Stranding)

- Every action: morale -1 always (isolation/loneliness)
- Below 40% morale: movement energy costs +25%
- Below 20% morale: all recovery halved (existing) + 10% "loss of will" event chance
- Eating: +5 morale, Drinking: +3 morale

### I. Altitude O2 Continuous Drain

| Altitude | O2 Drain per push_forward |
|----------|--------------------------|
| < 3000m | 0 |
| 3000-3400m | -2 |
| 3400-3600m | -4 |
| > 3600m | -6 |

Medicine is CRITICAL for summit push (only O2 restoration source).

### J. Weather Force Multiplier

- Blizzard/wind: all drain rates x1.5
- Snow: all drain rates x1.2
- Clear: normal (weather windows are precious)

### Target Survival Rate: 10-15%

Must-do strategy to win:
1. Eat regularly (every 4-5 actions) or starve
2. Drink regularly (every 3-4 actions) or dehydrate
3. Push forward during good weather windows
4. Camp strategically (diminishing returns punish over-camping)
5. Use medicine for high-altitude summit push
6. Manage morale through eating/drinking/progress

---

## Section 3: Background Music

- Move `Witch Parade Assassin.mp3` from `data/music/` to `public/music/`
- Add `MusicManager` to `soundManager.ts` using HTML5 `Audio` element
- Loop continuously, volume 0.3 (weather/UI sounds remain louder)
- Start on title->playing transition with 3-second fade-in
- Respect existing mute toggle in `SoundControls`
- Keep all Web Audio API procedural sounds (weather, footsteps, alerts)

---

## Section 4: Store & UI Updates

- Add `lastAction: GameAction | null` to store state
- Pass `lastAction` through: `gameStore` -> `TacticalMap` -> `HumanMarker`
- Update `NavigationConsole` action descriptions for new costs
- Flash resource warnings in `StatusDashboard` when food < 2 or water < 1L
- Update `InventoryPanel` to show resource pressure indicators
