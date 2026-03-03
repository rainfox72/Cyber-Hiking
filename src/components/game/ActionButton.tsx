/**
 * ActionButton component — a single navigation action button with validity and processing state.
 * Highlights with glow animation when the AI selects this action.
 */

import { useCallback } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import type { GameAction } from "../../engine/types.ts";
import { soundManager } from "../../services/soundManager.ts";

export function ActionButton({ action, label, cost }: { action: GameAction; label: string; cost: string }) {
  const performAction = useGameStore((s) => s.performAction);
  const isValid = useGameStore((s) => s.isActionValid(action));
  const isProcessing = useGameStore((s) => s.isProcessing);
  const lastAIAction = useGameStore((s) => s.lastAIAction);
  const isAISelected = lastAIAction === action;
  const handleClick = useCallback(() => { soundManager.click(); performAction(action); }, [performAction, action]);

  const className = [
    "action-button",
    isAISelected ? "action-button--ai-selected" : "",
  ].filter(Boolean).join(" ");

  return (
    <button className={className} disabled={!isValid || isProcessing} onClick={handleClick}>
      {label}
      <span className="action-button__cost">{cost}</span>
    </button>
  );
}
