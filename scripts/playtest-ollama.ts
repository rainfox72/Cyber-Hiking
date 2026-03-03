/**
 * Automated playtest using Ollama AI decisions — plays the game N times
 * with the LLM choosing every action, and reports statistics.
 * Falls back to heuristic bot if Ollama fails on a given turn.
 */

import { createInitialState, processAction, validateAction } from "../src/engine/gameEngine.ts";
import { WAYPOINTS } from "../src/data/waypoints.ts";
import { createRNG } from "../src/utils/random.ts";
import type { GameState, GameAction } from "../src/engine/types.ts";
import { generateDecision, heuristicDecision } from "../src/services/ollamaDecision.ts";
import { calculateRisk } from "../src/engine/riskCalculator.ts";

const NUM_GAMES = 20;
const MAX_TURNS = 120; // safety cap

interface GameResult {
  gameId: number;
  outcome: "summit" | "escape" | "defeat" | "timeout";
  endingType: string | null;
  defeatCause: string | null;
  dyingCause: string | null;
  turns: number;
  days: number;
  distance: number;
  maxWaypoint: number;
  maxWaypointName: string;
  gotLost: boolean;
  lostCount: number;
  fellCount: number;
  fatalFall: boolean;
  finalEnergy: number;
  finalHydration: number;
  finalBodyTemp: number;
  finalO2: number;
  finalMorale: number;
  finalFood: number;
  finalWater: number;
  ollamaDecisions: number;
  heuristicFallbacks: number;
  actionHistory: string[];
  eventLog: string[];
}

/** Get valid actions for current state */
function getValidActions(state: GameState): GameAction[] {
  const all: GameAction[] = [
    "push_forward", "set_camp", "descend", "check_map",
    "rest", "eat", "drink", "use_medicine",
  ];
  return all.filter((a) => validateAction(state, a, WAYPOINTS));
}

async function playGame(gameId: number): Promise<GameResult> {
  let state = createInitialState();
  const rng = createRNG(Date.now() + gameId * 7919);

  let maxWaypoint = 0;
  let gotLost = false;
  let lostCount = 0;
  let fellCount = 0;
  let fatalFall = false;
  let ollamaDecisions = 0;
  let heuristicFallbacks = 0;
  const eventLog: string[] = [];
  const actionHistory: string[] = [];

  let prevLost = false;
  let prevFallInjury = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (state.gamePhase !== "playing") break;

    const validActions = getValidActions(state);
    if (validActions.length === 0) break;

    // Calculate risk for AI decisions
    const riskPercent = calculateRisk(state, WAYPOINTS);

    // Try Ollama first, fall back to heuristic
    let decision = await generateDecision(state, validActions, riskPercent);
    if (decision) {
      ollamaDecisions++;
    } else {
      decision = heuristicDecision(state, validActions, riskPercent);
      heuristicFallbacks++;
    }

    const action = decision.action;
    actionHistory.push(action);

    try {
      const result = processAction(state, action, WAYPOINTS, rng);
      state = result.newState;

      // Track max waypoint reached
      if (state.player.currentWaypointIndex > maxWaypoint) {
        maxWaypoint = state.player.currentWaypointIndex;
      }

      // Track lost events
      if (state.player.isLost && !prevLost) {
        gotLost = true;
        lostCount++;
        eventLog.push(`T${state.turnNumber}: Got lost at WP${state.player.lostFromWaypointIndex}`);
      }
      if (!state.player.isLost && prevLost) {
        eventLog.push(`T${state.turnNumber}: Found trail at WP${state.player.currentWaypointIndex}`);
      }
      prevLost = state.player.isLost;

      // Track falls
      const hasFallInjury = state.player.statusEffects.some(e => e.id === "fall_injury");
      if (hasFallInjury && !prevFallInjury) {
        fellCount++;
        eventLog.push(`T${state.turnNumber}: Fall injury`);
      }
      prevFallInjury = hasFallInjury;

      // Track fatal fall
      if (state.gamePhase === "dying" && state.dyingCause?.includes("FALL")) {
        fatalFall = true;
        eventLog.push(`T${state.turnNumber}: FATAL FALL`);
      }

      // Track critical events
      for (const evt of result.events) {
        eventLog.push(`T${state.turnNumber}: Event [${evt.severity}] ${evt.name}`);
      }

      // Log defeat
      if (state.gamePhase === "dying" || state.gamePhase === "defeat") {
        eventLog.push(`T${state.turnNumber}: ${state.dyingCause || state.defeatCause}`);
      }
    } catch (e) {
      eventLog.push(`T${state.turnNumber}: ERROR - ${(e as Error).message}`);
      break;
    }
  }

  const outcome =
    state.gamePhase === "victory" ? (state.endingType as "summit" | "escape") :
    state.gamePhase === "defeat" || state.gamePhase === "dying" ? "defeat" :
    "timeout";

  return {
    gameId,
    outcome,
    endingType: state.endingType,
    defeatCause: state.defeatCause,
    dyingCause: state.dyingCause,
    turns: state.turnNumber,
    days: state.time.day,
    distance: Math.round(state.player.distanceTraveled * 10) / 10,
    maxWaypoint,
    maxWaypointName: WAYPOINTS[maxWaypoint].nameCN,
    gotLost,
    lostCount,
    fellCount,
    fatalFall,
    finalEnergy: Math.round(state.player.energy),
    finalHydration: Math.round(state.player.hydration),
    finalBodyTemp: Math.round(state.player.bodyTemp),
    finalO2: Math.round(state.player.o2Saturation),
    finalMorale: Math.round(state.player.morale),
    finalFood: state.player.food,
    finalWater: Math.round(state.player.water * 10) / 10,
    ollamaDecisions,
    heuristicFallbacks,
    actionHistory,
    eventLog,
  };
}

// --- Main ---
async function main() {
  // Check Ollama health
  try {
    const resp = await fetch("http://localhost:11434/api/tags");
    if (!resp.ok) throw new Error("Ollama not responding");
    console.log("[OK] Ollama is running\n");
  } catch {
    console.error("[ERROR] Ollama is not running at localhost:11434. Start it first.");
    process.exit(1);
  }

  console.log(`${"=".repeat(70)}`);
  console.log(`  AO TAI CYBER-HIKE — OLLAMA AI PLAYTEST (${NUM_GAMES} games)`);
  console.log(`${"=".repeat(70)}\n`);

  const results: GameResult[] = [];

  for (let i = 0; i < NUM_GAMES; i++) {
    const gameNum = i + 1;
    process.stdout.write(`Playing game #${gameNum}/${NUM_GAMES}...`);
    const result = await playGame(gameNum);
    const causeShort = result.outcome === "defeat"
      ? (result.dyingCause || "unknown").substring(0, 25)
      : result.outcome.toUpperCase();
    console.log(` ${result.outcome.toUpperCase()} (${result.turns}t, ${result.days}d, WP${result.maxWaypoint}) [AI:${result.ollamaDecisions}/Bot:${result.heuristicFallbacks}] ${causeShort}`);
    results.push(result);
  }

  // --- Per-game summary ---
  console.log(`\n${"=".repeat(90)}`);
  console.log("GAME-BY-GAME RESULTS");
  console.log("-".repeat(90));
  console.log(
    "Game".padEnd(6) +
    "Outcome".padEnd(10) +
    "Turns".padEnd(7) +
    "Days".padEnd(6) +
    "Dist".padEnd(8) +
    "MaxWP".padEnd(10) +
    "Lost".padEnd(6) +
    "Fell".padEnd(6) +
    "AI/Bot".padEnd(10) +
    "Cause"
  );
  console.log("-".repeat(90));

  for (const r of results) {
    const cause = r.outcome === "defeat"
      ? (r.dyingCause || r.defeatCause || "unknown").substring(0, 30)
      : r.outcome === "summit" ? "ENDING 2: SUMMIT"
      : r.outcome === "escape" ? "ENDING 1: ESCAPE"
      : "TIMEOUT";

    console.log(
      `#${String(r.gameId).padEnd(4)}` +
      r.outcome.toUpperCase().padEnd(10) +
      String(r.turns).padEnd(7) +
      String(r.days).padEnd(6) +
      `${r.distance}km`.padEnd(8) +
      r.maxWaypointName.padEnd(10) +
      String(r.lostCount).padEnd(6) +
      String(r.fellCount).padEnd(6) +
      `${r.ollamaDecisions}/${r.heuristicFallbacks}`.padEnd(10) +
      cause
    );
  }

  // --- Aggregate stats ---
  console.log(`\n${"=".repeat(90)}`);
  console.log("AGGREGATE STATISTICS");
  console.log("=".repeat(90));

  const summitWins = results.filter(r => r.outcome === "summit");
  const escapeWins = results.filter(r => r.outcome === "escape");
  const defeats = results.filter(r => r.outcome === "defeat");
  const timeouts = results.filter(r => r.outcome === "timeout");

  console.log(`\nOutcomes:`);
  console.log(`  Summit (Ending 2): ${summitWins.length}/${NUM_GAMES} (${(summitWins.length/NUM_GAMES*100).toFixed(0)}%)`);
  console.log(`  Escape (Ending 1): ${escapeWins.length}/${NUM_GAMES} (${(escapeWins.length/NUM_GAMES*100).toFixed(0)}%)`);
  console.log(`  Defeat:            ${defeats.length}/${NUM_GAMES} (${(defeats.length/NUM_GAMES*100).toFixed(0)}%)`);
  console.log(`  Timeout:           ${timeouts.length}/${NUM_GAMES} (${(timeouts.length/NUM_GAMES*100).toFixed(0)}%)`);

  // Ollama vs heuristic
  const totalOllama = results.reduce((s, r) => s + r.ollamaDecisions, 0);
  const totalHeuristic = results.reduce((s, r) => s + r.heuristicFallbacks, 0);
  console.log(`\nAI Decision Source:`);
  console.log(`  Ollama decisions: ${totalOllama} (${(totalOllama/(totalOllama+totalHeuristic)*100).toFixed(0)}%)`);
  console.log(`  Heuristic fallbacks: ${totalHeuristic} (${(totalHeuristic/(totalOllama+totalHeuristic)*100).toFixed(0)}%)`);

  // Death causes
  if (defeats.length > 0) {
    console.log(`\nDeath Causes:`);
    const causeCounts: Record<string, number> = {};
    for (const r of defeats) {
      const cause = r.dyingCause || r.defeatCause || "unknown";
      let category = "OTHER";
      if (cause.includes("EXHAUSTION") || cause.includes("exhaustion")) category = "EXHAUSTION";
      else if (cause.includes("DEHYDRAT") || cause.includes("dehydrat")) category = "DEHYDRATION";
      else if (cause.includes("HYPOTHER") || cause.includes("hypother")) category = "HYPOTHERMIA";
      else if (cause.includes("ALTITUDE") || cause.includes("altitude") || cause.includes("O2") || cause.includes("o2")) category = "ALTITUDE SICKNESS";
      else if (cause.includes("DESPAIR") || cause.includes("despair") || cause.includes("morale")) category = "DESPAIR";
      else if (cause.includes("FALL") || cause.includes("fall")) category = "FATAL FALL";
      causeCounts[category] = (causeCounts[category] || 0) + 1;
    }
    for (const [cause, count] of Object.entries(causeCounts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${cause}: ${count} (${(count/defeats.length*100).toFixed(0)}%)`);
    }
  }

  // Getting lost stats
  const gamesWithLost = results.filter(r => r.gotLost);
  const totalLostEvents = results.reduce((sum, r) => sum + r.lostCount, 0);
  console.log(`\nGetting Lost:`);
  console.log(`  Games with lost event: ${gamesWithLost.length}/${NUM_GAMES} (${(gamesWithLost.length/NUM_GAMES*100).toFixed(0)}%)`);
  console.log(`  Total lost events: ${totalLostEvents}`);
  console.log(`  Avg per game: ${(totalLostEvents/NUM_GAMES).toFixed(1)}`);

  // Fall stats
  const gamesWithFalls = results.filter(r => r.fellCount > 0);
  const totalFalls = results.reduce((sum, r) => sum + r.fellCount, 0);
  const fatalFalls = results.filter(r => r.fatalFall);
  console.log(`\nFalls:`);
  console.log(`  Games with falls: ${gamesWithFalls.length}/${NUM_GAMES} (${(gamesWithFalls.length/NUM_GAMES*100).toFixed(0)}%)`);
  console.log(`  Total falls: ${totalFalls}`);
  console.log(`  Fatal falls: ${fatalFalls.length}`);

  // Turn/day/distance stats
  const avgTurns = results.reduce((s, r) => s + r.turns, 0) / NUM_GAMES;
  const avgDays = results.reduce((s, r) => s + r.days, 0) / NUM_GAMES;
  const avgDist = results.reduce((s, r) => s + r.distance, 0) / NUM_GAMES;
  const maxDist = Math.max(...results.map(r => r.distance));
  console.log(`\nProgression:`);
  console.log(`  Avg turns: ${avgTurns.toFixed(1)}`);
  console.log(`  Avg days: ${avgDays.toFixed(1)}`);
  console.log(`  Avg distance: ${avgDist.toFixed(1)}km`);
  console.log(`  Max distance: ${maxDist}km`);

  // Waypoint reach distribution
  console.log(`\nFurthest Waypoint Reached:`);
  const wpCounts: Record<string, number> = {};
  for (const r of results) {
    const key = `WP${r.maxWaypoint} ${r.maxWaypointName}`;
    wpCounts[key] = (wpCounts[key] || 0) + 1;
  }
  for (const [wp, count] of Object.entries(wpCounts).sort()) {
    console.log(`  ${wp}: ${count} games`);
  }

  // Final vitals of defeats
  if (defeats.length > 0) {
    console.log(`\nDefeat Final Vitals (avg):`);
    const avgE = defeats.reduce((s, r) => s + r.finalEnergy, 0) / defeats.length;
    const avgH = defeats.reduce((s, r) => s + r.finalHydration, 0) / defeats.length;
    const avgT = defeats.reduce((s, r) => s + r.finalBodyTemp, 0) / defeats.length;
    const avgO = defeats.reduce((s, r) => s + r.finalO2, 0) / defeats.length;
    const avgM = defeats.reduce((s, r) => s + r.finalMorale, 0) / defeats.length;
    console.log(`  Energy: ${avgE.toFixed(0)}%  Hydration: ${avgH.toFixed(0)}%  BodyTemp: ${avgT.toFixed(0)}%  O2: ${avgO.toFixed(0)}%  Morale: ${avgM.toFixed(0)}%`);
  }

  // Resource usage
  console.log(`\nResource Usage (at end):`);
  const avgFood = results.reduce((s, r) => s + r.finalFood, 0) / NUM_GAMES;
  const avgWater = results.reduce((s, r) => s + r.finalWater, 0) / NUM_GAMES;
  console.log(`  Avg remaining food: ${avgFood.toFixed(1)} (started: 14 + caches)`);
  console.log(`  Avg remaining water: ${avgWater.toFixed(1)}L (started: 6L)`);

  // Action distribution
  console.log(`\nAction Distribution (across all games):`);
  const actionCounts: Record<string, number> = {};
  for (const r of results) {
    for (const a of r.actionHistory) {
      actionCounts[a] = (actionCounts[a] || 0) + 1;
    }
  }
  const totalActions = Object.values(actionCounts).reduce((s, c) => s + c, 0);
  for (const [action, count] of Object.entries(actionCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${action}: ${count} (${(count/totalActions*100).toFixed(0)}%)`);
  }

  // Dying breath check
  const defeatsWithoutCause = defeats.filter(r => !r.dyingCause);
  console.log(`\nDying Breath Check:`);
  console.log(`  Defeats with dyingCause: ${defeats.length - defeatsWithoutCause.length}/${defeats.length}`);

  // Escape/Summit check
  if (escapeWins.length > 0) {
    console.log(`\nEscape Wins:`);
    for (const r of escapeWins) {
      console.log(`  Game #${r.gameId}: turns=${r.turns}, distance=${r.distance}km, maxWP=${r.maxWaypointName}`);
    }
  }
  if (summitWins.length > 0) {
    console.log(`\nSummit Wins:`);
    for (const r of summitWins) {
      console.log(`  Game #${r.gameId}: turns=${r.turns}, distance=${r.distance}km, days=${r.days}`);
    }
  }

  console.log(`\n${"=".repeat(90)}`);
  console.log("OLLAMA PLAYTEST COMPLETE");
  console.log("=".repeat(90));
}

main().catch(console.error);
