/**
 * Critical event catalog for the Ao Tai Cyber-Hike game engine.
 * Contains 25 events ranging from minor boosts to critical hazards.
 * Events are selected via weighted random based on current weather and terrain.
 */

import type {
  CriticalEvent,
  TerrainType,
  WeatherCondition,
} from "../engine/types.ts";
import type { RNG } from "../utils/random.ts";

const EVENT_CATALOG: CriticalEvent[] = [
  {
    id: "altitude_sickness",
    name: "Altitude Sickness",
    description:
      "A pounding headache and wave of nausea hit as your body struggles to adjust to the thinning air.",
    effects: { energy: -20, o2Saturation: -15, morale: -10 },
    severity: "major",
  },
  {
    id: "hypothermia_onset",
    name: "Hypothermia Onset",
    description:
      "Uncontrollable shivering sets in as your core temperature drops dangerously. Your fingers go numb.",
    effects: { bodyTemp: -25, energy: -15 },
    severity: "critical",
  },
  {
    id: "ankle_sprain",
    name: "Ankle Sprain",
    description:
      "Your foot catches on a hidden root and your ankle twists sharply. Pain shoots up your leg with every step.",
    effects: { energy: -15, gear: -20 },
    severity: "major",
  },
  {
    id: "lost_in_fog",
    name: "Lost in Fog",
    description:
      "Thick fog rolls in and swallows the trail markers. You wander in circles before finding your bearings again.",
    effects: { morale: -20, energy: -10 },
    severity: "major",
  },
  {
    id: "equipment_failure",
    name: "Equipment Failure",
    description:
      "Your pack frame snaps and tent poles buckle. Critical gear is now compromised beyond field repair.",
    effects: { gear: -100 },
    severity: "critical",
  },
  {
    id: "flash_storm",
    name: "Flash Storm",
    description:
      "A violent squall strikes without warning, driving horizontal rain through every layer of clothing.",
    effects: { bodyTemp: -15, hydration: -10 },
    severity: "major",
  },
  {
    id: "found_water",
    name: "Mountain Spring",
    description:
      "You stumble upon a crystal-clear spring trickling from a mossy rock face. The water is ice-cold and pure.",
    effects: { hydration: 30 },
    severity: "minor",
  },
  {
    id: "trail_marker",
    name: "Trail Marker Found",
    description:
      "A cairn with a faded ribbon appears through the mist. You are still on the right path after all.",
    effects: { morale: 15 },
    severity: "minor",
  },
  {
    id: "rockfall",
    name: "Rockfall",
    description:
      "Loose stones cascade from the slope above. You dive for cover but take a glancing blow to your pack.",
    effects: { energy: -25, gear: -15 },
    severity: "critical",
  },
  {
    id: "wildlife_scare",
    name: "Wildlife Encounter",
    description:
      "A takin crashes through the underbrush nearby, startling you. Your heart hammers long after it disappears.",
    effects: { morale: -15 },
    severity: "minor",
  },
  {
    id: "beautiful_vista",
    name: "Stunning Vista",
    description:
      "The clouds part to reveal an endless sea of peaks bathed in golden light. The beauty is overwhelming.",
    effects: { morale: 20 },
    severity: "minor",
  },
  {
    id: "dehydration_crisis",
    name: "Dehydration Crisis",
    description:
      "Your water reserves are critically low and the next source is unknown. Dizziness and cramps set in.",
    effects: { hydration: -30, energy: -10 },
    severity: "critical",
  },
  {
    id: "sudden_whiteout",
    name: "Sudden Whiteout",
    description:
      "Snow and fog merge into a featureless white void. Up and down become indistinguishable.",
    effects: { morale: -25, energy: -5, o2Saturation: -5 },
    severity: "major",
  },
  {
    id: "warm_sunbreak",
    name: "Warm Sunbreak",
    description:
      "The clouds break and warm sunlight floods the mountainside, drying your gear and lifting your spirits.",
    effects: { bodyTemp: 10, morale: 10 },
    severity: "minor",
  },
  {
    id: "rope_section",
    name: "Exposed Rope Section",
    description:
      "A crumbling cliff face forces you to haul yourself along a frayed fixed rope. One wrong grip could be fatal.",
    effects: { energy: -20, morale: -10, gear: -10 },
    severity: "major",
  },
  {
    id: "gear_tumble",
    name: "Gear Tumble",
    description:
      "A misstep sends your pack tumbling down the slope. Supplies scatter across the rocks below.",
    effects: { food: -2 },
    severity: "critical",
  },
  {
    id: "whiteout_event",
    name: "Total Whiteout",
    description:
      "Snow and fog merge into a featureless white void. You cannot move — you must wait it out.",
    effects: { morale: -15 },
    severity: "critical",
  },
  {
    id: "pulmonary_edema",
    name: "Pulmonary Edema",
    description:
      "A wet, rattling cough. Fluid is filling your lungs. Each breath is a drowning struggle.",
    effects: { energy: -30, o2Saturation: -20 },
    severity: "critical",
  },
  {
    id: "frostbite",
    name: "Frostbite",
    description:
      "Your fingers and toes turn waxy white. The numbness gives way to searing pain as tissue dies.",
    effects: { gear: -30, energy: -10, bodyTemp: -15 },
    severity: "major",
  },
  {
    id: "trail_collapse",
    name: "Trail Collapse",
    description:
      "The path crumbles beneath your feet. You slide downhill, clawing at loose earth and rock.",
    effects: { energy: -20, morale: -20 },
    severity: "major",
  },
  {
    id: "lost_trail",
    name: "Lost Trail",
    description:
      "The trail vanishes into a maze of identical boulder fields. Hours pass before you find the route.",
    effects: { energy: -15, morale: -10 },
    severity: "major",
  },
  {
    id: "pack_strap_breaks",
    name: "Pack Strap Breaks",
    description:
      "A shoulder strap snaps under the weight. Food spills from the top compartment as you scramble to catch it.",
    effects: { food: -1, gear: -15 },
    severity: "major",
  },
  {
    id: "altitude_insomnia",
    name: "Altitude Insomnia",
    description:
      "The thin air makes sleep impossible. You lie awake gasping, drifting between consciousness and panic.",
    effects: { energy: -10, morale: -5 },
    severity: "minor",
  },
  {
    id: "knee_injury",
    name: "Knee Injury",
    description:
      "A sharp pop in your knee followed by swelling. Every downward step sends lightning through the joint.",
    effects: { energy: -15 },
    severity: "major",
  },
  {
    id: "companion_warning",
    name: "Memorial Cairn",
    description:
      "A pile of stones with a faded photo and dates. Someone else did not make it past this point.",
    effects: { morale: -5 },
    severity: "minor",
  },
];

/**
 * Weight table mapping event IDs to base weight and conditional modifiers.
 * Higher weight = more likely to be selected.
 */
interface EventWeight {
  baseWeight: number;
  weatherBonus: Partial<Record<WeatherCondition, number>>;
  terrainBonus: Partial<Record<TerrainType, number>>;
}

const EVENT_WEIGHTS: Record<string, EventWeight> = {
  altitude_sickness: {
    baseWeight: 8,
    weatherBonus: {},
    terrainBonus: { ridge: 5, summit: 8, scree: 3 },
  },
  hypothermia_onset: {
    baseWeight: 4,
    weatherBonus: { snow: 8, blizzard: 12, wind: 5, rain: 3 },
    terrainBonus: { ridge: 3, summit: 5 },
  },
  ankle_sprain: {
    baseWeight: 6,
    weatherBonus: { rain: 3, fog: 2 },
    terrainBonus: { scree: 5, stone_sea: 4, forest: 2 },
  },
  lost_in_fog: {
    baseWeight: 2,
    weatherBonus: { fog: 15, snow: 5, blizzard: 3 },
    terrainBonus: { ridge: 3, stone_sea: 2 },
  },
  equipment_failure: {
    baseWeight: 2,
    weatherBonus: { blizzard: 4, wind: 3 },
    terrainBonus: { scree: 2, ridge: 2 },
  },
  flash_storm: {
    baseWeight: 3,
    weatherBonus: { rain: 8, cloudy: 4, wind: 3 },
    terrainBonus: { ridge: 3, summit: 3 },
  },
  found_water: {
    baseWeight: 5,
    weatherBonus: { rain: 3, clear: 2 },
    terrainBonus: { stream_valley: 8, meadow: 4, forest: 3 },
  },
  trail_marker: {
    baseWeight: 6,
    weatherBonus: { clear: 4 },
    terrainBonus: { forest: 2, meadow: 2 },
  },
  rockfall: {
    baseWeight: 2,
    weatherBonus: { rain: 3, wind: 2 },
    terrainBonus: { ridge: 8, scree: 10, stone_sea: 6 },
  },
  wildlife_scare: {
    baseWeight: 5,
    weatherBonus: { clear: 2 },
    terrainBonus: { forest: 6, meadow: 4, stream_valley: 3 },
  },
  beautiful_vista: {
    baseWeight: 5,
    weatherBonus: { clear: 10, cloudy: 3 },
    terrainBonus: { ridge: 5, summit: 8, meadow: 3 },
  },
  dehydration_crisis: {
    baseWeight: 3,
    weatherBonus: { clear: 3 },
    terrainBonus: { ridge: 4, scree: 4, stone_sea: 3 },
  },
  sudden_whiteout: {
    baseWeight: 2,
    weatherBonus: { snow: 10, blizzard: 8, fog: 6 },
    terrainBonus: { ridge: 4, summit: 5 },
  },
  warm_sunbreak: {
    baseWeight: 4,
    weatherBonus: { clear: 6, cloudy: 3 },
    terrainBonus: { meadow: 3, summit: 2 },
  },
  rope_section: {
    baseWeight: 3,
    weatherBonus: { rain: 2, wind: 2 },
    terrainBonus: { ridge: 6, scree: 4, stone_sea: 3 },
  },
  gear_tumble: {
    baseWeight: 3,
    weatherBonus: { wind: 4 },
    terrainBonus: { scree: 8, ridge: 6, stone_sea: 4 },
  },
  whiteout_event: {
    baseWeight: 1,
    weatherBonus: { blizzard: 12, snow: 8, fog: 6 },
    terrainBonus: { ridge: 4, summit: 4 },
  },
  pulmonary_edema: {
    baseWeight: 1,
    weatherBonus: {},
    terrainBonus: { summit: 10, ridge: 8 },
  },
  frostbite: {
    baseWeight: 2,
    weatherBonus: { blizzard: 10, snow: 6 },
    terrainBonus: { ridge: 4, summit: 3 },
  },
  trail_collapse: {
    baseWeight: 2,
    weatherBonus: { rain: 6 },
    terrainBonus: { scree: 8, stone_sea: 6, ridge: 3 },
  },
  lost_trail: {
    baseWeight: 2,
    weatherBonus: { fog: 10 },
    terrainBonus: { stone_sea: 4, scree: 3 },
  },
  pack_strap_breaks: {
    baseWeight: 2,
    weatherBonus: { wind: 4 },
    terrainBonus: { ridge: 4, scree: 3 },
  },
  altitude_insomnia: {
    baseWeight: 3,
    weatherBonus: {},
    terrainBonus: { summit: 5, ridge: 4 },
  },
  knee_injury: {
    baseWeight: 2,
    weatherBonus: { rain: 2 },
    terrainBonus: { scree: 6, stone_sea: 5 },
  },
  companion_warning: {
    baseWeight: 3,
    weatherBonus: {},
    terrainBonus: { ridge: 4, summit: 6 },
  },
};

/**
 * Selects a weighted random event appropriate to current conditions.
 * Events that match the current weather and terrain are more likely.
 */
export function selectEvent(
  weather: WeatherCondition,
  terrain: TerrainType,
  rng: RNG,
): CriticalEvent {
  const weights: number[] = EVENT_CATALOG.map((event) => {
    const config = EVENT_WEIGHTS[event.id];
    if (!config) return 1;

    let weight = config.baseWeight;
    weight += config.weatherBonus[weather] ?? 0;
    weight += config.terrainBonus[terrain] ?? 0;
    return weight;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let roll = rng.next() * totalWeight;

  for (let i = 0; i < EVENT_CATALOG.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      return EVENT_CATALOG[i];
    }
  }

  // Fallback: return last event (should not reach here)
  return EVENT_CATALOG[EVENT_CATALOG.length - 1];
}

export { EVENT_CATALOG };
