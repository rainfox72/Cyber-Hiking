/**
 * Action feedback hook — applies transient CSS classes to scene and UI
 * elements in response to player actions and critical events.
 * Provides visual "juice" for every decision without modifying component JSX.
 */

import { useEffect, useRef } from "react";
import { useGameStore } from "../store/gameStore.ts";
import type { CriticalEvent } from "../engine/types.ts";

interface FeedbackConfig {
  sceneClass: string;
  uiClass: string;
  duration: number; // ms
}

const ACTION_FEEDBACK: Record<string, FeedbackConfig> = {
  push_forward: { sceneClass: "scene-push", uiClass: "ui-push", duration: 400 },
  descend: { sceneClass: "scene-push", uiClass: "ui-push", duration: 400 },
  set_camp: { sceneClass: "scene-camp", uiClass: "ui-camp", duration: 600 },
  check_map: { sceneClass: "scene-map", uiClass: "ui-map", duration: 300 },
  rest: { sceneClass: "scene-rest", uiClass: "ui-rest", duration: 500 },
  eat: { sceneClass: "scene-consume", uiClass: "ui-consume", duration: 300 },
  drink: { sceneClass: "scene-consume", uiClass: "ui-consume", duration: 300 },
  use_medicine: { sceneClass: "scene-medicine", uiClass: "ui-medicine", duration: 400 },
};

/** Injury-related event IDs */
const INJURY_EVENT_IDS = new Set([
  "ankle_sprain", "rockfall", "frostbite", "knee_injury",
  "trail_collapse", "pack_strap_breaks",
]);

/** Lost-related event IDs */
const LOST_EVENT_IDS = new Set([
  "lost_in_fog", "lost_trail", "sudden_whiteout",
]);

function hasInjuryEvent(events: CriticalEvent[]): boolean {
  return events.some(
    (e) => INJURY_EVENT_IDS.has(e.id) || e.severity === "critical" || e.severity === "major",
  );
}

function hasLostEvent(events: CriticalEvent[]): boolean {
  return events.some((e) => LOST_EVENT_IDS.has(e.id));
}

export function useActionFeedback(): void {
  const lastAction = useGameStore((s) => s.lastAction);
  const lastEvents = useGameStore((s) => s.lastEvents);
  const turnNumber = useGameStore((s) => s.turnNumber);

  // Track previous turn to detect actual changes
  const prevTurnRef = useRef(0);
  const cleanupRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    // Only fire on actual turn changes
    if (turnNumber === prevTurnRef.current) return;
    prevTurnRef.current = turnNumber;

    // Clean up any lingering classes from previous turn
    for (const cleanup of cleanupRef.current) cleanup();
    cleanupRef.current = [];

    const shell = document.querySelector(".game-shell");
    const grid = document.querySelector(".panel-grid");
    if (!shell) return;

    const applyFeedback = (sceneClass: string, uiClass: string, duration: number) => {
      shell.classList.add(sceneClass);
      if (grid) grid.classList.add(uiClass);

      const timer = setTimeout(() => {
        shell.classList.remove(sceneClass);
        if (grid) grid.classList.remove(uiClass);
      }, duration);

      cleanupRef.current.push(() => {
        clearTimeout(timer);
        shell.classList.remove(sceneClass);
        if (grid) grid.classList.remove(uiClass);
      });
    };

    // Action-based feedback
    if (lastAction) {
      const config = ACTION_FEEDBACK[lastAction];
      if (config) {
        applyFeedback(config.sceneClass, config.uiClass, config.duration);
      }
    }

    // Event-based feedback — injury
    if (hasInjuryEvent(lastEvents)) {
      applyFeedback("scene-injury", "ui-injury", 200);
      // Trigger store shake (reuses existing isShaking mechanism)
      useGameStore.setState({ isShaking: true });
      const shakeTimer = setTimeout(() => useGameStore.setState({ isShaking: false }), 500);
      cleanupRef.current.push(() => clearTimeout(shakeTimer));
    }

    // Event-based feedback — lost
    if (hasLostEvent(lastEvents)) {
      applyFeedback("scene-lost", "ui-lost", 500);
    }

    return () => {
      for (const cleanup of cleanupRef.current) cleanup();
      cleanupRef.current = [];
    };
  }, [lastAction, lastEvents, turnNumber]);
}
