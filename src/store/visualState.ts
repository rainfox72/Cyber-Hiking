/**
 * VisualState — derived visual profile computed from game state.
 * Consumed by all atmosphere/scene components via VisualStateBridge context.
 */

import type { TimeOfDay, WeatherCondition } from '../engine/types.ts';

export type BandId = 'forest' | 'rocky' | 'plateau' | 'storm' | 'summit';

export interface VisualState {
  bandId: BandId;
  timeOfDay: TimeOfDay;
  weather: WeatherCondition;
  weatherIntensity: number;
  fogDensity: number;
  fogColor: string;
  skyTop: string;
  skyBottom: string;
  ambientIntensity: number;
  ambientColor: string;
  sunColor: string;
  sunDirection: [number, number, number];
}

export function waypointToBand(index: number): BandId {
  if (index <= 2) return 'forest';
  if (index <= 5) return 'rocky';
  if (index <= 8) return 'plateau';
  if (index <= 11) return 'storm';
  return 'summit';
}

// Fog density per weather
const FOG_DENSITY = {
  clear: 0.02, cloudy: 0.04, fog: 0.12,
  rain: 0.06, snow: 0.08, wind: 0.03, blizzard: 0.18,
} satisfies Record<WeatherCondition, number>;

// Fog base color per weather
const FOG_COLOR = {
  clear: '#0a0a0a', cloudy: '#151515', fog: '#1a1a1a',
  rain: '#0a0a0a', snow: '#1a1a2a', wind: '#0a0a0a', blizzard: '#2a2a2a',
} satisfies Record<WeatherCondition, string>;

// Sky gradients per time of day
const SKY_GRADIENTS = {
  dawn:      { top: '#1a0a2e', bottom: '#4a2040' },
  morning:   { top: '#0d1a2d', bottom: '#1a3a4a' },
  midday:    { top: '#0a1520', bottom: '#152530' },
  afternoon: { top: '#0d1520', bottom: '#2a2a1a' },
  dusk:      { top: '#2a1525', bottom: '#1a0a0a' },
  night:     { top: '#050510', bottom: '#0a0a0a' },
} satisfies Record<TimeOfDay, { top: string; bottom: string }>;

// Ambient light per time of day
const AMBIENT = {
  dawn:      { intensity: 0.5, color: '#e8dcc0' },
  morning:   { intensity: 0.7, color: '#d0d8e0' },
  midday:    { intensity: 0.8, color: '#c0c8d0' },
  afternoon: { intensity: 0.7, color: '#d0c8b0' },
  dusk:      { intensity: 0.4, color: '#8a6a5a' },
  night:     { intensity: 0.3, color: '#4a5a6a' },
} satisfies Record<TimeOfDay, { intensity: number; color: string }>;

// Sun direction per time of day (x, y, z)
const SUN_DIR = {
  dawn:      [-1, 0.3, 0.5] as [number, number, number],
  morning:   [-0.5, 0.7, 0.5] as [number, number, number],
  midday:    [0, 1, 0.3] as [number, number, number],
  afternoon: [0.5, 0.7, 0.5] as [number, number, number],
  dusk:      [1, 0.3, 0.5] as [number, number, number],
  night:     [0, 0.5, -1] as [number, number, number],
} satisfies Record<TimeOfDay, [number, number, number]>;

function blendHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

export function deriveVisualState(
  waypointIndex: number,
  timeOfDay: TimeOfDay,
  weather: WeatherCondition,
  weatherIntensity: number,
): VisualState {
  const bandId = waypointToBand(waypointIndex);
  const sky = SKY_GRADIENTS[timeOfDay];
  const amb = AMBIENT[timeOfDay];

  // Weather modifier on sky
  let skyTop = sky.top;
  let skyBottom = sky.bottom;
  if (weather === 'cloudy' || weather === 'fog') {
    skyTop = blendHex(sky.top, '#151515', weatherIntensity * 0.3);
    skyBottom = blendHex(sky.bottom, '#151515', weatherIntensity * 0.2);
  } else if (weather === 'blizzard') {
    skyTop = blendHex(sky.top, '#303030', weatherIntensity * 0.4);
    skyBottom = blendHex(sky.bottom, '#202020', weatherIntensity * 0.3);
  }

  return {
    bandId,
    timeOfDay,
    weather,
    weatherIntensity,
    fogDensity: FOG_DENSITY[weather],
    fogColor: FOG_COLOR[weather],
    skyTop,
    skyBottom,
    ambientIntensity: amb.intensity,
    ambientColor: amb.color,
    sunColor: amb.color,
    sunDirection: SUN_DIR[timeOfDay],
  };
}
