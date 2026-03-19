# Ao Tai Cyber-Hike: Visual & Presentation Overhaul

**Date:** 2026-03-18
**Art Direction:** Tactical Alpine Nightmare
**Core Fantasy:** A documented expedition across a hostile mountain, where every run leaves a record, every failure has a place and cause, and survival is meaningful because the environment is consistent, severe, and legible.

## Decisions Made

- **Rendering:** Hybrid — SVG silhouettes for mountain structure, canvas for atmospheric effects
- **Layout:** Full-bleed mountain viewport with floating instrument panels
- **Sequencing:** Foundation → Layout → Scene MVP → Atmosphere → Hiker → Feedback → Screens/Replay/Route → Difficulty → Cleanup
- **Iteration:** Iterative implementation with critical review after each phase (20+ review cycles)

---

## 1. Visual Foundation — Art Direction System

### Palette

Replace flat always-on neon cyberpunk with a restrained expedition console language.

**Base layer:**
- `--bg-abyss: #08090c` — obsidian base (body/viewport)
- `--bg-panel: #0d1117` — panel dark
- `--bg-panel-raised: #151b26` — panel raised/hover
- `--bg-storm: #1c2333` — storm blue tint

**Instrumentation (nominal state):**
- `--tactical-green: #3d8b37` — primary text, traversed trail
- `--tactical-green-bright: #5ca854` — emphasis, healthy vitals
- `--amber: #d4a843` — secondary, current waypoint, caution
- `--teal-muted: #1e5c6b` — info, hydration

**Danger states (escalating):**
- `--warning-orange: #c97a2e` — caution vitals
- `--hazard-red: #c93838` — danger vitals, lost state
- `--critical-red: #ff4444` — critical glow source, pulsing
- `--ice-blue: #6cb4d4` — cold/hypothermia

**Environmental accents:**
- `--dawn-gold: #e8dcc0` — dawn sky, summit moment
- `--moonlight: #c4d6e8` — night, pale accents
- `--lightning-white: #f0f0ff` — storm flash
- `--night-purple: #2a1a2e` — night sky tint

### Glow Philosophy

Glow is earned, not ambient. Base text uses muted tactical green with zero glow. Glow reserved for: active waypoints, critical vital alerts (pulsing), action button hover/press, AI decision highlight, and the rare victory moment. Calm states have low glow and strong contrast discipline. Glow intensity scales with danger — storms bring environmental light flicker, crisis brings pulsing danger glow on relevant vitals.

### Typography & Hierarchy

- Headings, labels, warning text, and readouts should feel deliberate with improved spacing
- Crisis states visibly alter UI treatment (border color, text glow, spacing tightens)
- Panel rhythm and contrast tuned for premium instrumentation feel
- Scanlines reduced in intensity to avoid degrading log/vital/control readability

---

## 2. Layout Architecture — Full-Bleed Mountain Viewport

### Z-Index Layer Stack (bottom to top)

| Z | Layer | Content |
|---|-------|---------|
| 0 | Sky gradient | CSS linear-gradient, time-of-day + weather reactive |
| 1 | SVG mountain ridgelines | 5 parallax layers, waypoint-specific terrain profiles |
| 2 | Atmosphere canvas | Fog, snow, rain, lightning, whiteout (replaces ParticleCanvas) |
| 3 | Danger overlays | Frost, altitude pulse, dehydration static, morale jitter |
| 4 | Floating panel grid | Left/center/right instrument panels with translucent backplates |
| 5 | Scanlines | Subtle CRT overlay, pointer-events: none |
| 6 | Screen overlays | Title, game over, victory (full-screen modal states) |

### Panel Treatment

- **Backplate:** `background: rgba(13, 17, 23, 0.85)` — dark enough for text readability, translucent enough to see mountain at edges
- **Blur:** `backdrop-filter: blur(8px)` — mountain softens behind instruments, creating depth
- **Borders:** `1px solid rgba(61, 139, 55, 0.15)` — faint tactical green edge, brightens during alerts
- **Crisis escalation:** Panel borders shift green → amber → red. Backplate opacity can pulse. Edge glow intensifies. Instruments react to the danger they display.
- **Readability:** Non-negotiable. Text contrast maintained regardless of background scene state.

---

## 3. Mountain Scene System

### SVG Ridgeline Layers

Full-viewport SVG component `<MountainScene>` with 5 parallax ridge layers:

| Layer | Role | Opacity Range | Parallax |
|-------|------|---------------|----------|
| 5 (far) | Distant range silhouette | 0.15–0.25 | Minimal |
| 4 | Secondary ridgeline | 0.25–0.35 | Slow |
| 3 | Primary Ao Tai spine | 0.40–0.55 | Medium |
| 2 | Near terrain | 0.55–0.70 | Faster |
| 1 (near) | Foreground detail/framing | 0.70–0.85 | Most |

Each layer is a single SVG `<path>` polygon. Shapes defined as data arrays in `terrainProfiles.ts`. Layers 3/2/1 change most across terrain bands; layers 4/5 remain more stable for continuity.

**Data format (`terrainProfiles.ts`):**
```typescript
type RidgePoints = [number, number][] // normalized [x, y] pairs, x: 0-1, y: 0-1
interface TerrainProfile {
  band: 'forest' | 'rocky' | 'plateau' | 'storm' | 'summit'
  layers: {
    1: RidgePoints  // foreground, ~20-30 vertices
    2: RidgePoints  // near terrain, ~15-25 vertices
    3: RidgePoints  // primary spine, ~15-20 vertices
    4: RidgePoints  // secondary ridge, ~10-15 vertices
    5: RidgePoints  // distant range, ~8-12 vertices
  }
  colors: {
    base: string[]      // 5 fill colors per layer (indexed by layer)
    dawn: string[]      // dawn-tinted variants
    night: string[]     // night-darkened variants
    storm: string[]     // storm-flattened variants
  }
}
```
Points are normalized 0-1 and scaled to viewport at render time. Layer 1 (foreground) has more vertices for detail; layer 5 (far) is simpler.

**Parallax:** `offset = (waypointIndex / 12) * maxShift * parallaxFactor[layer]` where `parallaxFactor = { 1: 1.0, 2: 0.7, 3: 0.45, 4: 0.25, 5: 0.1 }` and `maxShift` is ~15% of viewport width. During terrain band transitions, parallax continues smoothly while profile shapes crossfade.

**Transitions:** Terrain band changes blend via color interpolation, opacity crossfade, or limited profile morphing — not hard cuts.

**Terrain band mapping from engine TerrainType:**
| Visual Band | Engine TerrainType values | Waypoint indices |
|-------------|-------------------------|-----------------|
| Forest Approach | forest, meadow, stream_valley | 0–2 |
| Rocky Spine | stone_sea, scree | 3–5 |
| Exposed Plateau | ridge | 6–8 |
| Storm Ridge | ridge (high elevation) | 9–11 |
| Summit Approach | summit | 12 |

Visual bands are determined by waypoint index, not TerrainType. The mapping above documents the correspondence but the scene system keys off `currentWaypointIndex`.

### 5 Terrain Bands

| Band | Waypoints | Elevation | Visual Character |
|------|-----------|-----------|------------------|
| Forest Approach | 0–2 | 1740–2600m | Rounded ridges, treeline silhouettes, warmer color temperature, organic contours, forest canopy foreground |
| Rocky Spine | 3–5 | 2800–3400m | Jagged angular ridges, exposed rock faces, treeline drops off, bare scree, cooler shift, sharper edges |
| Exposed Plateau | 6–8 | 3400–3600m | Wide open ridgelines, long traversals, more sky visible, wind-swept, desolate, color desaturates |
| Storm Ridge | 9–11 | 3450–3600m | Knife-edge ridges, steep implied drop-offs, darkest profiles, clouds wrap close, sparse foreground |
| Summit Approach | 12 | 3767m | Single dominant peak above all layers, final scramble foreground, sky opens if weather permits |

### Sky System

CSS `linear-gradient` on the base layer, transitioned smoothly (2–3s) on time/weather changes.

**Time-of-day variants:** dawn (indigo → peach → gold), morning (steel blue → pale horizon), midday (medium blue-gray), afternoon (warm blue → golden haze), dusk (purple → crimson → burnt orange), night (near-black → deep navy).

**Weather modifiers:** Overcast/storm variants flatten, bruise, darken, or erase the sky. Storm night = pure black void with no horizon.

**Ridge color response:** Ridge layer fills shift with time-of-day (dawn warms, night darkens/desaturates) and weather (storms push toward uniform dark gray).

---

## 4. Atmosphere Canvas

### AtmosphereCanvas Component

Replaces `ParticleCanvas`. Full viewport, `pointer-events: none`, positioned between SVG mountains and UI panels (z:2). Canvas handles atmosphere only — never mountain structure.

### Weather Modes

| Weather | World Layer (on scene) | UI Interference |
|---------|----------------------|-----------------|
| Clear | Minimal haze, occasional dust mote. Mountain crisp. | None. |
| Cloudy | Slow cloud bank shapes drift, partial ridge obscuration. | None. |
| Fog | Dense gradient fog from valleys. Far ridges vanish. Depth collapses. | Subtle haze on panel edges. |
| Rain | Angled streak particles. Darkened surface tint. | Occasional streak across panel glass. Faint noise texture. |
| Snow | Moderate snowfall. Accumulation tint on foreground ridges. Reduced distance visibility. | Snow drifts across panel edges. Frost at corners in severe cold. |
| Wind | Directional horizontal streaks. Debris. Faster cloud movement. | Panel edges flicker. Slight directional text vibration (CSS). |
| Blizzard | Maximum density + directional chaos. Near-total ridge obscuration. Whiteout gradient. Only closest foreground partially visible. | Heavy interference. Panel glass frosts. Text flicker. Static noise on risk meter. |

**Minimal anchors in blizzard:** Even at maximum whiteout, preserve the nearest foreground ridge silhouette and hiker readability. Total visual loss is disorienting but the player must always be able to find the hiker.

**Storm lightning:** During storm/blizzard, occasional flashes: 50ms white fill → silhouette lit in stark contrast → 300ms fade. 1–3 per turn.

---

## 5. Hiker System

### Base Approach

Keep the stylized geometric SVG figure. Evolve from marker to readable person under stress. Default hiker should feel small, burdened, and exposed even in calm conditions.

**Scene placement:** The hiker renders in the mountain scene SVG, positioned at a fixed vertical position on layer 2 (near terrain, roughly 65-70% from top of viewport). Horizontal position interpolates between left (waypoint 0) and right (waypoint 12) of the viewport, matching parallax layer 2 offset. Size: approximately 2-3% of viewport height — small enough to feel exposed against the mountain, large enough to read pose and condition. The TacticalMap retains its own separate smaller hiker marker for the instrument panel.

### 8 Action Poses (existing, refined)

Idle, walking, camping, eating, drinking, resting, mapping, medicine. Current pose system preserved and polished.

### Condition Modifiers (additive, limit visible posture-level to 2–3 max)

| Condition | Visual Modifier | Trigger |
|-----------|----------------|---------|
| Cold | Hunched shoulders, breath vapor (2–3 animated circles), blue outline tint | bodyTemp < 50 |
| Wind | Lean into wind (rotate transform), jacket flutter, hood motion | weather = wind/blizzard |
| Exhaustion | Lowered head, slower bob (1.2s), forward lean, shorter stride | energy < 35 |
| Injury | Asymmetric limp, arm held close, movement stutter | statusEffects includes entry with id containing "injury" or "sprain" |
| Night | Headlamp cone (amber SVG gradient triangle), sways with movement | timeOfDay = night/dusk |
| Critical | Opacity flicker (0.4–1.0 irregular), scan field distorts, desaturated | any vital < 15 |

Secondary conditions (beyond the top 2–3) appear through color, timing, breath, flicker, or accessory effects rather than posture changes.

### Special Moment Poses

- **Summit:** Arms raised, golden glow pulse. Only at waypoint 12. Rare and earned.
- **Stumble recovery:** 300ms drop → catch → pause. Plays on fall events before injury modifier.
- **Lost wandering:** Drifts off trail with uncertain micro-movements. Inconsistent facing. Wider headlamp sweep at night.

---

## 6. Action Feedback System

### Architecture

`useActionFeedback` hook watches `lastAction` and `lastEvents`, sets CSS classes and triggers brief animations. Most effects are CSS transitions with JS-controlled class toggling. Configurable shake intensity reuses existing `isShaking` mechanism.

### Action Responses

| Action | Scene Response | UI Response | Feel |
|--------|---------------|-------------|------|
| Push Forward | Parallax shift, dust/snow puff from feet, directional motion streak | Route line pulse, map micro-pan, location text transition | Commitment, momentum |
| Set Camp | Scene dims slightly, warm amber campfire glow, particles slow | Panel borders soften, amber wash, action area contracts | Fragile safety |
| Check Map | Brief tactical grid overlay flash on scene (fast fade) | Map border brightens, route line refresh sweep | Tactical clarity |
| Rest | Subtle zoom pulse (0.5%), particles drift lazily | Vitals animate recovery, panel glow dims to minimum | Brief respite |
| Eat / Drink | Minimal scene change, hiker pose animation | Relevant vital pulses green, inventory counter flash | Resource spent wisely |
| Use Medicine | Brief warm pulse around hiker | Status effect fades with relief animation | Costly relief |
| Fall / Injury | Sharp screen shake (200ms high intensity), stumble animation, red flash | All panel borders flash red, risk spike, affected vitals pulse | Shock, cost |
| Get Lost | Scene blurs 200ms, mountain layers shift conflicting directions, fog thickens | Map flickers, waypoint jitter, route line uncertain, compass spin | Disorientation, dread |

**Intensity tiers:** Minor actions (eat, drink, rest) stay restrained. Travel/camp actions feel weightier. Injury/lost events hit hardest. Feedback punctuates play without competing with weather or scene motion.

---

## 7. Danger Overlay System

### Architecture

`<DangerOverlay>` component replaces/upgrades current `<Vignette>`. Reads all player vitals and status effects. Renders condition-specific CSS overlays (positioned absolute, pointer-events: none). Each overlay is a separate div with its own animation. Memoizes on relevant vital thresholds.

### Stacking Rule

**One dominant full-screen treatment at a time** (the worst active condition). Other active conditions appear as supporting accents (border tints, subtle secondary overlays, icon indicators). This prevents unreadable noise while still communicating compounding danger.

### Condition Treatments

| Danger | Screen Treatment | UI Treatment |
|--------|-----------------|--------------|
| Hypothermia | Blue-white frost creep from edges, scene desaturation toward cold blue, frost crystal corners | Body temp bar ice-blue glow, panel borders tint blue |
| Altitude Sickness | Tunnel vision (vignette tightens), pulsing desaturation on 1.2s heartbeat rhythm | O2 bar pulses with heartbeat, faint red vignette tint |
| Dehydration | Contrast harshens, faint static/grain overlay, dry brittle feel | Hydration bar flickers, hairline crack overlays on panels |
| Starvation | Scene dims progressively, colors drain, slower parallax response | Energy bar dims, reduced text contrast, non-essential action opacity drops |
| Morale Collapse | Micro-jitter on scene layers (1–2px intermittent displacement) | Vitals jitter intensifies, log text glitch, panel borders flicker |
| Navigation Uncertainty | Mountain layers shift conflicting directions, fog thickens, depth degrades | Waypoint markers pulse uncertain, route line dashed/faded, "UNCERTAIN" label |
| High Fall Risk | Foreground shows steep drop-off, subtle downward drift on near layers | Route segment pulses red, risk meter border glows, terrain hazard icon |

---

## 8. Screen Overhauls

### Unifying Principle

Title, death, and victory reinforce the documented expedition fantasy. Every screen shows the mountain. Every outcome leaves a record with a place and a cause.

### Title Screen — "Expedition Briefing"

1. Mountain scene fades in first — dawn sky, ridges emerge from black (2s)
2. Terminal boot overlay appears over the scene (floating console panel, 200ms/line)
3. Route drawing sequence — thin line traces the Ao Tai route across mountain silhouette (SVG path animation, 2s), waypoint markers appear as line reaches each
4. Title reveal — "AO TAI CYBER-HIKE" with mountain behind, route stats: "80km · 13 waypoints · 3767m summit · <10% survival rate"
5. Expedition dossier — rotating flavor text (weather warnings, route bans, missing hiker reports, 4s cycle)
6. Prompt — "PRESS ENTER TO BEGIN EXPEDITION" with restrained amber pulse, mountain + atmosphere continues behind

### Death Screen — "Signal Lost"

**Phase 1 — The Moment (2s):**
- Mountain scene freezes, weather particles halt mid-frame
- Cause of death text appears center-screen in large hazard red
- Scene rapidly desaturates to near-monochrome
- Hiker figure flickers and goes dark
- Brief static burst (100ms) then silence

**Phase 2 — The Report (holds until restart):**
- Frozen desaturated mountain remains as memorial backdrop showing where you fell
- Floating expedition report panel:
  - `// SIGNAL LOST`
  - `// LAST KNOWN POSITION: [waypoint] [elevation]`
  - `// CAUSE: [death cause]`
  - `// DAY [n] · HOUR [hh:mm] · [weather]`
  - `// DISTANCE: [x]km / 80km`
  - `// WAYPOINTS REACHED: [n] / 13`
  - `// TURNS SURVIVED: [n]`
- Run summary below (see §9)
- "RESTART MISSION" button

### Victory Screen

**Summit (Ending 2):**
- Mountain transitions to summit band. Sky clears if weather permits (golden light rays) or holds storm (surviving a storm summit is even more dramatic — no golden light, just raw survival).
- Hiker summit pose. "SUMMIT REACHED" in earned green glow — the only time full bright green is used.
- "拔仙台 · BAXIAN PLATFORM · 3767m" subtitle. Full expedition report.

**Escape (Ending 1):**
- Mountain transitions to forest approach. Dawn/morning sky. Warmer, calmer.
- "ESCAPE" in amber. No celebration glow. Tone: "You turned back. You lived. Most don't."

---

## 9. Replay Drama — Run Summary

Shown on death/victory screen below expedition report. Turns each run into a story.

**Components:**
- **Route trace:** Miniature tactical map showing traversed path. Final position marked X (death) or star (summit).
- **Event timeline:** 3–5 key moments auto-selected by severity. Format: "Day 3 · Blizzard struck at 梁1 · Day 4 · Fall at stone sea"
- **Expedition epitaph:** Template-generated summary line from run data. E.g.: "Lost to hypothermia on the storm ridge after 6 days. The blizzard on Day 4 was the turning point."
- **Run codename:** Auto-generated from run characteristics. "[Weather]-[Terrain]-[Fate]" combinations. E.g.: "Operation Frozen Ridge," "The Stone Sea Retreat," "Whiteout Protocol."

**Data source:** Existing game log entries filtered by type. Events of type `event` correspond to `CriticalEvent` entries stored in `lastEvents` — select those with severity `major` or `critical`, take the most recent 3-5. For the epitaph, use the final log entry's action + the defeat cause + weather at death. No engine changes needed — pure presentation on existing data.

**Run codename generation:** Template patterns drawing from word pools:
- Pattern: `"Operation [Weather] [Terrain]"` — e.g., "Operation Frozen Ridge"
- Pattern: `"The [Terrain] [Fate]"` — e.g., "The Stone Sea Retreat"
- Pattern: `"[Weather] Protocol"` — e.g., "Whiteout Protocol"
- Weather pool: Frozen, Storm, Whiteout, Thunder, Ice, Bitter, Gale, Silent
- Terrain pool: Ridge, Peak, Spine, Stone Sea, Plateau, Summit, Valley, Traverse
- Fate pool: Retreat, Collapse, Crossing, Descent, Stand, March, Vigil, Protocol

---

## 10. Route Identity — Tactical Map Upgrades

Tactical map stays isometric SVG, gains richer visual language:

- **Route line treatment:** Thickness and pulse rate scale with danger. Safe = thin steady. Dangerous = thicker slow pulse. Extreme = thick pulsing red-tinged.
- **Traversed vs future:** Traversed glows tactical green. Future is dim dashed with terrain-colored tint (green/forest, gray/rock, blue-white/exposed, red/storm ridge).
- **Waypoint markers:** Current gets breathing ring animation. Passed = solid diamond. Future = hollow diamond. Shelter waypoints get tiny roof icon. Camp-available get dot.
- **Terrain hazard zones:** Subtle shaded regions for high-danger bands. Storm Ridge = faint red overlay. Exposed Plateau = wind-streak overlay. Always visible as tactical information.
- **Lost state:** Route line dissolves. Waypoint markers blur. Search radius pulses. Hiker drifts off trail. The map becomes uncertain.
- **Point of no return:** Permanent marker at waypoint 10. "DESCEND" label changes after passing. No return path shown.

---

## 11. Difficulty Retune — Target <10% Win Rate

### Tuning Levers

| Lever | Current | Proposed | Rationale |
|-------|---------|----------|-----------|
| Weather escalation | Day 4+ shift | Day 3+ shift, stronger snow/blizzard weighting | Earlier hostile weather |
| Night travel | Higher lost chance | +15% energy drain, +25% lost chance, +10% fall risk | Night genuinely terrifying |
| Camp recovery | 100%/35%/10% | 85%/30%/8% | Every camp matters more |
| Morale decay | Per-action decrease | Steeper in bad weather and at night | Morale collapse as real threat |
| Getting lost | 6% base | 8% base, stronger weather/night modifiers | Navigation as real concern |
| Altitude drain | Above 3000m | Steeper O2 above 3500m, energy compounds with altitude + weather | Punishing final approach |

### Engine Files Affected

| Lever | Primary file(s) |
|-------|----------------|
| Weather escalation | `src/engine/weatherSystem.ts` (Markov transition matrix, escalation day threshold) |
| Night travel | `src/engine/vitalCalculator.ts` (night drain multipliers), `src/engine/navigationSystem.ts` (lost chance), `src/engine/fallSystem.ts` (fall risk) |
| Camp recovery | `src/engine/gameEngine.ts` (camp/rest recovery constants) |
| Morale decay | `src/engine/vitalCalculator.ts` (morale drain per-action, weather/night modifiers) |
| Getting lost | `src/engine/navigationSystem.ts` (base lost chance, weather/night modifiers) |
| Altitude drain | `src/engine/vitalCalculator.ts` (O2 drain curve above 3500m), `src/engine/exposureSystem.ts` |

### Validation

- Run 200+ simulations with heuristic playtest bot
- Target: 5–9% summit rate
- Verify deaths attributable to decisions + conditions, not pure RNG
- Median run should reach waypoint 5–7 (the game is a journey, not instant death)
- Document tuning changes and results

### Philosophy

Difficulty from environmental pressure (weather, night, altitude) and resource tension (camp recovery, morale), not arbitrary damage spikes. The player always understands why they died.

---

## Implementation Sequence

1. **Foundation** — CSS variables, palette, typography, glow rules
2. **Layout** — Full-bleed viewport, floating panels, z-index stack, backplate treatment
3. **Scene MVP** — MountainScene component, terrainProfiles.ts, 5 ridgeline layers, sky gradients, terrain band switching
4. **Atmosphere** — AtmosphereCanvas replacing ParticleCanvas, all 7 weather modes, lightning, UI interference
5. **Hiker** — Condition modifiers, special moments, headlamp, breath vapor, wind lean
6. **Feedback** — useActionFeedback hook, per-action scene + UI responses, screen shake refinement
7. **Screens / Replay / Route** — Title overhaul, death/victory sequences, run summary, tactical map upgrades, route identity
8. **Difficulty** — Engine tuning, playtest validation, balance documentation
9. **Cleanup** — Final polish, docs update, consistency pass

Each phase iterated with critical self-review after implementation. 20+ review cycles total across all phases.

---

## Constraints

- Browser-performant, no heavy dependencies
- Engine stays pure TS, React handles presentation
- Maintainable code with comments where complexity rises
- Glow as emphasis, not ambient noise
- Weather escalates from scenic to adversarial, never unreadable
- Danger overlays communicate collapse, never become noise
- Text readability non-negotiable at all times
- The game stays hard, oppressive, and challengeable — never cute, cozy, or forgiving
- Desktop-only, minimum viewport 1024×768. No mobile/responsive layout required.
- Audio integration: out of scope for this spec. Existing SoundManager continues to function; new visual events (lightning, stumble, etc.) may trigger existing sound hooks but no new audio design is specified here.

### Performance Budget

- AtmosphereCanvas: target <4ms/frame. Max particle counts: clear 10, cloudy 30, fog 25, rain 120, snow 100, wind 80, blizzard 180. Cloud bank shapes rendered as gradient fills, not individual particles.
- `backdrop-filter: blur(8px)`: monitor for frame drops. Fallback: replace with `background: rgba(13, 17, 23, 0.92)` (solid, slightly more opaque) if compositing cost exceeds budget. Only apply blur to panels that overlay active scene areas.
- SVG mountain scene: 5 static path elements + CSS transforms. Negligible render cost. Profile swaps on terrain band changes, not per-frame.
- Danger overlays: CSS-only (gradients, opacity, filters). No canvas rendering.

### CSS Variable Migration

Old variables to replace throughout all components:
| Old | New |
|-----|-----|
| `--neon-green` / `--neon-green-dim` | `--tactical-green` / `--tactical-green-bright` |
| `--amber` | `--amber` (same name, adjusted value) |
| `--danger` | `--hazard-red` |
| `--cyan` | `--teal-muted` |
| `--magenta` | removed (morale uses `--warning-orange` or context-specific) |
| `--bg-dark` | `--bg-abyss` |
| `--bg-panel` | `--bg-panel` (same name, adjusted value) |
| `--bg-input` | `--bg-panel` (consolidated) |
| `--text-dim` | `--tactical-green` at reduced opacity |

### Accessibility

- Support `prefers-reduced-motion`: disable jitter, flicker, pulse, parallax motion. Use static indicators (color/border changes) instead of animations for danger states.
- All text maintains WCAG AA contrast (4.5:1 minimum) against panel backplates at all times, including during crisis states.
- Danger states use shape + color (not color alone): frost pattern for cold, pulse rhythm for altitude, static texture for dehydration. Colorblind users can distinguish states by pattern.

---

## Success Criteria

The player should feel like they are operating a hostile expedition console while watching a tiny vulnerable hiker cross a giant cursed mountain spine. A screenshot from waypoint 2 should not feel interchangeable with waypoint 11. The hiker should feel like a person. Weather should feel like an adversary. Death should feel tragic and specific. Victory should feel miraculous. A failed run should feel interesting enough to immediately retry. Win rate under 10%.
