# 3D Map Bug Fixes + Interactivity — Design Spec

**Date**: 2026-03-18
**Status**: Draft v3 (addresses Codex round-1 + round-2 issues + Gemini suggestions)
**Scope**: Fix 6 bugs in TacticalMap3D/TerrainAtmosphere, add lost-state visual displacement, smooth movement animation, and drag/scale OrbitControls

## Context: Current Bugs (from Codex/Gemini/Claude review of v3.0)

These bugs exist in the current `feature/visual-atmosphere-overhaul` branch:

1. **Lost-state wireframe red tint never resets** — `TerrainWireframe.useFrame` mutates the color buffer red when `isLost=true`, but never restores original colors when `isLost` flips back to `false`. Map stays permanently red-tinted after being found.
2. **Terrain reveal animation broken** — `revealProgressRef.current` is written in `useFrame` but read as a JSX prop (`opacity={... * revealProgressRef.current}`). Ref writes don't trigger React re-render, so opacity never visually animates.
3. **Double `.tactical-map` nesting in WebGL fallback** — `TacticalMap3D` wraps in `<div className="tactical-map">`, and `TacticalMapLegacy` also renders its own `.tactical-map` container. On WebGL failure: double borders, duplicate zoom controls.
4. **Three.js object leaks in TrailLine** — `useMemo` creates new `THREE.Line`, `BufferGeometry`, and `Material` objects on every `currentIndex` change without disposing previous ones.
5. **TerrainAtmosphere doesn't initialize on first mount** — `prevIndexRef` starts at `0`, so when `waypointIndex` is `0` at mount time, the effect early-returns. The initial waypoint never triggers the transition, and `--terrain-tint` CSS variable is never set until first movement.
6. **Documentation overstates shipped features** — CHANGELOG.md claims terrain reveal works (it doesn't). Lists `@react-three/drei` as required but nothing imports it. CLAUDE.md references reveal effects that are broken.

## Overview

Two-phase approach: fix all bugs first (stable foundation), then add interactivity features.

**Phase 1 — Bug Fixes**: 6 targeted fixes to existing components.
**Phase 2 — Interactivity**: Lost-state displacement, movement animation, OrbitControls.

## Section 1: Bug Fixes

### Fix 1 — Lost-state wireframe red tint reset

**File**: `src/components/map/TacticalMap3D.tsx` — `TerrainWireframe` component

**Fix**: Add `wasTintedRef` flag. When `isLost` is true, tint red using sine-wave modulation (not raw `Math.random()`) for a smoother "dying monitor" flicker. When `isLost` flips false, restore original colors from `meshData.edgeColors`.

```tsx
const wasTintedRef = useRef(false);

useFrame(({ clock }, delta) => {
  // ... reveal logic ...

  if (isLost && lineRef.current) {
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    const baseColors = meshData.edgeColors;
    const arr = colors.array as Float32Array;
    // Sine-wave flicker for "dying monitor" feel (Gemini suggestion)
    const flickerR = 0.9 + Math.sin(clock.elapsedTime * 20) * 0.1;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = baseColors[i] * 0.5 + flickerR * 0.5;
      arr[i + 1] = baseColors[i + 1] * 0.3;
      arr[i + 2] = baseColors[i + 2] * 0.3;
    }
    colors.needsUpdate = true;
    wasTintedRef.current = true;
  } else if (wasTintedRef.current && lineRef.current) {
    // Restore original colors
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    (colors.array as Float32Array).set(meshData.edgeColors);
    colors.needsUpdate = true;
    wasTintedRef.current = false;
  }
});
```

### Fix 2 — Terrain reveal animation

**File**: `src/components/map/TacticalMap3D.tsx` — `TerrainWireframe` component

**Fix**: Directly mutate the material's `opacity` in `useFrame` instead of passing it as a JSX prop. Remove `opacity` from JSX `<lineBasicMaterial>` props.

```tsx
useFrame((_, delta) => {
  // ... reveal progress logic (revealProgressRef) ...

  if (lineRef.current) {
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    const nightDim = timeOfDay === "night" ? 0.6 : timeOfDay === "dusk" ? 0.8 : 1.0;
    mat.opacity = nightDim * revealProgressRef.current;
  }
});
```

### Fix 3 — Double `.tactical-map` nesting

**Files**: `src/components/map/TacticalMapLegacy.tsx`, `src/components/map/TacticalMap3D.tsx`

**Fix** (addressing Codex feedback — `bare` must strip BOTH wrapper AND controls):

`TacticalMapLegacy` accepts `bare` prop. When `bare=true`:
- Skips outer `.tactical-map` div
- Skips zoom controls (parent owns controls)
- Skips `onWheel` handler (parent handles zoom)

```tsx
export function TacticalMapLegacy({ bare = false }: { bare?: boolean }) {
  // ... existing state/logic ...

  const svgContent = (
    <div className="tactical-map__perspective">
      <svg ...>{/* existing SVG content */}</svg>
    </div>
  );

  if (bare) return svgContent;

  return (
    <div className="tactical-map" onWheel={handleWheel}>
      <div className="tactical-map__zoom-controls">...</div>
      {svgContent}
    </div>
  );
}
```

In `TacticalMap3D`:
```tsx
<WebGLErrorBoundary fallback={<TacticalMapLegacy bare />}>
```

**Fallback rendering**: When WebGL fails, the error boundary renders `<TacticalMapLegacy bare={false} />` — the full standalone legacy map with its own `.tactical-map` wrapper, zoom controls, and wheel handler. The parent `TacticalMap3D`'s outer div is hidden via conditional rendering when the fallback is active (use a state flag set by the error boundary). This ensures the legacy map has full zoom functionality on WebGL failure.

**Normal (3D) mode**: The parent `TacticalMap3D` owns the outer `.tactical-map` div and the recenter button. Legacy is rendered `bare` only as a theoretical fallback.

### Fix 4 — Three.js object leaks in TrailLine

**File**: `src/components/map/TacticalMap3D.tsx` — `TrailLine` component

**Fix** (Codex feedback: do NOT dispose inside `useMemo` — use `useEffect` cleanup):

```tsx
// Track created objects in refs
const traversedLineRef = useRef<THREE.Line | null>(null);
const futureLineRef = useRef<THREE.Line | null>(null);

// Create line objects in useMemo (no side effects)
const traversedLine = useMemo(() => { ... create line ... }, [traversedGeo]);
const futureLine = useMemo(() => { ... create line ... }, [futureGeo]);

// Dispose in useEffect cleanup (correct lifecycle)
useEffect(() => {
  traversedLineRef.current = traversedLine;
  return () => {
    if (traversedLineRef.current) {
      traversedLineRef.current.geometry.dispose();
      (traversedLineRef.current.material as THREE.Material).dispose();
    }
  };
}, [traversedLine]);

// Same pattern for futureLine
```

### Fix 5 — TerrainAtmosphere first-mount initialization

**File**: `src/components/effects/TerrainAtmosphere.tsx`

**Fix**: Initialize `prevIndexRef` to `-1` and use `useLayoutEffect` to avoid a flash of incorrect state:

```tsx
const prevIndexRef = useRef(-1);
```

### Fix 6 — Documentation accuracy

After all code fixes are applied, docs become accurate:
- CHANGELOG terrain reveal → works after Fix 2
- CHANGELOG `@react-three/drei` → imported after Section 4 (OrbitControls)
- CLAUDE.md reveal effects → works after Fix 2

## Section 2: Lost-State Visual Displacement

**File**: `src/components/map/TacticalMap3D.tsx` — `HikerMarker` component

### Behavior

When `isLost` is true:
- Hiker marker drifts off the trail into surrounding terrain
- Drift magnitude driven by `lostTurns` value (not per-frame randomness)
- A pulsing search radius ring appears around the displaced position
- Camera follows the displaced position

When `isLost` flips back to false:
- Hiker smoothly animates back to the correct trail position (0.5s lerp)
- Search ring fades out

### Edge Case: Lost During Movement Animation

A `push_forward` action can both advance `currentWaypointIndex` AND set `isLost` in the same turn. **Rule**: movement animation completes first (hiker arrives at new waypoint), THEN lost drift is applied from the arrival position. This prevents contradictory camera targets and visual snapping.

Implementation: in the `useFrame` loop, check `animRef.current.active` before applying drift. Only apply drift when `!anim.active`.

### Implementation (Codex-revised: lostTurns-driven, not per-frame noise)

```tsx
const isLost = useGameStore((s) => s.player.isLost);
const lostTurns = useGameStore((s) => s.player.lostTurns);

const driftRef = useRef({
  offset: new THREE.Vector3(),
  direction: 0, // angle in radians, set once when becoming lost
  prevLost: false,
  prevLostTurns: 0,
});

useFrame((_, delta) => {
  const d = driftRef.current;
  const truePos = meshData.waypointPositions[Math.min(currentIndex, ...)];

  if (isLost && !d.prevLost) {
    // Just got lost: pick a persistent drift direction
    d.direction = Math.random() * Math.PI * 2;
    d.prevLostTurns = 0;
    d.prevLost = true;
  }

  if (isLost && lostTurns !== d.prevLostTurns) {
    // New turn while lost: update target offset based on lostTurns
    d.prevLostTurns = lostTurns;
    const magnitude = Math.min(0.3 + lostTurns * 0.25, 1.5);
    // Small wobble per turn (seeded, not random per frame)
    const wobble = (lostTurns * 0.3) % (Math.PI * 2);
    d.offset.set(
      Math.cos(d.direction + wobble * 0.2) * magnitude,
      0,
      Math.sin(d.direction + wobble * 0.2) * magnitude,
    );
  }

  if (isLost) {
    // Smooth ease toward target offset (not instant snap)
    // Already at target — just hold position
  } else if (d.prevLost) {
    // Found: lerp back to trail
    d.offset.lerp(new THREE.Vector3(), delta * 3);
    if (d.offset.length() < 0.01) {
      d.offset.set(0, 0, 0);
      d.prevLost = false;
    }
  }

  // Only apply drift if not mid-movement-animation
  const displayPos = animRef.current.active
    ? currentAnimPos  // movement animation position
    : truePos.clone().add(d.offset);

  // Write to shared position ref for camera
  hikerDisplayPosRef.current.copy(displayPos);
});
```

### Search Radius Ring

```tsx
function SearchRing({ position, lostTurns }: { position: THREE.Vector3; lostTurns: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const radius = 0.4 + lostTurns * 0.15;

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(clock.elapsedTime * 4) * 0.2;
    }
  });

  return (
    <mesh ref={ringRef} position={[position.x, 0.02, position.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius, 32]} />
      <meshBasicMaterial color="#ff2222" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}
```

## Section 3: Smooth Movement Animation

**File**: `src/components/map/TacticalMap3D.tsx` — `HikerMarker` component

### Behavior

When `currentWaypointIndex` changes via `push_forward` or `descend`:
1. Animate hiker from old waypoint position to new waypoint position
2. Duration: `push_forward` = 2.5s, `descend` = 1.5s, others = instant
3. Ease-in-out interpolation
4. During animation: scan beam stretches, bob speeds up
5. Camera follows the moving hiker position
6. If another action fires mid-animation, snap to destination instantly

### Path Sampling (Codex-revised: use waypointPositions directly)

Instead of sampling `trailPoints` via distance ratios (unreliable due to index-space mismatch), **lerp directly between `waypointPositions[oldIdx]` and `waypointPositions[newIdx]`**. This is simpler and avoids the distance-ratio conversion bug.

For longer segments (multi-waypoint skips are not possible in the game — only +1/-1 waypoint per turn), a single lerp between adjacent waypoint positions is sufficient. The path follows the terrain surface since both endpoints are on-surface positions.

```tsx
useEffect(() => {
  if (currentIndex === prevIndexRef.current) return;
  const oldIdx = prevIndexRef.current;
  prevIndexRef.current = currentIndex;

  // Mid-animation interruption: snap previous animation to destination
  if (animRef.current.active) {
    animRef.current.active = false;
    // Position will be updated in next useFrame to endPos
  }

  const durations: Record<string, number> = {
    push_forward: 2.5,
    descend: 1.5,
  };
  const dur = durations[lastAction ?? ""] ?? 0;
  if (dur === 0) return;

  const startPos = meshData.waypointPositions[Math.min(oldIdx, meshData.waypointPositions.length - 1)];
  const endPos = meshData.waypointPositions[Math.min(currentIndex, meshData.waypointPositions.length - 1)];

  animRef.current = {
    active: true,
    progress: 0,
    duration: dur,
    startPos: startPos.clone(),
    endPos: endPos.clone(),
  };
}, [currentIndex]);

useFrame((_, delta) => {
  const anim = animRef.current;
  if (!anim.active) return;

  anim.progress += delta / anim.duration;
  if (anim.progress >= 1) {
    anim.active = false;
    anim.progress = 1;
  }

  // Ease-in-out
  const t = anim.progress < 0.5
    ? 2 * anim.progress * anim.progress
    : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;

  const pos = anim.startPos.clone().lerp(anim.endPos, t);

  if (markerRef.current) {
    markerRef.current.position.copy(pos);
    markerRef.current.position.y += 0.15 + Math.sin(performance.now() / 150) * 0.02;
  }

  hikerDisplayPosRef.current.copy(pos);
});
```

## Section 4: Drag & Scale (OrbitControls)

**File**: `src/components/map/TacticalMap3D.tsx`

### Dependencies

- `@react-three/drei` — `OrbitControls` component (already installed, now actually imported)

### Implementation (Codex-revised: don't fight user interaction)

```tsx
import { OrbitControls } from "@react-three/drei";

function CameraSystem() {
  const controlsRef = useRef<any>(null);
  const isUserControllingRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const autoOrbitRef = useRef(true);
  const isTargetFollowingRef = useRef(true); // also paused during user interaction
  const defaultCameraState = useRef({ azimuth: 0, polar: 1.0, distance: 4 });

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    // Only lerp target when target-following is active
    // (paused during AND after interaction, resumes with auto-orbit after 5s)
    if (isTargetFollowingRef.current) {
      controlsRef.current.target.lerp(hikerDisplayPosRef.current, 0.05);
    }

    // Auto-orbit when not user-controlled
    if (autoOrbitRef.current && !isUserControllingRef.current) {
      const azimuth = controlsRef.current.getAzimuthalAngle();
      controlsRef.current.setAzimuthalAngle(azimuth + delta * 0.5 * (Math.PI / 180));
    }

    controlsRef.current.update();
  });

  const handleStart = () => {
    isUserControllingRef.current = true;
    autoOrbitRef.current = false;
    isTargetFollowingRef.current = false; // stop chasing hiker
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  };

  const handleEnd = () => {
    isUserControllingRef.current = false;
    // Both auto-orbit AND target-following resume together after 5s
    inactivityTimerRef.current = window.setTimeout(() => {
      autoOrbitRef.current = true;
      isTargetFollowingRef.current = true;
    }, 5000);
  };

  // Cleanup timer on unmount (Codex fix)
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minPolarAngle={0.3}
      maxPolarAngle={Math.PI / 2.2}
      minDistance={1.5}
      maxDistance={8}
      enableDamping
      dampingFactor={0.05}
      onStart={handleStart}
      onEnd={handleEnd}
    />
  );
}
```

### Recenter Button

```tsx
function RecenterButton({ onRecenter }: { onRecenter: () => void }) {
  return (
    <div className="tactical-map__controls">
      <button onClick={onRecenter} title="Recenter on hiker">⌖</button>
    </div>
  );
}
```

Styled with neon green + glow matching the CRT aesthetic (Gemini suggestion):
```css
.tactical-map__controls button {
  color: var(--neon-green);
  text-shadow: 0 0 6px var(--neon-green-glow);
}
```

On click: snap `controls.target` to `hikerDisplayPosRef.current`, reset azimuth/polar/distance to defaults stored in `defaultCameraState.current`, re-enable `autoOrbitRef`.

### Shared State: Hiker Display Position

Pass a ref from parent `TacticalMap3D` to both `HikerMarker` and `CameraSystem` via props (Codex suggestion — avoids module-level singleton issues):

```tsx
export function TacticalMap3D() {
  const hikerPosRef = useRef(new THREE.Vector3());

  return (
    <Canvas ...>
      <HikerMarker hikerPosRef={hikerPosRef} />
      <CameraSystem hikerPosRef={hikerPosRef} />
      ...
    </Canvas>
  );
}
```

`HikerMarker` writes to `hikerPosRef.current` in its `useFrame` (priority 1).
`CameraSystem` reads `hikerPosRef.current` in its `useFrame` (priority 2).

R3F `useFrame` priority ensures correct read-after-write ordering.

## Files Summary

| File | Action | Changes |
|------|--------|---------|
| `src/components/map/TacticalMap3D.tsx` | Modify | All 4 sections: bug fixes, displacement, animation, OrbitControls |
| `src/components/map/TacticalMapLegacy.tsx` | Modify | Add `bare` prop (strips wrapper + controls) |
| `src/components/effects/TerrainAtmosphere.tsx` | Modify | Fix first-mount init (`prevIndexRef = -1`) |
| `src/App.css` | Modify | Replace zoom controls with recenter button |
| `CHANGELOG.md` | Modify | Add v3.1 entry after all fixes/features |
| `CLAUDE.md` | Modify | Accuracy fixes if needed after implementation |

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| OrbitControls conflicts with auto-orbit | Both target-following AND auto-orbit paused during user interaction; both resume together after 5s timeout + unmount cleanup |
| Movement animation + lost state simultaneous | Rule: movement completes first, then drift applies. Checked via `animRef.current.active` |
| Lost-state drift too extreme or too subtle | lostTurns-driven magnitude (0.3 base + 0.25/turn, capped 1.5); tunable constants |
| Three.js disposal misses objects | `useEffect` cleanup (not `useMemo` side-effects); tracks objects in refs |
| Shared hiker position ref frame ordering | Passed via props from parent; `useFrame` priorities ensure write-before-read |
| Path sampling mismatch | Simplified to direct lerp between `waypointPositions` (no distance-ratio conversion) |
