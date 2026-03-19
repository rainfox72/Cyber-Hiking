/**
 * TacticalMap -- Isometric contour map replacing the flat elevation profile.
 * Shows the full Ao Tai route with topographic contour rings,
 * danger-scaled trail segments, waypoint markers, terrain hazard zones,
 * lost-state visuals, and animated human marker.
 */

import { useState, useMemo, useCallback } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import { HumanMarker } from "./HumanMarker.tsx";
import type { TerrainType } from "../../engine/types.ts";

const VIEW_W = 600;
const VIEW_H = 300;
const PADDING = 40;
const MAX_DIST = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
const MIN_ELEV = 1500;
const MAX_ELEV = 4000;

/** Point of no return waypoint index */
const NO_RETURN_INDEX = 10;

function toMapX(km: number): number {
  return PADDING + ((km / MAX_DIST) * (VIEW_W - PADDING * 2));
}

function toMapY(elev: number): number {
  return VIEW_H - PADDING - (((elev - MIN_ELEV) / (MAX_ELEV - MIN_ELEV)) * (VIEW_H - PADDING * 2));
}

/** Classify a route segment's danger level based on the destination waypoint. */
function getSegmentDanger(terrain: TerrainType, elevation: number): "safe" | "moderate" | "dangerous" {
  if (terrain === "ridge" && elevation > 3400) return "dangerous";
  if (terrain === "stone_sea" || terrain === "scree") return "moderate";
  return "safe";
}

/** Get stroke properties for a segment danger level. */
function getSegmentStyle(danger: "safe" | "moderate" | "dangerous", traversed: boolean) {
  const base = {
    safe:      { color: "var(--tactical-green)", width: 1,   animClass: "" },
    moderate:  { color: "var(--amber)",          width: 1.5, animClass: "segment-pulse-slow" },
    dangerous: { color: "var(--hazard-red)",     width: 2,   animClass: "segment-pulse-fast" },
  }[danger];

  if (traversed) {
    return { ...base, dasharray: "none", filter: "url(#topo-glow)", opacity: 1 };
  }
  return { ...base, dasharray: "4,3", filter: "none", opacity: 0.4 };
}

/** Generate contour ellipses for a waypoint based on its prominence. */
function generateContours(x: number, y: number, elevation: number) {
  const prominence = (elevation - MIN_ELEV) / (MAX_ELEV - MIN_ELEV);
  const rings = prominence > 0.6 ? 4 : prominence > 0.3 ? 3 : 2;
  const baseRx = 18 - prominence * 8;
  const baseRy = baseRx * 0.6;

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
  const isLost = useGameStore((s) => s.player.isLost);

  const [zoomLevel, setZoomLevel] = useState(1);

  const healthPercent = useMemo(
    () => (energy + hydration + bodyTemp + o2 + morale) / 5,
    [energy, hydration, bodyTemp, o2, morale],
  );

  // When lost, offset the hiker marker off-trail
  const hikerX = toMapX(WAYPOINTS[currentIndex].distanceFromStart);
  const hikerY = toMapY(WAYPOINTS[currentIndex].elevation) - 18;
  const lostOffsetX = isLost ? 25 : 0;
  const lostOffsetY = isLost ? -20 : 0;

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

  // Build route segments between consecutive waypoints
  const segments = useMemo(() => {
    return WAYPOINTS.slice(1).map((wp, i) => {
      const prev = WAYPOINTS[i];
      const x1 = toMapX(prev.distanceFromStart);
      const y1 = toMapY(prev.elevation);
      const x2 = toMapX(wp.distanceFromStart);
      const y2 = toMapY(wp.elevation);
      const segIndex = i + 1; // destination waypoint index
      const traversed = segIndex <= currentIndex;
      const danger = getSegmentDanger(wp.terrain, wp.elevation);
      return { x1, y1, x2, y2, segIndex, traversed, danger, key: `seg-${i}` };
    });
  }, [currentIndex]);

  // Terrain hazard zone rects
  const hazardZones = useMemo(() => {
    const zones: { x: number; y: number; w: number; h: number; fill: string; label: string }[] = [];

    // Storm Ridge: waypoints 9-11
    const sr9 = WAYPOINTS[9], sr11 = WAYPOINTS[11];
    const srX1 = toMapX(sr9.distanceFromStart) - 5;
    const srX2 = toMapX(sr11.distanceFromStart) + 5;
    const srMinY = Math.min(toMapY(sr9.elevation), toMapY(sr11.elevation), toMapY(WAYPOINTS[10].elevation)) - 10;
    const srMaxY = Math.max(toMapY(sr9.elevation), toMapY(sr11.elevation), toMapY(WAYPOINTS[10].elevation)) + 10;
    zones.push({
      x: srX1, y: srMinY, w: srX2 - srX1, h: srMaxY - srMinY,
      fill: "rgba(201, 56, 56, 0.06)", label: "STORM RIDGE",
    });

    // Exposed Plateau: waypoints 6-8
    const ep6 = WAYPOINTS[6], ep8 = WAYPOINTS[8];
    const epX1 = toMapX(ep6.distanceFromStart) - 5;
    const epX2 = toMapX(ep8.distanceFromStart) + 5;
    const epMinY = Math.min(toMapY(ep6.elevation), toMapY(ep8.elevation), toMapY(WAYPOINTS[7].elevation)) - 10;
    const epMaxY = Math.max(toMapY(ep6.elevation), toMapY(ep8.elevation), toMapY(WAYPOINTS[7].elevation)) + 10;
    zones.push({
      x: epX1, y: epMinY, w: epX2 - epX1, h: epMaxY - epMinY,
      fill: "rgba(108, 180, 212, 0.04)", label: "EXPOSED PLATEAU",
    });

    return zones;
  }, []);

  // Point of no return position
  const norX = toMapX(WAYPOINTS[NO_RETURN_INDEX].distanceFromStart);
  const norY = toMapY(WAYPOINTS[NO_RETURN_INDEX].elevation);
  const pastNoReturn = currentIndex > NO_RETURN_INDEX;

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
            <filter id="waypoint-blur">
              <feGaussianBlur stdDeviation="2" />
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

          {/* Terrain hazard zones — static tactical overlays */}
          {hazardZones.map((zone) => (
            <g key={zone.label}>
              <rect
                x={zone.x} y={zone.y} width={zone.w} height={zone.h}
                fill={zone.fill}
                rx="3"
              />
              <text
                x={zone.x + zone.w / 2}
                y={zone.y + 8}
                textAnchor="middle"
                fill="var(--text-dim)"
                fontSize="4"
                fontFamily="monospace"
                opacity="0.3"
              >
                {zone.label}
              </text>
            </g>
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
                stroke="var(--tactical-green)"
                strokeWidth="0.5"
                opacity={c.opacity}
              />
            ));
          })}

          {/* Route segments — danger-scaled */}
          {segments.map((seg) => {
            const style = getSegmentStyle(seg.danger, seg.traversed);
            // When lost, future segments are nearly invisible
            const lostDim = isLost && !seg.traversed;
            // Past no-return: pre-NR traversed segments fade out
            const preNrFade = pastNoReturn && seg.traversed && seg.segIndex <= NO_RETURN_INDEX;
            const finalOpacity = lostDim ? 0.1 : preNrFade ? 0.05 : style.opacity;

            return (
              <line
                key={seg.key}
                x1={seg.x1} y1={seg.y1}
                x2={seg.x2} y2={seg.y2}
                stroke={style.color}
                strokeWidth={style.width}
                strokeDasharray={style.dasharray}
                filter={style.filter}
                opacity={finalOpacity}
                className={seg.traversed ? "" : style.animClass}
              />
            );
          })}

          {/* Point of no return marker */}
          <g opacity={pastNoReturn ? 0.15 : 0.3}>
            <line
              x1={norX} y1={norY - 8}
              x2={norX} y2={norY + 8}
              stroke="var(--hazard-red)"
              strokeWidth="1"
            />
            <text
              x={norX}
              y={norY + 14}
              textAnchor="middle"
              fill="var(--hazard-red)"
              fontSize="4"
              fontFamily="monospace"
            >
              NO RETURN
            </text>
          </g>

          {/* Waypoint markers */}
          {WAYPOINTS.map((wp, i) => {
            const x = toMapX(wp.distanceFromStart);
            const y = toMapY(wp.elevation);
            const isPassed = i < currentIndex;
            const isCurrent = i === currentIndex;
            const isFuture = i > currentIndex;

            // Determine fill/stroke for diamond
            const color =
              isPassed ? "var(--tactical-green)" :
              isCurrent ? "var(--amber)" :
              "var(--text-muted)";

            const diamondFill = isFuture ? "none" : color;
            const diamondStroke = color;

            // Lost state: blur future waypoints
            const futureBlur = isLost && isFuture;
            // Past no return: dim pre-NR passed waypoints
            const preNrDim = pastNoReturn && isPassed && i <= NO_RETURN_INDEX;

            return (
              <g key={wp.id} opacity={preNrDim ? 0.1 : 1} filter={futureBlur ? "url(#waypoint-blur)" : undefined}>
                {/* Current waypoint breathing ring */}
                {isCurrent && (
                  <circle
                    cx={x} cy={y}
                    r="6"
                    fill="none"
                    stroke="var(--amber)"
                    strokeWidth="0.8"
                    className="waypoint-breathe"
                  />
                )}

                {/* Diamond marker */}
                <polygon
                  points={`${x},${y - 4} ${x + 3},${y} ${x},${y + 4} ${x - 3},${y}`}
                  fill={diamondFill}
                  stroke={diamondStroke}
                  strokeWidth="0.5"
                />

                {/* Shelter icon: small triangle inside diamond */}
                {wp.shelterAvailable && (
                  <polygon
                    points={`${x},${y - 2} ${x + 1.5},${y + 1} ${x - 1.5},${y + 1}`}
                    fill="none"
                    stroke={isPassed ? "var(--bg-panel)" : color}
                    strokeWidth="0.4"
                  />
                )}

                {/* Camp-available indicator: small dot below diamond */}
                {wp.canCamp && (
                  <circle
                    cx={x} cy={y + 7}
                    r="1"
                    fill={color}
                    opacity="0.6"
                  />
                )}

                {/* Label (only at zoom 2+, or every other at zoom 1) */}
                {(zoomLevel >= 2 || i % 2 === 0) && (
                  <text
                    x={x}
                    y={y + (wp.canCamp ? 15 : 12)}
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

          {/* Lost overlay tint */}
          {isLost && (
            <rect x={vbX} y={vbY} width={vbW} height={vbH}
              fill="rgba(120,0,0,0.15)" />
          )}

          {/* Lost search radius ring */}
          {isLost && (
            <circle
              cx={hikerX + lostOffsetX}
              cy={hikerY + lostOffsetY - 3}
              r="20"
              fill="none"
              stroke="var(--hazard-red)"
              strokeWidth="0.8"
              strokeDasharray="4,3"
              opacity="0.5"
              className="lost-marker"
            />
          )}

          {/* Human marker */}
          <g transform={`translate(${hikerX + lostOffsetX}, ${hikerY + lostOffsetY}) scale(2.5)`}>
            <HumanMarker
              healthPercent={healthPercent}
              lastAction={lastAction}
              isLost={isLost}
            />
          </g>
        </svg>
      </div>
    </div>
  );
}
