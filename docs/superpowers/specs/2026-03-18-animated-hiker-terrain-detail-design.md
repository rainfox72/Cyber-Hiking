# Animated 3D Hiker + Procedural Terrain Detail — Design Spec

**Date**: 2026-03-18
**Status**: Draft v2 (post spec-review — 14 issues fixed)
**Scope**: Sub-project B — Replace sphere hiker with articulated 3D character, add terrain-type-specific procedural map details and unique waypoint landmarks
**Branch**: `feature/visual-atmosphere-overhaul` (extends v3.1)
**Reviewers**: Claude (author), Codex (technical review), Gemini (art direction review)

## Overview

The 3D TacticalMap currently renders the hiker as a green sphere with a scan beam — functional but visually flat. The wireframe terrain has no vegetation, rocks, or landmarks — a bare data mesh.

This sub-project adds:
1. **Animated 3D hiker** with an 11-joint articulated skeleton (+ 1 static pack attachment), 9 poses, smooth blending, walk cycle, and CRT holographic rendering
2. **Procedural terrain details** — terrain-type-specific vegetation, rocks, and debris rendered as instanced wireframe geometry
3. **Unique waypoint landmarks** — hand-crafted markers at significant trail locations
4. **Movement polish** — trail afterimages, radar ping on arrival, CRT glitch transitions

**What's NOT in scope**: Gameplay/engine changes, sound, new UI panels, OrbitControls (still deferred), SVG legacy map changes.

## Architecture: Modular Component System

Two independent subsystems added as new directories under `src/components/map/`:

```
src/components/map/
  hiker/
    HikerRig3D.tsx          — Skeleton group, body meshes, 3-layer rendering
    hikerPoses.ts            — Pose table: joint rotation targets per action
    hikerAnimator.ts         — Pose blending state machine, walk cycle logic
    HikerEffects.tsx         — CRT glitch, afterimages, radar ping
  terrain/
    terrainDetails.ts        — Detail placement generator (pure TS, no React)
    TerrainVegetation.tsx    — Instanced trees, grass, shrubs
    TerrainRocks.tsx         — Instanced rocks, scree, debris
    TerrainWater.tsx         — Animated stream ribbons
    TerrainLandmarks.tsx     — Unique waypoint markers
  TacticalMap3D.tsx          — Orchestrator (modified, not rewritten)
  terrainMesh.ts             — Extended with detail spawn data
```

**Key constraint**: `HikerRig3D` and terrain detail components are fully independent — zero coupling between them. They coexist as siblings inside the R3F Canvas.

## Section 1: Hiker Skeleton Rig

### File: `src/components/map/hiker/HikerRig3D.tsx`

### Skeleton Structure

11-joint articulated hierarchy using `THREE.Group` nodes, plus 1 static attachment (pack):

```
root (local origin at FEET, not hips)
└── hips (offset upward from root)
    ├── spine
    │   ├── head
    │   ├── armL → forearmL
    │   ├── armR → forearmR
    │   └── pack (backpack — rigidly attached to spine, NOT an animated joint)
    ├── legL → shinL
    └── legR → shinR
```

**Joint count**: 11 animated joints (hips, spine, head, armL, forearmL, armR, forearmR, legL, shinL, legR, shinR). Pack is a static child of spine with no independent rotation — it is excluded from `JointRotations` and does not get a joint glow sphere.

**Critical rule (from Codex review)**: Root origin is at feet. Parent `HikerMarker` group positions the root at ground level (lines 273/302 of TacticalMap3D.tsx). Hips are offset upward as the first child. This prevents floating.

**Critical rule**: `HikerRig3D` must NEVER modify world position. Parent `HikerMarker` owns all world-space movement, drift, and camera follow. The rig owns only local bone rotations, prop visibility, and local VFX.

### Rendering: Hybrid Tactical Hologram (3-layer)

Each body part rendered with up to 3 layers:

| Layer | Technique | Material | Opacity |
|-------|-----------|----------|---------|
| **Solid volume** | Low-segment `BoxGeometry` / `CylinderGeometry` | `MeshBasicMaterial`, `depthWrite: false` | 0.08–0.15 |
| **Edge wireframe** | `<Line>` component from `@react-three/drei` (uses `Line2` internally, fixed 2px via `lineWidth` prop) | `LineMaterial` (managed by `<Line>`) | 0.7–1.0 |
| **Joint glow** | `SphereGeometry` (r=0.006, 4 segments) at each joint | `MeshBasicMaterial` | 1.0 |

**Edge rendering simplification (from Codex review)**: Full wireframe (`<Line>`) on **6 major parts only**: head, spine, hips, legL (upper), legR (upper), pack. Arms (upper + forearm) and shins get solid mesh only — too small for edges to read at this scale.

**Depth sorting (from Codex review)**: Solid layer uses `depthWrite={false}`. Edge layer uses higher `renderOrder`. Prevents wireframe disappearing into body parts.

**Line width (from Gemini review)**: Use `<Line>` from `@react-three/drei` (internally uses `Line2` / `LineMaterial`) instead of `LineSegments` + `LineBasicMaterial`. Standard WebGL lines are capped at 1px on most platforms — invisible at the hiker's small scale. The `<Line lineWidth={2}>` prop provides fixed pixel-width lines regardless of camera distance. Import as `{ Line } from '@react-three/drei'`.

### Body Part Proportions

Hiker total height: ~0.25 scene units. All geometry uses `BoxGeometry` for limbs (angular consistency with terrain triangles, per Gemini recommendation) except cylinders for arms.

| Part | Geometry | Approximate Size | Edge Layer |
|------|----------|------------------|------------|
| head | `BoxGeometry` | 0.03 × 0.035 × 0.025 | Yes |
| spine | `BoxGeometry` | 0.04 × 0.06 × 0.02 | Yes |
| hips | `BoxGeometry` | 0.04 × 0.02 × 0.02 | Yes |
| armL/R (upper) | `CylinderGeometry` | r=0.006, h=0.04 | No |
| forearmL/R | `CylinderGeometry` | r=0.005, h=0.035 | No |
| legL/R (upper) | `BoxGeometry` | 0.02 × 0.05 × 0.015 | Yes |
| shinL/R | `CylinderGeometry` | r=0.006, h=0.045 | No |
| pack | `BoxGeometry` | 0.025 × 0.04 × 0.015 | Yes |

### Color System

Driven by `healthPercent`, derived from game store vitals using the same formula as `TacticalMapLegacy.tsx:52–54`: `(energy + hydration + bodyTemp + o2Saturation + morale) / 5`:

| Health | Color | Signal Quality |
|--------|-------|----------------|
| > 60% | `#00ff41` (neon green) | Strong — full edge opacity |
| 30–60% | `#ffb000` (amber) | Degraded — edge opacity drops to 0.5, solid flickers |
| < 30% | `#ff2222` (danger red) | Critical — edges flicker, joint glow pulses, 10–15Hz solid flicker |

Color applied to all materials uniformly. At low health, edge opacity drops and solid layer gains a 10–15Hz flicker (opacity oscillates 0.08 → 0.15 → 0.08, per Gemini suggestion) to simulate "failing projection signal."

### Props System

Action-specific props toggled via `visible` flag (always present in scene graph, no runtime creation):

| Prop | Geometry | Shown During |
|------|----------|-------------|
| `mapProp` | Flat rectangle, semi-transparent glow | `check_map` |
| `bottleProp` | Small cylinder | `drink` |
| `tentProp` | Pyramid wireframe (above hiker) | `set_camp` |
| `medkitProp` | Small box with cross lines | `use_medicine` |
| `foodProp` | Small item near mouth | `eat` |

### Bad Weather Visibility Rule (from Codex + Gemini review)

When `weather === "fog" || weather === "blizzard"`:
- Force hiker solid layer to minimum opacity 0.4 (instead of 0.08–0.15)
- Force hiker edges to opacity 1.0
- Force joint glow to 1.0 with slight bloom (increased sphere radius to 0.008)
- **"Current position always readable"** regardless of fog/blizzard

### Night Mode Enhancement (from Gemini review)

When `timeOfDay === "night"`:
- Hiker joint spheres become the brightest elements in the scene
- Joint glow radius increases slightly (0.006 → 0.008)
- Terrain wireframe dims further (already at 60%), making hiker stand out

## Section 2: Animation System

### File: `src/components/map/hiker/hikerPoses.ts`

### Pose Table

9 static poses defined as Euler rotation targets per joint:

```ts
type JointRotations = {
  hips: [x: number, y: number, z: number];
  spine: [x: number, y: number, z: number];
  head: [x: number, y: number, z: number];
  armL: [x: number, y: number, z: number];
  forearmL: [x: number, y: number, z: number];
  armR: [x: number, y: number, z: number];
  forearmR: [x: number, y: number, z: number];
  legL: [x: number, y: number, z: number];
  shinL: [x: number, y: number, z: number];
  legR: [x: number, y: number, z: number];
  shinR: [x: number, y: number, z: number];
};

type PoseDef = {
  joints: JointRotations;
  prop: "map" | "bottle" | "tent" | "medkit" | "food" | null;
  facing: "forward" | "backward";  // Y rotation of root
};
```

Poses: `idle`, `walkingA`, `walkingB`, `camping`, `eating`, `drinking`, `resting`, `mapping`, `medicine`.

**Euler → Quaternion conversion**: Euler targets in the pose table are converted to `THREE.Quaternion` at load time (once). Runtime blending uses `Quaternion.slerp()` on the pre-converted values — never on raw Euler tuples.

### File: `src/components/map/hiker/hikerAnimator.ts`

### Pose Blending State Machine

```
States:
  IDLE       — holding current pose with breathing wobble
  GLITCH     — 50ms CRT transition overlay
  BLENDING   — slerp interpolation from current → target pose
  WALKING    — cycling walkingA ↔ walkingB during movement

Transitions:
  Action change → GLITCH (50ms) → BLENDING (200ms) → IDLE
  Movement start → GLITCH (50ms) → WALKING (duration) → GLITCH → BLENDING → IDLE
```

### Animation Trigger (from Codex review — critical fix)

Trigger animation from `turnNumber + lastAction + currentWaypointIndex` tuple, NOT `lastAction` alone:

```ts
const triggerKey = `${turnNumber}-${lastAction}-${currentWaypointIndex}`;
```

This fixes:
- **Repeated same-action**: Two consecutive `eat` turns produce different `turnNumber`, so both trigger transitions
- **Push-while-lost**: `currentWaypointIndex` doesn't change, so no walk cycle starts. Instead, a "wandering" idle variant plays (slight restless sway)

### Walk Cycle

Triggered ONLY when `currentWaypointIndex` changes (not just when `lastAction === "push_forward"`):
- Alternates between `walkingA` and `walkingB` poses via quaternion slerp
- Step timing: `stepDuration = movementDuration / stepCount`
  - `push_forward` (2.5s): 4 steps → 0.625s per step
  - `descend` (1.5s): 3 steps → 0.5s per step
- Root Y rotation: forward for push_forward, backward for descend
- On movement end: GLITCH → blend to idle

### Idle Wobble

Spine oscillates ±0.02 rad on X axis, 3s sine period (breathing).

**Integration note (from Codex review)**: The existing Y-axis bob in `HikerMarker` (4Hz moving, 2Hz idle at lines 275/304) must be **removed** when the rig is active. The rig owns all secondary motion to avoid layered visual noise.

### Forced State Gating (from Codex review)

Animation state machine checks `gamePhase` each frame. If `gamePhase !== "playing"` (defeat, victory, dying), all animations freeze at current pose. Prevents walk cycles or transitions running during death/victory screens.

## Section 3: Hiker Effects

### File: `src/components/map/hiker/HikerEffects.tsx`

### CRT Glitch Transition (50ms)

Fires during GLITCH state on every action change:
- Opacity pulse: all hiker materials drop to 0.3 then snap back
- Horizontal jitter: root group offset X by ±0.005 (random, seeded)
- Color channel shift: edge material briefly tints cyan or magenta (1 frame)
- Optional: 1-frame `visible=false` flicker

All driven by `glitchRef` in `useFrame` — no React state, no re-renders.

### Trail Afterimages

During WALKING state only:
- Ring buffer of **4 joint-only ghosts** (NOT full 33-part rig clones — per Codex review)
- Each ghost: 11 small spheres at joint positions only, no solid meshes or edges
- Material: neon green at opacity 0.15 → 0.0 fade over 0.6s ("persistent phosphorus" — per Gemini)
- Position + rotation snapshot copied every 0.3s during movement
- Pre-created and reused (no runtime allocation)
- On movement end: all ghosts fade to 0 over 0.3s

### Radar Ping on Waypoint Arrival

When `currentWaypointIndex` changes:
- Single reusable `RingGeometry` mesh at hiker position on terrain surface
- Expands from r=0 to r=1.5 over 0.8s, ease-out
- Opacity fades 0.4 → 0.0 during expansion
- Color matches hiker health color (neon green / amber / red)
- Sine wave displacement on Y as ring hits terrain (per Gemini: makes topology feel interactive)

**Edge case (from Codex review)**: Lost-state search ring already occupies the same visual space. If player is found and arrives simultaneously, radar ping uses a **different color** (cyan) and **different Y offset** (+0.05) to avoid overlap with the red search ring.

## Section 4: Terrain Detail System

### File: `src/components/map/terrain/terrainDetails.ts`

### Data Layer

Pure TS function `generateTerrainDetails()` that runs once at module load alongside existing `generateTerrainMesh()`. Takes `WAYPOINTS` + mesh data as input.

**Placement algorithm**:
1. Iterate 128×64 grid cells (reuse existing grid)
2. Look up terrain type from nearest waypoint
3. Apply terrain-specific density threshold (seeded via existing `valueNoise`)
4. Jitter position within cell for natural distribution
5. **Exclude trail corridor**: skip cells where `|zNorm| < 0.10`
6. Sample Y height from existing `positions` array (exact terrain surface — no floating)
7. Output pre-computed `Float32Array` instance matrices per detail category

**Output**:

```ts
interface TerrainDetailData {
  trees: { matrices: Float32Array; count: number; };
  grass: { positions: Float32Array; count: number; };   // line geometry, not instanced
  rocks: { matrices: Float32Array; count: number; };
  water: { positions: Float32Array; count: number; };   // line ribbons
  landmarks: LandmarkDef[];
}

interface LandmarkDef {
  waypointId: string;       // bound by ID, NOT index (Codex review fix)
  type: LandmarkType;
  position: [number, number, number];
  scale: number;
}

type LandmarkType =
  | "trailhead_gate"
  | "shelter_marker"
  | "cairn"
  | "warning_sign"
  | "summit_beacon"
  | "shrine";
```

### Terrain Detail Recipes

| Terrain | Detail | Geometry | Count/zone | Rendering |
|---------|--------|----------|------------|-----------|
| **forest** | 2-tier cone trees | `ConeGeometry` (trunk + canopy) | 15–25 | `InstancedMesh` |
| **forest** | Understory tufts | 3-line fans (merged) | 30–40 | `LineSegments` |
| **meadow** | Grass tufts | 3-line fans (merged) | 40–60 | `LineSegments` |
| **meadow** | Low shrubs | Small wireframe sphere | 5–8 | `InstancedMesh` |
| **stone_sea** | Rock clusters | `OctahedronGeometry` / `TetrahedronGeometry` | 20–30 | `InstancedMesh` |
| **stone_sea** | Debris lines | Short broken fragments | 15–20 | `LineSegments` |
| **ridge** | Cairns | 3 stacked small boxes | 3–5 | Individual `<group>` |
| **ridge** | Rock teeth | Thin tall `ConeGeometry` | 5–8 | `InstancedMesh` |
| **scree** | Loose rocks | Small `OctahedronGeometry` | 25–35 | `InstancedMesh` |
| **scree** | Dust fragments | Tiny flat triangles | 15–20 | `LineSegments` |
| **summit** | Exposed rocks | Small `OctahedronGeometry` | 5–10 | `InstancedMesh` |
| **summit** | Wind-scoured debris | Tiny flat triangles | 8–12 | `LineSegments` |
| **stream_valley** | Water ribbon | 2 parallel translucent lines | 1–2 | `Line` with opacity pulse |
| **stream_valley** | Boulders | Medium `OctahedronGeometry` | 5–8 | `InstancedMesh` |

**Estimated totals**: ~800–1500 instanced meshes + ~400–600 merged line vertices.

### Elevation-Driven Detail Scaling (from Gemini review)

Trees scale down and skew (wind-lean) as elevation increases:
- Below 2500m: full scale, upright
- 2500–3200m: 80% scale, slight lean (0.1 rad)
- Above 3200m: 60% scale, stronger lean (0.2 rad), sparser placement

Rocks are unaffected by elevation scaling.

### Detail Color (from Codex review)

Instanced rocks inherit **per-vertex elevation colors** from the terrain mesh they sit on, sampled at placement time. They look like data extrusions rather than foreign objects. Trees use terrain-tinted green (forest = darker, meadow = brighter).

### Stream Valley Water (revised from Codex review)

Instead of animated `LineDashedMaterial` (poorly supported for flowing animation in core Three.js), use:
- Plain `Line` with translucent `LineBasicMaterial`
- Color: `#2288aa` at opacity 0.3
- Slow **opacity pulsing** in `useFrame` (sine wave, 2s period) to simulate water shimmer
- Simpler, cheaper, avoids dashed-line API limitations

### Rendering Components

**`TerrainVegetation.tsx`**: Trees (`InstancedMesh`, 2 size variants) + grass/shrubs (merged `LineSegments`). Material: `MeshBasicMaterial`, transparent, terrain-tinted, opacity 0.3–0.5.

**`TerrainRocks.tsx`**: Rocks (`InstancedMesh`, 2–3 geometry variants) + debris (merged `LineSegments`). Color: elevation-sampled.

**`TerrainWater.tsx`**: Stream ribbons (`Line` with opacity pulse). Only active in stream_valley zones.

**`TerrainLandmarks.tsx`**: Unique per-waypoint markers (individual `<group>` nodes, not instanced).

### Material Management (from Codex review)

All geometries created once in `useMemo`, disposed on unmount via `useEffect` cleanup. No per-frame geometry rebuilds. `useFrame` only touches: grass sway (vertex Y offset), water opacity pulse, landmark animations.

### Merged LineSegments Trade-off (from Codex review)

All segments in a merged `LineSegments` draw call share one material. This means no per-terrain pulse rates or color variation within a single batch. Acceptable for Sub-project B scope — if per-terrain animation is needed later, split into per-terrain batches (one draw call per terrain type).

## Section 5: Unique Waypoint Landmarks

### File: `src/components/map/terrain/TerrainLandmarks.tsx`

Each landmark is a small hand-built `<group>` with wireframe geometry. Bound by waypoint `id` string (not index).

| Landmark | Waypoint(s) | Visual | Animation |
|----------|-------------|--------|-----------|
| `trailhead_gate` | `tangkou` (start, 1740m) | Two vertical posts + horizontal bar, wireframe | Slow opacity breathe |
| `shelter_marker` | `camp_2900`, `camp_2800` (shelters with camping) | Small tent pyramid + amber campfire glow point | Campfire flickers (opacity oscillation) |
| `shrine` | `yaowangmiao` (Medicine King Temple, 3327m) | Torii-gate wireframe (2 posts + curved top) | Slow opacity breathe |
| `cairn` | Ridge waypoints (`daohangja`, `maijianliang`, `taibailiang`) | 3 stacked octahedra, decreasing size | None (static) |
| `warning_sign` | `nantianmen` (South Heaven Gate — point of no return, 3300m) | Tall post + triangle sign, amber/red | **Aggressive**: constant jitter + local scanline pulse + flicker (Gemini review) |
| `summit_beacon` | `baxiantai` (拔仙台, 3767m peak) | Tall vertical pole + pulsing bright point + slow rotating ring | Pulse + rotate (most visually prominent landmark) |

### Weather Reactivity (from Gemini review)

When `weather === "blizzard"`:
- All landmarks gain horizontal jitter (±0.003 random offset per frame)
- Landmark opacity fluctuates (0.3–0.7 range) simulating "degraded sensor data"
- Summit beacon pulse speeds up (signal struggling)

### Night Mode

Landmark glow points (campfire, beacon, shrine) become brighter at night — they serve as navigational beacons on the darkened terrain.

## Section 6: Integration

### Modified: `TacticalMap3D.tsx`

Replace sphere+cylinder in `HikerMarker` (line 312) with:

```tsx
<group ref={markerRef}>
  <HikerRig3D
    healthPercent={healthPercent}
    lastAction={lastAction}
    turnNumber={turnNumber}
    isLost={isLost}
    isMoving={animRef.current.active}
    movementDuration={animRef.current.duration}
    weather={weather}
    timeOfDay={timeOfDay}
    gamePhase={gamePhase}
  />
  <HikerEffects
    hikerPosRef={hikerDisplayPos}
    isMoving={animRef.current.active}
    currentWaypointIndex={currentIndex}
    healthPercent={healthPercent}
    isLost={isLost}
  />
</group>
```

**Remove existing Y-axis bob** (lines 275, 304) — rig owns all secondary motion.

**Add `healthPercent` derivation** from store vitals (reuse TacticalMapLegacy formula).

**Add `turnNumber` selector** from store for animation trigger.

Add terrain detail components as Canvas siblings:

```tsx
<Canvas ...>
  <CameraController />
  <FogController />
  <GridFloor />
  <TerrainWireframe />
  <TrailLine />
  <WaypointMarkers />
  <HikerMarker />
  {/* New: terrain details */}
  <TerrainVegetation details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} />
  <TerrainRocks details={DETAIL_DATA} timeOfDay={timeOfDay} />
  <TerrainWater details={DETAIL_DATA} timeOfDay={timeOfDay} />
  <TerrainLandmarks details={DETAIL_DATA} timeOfDay={timeOfDay} weather={weather} currentIndex={currentIndex} />
</Canvas>
```

Where `DETAIL_DATA = generateTerrainDetails(WAYPOINTS, MESH_DATA)` is computed in `TacticalMap3D.tsx` at module scope, immediately after `MESH_DATA`, and passed as props to terrain detail components.

### Modified: `terrainMesh.ts`

Export additional data for detail placement. Note: `positions` is already exported via `TerrainMeshData`. New exports needed:
- Per-grid-cell terrain type array (`Float32Array` or `Uint8Array` indexed by `ix * GRID_Z + iz`)
- Grid constants `GRID_X` (128) and `GRID_Z` (64)
- `valueNoise` function (for consistent detail placement using same noise source)
- ~15 lines added, no logic changes.

### No New Dependencies

Everything uses `three`, `@react-three/fiber`, `@react-three/drei` already installed. `<Line>` from drei (which internally uses `Line2` / `LineMaterial` from `three-stdlib`) is the only new import from the existing drei package.

## Build Order

Two independent tracks:

### Track A: Hiker (ship first — highest visual impact)

1. `hikerPoses.ts` — define all 9 pose rotation targets
2. `hikerAnimator.ts` — blending state machine + walk cycle
3. `HikerRig3D.tsx` — skeleton rendering + pose application + color system
4. Wire into `HikerMarker` (replace sphere, remove Y-bob, add health/turn selectors)
5. `HikerEffects.tsx` — glitch overlay, afterimages, radar ping
6. Test: all 8 actions, movement, lost state, fog/blizzard visibility, night mode, defeat/victory freeze

### Track B: Terrain (ship second)

1. Extend `terrainMesh.ts` — export positions + terrain type per cell
2. `terrainDetails.ts` — placement generator with elevation scaling
3. `TerrainVegetation.tsx` + `TerrainRocks.tsx` — instanced props
4. `TerrainWater.tsx` — stream ribbons with opacity pulse
5. `TerrainLandmarks.tsx` — unique waypoint markers with weather reactivity
6. Test: all 13 waypoints × night/fog/blizzard, check z-fighting, density balance

## Performance Budget

| Category | Draw Calls | Instances/Vertices |
|----------|-----------|-------------------|
| Existing terrain wireframe | 1 | ~24K edge vertices |
| Existing trail + waypoints | 3 | ~140 trail points + 13 markers |
| **Hiker (new)** | ~18 | 12 solid meshes + 6 `<Line>` edges (head/spine/hips/legL/legR/pack) + 11 joint spheres |
| **Afterimage ghosts (new)** | 4 | 44 spheres total (11 × 4 ghosts) |
| **Terrain vegetation (new)** | 2–3 | ~300–600 instanced trees + 1 merged line batch |
| **Terrain rocks (new)** | 2–3 | ~200–500 instanced rocks + 1 merged line batch |
| **Terrain water (new)** | 1–2 | ~2 line objects per stream zone |
| **Landmarks (new)** | 6–10 | ~6 unique groups, ~15 meshes total |
| **Total** | ~38–45 | Well within Apple Silicon budget |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Hiker too small to read | drei `<Line>` with `lineWidth={2}` for fixed 2px; bad-weather forced opacity; tune proportions. Test at all 3 zoom levels. |
| Walk cycle without movement (push while lost) | Trigger from `currentWaypointIndex` change, not `lastAction`. Lost-push gets wandering idle. |
| Repeated actions don't retrigger | `turnNumber + lastAction + waypointIndex` trigger tuple. |
| Depth sorting (wireframe into body) | `depthWrite: false` on solid; higher `renderOrder` on edges. |
| Terrain props float above surface | Y sampled from exact `terrainMesh.ts` positions array. |
| Fog hides hiker | Forced minimum opacity in fog/blizzard. Current position always readable. |
| Afterimage performance | Joint-only ghosts (44 spheres), not full rig clones (132 meshes). |
| Stream animation API limits | Opacity pulse instead of animated dashes. |
| Landmark index drift | Bound by waypoint `id` string, not numeric index. |
| Animation during defeat/victory | `gamePhase` gate: freeze at current pose if not "playing". |
| Search ring + radar ping overlap | Radar ping uses cyan + Y offset to distinguish from red search ring. |
| Three.js object leaks | All geometry in `useMemo`, disposed in `useEffect` cleanup. |

## Out of Scope (Future Work)

- Custom shaders for per-body-part scanline fill (global CSS scanlines suffice for now)
- Multi-waypoint skip animation (game only allows ±1 per turn)
- NPC/animal entities on the trail
- OrbitControls camera interaction (known incompatibility, deferred)
- Procedural weather particles on terrain surface (snow accumulation, rain puddles)
- Backpack contents visualization
