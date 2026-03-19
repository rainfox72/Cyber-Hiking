/**
 * Run summary utilities for expedition reports on death/victory.
 * Extracts key events, generates epitaphs, and creates run codenames.
 */

export interface KeyEvent {
  day: number;
  event: string;
  waypoint: string;
  severity: string;
}

/**
 * Extract 3-5 key events from event history.
 * Takes the most recent 5 events with severity major or critical.
 */
export function extractKeyEvents(eventHistory: KeyEvent[]): KeyEvent[] {
  const significant = eventHistory.filter(
    (e) => e.severity === "major" || e.severity === "critical",
  );
  return significant.slice(-5);
}

/**
 * Generate a single-line expedition epitaph summarizing the run's end.
 */
export function generateEpitaph(
  defeatCause: string | null,
  waypointName: string,
  day: number,
  weather: string,
): string {
  const weatherContext = getWeatherContext(weather);
  if (!defeatCause) {
    return `Reached ${waypointName} on Day ${day}. ${weatherContext}`;
  }
  return `Lost to ${defeatCause.toLowerCase()} near ${waypointName} on Day ${day}. ${weatherContext}`;
}

function getWeatherContext(weather: string): string {
  switch (weather) {
    case "blizzard":
      return "Visibility was near zero in the blizzard.";
    case "snow":
      return "Snow was falling steadily.";
    case "rain":
      return "Cold rain soaked everything.";
    case "fog":
      return "Dense fog obscured the trail.";
    case "wind":
      return "Gale-force winds battered the ridge.";
    case "cloudy":
      return "Overcast skies hung low.";
    case "clear":
      return "The sky was mercilessly clear.";
    default:
      return "Conditions were harsh.";
  }
}

const WEATHER_POOL = [
  "Frozen",
  "Storm",
  "Whiteout",
  "Thunder",
  "Ice",
  "Bitter",
  "Gale",
  "Silent",
];

const TERRAIN_POOL = [
  "Ridge",
  "Peak",
  "Spine",
  "Stone Sea",
  "Plateau",
  "Summit",
  "Valley",
  "Traverse",
];

const FATE_POOL = [
  "Retreat",
  "Collapse",
  "Crossing",
  "Descent",
  "Stand",
  "March",
  "Vigil",
  "Protocol",
];

/**
 * Generate a random run codename using seeded RNG.
 * Patterns:
 *   "Operation [Weather] [Terrain]"
 *   "The [Terrain] [Fate]"
 *   "[Weather] Protocol"
 */
export function generateCodename(rng: () => number): string {
  const pattern = Math.floor(rng() * 3);
  const weather = WEATHER_POOL[Math.floor(rng() * WEATHER_POOL.length)];
  const terrain = TERRAIN_POOL[Math.floor(rng() * TERRAIN_POOL.length)];
  const fate = FATE_POOL[Math.floor(rng() * FATE_POOL.length)];

  switch (pattern) {
    case 0:
      return `Operation ${weather} ${terrain}`;
    case 1:
      return `The ${terrain} ${fate}`;
    case 2:
      return `${weather} Protocol`;
    default:
      return `Operation ${weather} ${terrain}`;
  }
}
