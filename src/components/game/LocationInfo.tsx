/**
 * LocationInfo component — displays the current waypoint name, elevation, terrain, and facilities.
 */

import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";

export function LocationInfo() {
  const index = useGameStore((s) => s.player.currentWaypointIndex);
  const wp = WAYPOINTS[index];
  return (
    <div className="panel" style={{ padding: "6px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ color: "var(--amber)", fontSize: "12px", letterSpacing: "1px" }}>{wp.name}</span>
          <span style={{ color: "var(--text-dim)", fontSize: "10px", marginLeft: "6px" }}>{wp.nameCN}</span>
        </div>
        <div style={{ color: "var(--neon-green)", fontSize: "14px", letterSpacing: "2px" }}>{wp.elevation}m</div>
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: "9px", marginTop: "2px", letterSpacing: "0.5px" }}>
        {wp.terrain.replace("_", " ").toUpperCase()} | {wp.distanceFromStart}km from start
        {wp.canCamp ? " | CAMP OK" : ""}{wp.shelterAvailable ? " | SHELTER" : ""}
      </div>
    </div>
  );
}
