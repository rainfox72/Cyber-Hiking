/**
 * MapHUD — 2D tactical overlay rendered above the 3D Canvas.
 *
 * Shows:
 *  - Compass rose (bottom-left)
 *  - Scan metadata readout (bottom-left, below compass)
 *  - Directional arrow toward next objective (top-right)
 *  - Trail name label (bottom-center)
 *
 * All pointer-events: none so clicks pass through to Canvas/panels.
 */

import "./MapHUD.css";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";

// ── Compass SVG ──

function CompassRose() {
  return (
    <div className="map-hud__compass">
      <span className="map-hud__compass-label">N</span>
      <svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">
        {/* Outer ring */}
        <circle cx="28" cy="28" r="26" fill="none" stroke="#00ff41" strokeWidth="1" opacity="0.5" />
        <circle cx="28" cy="28" r="22" fill="none" stroke="#00ff41" strokeWidth="0.5" opacity="0.3" />

        {/* Cardinal tick marks */}
        {/* N */}
        <line x1="28" y1="2" x2="28" y2="8" stroke="#00ff41" strokeWidth="1.5" />
        {/* S */}
        <line x1="28" y1="48" x2="28" y2="54" stroke="#00ff41" strokeWidth="0.8" opacity="0.5" />
        {/* E */}
        <line x1="48" y1="28" x2="54" y2="28" stroke="#00ff41" strokeWidth="0.8" opacity="0.5" />
        {/* W */}
        <line x1="2" y1="28" x2="8" y2="28" stroke="#00ff41" strokeWidth="0.8" opacity="0.5" />

        {/* Diamond pointer (north-facing) */}
        <polygon
          points="28,8 32,28 28,24 24,28"
          fill="#00ff41"
          opacity="0.7"
        />
        <polygon
          points="28,48 32,28 28,32 24,28"
          fill="none"
          stroke="#00ff41"
          strokeWidth="0.5"
          opacity="0.4"
        />

        {/* Center dot */}
        <circle cx="28" cy="28" r="2" fill="#00ff41" opacity="0.8" />
      </svg>
    </div>
  );
}

// ── Main HUD ──

export function MapHUD() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const gamePhase = useGameStore((s) => s.gamePhase);

  if (gamePhase !== "playing") return null;

  // Determine direction label
  const isAtSummit = currentIndex >= WAYPOINTS.length - 1;
  const wp = WAYPOINTS[currentIndex];

  let directionLabel: string;
  let directionArrow: string;

  if (isAtSummit) {
    directionLabel = "SUMMIT REACHED";
    directionArrow = "★";
  } else if (currentIndex <= 3) {
    directionLabel = "TOWARD PEAK";
    directionArrow = "↗";
  } else if (currentIndex <= 8) {
    directionLabel = "TOWARD SUMMIT";
    directionArrow = "↗";
  } else {
    directionLabel = "FINAL APPROACH";
    directionArrow = "↑";
  }

  return (
    <div className="map-hud">
      {/* Compass rose */}
      <CompassRose />

      {/* Scan metadata */}
      <div className="map-hud__metadata">
        <span>SCAN: 60Hz</span>
        <span>RES: 1024×768</span>
        <span>MODE: VECTOR</span>
        <span>ALT: {wp.elevation}M</span>
        <span>AOTAI_LINE_TRAIL_MAP_V2.0</span>
      </div>

      {/* Directional arrow */}
      <div className="map-hud__direction">
        <span className="map-hud__direction-arrow">{directionArrow}</span>
        <span className="map-hud__direction-label">{directionLabel}</span>
      </div>

      {/* Trail name */}
      <div className="map-hud__trail-name">
        鳌太线 AOTAI TRAIL
      </div>
    </div>
  );
}
