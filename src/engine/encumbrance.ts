/**
 * Encumbrance system for the Ao Tai Cyber-Hike.
 * Calculates total pack weight and its effect on travel speed and energy.
 */

import type { PlayerState } from "./types.ts";

const WEIGHT_PER_FOOD = 0.4;
const WEIGHT_PER_WATER_LITER = 1.0;
const WEIGHT_PER_MEDICINE = 0.2;
const BASE_GEAR_WEIGHT = 5.0;
const THRESHOLD_HEAVY = 15;
const THRESHOLD_OVERBURDENED = 20;

export function calculateWeight(player: PlayerState): number {
  return (
    player.food * WEIGHT_PER_FOOD +
    player.water * WEIGHT_PER_WATER_LITER +
    player.medicine * WEIGHT_PER_MEDICINE +
    BASE_GEAR_WEIGHT
  );
}

export function getEncumbranceTimePenalty(player: PlayerState): number {
  const weight = calculateWeight(player);
  if (weight > THRESHOLD_OVERBURDENED) return 2;
  if (weight > THRESHOLD_HEAVY) return 1;
  return 0;
}

export function getEncumbranceEnergyPenalty(player: PlayerState): number {
  const weight = calculateWeight(player);
  if (weight > THRESHOLD_OVERBURDENED) return 10;
  if (weight > THRESHOLD_HEAVY) return 5;
  return 0;
}
