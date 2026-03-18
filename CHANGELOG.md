# Changelog

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
