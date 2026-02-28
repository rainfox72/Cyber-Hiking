/**
 * TacticalMap -- Isometric contour map replacing the flat elevation profile.
 * Shows the full Ao Tai route with topographic contour rings,
 * trail line, waypoint markers, and animated human marker.
 */

import { useState, useMemo, useCallback } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import { HumanMarker } from "./HumanMarker.tsx";

const VIEW_W = 600;
const VIEW_H = 300;
const PADDING = 40;
const MAX_DIST = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
const MIN_ELEV = 1500;
const MAX_ELEV = 4000;

function toMapX(km: number): number {
  return PADDING + ((km / MAX_DIST) * (VIEW_W - PADDING * 2));
}

function toMapY(elev: number): number {
  return VIEW_H - PADDING - (((elev - MIN_ELEV) / (MAX_ELEV - MIN_ELEV)) * (VIEW_H - PADDING * 2));
}

/** Generate contour ellipses for a waypoint based on its prominence. */
function generateContours(x: number, y: number, elevation: number) {
  const prominence = (elevation - MIN_ELEV) / (MAX_ELEV - MIN_ELEV);
  const rings = prominence > 0.6 ? 4 : prominence > 0.3 ? 3 : 2;
  const baseRx = 18 - prominence * 8; // tighter for higher peaks
  const baseRy = baseRx * 0.6; // squash vertically for perspective

  return Array.from({ length: rings }, (_, i) => {
    const scale = 1 + i * 0.5;
    return { rx: baseRx * scale, ry: baseRy * scale, opacity: 0.3 - i * 0.06 };
  });
}

export function TacticalMap() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const lastAction = useGameStore((s) => s.lastAction);

  const [zoomLevel, setZoomLevel] = useState(1);

  const healthPercent = useMemo(
    () => (energy + hydration + bodyTemp + o2 + morale) / 5,
    [energy, hydration, bodyTemp, o2, morale],
  );

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoomLevel((z) => {
      if (e.deltaY < 0) return Math.min(z + 1, 3);
      return Math.max(z - 1, 1);
    });
  }, []);

  // Current waypoint position for zoom focus
  const focusX = toMapX(WAYPOINTS[currentIndex].distanceFromStart);
  const focusY = toMapY(WAYPOINTS[currentIndex].elevation);

  // Compute viewBox based on zoom
  const vbW = VIEW_W / zoomLevel;
  const vbH = VIEW_H / zoomLevel;
  const vbX = Math.max(0, Math.min(focusX - vbW / 2, VIEW_W - vbW));
  const vbY = Math.max(0, Math.min(focusY - vbH / 2, VIEW_H - vbH));

  // Trail polyline points
  const trailPoints = WAYPOINTS.map(
    (wp) => `${toMapX(wp.distanceFromStart)},${toMapY(wp.elevation)}`,
  ).join(" ");

  const traversedPoints = WAYPOINTS.slice(0, currentIndex + 1)
    .map((wp) => `${toMapX(wp.distanceFromStart)},${toMapY(wp.elevation)}`)
    .join(" ");

  return (
    <div className="tactical-map" onWheel={handleWheel}>
      <div className="tactical-map__zoom-controls">
        <button onClick={() => setZoomLevel((z) => Math.min(z + 1, 3))}>+</button>
        <span>{zoomLevel}x</span>
        <button onClick={() => setZoomLevel((z) => Math.max(z - 1, 1))}>-</button>
      </div>
      <div className="tactical-map__perspective">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          preserveAspectRatio="xMidYMid meet"
          className="tactical-map__svg"
        >
          <defs>
            <filter id="topo-glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Elevation band lines */}
          {[2000, 2500, 3000, 3500].map((elev) => (
            <line
              key={elev}
              x1={PADDING}
              y1={toMapY(elev)}
              x2={VIEW_W - PADDING}
              y2={toMapY(elev)}
              stroke="var(--bg-panel-border)"
              strokeWidth="0.5"
              strokeDasharray="4,4"
              opacity="0.3"
            />
          ))}

          {/* Contour rings around each waypoint */}
          {WAYPOINTS.map((wp) => {
            const cx = toMapX(wp.distanceFromStart);
            const cy = toMapY(wp.elevation);
            const contours = generateContours(cx, cy, wp.elevation);
            return contours.map((c, j) => (
              <ellipse
                key={`${wp.id}-${j}`}
                cx={cx}
                cy={cy}
                rx={c.rx}
                ry={c.ry}
                fill="none"
                stroke="var(--neon-green)"
                strokeWidth="0.5"
                opacity={c.opacity}
              />
            ));
          })}

          {/* Future trail (dashed) */}
          <polyline
            points={trailPoints}
            fill="none"
            stroke="var(--text-dim)"
            strokeWidth="1"
            strokeDasharray="3,3"
          />

          {/* Traversed trail (glowing) */}
          {currentIndex > 0 && (
            <polyline
              points={traversedPoints}
              fill="none"
              stroke="var(--neon-green)"
              strokeWidth="1.5"
              filter="url(#topo-glow)"
            />
          )}

          {/* Waypoint markers */}
          {WAYPOINTS.map((wp, i) => {
            const x = toMapX(wp.distanceFromStart);
            const y = toMapY(wp.elevation);
            const fill =
              i < currentIndex ? "var(--neon-green)" :
              i === currentIndex ? "var(--amber)" :
              "var(--text-muted)";
            return (
              <g key={wp.id}>
                {/* Diamond marker */}
                <polygon
                  points={`${x},${y - 4} ${x + 3},${y} ${x},${y + 4} ${x - 3},${y}`}
                  fill={fill}
                  stroke={fill}
                  strokeWidth="0.5"
                />
                {/* Label (only at zoom 2+, or every other at zoom 1) */}
                {(zoomLevel >= 2 || i % 2 === 0) && (
                  <text
                    x={x}
                    y={y + 12}
                    textAnchor="middle"
                    fill="var(--text-dim)"
                    fontSize={zoomLevel >= 2 ? "7" : "5"}
                    fontFamily="monospace"
                  >
                    {wp.nameCN}
                  </text>
                )}
              </g>
            );
          })}

          {/* Human marker */}
          <HumanMarker
            x={toMapX(WAYPOINTS[currentIndex].distanceFromStart)}
            y={toMapY(WAYPOINTS[currentIndex].elevation) - 10}
            healthPercent={healthPercent}
            lastAction={lastAction}
          />
        </svg>
      </div>
    </div>
  );
}
