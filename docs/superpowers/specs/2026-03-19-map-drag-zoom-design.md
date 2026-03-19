# Map Drag & Zoom

**Date:** 2026-03-19
**Scope:** Add drag-to-rotate and scroll/pinch-to-zoom to the 3D map camera

## Problem

The 3D map is now the main game console (full-bleed viewport) but the camera is locked to auto-orbit. Players can't inspect terrain ahead, check distance traveled, or examine specific waypoints.

## Solution

Add left-click drag (orbit rotation) and scroll/pinch (zoom) to the existing CameraDirector. User input temporarily overrides auto-orbit, then camera smoothly returns after 4 seconds of inactivity.

## Behavior

### Drag to Rotate
- Left-click + drag changes orbit angle (horizontal) and orbit pitch (vertical)
- Horizontal drag: modifies `orbitAngleRef` directly (radians, wraps 0-2π)
- Vertical drag: modifies new `orbitPitchRef` (clamped 10-80 degrees from horizontal)
- Sensitivity: ~0.005 radians per pixel of mouse movement

### Scroll/Pinch to Zoom
- Scroll wheel or trackpad pinch modifies `orbitRadius`
- Range: 1.5 (close-up, hiker detail) to 10.0 (route overview)
- Default: 3.3 (current value)
- Sensitivity: ~0.5 units per scroll notch, clamped

### Auto-Return
- Any user input (drag or scroll) sets `lastInteractionTime`
- After 4 seconds of no interaction:
  - `orbitAngleRef` resumes auto-advancing (0.5 deg/s)
  - `orbitRadius` lerps back to 3.3 over ~2 seconds
  - `orbitPitchRef` lerps back to default (~55 degrees)
- Lerp speed: `delta * 0.8` (smooth ~2 second return)
- During auto-return, new user input immediately cancels the return

### Impulse Interaction
- CameraDirector impulses (shake, dolly, FOV changes) apply additively on top of user's orbit position
- Lost-state wobble, heartbeat pulse, blizzard jitter all still work
- User drag during an impulse: impulse continues but user controls the base orbit

## Input Handling

Register events on `gl.domElement` (the Canvas element):
- `pointerdown` → start drag tracking
- `pointermove` → update orbit angle/pitch if dragging
- `pointerup` / `pointerleave` → stop drag
- `wheel` → zoom (with `{ passive: false }` to prevent page scroll)

No drei OrbitControls — pure pointer math. This avoids the known R3F crash with OrbitControls.

## Camera Math

Current baseline (auto-orbit):
```
orbitX = sin(orbitAngle) * orbitRadius
orbitZ = cos(orbitAngle) * orbitRadius
camPos = target + (orbitX, yOffset, orbitZ)
```

New with pitch:
```
orbitX = sin(orbitAngle) * cos(orbitPitch) * orbitRadius
orbitY = sin(orbitPitch) * orbitRadius
orbitZ = cos(orbitAngle) * cos(orbitPitch) * orbitRadius
camPos = target + (orbitX, yOffset + orbitY, orbitZ)
```

## Files Modified

| File | Change |
|------|--------|
| `src/components/map/CameraDirector.tsx` | Add drag/zoom input, pitch axis, auto-return timer |
| `src/components/map/TacticalMap3D.tsx` | Remove ZoomControls component and usage |

## Constraints

- No drei OrbitControls (known crash documented in CLAUDE.md)
- Pitch clamped 10-80 degrees (no flip, no underground)
- Zoom clamped 1.5-10.0 orbit radius
- Auto-return after 4 seconds inactivity
- `pointer-events: none` on game-shell means only Canvas receives events
- Touch/trackpad pinch via wheel event (browsers normalize pinch to wheel)
