/**
 * Ollama-powered AI decision service for auto-play mode.
 * Asks the local Ollama LLM to pick the next game action, with a
 * deterministic heuristic fallback when the LLM is unavailable.
 */

import type { GameAction, GameState, Waypoint } from "../engine/types.ts";
import { WAYPOINTS } from "../data/waypoints.ts";
import { calculateRisk } from "../engine/riskCalculator.ts";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "gemma4:27b";
const TIMEOUT_MS = 15000;

/** Result of an AI or heuristic decision. */
export interface AIDecision {
  action: GameAction;
  reasoning: string;
}

/**
 * Build a decision prompt from the current game state and valid actions.
 * Includes survival priority, risk awareness, and descend teaching.
 */
function buildDecisionPrompt(state: GameState, validActions: GameAction[], riskPercent: number): string {
  const wp: Waypoint = WAYPOINTS[state.player.currentWaypointIndex];
  const { weather, time, player } = state;
  const totalWaypoints = WAYPOINTS.length;
  const progressPct = Math.round((player.currentWaypointIndex / (totalWaypoints - 1)) * 100);

  // Count critical vitals
  const criticalVitals: string[] = [];
  if (player.energy < 30) criticalVitals.push(`Energy=${Math.round(player.energy)}%`);
  if (player.hydration < 30) criticalVitals.push(`Hydration=${Math.round(player.hydration)}%`);
  if (player.bodyTemp < 30) criticalVitals.push(`BodyTemp=${Math.round(player.bodyTemp)}%`);
  if (player.o2Saturation < 30) criticalVitals.push(`O2=${Math.round(player.o2Saturation)}%`);
  if (player.morale < 30) criticalVitals.push(`Morale=${Math.round(player.morale)}%`);

  const criticalWarning = criticalVitals.length > 0
    ? `\n⚠ CRITICAL VITALS: ${criticalVitals.join(", ")}`
    : "";

  const riskLevel = riskPercent > 0.7 ? "EXTREME" : riskPercent > 0.5 ? "HIGH" : riskPercent > 0.3 ? "MODERATE" : "LOW";

  return `You are an AI survival strategist for a hiking simulation on the Ao Tai Line (鳌太线).

SURVIVAL IS PRIORITY #1. You must keep the hiker alive above all else.

WINNING CONDITIONS (either counts as victory):
1. SUMMIT: Reach waypoint 12 (拔仙台, 3767m) — the ultimate goal
2. ESCAPE: Descend back to waypoint 0 (塘口) after at least 4 turns — a valid survival victory

CURRENT STATE:
- Location: ${wp.name} (${wp.nameCN}), WP ${player.currentWaypointIndex}/${totalWaypoints - 1} (${progressPct}% progress)
- Elevation: ${wp.elevation}m, Terrain: ${wp.terrain.replace("_", " ")}
- Weather: ${weather.current}, intensity ${Math.round(weather.intensity * 100)}%, wind ${Math.round(weather.windSpeed)}
- Time: Day ${time.day}, ${Math.floor(time.hour)}:00 (${time.timeOfDay})
- RISK: ${Math.round(riskPercent * 100)}% (${riskLevel})
- Energy: ${Math.round(player.energy)}%, Hydration: ${Math.round(player.hydration)}%
- Body Temp: ${Math.round(player.bodyTemp)}%, O2: ${Math.round(player.o2Saturation)}%
- Morale: ${Math.round(player.morale)}%
- Food: ${player.food} meals, Water: ${player.water.toFixed(1)}L, Gear: ${player.gear}%, Medicine: ${player.medicine}
- Lost: ${player.isLost ? "YES — must push_forward to search for trail (check_map once first to boost odds)" : "no"}
- Turn: ${state.turnNumber}${criticalWarning}

MANDATORY RULES (follow in priority order):
1. If Energy < 60% and food > 0: choose "eat" (+50 energy, much more efficient than rest)
2. If Hydration < 50% and water > 0: choose "drink" (+40 hydration)
3. If Body Temp < 40% and food > 0: choose "set_camp" (major warmth + morale recovery)
4. If night/dusk and food > 0: choose "set_camp" (sleep through dangerous night hours)
5. If Risk > 70% and any vital < 30%: choose "descend" to retreat to safety
6. SET CAMP costs 1 food but gives MAJOR energy + warmth + morale. Overnight camp with shelter FULLY restores bodyTemp to 70 in clear weather. Camp is the ONLY serious way to recover Body Temp. Bad weather reduces recovery (blizzard worst, wind moderate, snow mild).
7. CAMP FORAGING: Setting camp during DAYTIME gives +0.5 food (foraging). Night camp gives no food. So prefer daytime camp when possible to offset food cost.
8. REST is WEAK (+8 energy, +2 bodyTemp in calm weather, 0 in wind/blizzard) — costs 0.3L water. Use camp for real recovery.
9. EAT gives +50 energy, +8 morale, +3 bodyTemp (hot food). Eat/drink are the MOST EFFICIENT actions — always prefer them before rest/camp when vitals are low.
10. WHEN LOST: check_map ONCE (improves find-back probability), then push_forward to actually search for the trail. Do NOT keep checking map repeatedly — you must move to find the way back. Pattern: check_map → push_forward → check_map → push_forward.
11. When all vitals > 60% and conditions are acceptable: choose "push_forward" to make progress.
12. If resources depleted and vitals declining: "descend" to survive rather than die pushing forward.
13. Use medicine for altitude sickness (low O2) or fall injuries only. Medicine does NOT help body temp.
14. Water resupply has 70% chance at stream valleys. Food caches have 70% chance at shelter waypoints (camp_2900, shuiwo, camp_2800).

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
  riskPercent?: number,
): Promise<AIDecision | null> {
  const risk = riskPercent ?? calculateRisk(state, WAYPOINTS);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildDecisionPrompt(state, validActions, risk),
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
 * Survival-first logic with strategic retreat support.
 */
export function heuristicDecision(
  state: GameState,
  validActions: GameAction[],
  riskPercent?: number,
): AIDecision {
  const { player } = state;
  const risk = riskPercent ?? calculateRisk(state, WAYPOINTS);

  const can = (a: GameAction): boolean => validActions.includes(a);

  // Count critical vitals (below 30)
  const criticalCount = [player.energy, player.hydration, player.bodyTemp, player.o2Saturation, player.morale]
    .filter(v => v < 30).length;

  // STRATEGIC RETREAT: High risk + critical vitals → descend
  if (risk > 0.7 && criticalCount >= 1 && can("descend")) {
    return { action: "descend", reasoning: "risk extreme and vitals critical, retreating to safety" };
  }

  // STRATEGIC RETREAT: Multiple critical vitals past halfway → descend
  if (criticalCount >= 2 && player.currentWaypointIndex >= 5 && can("descend")) {
    return { action: "descend", reasoning: "multiple vitals critical deep in route, retreating" };
  }

  // STRATEGIC RETREAT: Very low resources → descend
  if (player.food <= 0 && player.water <= 0.5 && player.energy < 40 && can("descend")) {
    return { action: "descend", reasoning: "resources depleted, retreating while still able" };
  }

  // Fall injury: prioritize medicine
  const hasFallInjury = player.statusEffects.some(e => e.id === "fall_injury");
  if (hasFallInjury && player.medicine > 0 && can("use_medicine")) {
    return { action: "use_medicine", reasoning: "treating fall injury with medicine" };
  }

  // Critical: low energy + have food → eat
  if (player.energy < 30 && player.food > 0 && can("eat")) {
    return { action: "eat", reasoning: "energy critically low, eating to recover" };
  }

  // Critical: low hydration + have water → drink
  if (player.hydration < 30 && player.water > 0 && can("drink")) {
    return { action: "drink", reasoning: "dehydration risk, drinking water" };
  }

  // Critical: hypothermia risk → camp if have food
  if (player.bodyTemp < 30 && player.food > 0 && can("set_camp")) {
    return { action: "set_camp", reasoning: "body temperature dangerously low, setting camp to warm up" };
  }

  // Critical: altitude sickness
  if (player.o2Saturation < 25 && player.medicine > 0 && can("use_medicine")) {
    return { action: "use_medicine", reasoning: "severe altitude sickness, using medicine" };
  }

  // Moderate: low energy with food → eat first (cheaper than camp)
  if (player.energy < 60 && player.food > 0 && can("eat")) {
    return { action: "eat", reasoning: "energy moderate, eating before it becomes critical" };
  }

  // Moderate: low hydration with water → drink first
  if (player.hydration < 50 && player.water > 0 && can("drink")) {
    return { action: "drink", reasoning: "hydration moderate, drinking to maintain levels" };
  }

  // Low energy: camp only if we have food (camp costs food now!)
  if (player.energy < 40 && player.food > 0 && can("set_camp")) {
    return { action: "set_camp", reasoning: "energy low, setting camp to recover" };
  }

  // Low energy without food: rest if we have water
  if (player.energy < 40 && player.water > 0.5 && can("rest")) {
    return { action: "rest", reasoning: "energy low, resting to recover" };
  }

  // Lost: check map ONCE to boost find-back odds, then push forward to actually move
  // check_map only increases probability of finding way back on next push_forward
  if (player.isLost) {
    // Check if we already checked the map recently (last action was check_map)
    const lastWasMapCheck = state.log.length > 0 &&
      state.log[state.log.length - 1].text.includes("Check Map");
    if (!lastWasMapCheck && can("check_map")) {
      return { action: "check_map", reasoning: "lost — checking map to improve odds of finding trail" };
    }
    if (can("push_forward")) {
      return { action: "push_forward", reasoning: "lost — moving to search for the trail (map checked)" };
    }
  }

  // Night time + can camp + have food: camp for the night
  if ((state.time.timeOfDay === "night" || state.time.timeOfDay === "dusk") && player.food > 0 && can("set_camp")) {
    return { action: "set_camp", reasoning: "nightfall approaching, setting camp" };
  }

  // Default: push forward
  if (can("push_forward")) {
    return { action: "push_forward", reasoning: "conditions acceptable, pressing onward" };
  }

  // If can't push forward, try descend
  if (can("descend")) {
    return { action: "descend", reasoning: "cannot advance, descending" };
  }

  // Ultimate fallback: first valid action
  return { action: validActions[0], reasoning: "taking only available action" };
}
