/**
 * Shared hiker pose and condition modifier logic.
 * Used by both the map HumanMarker and the scene SceneHiker.
 */

export type HikerPose =
  | "idle"
  | "walking"
  | "camping"
  | "eating"
  | "drinking"
  | "resting"
  | "mapping"
  | "medicine"
  | "summit";

export interface ConditionModifier {
  id: string;
  priority: number; // lower = more important
  type: "posture" | "accessory" | "effect";
}

/** Determine active pose from last action and summit state */
export function getActivePose(
  lastAction: string | null,
  waypointIndex: number,
  hasReachedSummit: boolean,
): HikerPose {
  if (waypointIndex === 12 && hasReachedSummit) return "summit";

  switch (lastAction) {
    case "push_forward":
    case "descend":
      return "walking";
    case "set_camp":
      return "camping";
    case "eat":
      return "eating";
    case "drink":
      return "drinking";
    case "rest":
      return "resting";
    case "check_map":
      return "mapping";
    case "use_medicine":
      return "medicine";
    default:
      return "idle";
  }
}

/** Condition-relevant player vitals subset */
interface PlayerCondition {
  energy: number;
  hydration: number;
  bodyTemp: number;
  o2Saturation: number;
  morale: number;
  statusEffects: Array<{ id: string }>;
}

interface WeatherCondition {
  current: string;
}

interface TimeCondition {
  timeOfDay: string;
}

/**
 * Determine condition modifiers ranked by danger priority.
 * Returns sorted list; callers should apply first 2-3 posture modifiers
 * and all accessory/effect modifiers.
 */
export function getConditionModifiers(
  player: PlayerCondition,
  weather: WeatherCondition,
  time: TimeCondition,
): ConditionModifier[] {
  const modifiers: ConditionModifier[] = [];

  // 1. Critical — any vital < 15
  const anyCritical =
    player.energy < 15 ||
    player.hydration < 15 ||
    player.bodyTemp < 15 ||
    player.o2Saturation < 15 ||
    player.morale < 15;

  if (anyCritical) {
    modifiers.push({ id: "critical", priority: 0, type: "effect" });
  }

  // 2. Injury — statusEffects includes "injury" or "sprain"
  const hasInjury = player.statusEffects.some(
    (e) => e.id === "injury" || e.id === "sprain",
  );
  if (hasInjury) {
    modifiers.push({ id: "injury", priority: 1, type: "posture" });
  }

  // 3. Cold — bodyTemp < 50
  if (player.bodyTemp < 50) {
    modifiers.push({ id: "cold-posture", priority: 2, type: "posture" });
    modifiers.push({ id: "cold-breath", priority: 2, type: "accessory" });
  }

  // 4. Exhaustion — energy < 35
  if (player.energy < 35) {
    modifiers.push({ id: "exhaustion", priority: 3, type: "posture" });
  }

  // 5. Wind — weather is wind or blizzard
  if (weather.current === "wind" || weather.current === "blizzard") {
    modifiers.push({ id: "wind-lean", priority: 4, type: "posture" });
    modifiers.push({ id: "wind-flutter", priority: 4, type: "accessory" });
  }

  // 6. Night — timeOfDay is night or dusk
  if (time.timeOfDay === "night" || time.timeOfDay === "dusk") {
    modifiers.push({ id: "headlamp", priority: 5, type: "accessory" });
  }

  modifiers.sort((a, b) => a.priority - b.priority);
  return modifiers;
}

/**
 * Get CSS class names for condition-based animation overrides.
 * Returns classes to apply on the figure group.
 */
export function getConditionClasses(modifiers: ConditionModifier[]): string {
  const classes: string[] = [];
  const ids = new Set(modifiers.map((m) => m.id));

  if (ids.has("critical")) classes.push("hiker-signal-break");
  if (ids.has("exhaustion")) classes.push("hiker-exhausted");

  return classes.join(" ");
}

/**
 * Get transform string for posture modifiers (wind lean, exhaustion lean).
 * Applied to the figure group.
 */
export function getPostureTransform(modifiers: ConditionModifier[]): string {
  const ids = new Set(modifiers.map((m) => m.id));
  let rotation = 0;

  // Wind lean (6 deg) takes priority over exhaustion lean (3 deg)
  if (ids.has("wind-lean")) {
    rotation = 6;
  } else if (ids.has("exhaustion")) {
    rotation = 3;
  }

  return rotation !== 0 ? `rotate(${rotation})` : "";
}
