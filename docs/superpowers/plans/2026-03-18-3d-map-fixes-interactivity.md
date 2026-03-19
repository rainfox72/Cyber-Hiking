# 3D Map Bug Fixes + Interactivity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 bugs in the v3.0 3D map/atmosphere layers and add lost-state displacement, smooth movement animation, and OrbitControls drag/scale.

**Architecture:** Phase 1 fixes bugs in existing components with surgical edits. Phase 2 rewires HikerMarker with drift/animation state, replaces CameraController with OrbitControls-based CameraSystem, and adds SearchRing. A shared `hikerPosRef` (passed from parent) coordinates hiker and camera positions with `useFrame` priorities.

**Tech Stack:** React 19, TypeScript, Three.js, @react-three/fiber, @react-three/drei (OrbitControls), Zustand 5.

**Spec:** `docs/superpowers/specs/2026-03-17-3d-map-fixes-interactivity-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/map/TacticalMap3D.tsx` | Modify | Bug fixes 1-4, all Phase 2 features |
| `src/components/map/TacticalMapLegacy.tsx` | Modify | Bug fix 3 (bare prop) |
| `src/components/effects/TerrainAtmosphere.tsx` | Modify | Bug fix 5 (first-mount init) |
| `src/App.css` | Modify | Replace zoom controls with recenter button |
| `CHANGELOG.md` | Modify | v3.1 entry |
| `CLAUDE.md` | Modify | Accuracy updates |

---

## Phase 1: Bug Fixes

### Task 1: Fix TerrainAtmosphere first-mount + wireframe tint reset + reveal animation

**Files:**
- Modify: `src/components/effects/TerrainAtmosphere.tsx:62`
- Modify: `src/components/map/TacticalMap3D.tsx:30-76`

- [ ] **Step 1: Fix TerrainAtmosphere `prevIndexRef` init**

In `src/components/effects/TerrainAtmosphere.tsx`, change line 62 from:
```tsx
const prevIndexRef = useRef(0);
```
to:
```tsx
const prevIndexRef = useRef(-1);
```

- [ ] **Step 2: Fix wireframe tint reset in `TerrainWireframe`**

In `src/components/map/TacticalMap3D.tsx`, replace the `useFrame` in `TerrainWireframe` (lines 46-66) with:

```tsx
const wasTintedRef = useRef(false);

useFrame(({ clock }, delta) => {
  // Reveal animation
  if (currentIndex !== prevIndexRef.current) {
    prevIndexRef.current = currentIndex;
    revealProgressRef.current = 0;
  }
  if (revealProgressRef.current < 1) {
    revealProgressRef.current = Math.min(1, revealProgressRef.current + delta * 1.5);
  }

  // Lost-state tint with sine-wave flicker + reset
  if (isLost && lineRef.current) {
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    const baseColors = meshData.edgeColors;
    const arr = colors.array as Float32Array;
    const flickerR = 0.9 + Math.sin(clock.elapsedTime * 20) * 0.1;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] = baseColors[i] * 0.5 + flickerR * 0.5;
      arr[i + 1] = baseColors[i + 1] * 0.3;
      arr[i + 2] = baseColors[i + 2] * 0.3;
    }
    colors.needsUpdate = true;
    wasTintedRef.current = true;
  } else if (wasTintedRef.current && lineRef.current) {
    const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
    (colors.array as Float32Array).set(meshData.edgeColors);
    colors.needsUpdate = true;
    wasTintedRef.current = false;
  }

  // Direct material opacity mutation (fix reveal animation)
  if (lineRef.current) {
    const mat = lineRef.current.material as THREE.LineBasicMaterial;
    const nightDim = timeOfDay === "night" ? 0.6 : timeOfDay === "dusk" ? 0.8 : 1.0;
    mat.opacity = nightDim * revealProgressRef.current;
  }
});
```

Also remove the `opacity` prop from the JSX — change line 73 from:
```tsx
<lineBasicMaterial vertexColors transparent opacity={opacity * revealProgressRef.current} />
```
to:
```tsx
<lineBasicMaterial vertexColors transparent />
```

And remove the `const opacity = ...` line (69).

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/effects/TerrainAtmosphere.tsx src/components/map/TacticalMap3D.tsx
git commit -m "fix: wireframe tint reset, reveal animation, TerrainAtmosphere init"
```

---

### Task 2: Fix fallback nesting + TrailLine object leaks

**Files:**
- Modify: `src/components/map/TacticalMapLegacy.tsx:40-115`
- Modify: `src/components/map/TacticalMap3D.tsx:86-147,270-302`

- [ ] **Step 1: Add `bare` prop to `TacticalMapLegacy`**

Change the function signature (line 40) and restructure to support `bare` mode — when `bare=true`, return only the SVG perspective wrapper (no outer div, no controls, no wheel handler):

```tsx
export function TacticalMapLegacy({ bare = false }: { bare?: boolean }) {
```

Wrap the SVG content in a variable, then conditionally render with or without the outer wrapper. When `bare=true`, return just the perspective div + SVG.

- [ ] **Step 2: Fix fallback in `TacticalMap3D` — use state flag for WebGL failure**

Replace the error boundary + main component to handle WebGL failure properly:

```tsx
class WebGLErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch() { this.props.onError(); }
  render() {
    // Render null on error — TacticalMap3D handles fallback via webglFailed state
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
```

In `TacticalMap3D`, track `webglFailed` state:
```tsx
export function TacticalMap3D() {
  const [webglFailed, setWebglFailed] = useState(false);

  if (webglFailed) return <TacticalMapLegacy />;

  return (
    <div className="tactical-map">
      <RecenterButton onRecenter={handleRecenter} />
      <WebGLErrorBoundary onError={() => setWebglFailed(true)}>
        <Canvas ...>...</Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 3: Add `useEffect` cleanup for TrailLine object disposal**

In the `TrailLine` component, after the `useMemo` blocks that create `traversedLine` and `futureLine`, add cleanup effects:

```tsx
const traversedLineRef = useRef<THREE.Line | null>(null);
const futureLineRef = useRef<THREE.Line | null>(null);

useEffect(() => {
  traversedLineRef.current = traversedLine;
  return () => {
    if (traversedLineRef.current) {
      traversedLineRef.current.geometry.dispose();
      (traversedLineRef.current.material as THREE.Material).dispose();
    }
  };
}, [traversedLine]);

useEffect(() => {
  futureLineRef.current = futureLine;
  return () => {
    if (futureLineRef.current) {
      futureLineRef.current.geometry.dispose();
      (futureLineRef.current.material as THREE.Material).dispose();
    }
  };
}, [futureLine]);
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/TacticalMapLegacy.tsx src/components/map/TacticalMap3D.tsx
git commit -m "fix: fallback nesting, TrailLine Three.js object disposal"
```

---

## Phase 2: Interactivity Features

### Task 3: Lost-state hiker displacement + search ring

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx` — HikerMarker component

- [ ] **Step 1: Add `hikerPosRef` prop and lost-state drift to `HikerMarker`**

Update `HikerMarker` to accept `hikerPosRef` prop and add drift logic:

```tsx
interface HikerMarkerProps {
  hikerPosRef: React.MutableRefObject<THREE.Vector3>;
}

function HikerMarker({ hikerPosRef }: HikerMarkerProps) {
  const meshData = MESH_DATA;
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const lastAction = useGameStore((s) => s.lastAction);
  const isLost = useGameStore((s) => s.player.isLost);
  const lostTurns = useGameStore((s) => s.player.lostTurns);
  const markerRef = useRef<THREE.Group>(null);
  const prevIndexRef = useRef(0);

  // Drift state
  const driftRef = useRef({
    offset: new THREE.Vector3(),
    direction: 0,
    prevLost: false,
    prevLostTurns: 0,
  });

  // Animation state (for Task 4)
  const animRef = useRef({
    active: false,
    progress: 0,
    duration: 0,
    startPos: new THREE.Vector3(),
    endPos: new THREE.Vector3(),
  });

  useFrame(({ clock }, delta) => {
    const d = driftRef.current;
    const truePos = meshData.waypointPositions[
      Math.min(currentIndex, meshData.waypointPositions.length - 1)
    ];

    // Lost drift logic (only when not mid-animation)
    if (!animRef.current.active) {
      if (isLost && !d.prevLost) {
        d.direction = Math.random() * Math.PI * 2;
        d.prevLostTurns = 0;
        d.prevLost = true;
      }

      if (isLost && lostTurns !== d.prevLostTurns) {
        d.prevLostTurns = lostTurns;
        const magnitude = Math.min(0.3 + lostTurns * 0.25, 1.5);
        const wobble = (lostTurns * 0.3) % (Math.PI * 2);
        d.offset.set(
          Math.cos(d.direction + wobble * 0.2) * magnitude,
          0,
          Math.sin(d.direction + wobble * 0.2) * magnitude,
        );
      }

      if (!isLost && d.prevLost) {
        d.offset.lerp(new THREE.Vector3(), delta * 3);
        if (d.offset.length() < 0.01) {
          d.offset.set(0, 0, 0);
          d.prevLost = false;
        }
      }
    }

    // Compute display position
    const displayPos = truePos.clone().add(d.offset);

    // Update marker
    if (markerRef.current) {
      markerRef.current.position.copy(displayPos);
      markerRef.current.position.y += 0.15 + Math.sin(clock.elapsedTime * 2) * 0.02;
    }

    // Write to shared ref for camera (priority 1)
    hikerPosRef.current.copy(displayPos);
    hikerPosRef.current.y += 0.5;
  }, 1); // useFrame priority 1

  return (
    <>
      <group ref={markerRef} position={[0, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.04, 8, 8]} />
          <meshBasicMaterial color="#00ff41" />
        </mesh>
        <mesh position={[0, 0.15, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.3, 4]} />
          <meshBasicMaterial color="#00ff41" transparent opacity={0.4} />
        </mesh>
      </group>
      {isLost && (
        <SearchRing posRef={hikerPosRef} lostTurns={lostTurns} />
      )}
    </>
  );
}
```

- [ ] **Step 2: Add `SearchRing` component**

Add above the `HikerMarker` function:

```tsx
function SearchRing({ posRef, lostTurns }: {
  posRef: React.MutableRefObject<THREE.Vector3>;
  lostTurns: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const radius = 0.4 + lostTurns * 0.15;

  useFrame(({ clock }) => {
    if (ringRef.current) {
      // Track hiker position every frame (not stale prop snapshot)
      ringRef.current.position.x = posRef.current.x;
      ringRef.current.position.z = posRef.current.z;
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(clock.elapsedTime * 4) * 0.2;
    }
  });

  return (
    <mesh ref={ringRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.02, radius, 32]} />
      <meshBasicMaterial color="#ff2222" transparent opacity={0.5} side={THREE.DoubleSide} />
    </mesh>
  );
}
```

- [ ] **Step 3: Update `TacticalMap3D` to pass `hikerPosRef`**

In the main `TacticalMap3D` component, create the ref and pass it:

```tsx
export function TacticalMap3D() {
  const hikerPosRef = useRef(new THREE.Vector3());
  // ...
  <HikerMarker hikerPosRef={hikerPosRef} />
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx
git commit -m "feat: lost-state hiker displacement + pulsing search ring"
```

---

### Task 4: Smooth movement animation

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx` — HikerMarker component

- [ ] **Step 1: Add movement animation to `HikerMarker`**

Add `useEffect` for detecting waypoint changes and starting animation. Add animation logic to `useFrame`. The `animRef` is already declared in Task 3.

Inside `HikerMarker`, add before the `useFrame`:

```tsx
useEffect(() => {
  if (currentIndex === prevIndexRef.current) return;
  const oldIdx = prevIndexRef.current;
  prevIndexRef.current = currentIndex;

  // Snap previous animation if mid-flight
  if (animRef.current.active) {
    animRef.current.active = false;
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
```

Update the `useFrame` to handle animation before drift:

```tsx
useFrame(({ clock }, delta) => {
  const anim = animRef.current;
  const d = driftRef.current;

  // Movement animation
  if (anim.active) {
    anim.progress += delta / anim.duration;
    if (anim.progress >= 1) {
      anim.active = false;
      anim.progress = 1;
    }

    const t = anim.progress < 0.5
      ? 2 * anim.progress * anim.progress
      : 1 - Math.pow(-2 * anim.progress + 2, 2) / 2;

    const pos = anim.startPos.clone().lerp(anim.endPos, t);

    if (markerRef.current) {
      markerRef.current.position.copy(pos);
      markerRef.current.position.y += 0.15 + Math.sin(clock.elapsedTime * 4) * 0.02;
    }
    hikerPosRef.current.copy(pos);
    hikerPosRef.current.y += 0.5;
    return; // Skip drift during animation
  }

  // ... existing drift + bob logic from Task 3 ...
}, 1);
```

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx
git commit -m "feat: smooth movement animation along trail (2.5s push, 1.5s descend)"
```

---

### Task 5: OrbitControls drag/scale + recenter button

**Files:**
- Modify: `src/components/map/TacticalMap3D.tsx` — replace CameraController with CameraSystem
- Modify: `src/App.css` — replace zoom controls CSS

- [ ] **Step 0: Verify @react-three/drei is installed**

Run: `ls node_modules/@react-three/drei/package.json 2>/dev/null && echo "installed" || npm install @react-three/drei`

- [ ] **Step 1: Add drei import and `CameraSystem` component**

Add import at the top of `TacticalMap3D.tsx`:
```tsx
import { OrbitControls } from "@react-three/drei";
```

Replace the entire `CameraController` function with `CameraSystem`:

```tsx
interface CameraSystemProps {
  hikerPosRef: React.MutableRefObject<THREE.Vector3>;
  recenterRef: React.MutableRefObject<(() => void) | null>;
}

function CameraSystem({ hikerPosRef, recenterRef }: CameraSystemProps) {
  const controlsRef = useRef<any>(null);
  const isUserControllingRef = useRef(false);
  const inactivityTimerRef = useRef<number | null>(null);
  const autoOrbitRef = useRef(true);
  const isTargetFollowingRef = useRef(true);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    if (isTargetFollowingRef.current) {
      controlsRef.current.target.lerp(hikerPosRef.current, 0.05);
    }

    if (autoOrbitRef.current && !isUserControllingRef.current) {
      const azimuth = controlsRef.current.getAzimuthalAngle();
      controlsRef.current.setAzimuthalAngle(azimuth + delta * 0.5 * (Math.PI / 180));
    }

    controlsRef.current.update();
  }, 2); // priority 2 — reads after HikerMarker writes

  const handleStart = () => {
    isUserControllingRef.current = true;
    autoOrbitRef.current = false;
    isTargetFollowingRef.current = false;
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
  };

  const handleEnd = () => {
    isUserControllingRef.current = false;
    inactivityTimerRef.current = window.setTimeout(() => {
      autoOrbitRef.current = true;
      isTargetFollowingRef.current = true;
    }, 5000);
  };

  // Wire up recenter callback
  useEffect(() => {
    recenterRef.current = () => {
      if (!controlsRef.current) return;
      controlsRef.current.target.copy(hikerPosRef.current);
      autoOrbitRef.current = true;
      isTargetFollowingRef.current = true;
      isUserControllingRef.current = false;
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
    return () => {
      recenterRef.current = null;
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

- [ ] **Step 2: Add `RecenterButton` and update `TacticalMap3D`**

Replace `ZoomControls` with `RecenterButton`:

```tsx
function RecenterButton({ onRecenter }: { onRecenter: () => void }) {
  return (
    <div className="tactical-map__controls">
      <button onClick={onRecenter} title="Recenter on hiker">⌖</button>
    </div>
  );
}
```

Update `TacticalMap3D` — remove `zoom` state, `handleWheel`, and `ZoomControls`. Replace `CameraController` with `CameraSystem`. Pass `hikerPosRef`:

```tsx
export function TacticalMap3D() {
  const [webglFailed, setWebglFailed] = useState(false);
  const hikerPosRef = useRef(new THREE.Vector3());

  const recenterRef = useRef<(() => void) | null>(null);
  const handleRecenter = () => recenterRef.current?.();

  if (webglFailed) return <TacticalMapLegacy />;

  return (
    <div className="tactical-map">
      <RecenterButton onRecenter={handleRecenter} />
      <WebGLErrorBoundary onError={() => setWebglFailed(true)}>
        <Canvas
          style={{ width: "100%", height: "100%" }}
          gl={{ alpha: true, antialias: true }}
          camera={{ fov: 40, near: 0.1, far: 50, position: [2, 3, 4] }}
          frameloop="always"
        >
          <CameraSystem hikerPosRef={hikerPosRef} recenterRef={recenterRef} />
          <FogController />
          <GridFloor />
          <TerrainWireframe />
          <TrailLine />
          <WaypointMarkers />
          <HikerMarker hikerPosRef={hikerPosRef} />
        </Canvas>
      </WebGLErrorBoundary>
    </div>
  );
}
```

- [ ] **Step 3: Update CSS — replace zoom controls with recenter button**

In `src/App.css`, replace `.tactical-map__zoom-controls` rules with:

```css
.tactical-map__controls {
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 10;
}

.tactical-map__controls button {
  background: var(--bg-input);
  border: 1px solid var(--bg-panel-border);
  color: var(--neon-green);
  text-shadow: 0 0 6px var(--neon-green-glow);
  width: 24px;
  height: 24px;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tactical-map__controls button:hover {
  background: var(--neon-green);
  color: var(--bg-dark);
  text-shadow: none;
}
```

- [ ] **Step 4: Type check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/map/TacticalMap3D.tsx src/App.css
git commit -m "feat: OrbitControls drag/scale with auto-orbit + recenter button"
```

---

### Task 6: Documentation updates + final verification

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add v3.1 entry to CHANGELOG.md**

Add above the `## [3.0]` section:

```markdown
## [3.1] - 2026-03-18

### Bug Fixes
- Lost-state wireframe red tint now properly resets when player finds the trail
- Terrain reveal animation works (direct material opacity mutation in useFrame)
- WebGL fallback no longer nests double .tactical-map containers
- Three.js Line objects properly disposed on waypoint change (no memory leaks)
- TerrainAtmosphere initializes correctly on first mount
- Wireframe lost-state flicker uses smooth sine-wave instead of raw random

### Features
- **Lost-state displacement**: hiker visually drifts off-trail when lost, with pulsing red search radius ring
- **Smooth movement animation**: hiker interpolates along trail on push_forward (2.5s) and descend (1.5s) with ease-in-out
- **Drag and scale**: OrbitControls for rotate/zoom with auto-orbit (resumes after 5s inactivity), recenter button

### Notes
- @react-three/drei now imported (OrbitControls)
- Discrete zoom controls replaced with continuous smooth zoom
```

- [ ] **Step 2: Update CLAUDE.md if needed**

Verify architecture section accuracy. Add OrbitControls note to key patterns if not present.

- [ ] **Step 3: Full type check + visual test**

Run: `npx tsc --noEmit`
Expected: Zero errors.

Open browser. Play a full game or use auto-play. Verify:
- Lost state: hiker drifts off trail, red ring pulses, wireframe tints red, resets when found
- Movement: hiker smoothly moves between waypoints (2.5s forward, 1.5s back)
- Drag: can rotate map, auto-orbit pauses, resumes after 5s
- Zoom: scroll/pinch zooms smoothly (continuous)
- Recenter button: snaps camera back to hiker
- WebGL fallback: legacy map renders standalone with its own controls

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md CLAUDE.md
git commit -m "docs: v3.1 changelog + CLAUDE.md accuracy updates"
```

---

## Summary

| Task | Description | Phase | Complexity |
|------|-------------|-------|------------|
| 1 | TerrainAtmosphere init + wireframe tint reset + reveal fix | Bug Fix | Easy |
| 2 | Fallback nesting + TrailLine object leaks | Bug Fix | Easy-Medium |
| 3 | Lost-state hiker displacement + search ring | Feature | Medium |
| 4 | Smooth movement animation | Feature | Medium |
| 5 | OrbitControls + recenter button | Feature | Medium |
| 6 | Documentation + final verification | Docs | Easy |
