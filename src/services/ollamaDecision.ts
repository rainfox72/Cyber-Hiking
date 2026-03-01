/**
 * Ollama-powered AI decision service for auto-play mode.
 * Asks the local Ollama LLM to pick the next game action, with a
 * deterministic heuristic fallback when the LLM is unavailable.
 */

import type { GameAction, GameState, Waypoint } from "../engine/types.ts";
import { WAYPOINTS } from "../data/waypoints.ts";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "llama3.1:8b";
const TIMEOUT_MS = 15000;

/** Result of an AI or heuristic decision. */
export interface AIDecision {
  action: GameAction;
  reasoning: string;
}

/**
 * Build a decision prompt from the current game state and valid actions.
 */
function buildDecisionPrompt(state: GameState, validActions: GameAction[]): string {
  const wp: Waypoint = WAYPOINTS[state.player.currentWaypointIndex];
  const { weather, time, player } = state;

  return `You are an AI player in a survival hiking simulation on the Ao Tai Line (鳌太线). Pick the best next action to survive and reach the summit.

CURRENT STATE:
- Location: ${wp.name} (${wp.nameCN}), elevation ${wp.elevation}m, terrain: ${wp.terrain.replace("_", " ")}
- Weather: ${weather.current}, intensity ${Math.round(weather.intensity * 100)}%, wind speed ${Math.round(weather.windSpeed)}
- Time: Day ${time.day}, hour ${Math.floor(time.hour)}:00, ${time.timeOfDay}
- Energy: ${Math.round(player.energy)}%, Hydration: ${Math.round(player.hydration)}%
- Body Temp: ${Math.round(player.bodyTemp)}%, O2 Saturation: ${Math.round(player.o2Saturation)}%
- Morale: ${Math.round(player.morale)}%
- Inventory: food=${player.food}, water=${player.water}, gear=${player.gear}, medicine=${player.medicine}
- Lost: ${player.isLost ? "yes" : "no"}
- Turn: ${state.turnNumber}

VALID ACTIONS: ${validActions.join(", ")}

Respond with ONLY this JSON (no other text):
{"action": "action_id", "reasoning": "one sentence why"}`;
}

/**
 * Ask Ollama to pick the next action.
 * Returns null if Ollama is unavailable, times out, or returns an invalid response.
 */
export async function generateDecision(
  state: GameState,
  validActions: GameAction[],
): Promise<AIDecision | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildDecisionPrompt(state, validActions),
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 60,
          top_p: 0.9,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text: string | undefined = data.response?.trim();
    if (!text) return null;

    // Extract JSON object containing "action" key
    const jsonMatch = text.match(/\{[^}]*"action"[^}]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { action: string; reasoning?: string };
    const action = parsed.action as GameAction;

    // Validate the chosen action is in the valid list
    if (!validActions.includes(action)) return null;

    return {
      action,
      reasoning: parsed.reasoning ?? "no reasoning provided",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Deterministic heuristic fallback when Ollama is unavailable.
 * Simple survival-first logic: address critical vitals, then progress.
 */
export function heuristicDecision(
  state: GameState,
  validActions: GameAction[],
): AIDecision {
  const { player } = state;

  const can = (a: GameAction): boolean => validActions.includes(a);

  // Critical: low energy + have food
  if (player.energy < 30 && player.food > 0 && can("eat")) {
    return { action: "eat", reasoning: "energy critically low, eating to recover" };
  }

  // Critical: low hydration + have water
  if (player.hydration < 30 && player.water > 0 && can("drink")) {
    return { action: "drink", reasoning: "dehydration risk, drinking water" };
  }

  // Critical: hypothermia risk
  if (player.bodyTemp < 30 && can("set_camp")) {
    return { action: "set_camp", reasoning: "body temperature dangerously low, setting camp to warm up" };
  }

  // Critical: altitude sickness
  if (player.o2Saturation < 25 && player.medicine > 0 && can("use_medicine")) {
    return { action: "use_medicine", reasoning: "severe altitude sickness, using medicine" };
  }

  // Low energy: camp or rest
  if (player.energy < 40 && can("set_camp")) {
    return { action: "set_camp", reasoning: "energy low, setting camp to recover" };
  }
  if (player.energy < 40 && can("rest")) {
    return { action: "rest", reasoning: "energy low, resting to recover" };
  }

  // Lost: check map
  if (player.isLost && can("check_map")) {
    return { action: "check_map", reasoning: "lost on the trail, checking map to reorient" };
  }

  // Default: push forward
  if (can("push_forward")) {
    return { action: "push_forward", reasoning: "conditions acceptable, pressing onward" };
  }

  // Ultimate fallback: first valid action
  return { action: validActions[0], reasoning: "taking only available action" };
}
