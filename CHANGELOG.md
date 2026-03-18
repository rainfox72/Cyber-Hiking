# Changelog

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
