/**
 * Template-based fallback narrator for when Ollama is unavailable.
 * Assembles atmospheric sentences from fragments based on game state.
 */

import type { TurnResult } from "../engine/types.ts";
import type { RNG } from "../utils/random.ts";

const TERRAIN_FRAGMENTS: Record<string, string[]> = {
  stream_valley: [
    "Mountain streams hiss over mossy stones beneath the canopy.",
    "The trail follows the creek through thick undergrowth.",
    "Water sounds echo off the valley walls.",
  ],
  forest: [
    "Ancient firs loom overhead, their branches heavy with moisture.",
    "The trail narrows through dense rhododendron thickets.",
    "Fallen needles soften each step. The forest smells of resin and earth.",
    "Moss-covered trunks press close on both sides of the switchback.",
  ],
  meadow: [
    "Alpine grass ripples in the wind across the open slope.",
    "The meadow stretches wide, offering no shelter from the sky.",
    "Low scrub and wildflowers dot the marshy ground.",
  ],
  stone_sea: [
    "Boulders the size of houses form a chaotic maze of grey rock.",
    "Each step across the stone sea demands full attention.",
    "The rock field stretches endlessly, every surface slick with mist.",
  ],
  ridge: [
    "The ridge narrows to arm's width with drops on both sides.",
    "Wind tears across the exposed ridge with nothing to break it.",
    "The knife-edge traverse demands every ounce of focus.",
    "Loose scree skitters off the ridge into the void below.",
  ],
  scree: [
    "Loose rock shifts and slides underfoot with every step.",
    "The scree slope is treacherous—two steps forward, one step back.",
    "Rocks clatter downhill behind you, swallowed by the fog.",
  ],
  summit: [
    "The summit platform is windswept and bare, the highest point for a hundred kilometers.",
    "At the roof of the Qinling, the world drops away in every direction.",
  ],
};

const WEATHER_FRAGMENTS: Record<string, string[]> = {
  clear: [
    "The sky is a hard blue dome overhead.",
    "Visibility stretches to distant ridgelines.",
    "Sunlight warms the exposed rock but the air stays thin and cold.",
  ],
  cloudy: [
    "A grey lid of cloud hangs low over the peaks.",
    "Cloud banks roll in from the west, swallowing the far ridges.",
  ],
  fog: [
    "Visibility drops to less than ten meters.",
    "The fog is so thick you can barely see the trail markers.",
    "The world shrinks to a grey sphere around you. Sounds are muffled.",
    "You navigate by feel, each cairn a small victory against the whiteout.",
  ],
  rain: [
    "Cold rain drums against your jacket hood.",
    "The trail turns to mud and running water.",
    "Rain beads on every surface, dripping from pack straps and hat brims.",
  ],
  snow: [
    "Snow falls in thick curtains, muffling all sound.",
    "Fresh powder covers the trail, hiding the path beneath.",
    "The world goes white. Each breath burns cold in your throat.",
  ],
  blizzard: [
    "The blizzard hits like a wall. Horizontal snow stings exposed skin.",
    "Wind-driven ice crystals reduce visibility to zero.",
    "The storm is relentless. Every step is a battle against the wind.",
  ],
  wind: [
    "Wind gusts slam into you with physical force.",
    "The wind screams across the ridge, never stopping.",
    "You lean into the gale at a forty-five degree angle just to stay upright.",
  ],
};

const ACTION_FRAGMENTS: Record<string, string[]> = {
  push_forward: [
    "You press on.",
    "You keep moving.",
    "One foot in front of the other.",
  ],
  set_camp: [
    "You pitch the tent and crawl inside. The wind howls outside.",
    "Camp is set. A chance to rest, if not to sleep well.",
    "The stove hisses as you heat water. Small comforts matter up here.",
  ],
  descend: [
    "You retreat downhill, losing hard-won elevation.",
    "The descent is its own challenge—knees aching on the steep trail.",
  ],
  rest: [
    "You stop and sit on a rock, breathing hard in the thin air.",
    "A brief rest. Your body thanks you; the mountain doesn't care.",
  ],
  eat: [
    "You force down a meal. Appetite fades at altitude but the body needs fuel.",
  ],
  drink: [
    "Water. The most precious resource on the ridge.",
  ],
  use_medicine: [
    "The medicine takes the edge off. Your head clears slightly.",
  ],
  check_map: [
    "You study the map, tracing the route ahead with a gloved finger.",
  ],
};

const EVENT_FRAGMENTS: Record<string, string[]> = {
  minor: [
    "A small mercy in the mountains.",
    "The ridge gives and takes in equal measure.",
  ],
  major: [
    "The situation grows serious.",
    "This changes the calculation.",
    "The mountain reminds you who is in charge.",
  ],
  critical: [
    "This is life-threatening.",
    "Every decision from here on matters.",
    "The margin for error just vanished.",
  ],
};

function pick(arr: string[], rng: RNG): string {
  return arr[rng.nextInt(0, arr.length - 1)];
}

/**
 * Generate a fallback narrative from templates.
 */
export function generateFallbackNarrative(result: TurnResult, rng: RNG): string {
  const parts: string[] = [];

  // Terrain fragment
  const terrainKey = getTerrainKey(result);
  if (TERRAIN_FRAGMENTS[terrainKey]) {
    parts.push(pick(TERRAIN_FRAGMENTS[terrainKey], rng));
  }

  // Weather fragment
  const weatherKey = result.newState.weather.current;
  if (WEATHER_FRAGMENTS[weatherKey]) {
    parts.push(pick(WEATHER_FRAGMENTS[weatherKey], rng));
  }

  // Action fragment
  const actionKey = result.action;
  if (ACTION_FRAGMENTS[actionKey]) {
    parts.push(pick(ACTION_FRAGMENTS[actionKey], rng));
  }

  // Event fragment (if any)
  if (result.events.length > 0) {
    const severity = result.events[0].severity;
    if (EVENT_FRAGMENTS[severity]) {
      parts.push(pick(EVENT_FRAGMENTS[severity], rng));
    }
  }

  return parts.join(" ");
}

function getTerrainKey(result: TurnResult): string {
  // We need to get terrain from the waypoint data
  // Since we can't import WAYPOINTS here without circular deps, use a simple lookup
  const terrainTypes = [
    "stream_valley", "forest", "forest", "meadow", "ridge",
    "stone_sea", "ridge", "meadow", "scree", "meadow",
    "ridge", "ridge", "summit",
  ];
  const idx = result.newState.player.currentWaypointIndex;
  return terrainTypes[idx] ?? "ridge";
}
