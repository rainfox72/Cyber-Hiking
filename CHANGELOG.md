# Changelog

## [4.0] - 2026-03-19

### Features
- Full-bleed 3D Canvas fills viewport with floating translucent instrument panels
- Skydome3D: in-scene gradient sky sphere with twinkling stars (replaces CSS Skybox)
- SceneLighting: ambient + directional lights driven by time-of-day and weather
- SceneFog: continuous FogExp2 with weather/band-driven density and color
- WeatherParticles3D: 3D snow/blizzard (Points) + rain/wind (LineSegments) in camera-relative space
- Terrain color compositor: band tinting + snow accumulation + rain darkening + lost-state red flicker
- Band-aware terrain detail density (trees thin at altitude, rocks peak mid-range)
- CameraDirector: action impulses (push dolly, camp lower, fall shake, summit crane) + state mods (heartbeat FOV, night tighten, blizzard jitter, lost wobble)
- PostFXController: Bloom (threshold 0.9, earned glow), Vignette (vital-driven), DepthOfField (lost blur), ChromaticAberration (fall shock), Noise (critical vitals)
- DangerOverlay: CSS frost edges (cold) + panel border color escalation
- VisualStateBridge: single Zustand subscriber distributing derived visual state via context + ref
- Visual event dispatch system (lastVisualEvent) for one-shot PostFX triggers
- FogPlanes: rolling fog bank noise planes for fog/blizzard weather
- LightningController: event-driven storm lightning (0-2 flashes per weather change)
- SceneAlerts: 3D event warnings near hiker (OFF TRAIL, BLIZZARD, FALL, NIGHT TRAVEL, critical events)
- Map drag & zoom: left-click drag to orbit, scroll/pinch to zoom (1.5-10x), auto-resumes orbit after 4s
- prefers-reduced-motion CSS support

### Design Rationale
- "Unified Scene" approach: all atmosphere/weather/lighting inside R3F Canvas, perception effects in postprocessing, minimal CSS overlays. Replaces layered CSS/canvas stack.
- Three-layer architecture: world-space (R3F), screen-space (postprocessing), UI-space (DOM)
- Terrain details migrated from MeshBasicMaterial to MeshLambertMaterial for directional light response
- Camera drama communicates action impact through physical motion, not UI overlays

### Notes
- Retired components kept for WebGL fallback: Skybox.tsx, ParticleCanvas.tsx, TerrainAtmosphere.tsx, Vignette.tsx
- Reviewed by Codex (technical) and Gemini (art direction) at each checkpoint
- Spec: docs/superpowers/specs/2026-03-19-3d-visual-atmosphere-overhaul-design.md

## [3.2] - 2026-03-18

### Features
- Animated 3D hiker with 11-joint skeleton, 9 action-driven poses, smooth blending
- Hybrid tactical hologram rendering (solid mesh + Line edges + joint glow)
- Walk cycle synced to movement animation (push_forward / descend)
- CRT glitch transitions on action change (opacity pulse + jitter + color shift)
- Trail afterimages during movement (4 joint-only ghost copies)
- Radar ping on waypoint arrival (expanding ring)
- Procedural terrain details: trees, grass, rocks, debris per terrain type
- Animated stream valley water ribbons
- 6 unique waypoint landmarks (trailhead gate, shelter, shrine, cairn, warning sign, summit beacon)
- Weather reactivity on landmarks (blizzard jitter, night glow)
- Elevation-driven vegetation scaling (smaller trees at altitude)
- Bad-weather hiker visibility enforcement

### Design Rationale
- "Hybrid Tactical Hologram" rendering chosen for readability at small scale + CRT aesthetic
- drei `<Line>` (Line2) for fixed 2px edge width regardless of zoom
- Joint-only afterimages instead of full rig clones for performance
- InstancedMesh for vegetation/rocks, merged LineSegments for wire details
- Landmarks bound by waypoint ID (not index) for stability

## [3.1] - 2026-03-18

### Bug Fixes
- Lost-state wireframe red tint now properly resets when player finds the trail
- Terrain reveal uses subtle dim (0.7→1.0) instead of full blackout flash
- Reveal animation works via direct material opacity mutation in useFrame
- Wireframe lost-state flicker uses smooth sine-wave instead of raw random
- TerrainAtmosphere initializes correctly on first mount
- TacticalMapLegacy supports bare prop for future fallback nesting fix

### Features
- **Lost-state displacement**: hiker visually drifts off-trail when lost (lostTurns-driven magnitude), with pulsing red search radius ring on terrain surface
- **Smooth movement animation**: hiker interpolates along trail on push_forward (2.5s) and descend (1.5s) with ease-in-out
- **Camera follows displaced hiker**: camera targets the visual hiker position (not the true waypoint) via shared ref

### Known Limitations
- OrbitControls (drei) crashes R3F Canvas — drag/scale deferred to future release. Using custom CameraController with auto-orbit instead.

## [3.0] - 2026-03-17

### Features
- **Skybox system**: Time-of-day gradient backgrounds (6 phases: dawn, morning, midday, afternoon, dusk, night) with smooth opacity crossfade transitions. Twinkling star canvas at night. Weather-modified gradients (cloudy/fog push toward gray, blizzard toward white).
- **Terrain atmosphere**: SVG noise filters and CSS gradient overlays per terrain type (7 types). Crossfade transitions between waypoints. Altitude-driven cold-shift and desaturation above 3200m.
- **3D tactical map**: Three.js WebGL wireframe heightmap replaces SVG isometric map. Per-vertex elevation coloring (green < 2500m, amber 2500-3200m, red > 3500m). Trail line, waypoint octahedra, hiker scan beam. Auto-orbit camera with smooth tracking. Fog effects for weather states. Lost-state camera shake and red wireframe tint. Terrain reveal animation on waypoint arrival. Falls back to SVG legacy map on WebGL failure.
- **Panel transparency**: UI panels use semi-transparent backgrounds so atmosphere layers show through gaps and faintly behind panels.

### Design Rationale
- Three independent composable layers (Skybox, TerrainAtmosphere, TacticalMap3D) that each read from Zustand store — no cross-dependencies.
- CRT tactical aesthetic deepened without changing it — dark gradients, neon wireframes, procedural noise all fit the existing identity.
- Night atmosphere consolidated in Skybox (removed from ParticleCanvas) to avoid double-tinting.

### Notes
- Requires `three`, `@react-three/fiber`, `@react-three/drei` dependencies
- Vite dev server port changed to 3100 (from 5173)
- SVG map preserved as `TacticalMapLegacy.tsx` for WebGL fallback
- `--sky-tint` and `--terrain-tint` CSS variables available for optional panel toning (opt-in)

## [2.6] - Previous

Ghost in the Machine: AI intent, resource economy, repo cleanup
