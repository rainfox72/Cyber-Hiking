/**
 * NavigationConsole component — panel containing all available player action buttons.
 * Includes AUTO toggle for AI auto-play mode with status ticker.
 */

import { ActionButton } from "./ActionButton.tsx";
import { useGameStore } from "../../store/gameStore.ts";
import type { GameAction } from "../../engine/types.ts";

export const ACTION_CONFIG: { action: GameAction; label: string; cost: string }[] = [
  { action: "push_forward", label: "PUSH FORWARD", cost: "3-5h | Advance (or wander if lost)" },
  { action: "set_camp", label: "SET CAMP", cost: "4h day / sleep til dawn | -1 Food, Major recovery" },
  { action: "descend", label: "DESCEND", cost: "2h | Retreat to prev waypoint" },
  { action: "check_map", label: "CHECK MAP", cost: "1h | Navigation (reduces getting lost)" },
  { action: "rest", label: "REST", cost: "2h | -0.3 Water, Minor recovery" },
  { action: "eat", label: "EAT RATION", cost: "0.5h | Energy +50, Morale +8" },
  { action: "drink", label: "DRINK WATER", cost: "0.5h | Hydration +40, Morale +3" },
  { action: "use_medicine", label: "USE MEDICINE", cost: "0.5h | Heal O2 or treat fall injury" },
];

export function NavigationConsole() {
  const isLost = useGameStore((s) => s.player.isLost);
  const hasFallInjury = useGameStore((s) => s.player.statusEffects.some(e => e.id === "fall_injury"));
  const autoPlayEnabled = useGameStore((s) => s.autoPlayEnabled);
  const aiStatusPhase = useGameStore((s) => s.aiStatusPhase);
  const toggleAutoPlay = useGameStore((s) => s.toggleAutoPlay);

  return (
    <div className="panel">
      <div className="section-label">NAVIGATION CONSOLE</div>
      <button
        className={`auto-play-button${autoPlayEnabled ? " auto-play-button--active" : ""}`}
        onClick={toggleAutoPlay}
      >
        {autoPlayEnabled ? "■ STOP AUTO" : "▶ AUTO"}
      </button>
      {aiStatusPhase && (
        <div className="ai-status-ticker">
          <span className="ai-status-ticker__label">AI</span>
          <span className="ai-status-ticker__phase">{aiStatusPhase}</span>
        </div>
      )}
      {isLost && (
        <div style={{
          color: "var(--hazard-red)",
          textAlign: "center",
          padding: "4px",
          fontSize: "11px",
          borderBottom: "1px solid var(--hazard-red)",
          marginBottom: "4px",
          animation: "lost-pulse 1s ease-in-out infinite",
        }}>
          ⚠ OFF TRAIL — CHECK MAP TO FIND WAY BACK
        </div>
      )}
      {hasFallInjury && (
        <div style={{
          color: "var(--amber)",
          textAlign: "center",
          padding: "4px",
          fontSize: "10px",
          borderBottom: "1px solid var(--amber)",
          marginBottom: "4px",
        }}>
          🩹 FALL INJURY — USE MEDICINE TO TREAT
        </div>
      )}
      <div className={autoPlayEnabled ? "nav-actions--dimmed" : ""}>
        {ACTION_CONFIG.map((cfg) => (
          <ActionButton key={cfg.action} {...cfg} />
        ))}
      </div>
    </div>
  );
}
