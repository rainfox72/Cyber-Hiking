/**
 * Automated playtest bot — plays the game N times using the pure TS engine
 * and reports statistics on outcomes, balance, and edge cases.
 */

import { createInitialState, processAction, validateAction } from "../src/engine/gameEngine.ts";
import { WAYPOINTS } from "../src/data/waypoints.ts";
import { createRNG } from "../src/utils/random.ts";
import type { GameState, GameAction } from "../src/engine/types.ts";

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
  eventLog: string[];
}

type BotStyle = "aggressive" | "cautious" | "escape";

/** Bot strategy — behavior depends on style */
function chooseAction(state: GameState, style: BotStyle): GameAction {
  const p = state.player;
  const valid = (a: GameAction) => validateAction(state, a, WAYPOINTS);
  const isNight = state.time.timeOfDay === "night" || state.time.timeOfDay === "dusk";
  const avgVital = (p.energy + p.hydration + p.bodyTemp + p.o2Saturation + p.morale) / 5;

  // --- ESCAPE bot: push forward a bit, then retreat home ---
  if (style === "escape") {
    // Go to waypoint 2-3, then descend back
    if (p.currentWaypointIndex >= 2 && valid("descend")) return "descend";
    // Eat/drink to survive the return
    if (p.energy < 50 && p.food > 0 && valid("eat")) return "eat";
    if (p.hydration < 50 && p.water > 0 && valid("drink")) return "drink";
    if (p.energy < 30 && valid("set_camp")) return "set_camp";
    if (!p.checkedMapThisSegment && valid("check_map")) return "check_map";
    if (valid("push_forward")) return "push_forward";
    if (valid("rest")) return "rest";
    return "rest";
  }

  // --- Shared emergency actions ---
  // Use medicine if O2 critical or has fall injury
  if (p.o2Saturation < 35 && p.medicine > 0 && valid("use_medicine")) return "use_medicine";
  if (p.statusEffects.some(e => e.id === "fall_injury") && p.medicine > 0 && valid("use_medicine")) return "use_medicine";

  // --- CAUTIOUS bot: camps at night, eats/drinks proactively, checks map always ---
  if (style === "cautious") {
    // Always camp at night
    if (isNight && valid("set_camp")) return "set_camp";

    // Eat/drink proactively (higher thresholds)
    if (p.hydration < 60 && p.water > 0 && valid("drink")) return "drink";
    if (p.energy < 55 && p.food > 0 && valid("eat")) return "eat";

    // Camp when energy below half
    if (p.energy < 40 && valid("set_camp")) return "set_camp";
    if (p.energy < 30 && valid("rest")) return "rest";

    // Always check map before pushing
    if (!p.checkedMapThisSegment && valid("check_map")) return "check_map";

    // Use medicine proactively for body temp
    if (p.bodyTemp < 25 && p.medicine > 0 && valid("use_medicine")) return "use_medicine";

    // Retreat if vitals are dangerously low
    if (avgVital < 30 && valid("descend")) return "descend";

    if (valid("push_forward")) return "push_forward";
    if (valid("rest")) return "rest";
    return "rest";
  }

  // --- AGGRESSIVE bot: pushes hard, minimal rest ---
  // Eat if energy low
  if (p.energy < 40 && p.food > 0 && valid("eat")) return "eat";

  // Drink if hydration low
  if (p.hydration < 40 && p.water > 0 && valid("drink")) return "drink";

  // Camp if energy very low
  if (p.energy < 20 && valid("set_camp")) return "set_camp";

  // Rest if can't camp but energy low
  if (p.energy < 15 && valid("rest")) return "rest";

  // Check map every ~3 pushes if not checked this segment
  if (!p.checkedMapThisSegment && state.turnNumber % 3 === 0 && valid("check_map")) return "check_map";

  // Push forward if possible
  if (valid("push_forward")) return "push_forward";

  // If can't push, try descend
  if (valid("descend")) return "descend";

  // Fallback: rest
  if (valid("rest")) return "rest";

  // Last resort
  if (valid("eat") && p.food > 0) return "eat";
  if (valid("drink") && p.water > 0) return "drink";

  return "rest";
}

function playGame(gameId: number, style: BotStyle): GameResult {
  let state = createInitialState();
  const rng = createRNG(Date.now() + gameId * 7919); // unique seed per game

  let maxWaypoint = 0;
  let gotLost = false;
  let lostCount = 0;
  let fellCount = 0;
  let fatalFall = false;
  const eventLog: string[] = [];

  let prevLost = false;
  let prevFallInjury = false;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (state.gamePhase !== "playing") break;

    const action = chooseAction(state, style);

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
    eventLog,
  };
}

// --- Run games ---
console.log(`\n${"=".repeat(70)}`);
console.log(`  AO TAI CYBER-HIKE — AUTOMATED PLAYTEST (${NUM_GAMES} games)`);
console.log(`${"=".repeat(70)}\n`);

const results: GameResult[] = [];
const styles: BotStyle[] = [
  // 7 aggressive, 7 cautious, 6 escape
  "aggressive", "aggressive", "aggressive", "aggressive", "aggressive", "aggressive", "aggressive",
  "cautious", "cautious", "cautious", "cautious", "cautious", "cautious", "cautious",
  "escape", "escape", "escape", "escape", "escape", "escape",
];
for (let i = 0; i < NUM_GAMES; i++) {
  results.push(playGame(i + 1, styles[i]));
}

// --- Per-game summary ---
console.log("GAME-BY-GAME RESULTS");
console.log("-".repeat(70));
console.log(
  "Game".padEnd(6) +
  "Bot".padEnd(7) +
  "Outcome".padEnd(10) +
  "Turns".padEnd(7) +
  "Days".padEnd(6) +
  "Dist".padEnd(8) +
  "MaxWP".padEnd(8) +
  "Lost".padEnd(6) +
  "Fell".padEnd(6) +
  "Cause"
);
console.log("-".repeat(70));

for (const r of results) {
  const cause = r.outcome === "defeat"
    ? (r.dyingCause || r.defeatCause || "unknown").substring(0, 30)
    : r.outcome === "summit" ? "ENDING 2: SUMMIT"
    : r.outcome === "escape" ? "ENDING 1: ESCAPE"
    : "TIMEOUT";

  console.log(
    `#${String(r.gameId).padEnd(4)}` +
    styles[r.gameId - 1].substring(0, 5).padEnd(7) +
    r.outcome.toUpperCase().padEnd(10) +
    String(r.turns).padEnd(7) +
    String(r.days).padEnd(6) +
    `${r.distance}km`.padEnd(8) +
    r.maxWaypointName.padEnd(8) +
    String(r.lostCount).padEnd(6) +
    String(r.fellCount).padEnd(6) +
    cause
  );
}

// --- Aggregate stats ---
console.log(`\n${"=".repeat(70)}`);
console.log("AGGREGATE STATISTICS");
console.log("=".repeat(70));

const summitWins = results.filter(r => r.outcome === "summit");
const escapeWins = results.filter(r => r.outcome === "escape");
const defeats = results.filter(r => r.outcome === "defeat");
const timeouts = results.filter(r => r.outcome === "timeout");

console.log(`\nOutcomes:`);
console.log(`  Summit (Ending 2): ${summitWins.length}/${NUM_GAMES} (${(summitWins.length/NUM_GAMES*100).toFixed(0)}%)`);
console.log(`  Escape (Ending 1): ${escapeWins.length}/${NUM_GAMES} (${(escapeWins.length/NUM_GAMES*100).toFixed(0)}%)`);
console.log(`  Defeat:            ${defeats.length}/${NUM_GAMES} (${(defeats.length/NUM_GAMES*100).toFixed(0)}%)`);
console.log(`  Timeout:           ${timeouts.length}/${NUM_GAMES} (${(timeouts.length/NUM_GAMES*100).toFixed(0)}%)`);

// Death causes
if (defeats.length > 0) {
  console.log(`\nDeath Causes:`);
  const causeCounts: Record<string, number> = {};
  for (const r of defeats) {
    const cause = r.dyingCause || r.defeatCause || "unknown";
    // Simplify to category
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

// Final vitals of defeats (to check if dying breath is reasonable)
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
console.log(`  Avg remaining food: ${avgFood.toFixed(1)} (started: 6)`);
console.log(`  Avg remaining water: ${avgWater.toFixed(1)}L (started: 4L)`);

// Dying breath check — make sure all defeats have a dyingCause
const defeatsWithoutCause = defeats.filter(r => !r.dyingCause);
console.log(`\nDying Breath Check:`);
console.log(`  Defeats with dyingCause: ${defeats.length - defeatsWithoutCause.length}/${defeats.length}`);
if (defeatsWithoutCause.length > 0) {
  console.log(`  ⚠ MISSING dyingCause in games: ${defeatsWithoutCause.map(r => r.gameId).join(", ")}`);
}

// Escape ending check
console.log(`\nEscape Ending Check:`);
if (escapeWins.length > 0) {
  for (const r of escapeWins) {
    console.log(`  Game #${r.gameId}: turns=${r.turns}, distance=${r.distance}km, maxWP=${r.maxWaypointName}`);
  }
} else {
  console.log(`  No escape endings triggered (bot prefers pushing forward)`);
}

console.log(`\n${"=".repeat(70)}`);
console.log("PLAYTEST COMPLETE");
console.log("=".repeat(70));
