/**
 * RunSummary — post-game expedition summary with route trace, event timeline,
 * epitaph, and codename. Displayed below the expedition report on death/victory.
 */

import { useMemo } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import {
  extractKeyEvents,
  generateEpitaph,
  generateCodename,
} from "../../utils/runSummary.ts";

interface RunSummaryProps {
  outcome: "defeat" | "victory";
}

export function RunSummary({ outcome }: RunSummaryProps) {
  const eventHistory = useGameStore((s) => s.eventHistory);
  const defeatCause = useGameStore((s) => s.defeatCause);
  const currentWaypointIndex = useGameStore(
    (s) => s.player.currentWaypointIndex,
  );
  const day = useGameStore((s) => s.time.day);
  const weather = useGameStore((s) => s.weather.current);
  const endingType = useGameStore((s) => s.endingType);
  const rng = useGameStore((s) => s.rng);

  const keyEvents = useMemo(
    () => extractKeyEvents(eventHistory),
    [eventHistory],
  );

  const waypointName = WAYPOINTS[currentWaypointIndex].name;

  const epitaph = useMemo(
    () => generateEpitaph(defeatCause, waypointName, day, weather),
    [defeatCause, waypointName, day, weather],
  );

  const codename = useMemo(() => generateCodename(() => rng.next()), [rng]);

  const isSummit = endingType === "summit";

  // SVG route trace dimensions
  const svgWidth = 320;
  const svgHeight = 40;
  const padding = 16;

  // Map waypoints to SVG coordinates
  const points = WAYPOINTS.map((wp, i) => {
    const x = padding + (i / (WAYPOINTS.length - 1)) * (svgWidth - padding * 2);
    // Elevation mapped to y (higher elevation = higher on screen = lower y)
    const minElev = 1740;
    const maxElev = 3767;
    const normalizedElev = (wp.elevation - minElev) / (maxElev - minElev);
    const y = svgHeight - 6 - normalizedElev * (svgHeight - 12);
    return { x, y };
  });

  const traversedPath = points
    .slice(0, currentWaypointIndex + 1)
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  const futurePath =
    currentWaypointIndex < WAYPOINTS.length - 1
      ? points
          .slice(currentWaypointIndex)
          .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
          .join(" ")
      : "";

  return (
    <div className="run-summary">
      {/* Mini route trace */}
      <svg
        className="run-summary__route"
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width={svgWidth}
        height={svgHeight}
      >
        {/* Future path (dim) */}
        {futurePath && (
          <path
            d={futurePath}
            fill="none"
            stroke="rgba(61, 139, 55, 0.15)"
            strokeWidth="1"
          />
        )}
        {/* Traversed path */}
        <path
          d={traversedPath}
          fill="none"
          stroke="var(--tactical-green)"
          strokeWidth="1.5"
        />
        {/* Waypoint dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === currentWaypointIndex ? 3 : 1.5}
            fill={
              i <= currentWaypointIndex
                ? "var(--tactical-green)"
                : "rgba(61, 139, 55, 0.2)"
            }
          />
        ))}
        {/* Final position marker */}
        {outcome === "defeat" ? (
          // X for death
          <g transform={`translate(${points[currentWaypointIndex].x}, ${points[currentWaypointIndex].y})`}>
            <line
              x1="-4" y1="-4" x2="4" y2="4"
              stroke="var(--hazard-red)"
              strokeWidth="2"
            />
            <line
              x1="4" y1="-4" x2="-4" y2="4"
              stroke="var(--hazard-red)"
              strokeWidth="2"
            />
          </g>
        ) : isSummit ? (
          // Star for summit
          <polygon
            points={starPoints(
              points[currentWaypointIndex].x,
              points[currentWaypointIndex].y,
              5,
              2,
            )}
            fill="var(--tactical-green-bright)"
          />
        ) : null}
      </svg>

      {/* Event timeline */}
      {keyEvents.length > 0 && (
        <div className="run-summary__timeline">
          {keyEvents.map((e, i) => (
            <div
              key={i}
              className={`run-summary__event run-summary__event--${e.severity}`}
            >
              <span className="run-summary__event-day">Day {e.day}</span>
              <span className="run-summary__event-sep">&middot;</span>
              <span className="run-summary__event-text">
                {e.event} at {e.waypoint}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Epitaph */}
      <div className="run-summary__epitaph">{epitaph}</div>

      {/* Codename */}
      <div className="run-summary__codename">{codename}</div>
    </div>
  );
}

/** Generate SVG star polygon points string. */
function starPoints(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return pts.join(" ");
}
