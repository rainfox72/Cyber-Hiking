/**
 * Danger overlay system — condition-specific visual treatments that
 * telegraph critical states. Replaces the simpler Vignette component.
 *
 * Reads all player vitals, determines the dominant danger (vital closest
 * to zero relative to its threshold), and renders its full-screen treatment.
 * Non-dominant active conditions render as accent overlays.
 */

import { useMemo, useEffect, useRef } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";

// ── Condition definitions ──────────────────────

interface Condition {
  id: string;
  /** Returns 0..1 where 1 = fully in danger. 0 = safe. */
  severity: number;
  /** Is this condition active at all? */
  active: boolean;
}

/**
 * Bucket a value to the nearest 10-unit range for memoization stability.
 * Prevents re-renders on every tiny vital change.
 */
function bucket(v: number): number {
  return Math.floor(v / 10) * 10;
}

// ── Component ──────────────────────────────────

export function DangerOverlay() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  const isLost = useGameStore((s) => s.player.isLost);
  const wpIndex = useGameStore((s) => s.player.currentWaypointIndex);

  // Ref for applying/removing CSS classes on .game-shell
  const appliedClassesRef = useRef<string[]>([]);

  const terrain = WAYPOINTS[wpIndex]?.terrain ?? "forest";

  // Bucket vitals for memoization
  const bEnergy = bucket(energy);
  const bHydration = bucket(hydration);
  const bTemp = bucket(bodyTemp);
  const bO2 = bucket(o2);
  const bMorale = bucket(morale);

  const { dominant, conditions } = useMemo(() => {
    const conds: Condition[] = [];

    // Hypothermia: threshold 40, dominant below 25
    if (bodyTemp < 40) {
      conds.push({
        id: "hypothermia",
        severity: 1 - bodyTemp / 40,
        active: true,
      });
    }

    // Altitude: threshold 50, dominant below 30
    if (o2 < 50) {
      conds.push({
        id: "altitude",
        severity: 1 - o2 / 50,
        active: true,
      });
    }

    // Dehydration: threshold 40, dominant below 25
    if (hydration < 40) {
      conds.push({
        id: "dehydration",
        severity: 1 - hydration / 40,
        active: true,
      });
    }

    // Starvation: threshold 30, dominant below 20
    if (energy < 30) {
      conds.push({
        id: "starvation",
        severity: 1 - energy / 30,
        active: true,
      });
    }

    // Morale: threshold 35, dominant below 20
    if (morale < 35) {
      conds.push({
        id: "morale",
        severity: 1 - morale / 35,
        active: true,
      });
    }

    // Navigation: binary
    if (isLost) {
      conds.push({ id: "navigation", severity: 0.7, active: true });
    }

    // Fall risk: ridge/scree terrain AND energy < 50
    if ((terrain === "ridge" || terrain === "scree") && energy < 50) {
      conds.push({
        id: "fall_risk",
        severity: 1 - energy / 50,
        active: true,
      });
    }

    // Find dominant — highest severity
    let dom: Condition | null = null;
    for (const c of conds) {
      if (!dom || c.severity > dom.severity) dom = c;
    }

    return { dominant: dom, conditions: conds };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bEnergy, bHydration, bTemp, bO2, bMorale, isLost, terrain]);

  // Apply/remove CSS classes on .game-shell for filter-based conditions
  useEffect(() => {
    const shell = document.querySelector(".game-shell");
    if (!shell) return;

    // Remove old classes
    for (const cls of appliedClassesRef.current) {
      shell.classList.remove(cls);
    }

    const newClasses: string[] = [];

    if (dominant) {
      if (dominant.id === "dehydration") newClasses.push("danger-dehydration");
      if (dominant.id === "starvation") newClasses.push("danger-starvation");
      if (dominant.id === "morale") newClasses.push("danger-morale");
      if (dominant.id === "fall_risk") newClasses.push("danger-fall-risk");
    }

    // Navigation always applies its class when active
    if (conditions.some((c) => c.id === "navigation")) {
      newClasses.push("danger-lost");
    }

    for (const cls of newClasses) {
      shell.classList.add(cls);
    }

    appliedClassesRef.current = newClasses;

    return () => {
      for (const cls of newClasses) {
        shell.classList.remove(cls);
      }
    };
  }, [dominant, conditions]);

  // Nothing to render if no conditions are active
  if (conditions.length === 0) return null;

  const dominantId = dominant?.id ?? null;
  const dominantSeverity = dominant?.severity ?? 0;

  // Build accent classes for non-dominant conditions
  const accentClasses = conditions
    .filter((c) => c.id !== dominantId)
    .map((c) => {
      switch (c.id) {
        case "hypothermia": return "danger-accent-cold";
        case "altitude": return "danger-accent-altitude";
        case "dehydration": return "danger-accent-dehydration";
        case "starvation": return "danger-accent-starvation";
        case "morale": return "danger-accent-morale";
        default: return "";
      }
    })
    .filter(Boolean)
    .join(" ");

  return (
    <div className={`danger-overlay ${accentClasses}`}>
      {/* Hypothermia dominant — cold radial + frost corners */}
      {dominantId === "hypothermia" && (
        <div className="danger-overlay__layer">
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at center, transparent 40%, rgba(108, 180, 212, ${0.15 * dominantSeverity}) 70%, rgba(108, 180, 212, ${0.3 * dominantSeverity}) 100%)`,
            }}
          />
          <div className="danger-overlay__frost-corner danger-overlay__frost-corner--tl" style={{ opacity: dominantSeverity }} />
          <div className="danger-overlay__frost-corner danger-overlay__frost-corner--tr" style={{ opacity: dominantSeverity }} />
          <div className="danger-overlay__frost-corner danger-overlay__frost-corner--bl" style={{ opacity: dominantSeverity * 0.5 }} />
          <div className="danger-overlay__frost-corner danger-overlay__frost-corner--br" style={{ opacity: dominantSeverity * 0.5 }} />
        </div>
      )}

      {/* Altitude dominant — dark vignette with heartbeat pulse */}
      {dominantId === "altitude" && (
        <div
          className="danger-overlay__layer"
          style={{
            background: `radial-gradient(ellipse at center, transparent 30%, rgba(0, 0, 0, ${0.4 * dominantSeverity}) 100%)`,
            animation: "heartbeat-pulse 1.2s infinite",
          }}
        />
      )}

      {/* Dehydration dominant — SVG noise overlay (filter applied via CSS class) */}
      {dominantId === "dehydration" && (
        <div
          className="danger-overlay__layer"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E")`,
            backgroundSize: "256px 256px",
            opacity: dominantSeverity * 0.5,
          }}
        />
      )}

      {/* Starvation dominant — just uses CSS filter on .game-shell, add dim overlay */}
      {dominantId === "starvation" && (
        <div
          className="danger-overlay__layer"
          style={{
            background: `rgba(0, 0, 0, ${0.1 * dominantSeverity})`,
          }}
        />
      )}

      {/* Navigation (lost) — fog overlay */}
      {conditions.some((c) => c.id === "navigation") && (
        <div
          className="danger-overlay__layer"
          style={{
            background: "rgba(150, 150, 150, 0.08)",
          }}
        />
      )}

      {/* Fall risk — handled via CSS animation on .mountain-layer */}
      {/* No extra overlay div needed */}

      {/* Morale dominant — handled via CSS animation on .mountain-layer */}
      {/* No extra overlay div needed */}
    </div>
  );
}
