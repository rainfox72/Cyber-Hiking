/**
 * Ollama HTTP client for AI-powered narrative generation.
 * Calls the local Ollama server at localhost:11434.
 * Non-blocking: game never waits for the LLM. Falls back gracefully.
 */

import type { TurnResult } from "../engine/types.ts";
import { WAYPOINTS } from "../data/waypoints.ts";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const OLLAMA_TAGS_URL = "http://localhost:11434/api/tags";
const MODEL = "gemma4:27b";
const TIMEOUT_MS = 15000;

/**
 * Build a narrative prompt from the turn result context.
 */
function buildPrompt(result: TurnResult): string {
  const wp = WAYPOINTS[result.newState.player.currentWaypointIndex];
  const { weather, time, player } = result.newState;
  const eventText = result.events.length > 0
    ? `\n- CRITICAL EVENT: ${result.events.map(e => e.name).join(", ")}`
    : "";

  return `You are the narrator of a survival hiking simulation on the Ao Tai Line (鳌太线). Write 1-2 terse sentences (under 40 words). Mountaineering journal style. No flowery prose.

CURRENT SITUATION:
- Location: ${wp.name} (${wp.nameCN}), elevation ${wp.elevation}m
- Terrain: ${wp.terrain.replace("_", " ")}
- Weather: ${weather.current}, intensity ${Math.round(weather.intensity * 100)}%
- Time: Day ${time.day}, ${time.timeOfDay} (${Math.floor(time.hour)}:00)
- Action taken: ${result.action.replace("_", " ")}
- Risk level: ${Math.round(result.riskPercent * 100)}%
- Energy: ${Math.round(player.energy)}%, Hydration: ${Math.round(player.hydration)}%
- O2 Saturation: ${Math.round(player.o2Saturation)}%, Body Temp: ${Math.round(player.bodyTemp)}%${eventText}

STYLE: Second-person ("You..."). Terse, gritty. 1-2 sentences max. Under 40 words total.`;
}

/**
 * Generate narrative text from Ollama.
 * Returns null if Ollama is unavailable or times out.
 */
export async function generateNarrative(result: TurnResult): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        prompt: buildPrompt(result),
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 80,
          top_p: 0.9,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data.response?.trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if Ollama is reachable by pinging the tags endpoint.
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(OLLAMA_TAGS_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
}
