/**
 * RiskMeter component — computes and displays the current threat level as a percentage.
 */

import { useMemo } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { calculateRisk } from "../../engine/riskCalculator.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";

export function RiskMeter() {
  const player = useGameStore((s) => s.player);
  const weather = useGameStore((s) => s.weather);
  const time = useGameStore((s) => s.time);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const mapRevealed = useGameStore((s) => s.mapRevealed);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const defeatCause = useGameStore((s) => s.defeatCause);

  const risk = useMemo(() => {
    const state = { player, weather, time, turnNumber, log: [] as never[], gamePhase, defeatCause, dyingCause: null, endingType: null, mapRevealed };
    return calculateRisk(state, WAYPOINTS);
  }, [player, weather, time, turnNumber, gamePhase, defeatCause, mapRevealed]);

  const pct = Math.round(risk * 100);
  const level = pct < 25 ? "low" : pct < 50 ? "medium" : "high";
  return (
    <div className={`risk-meter risk-meter--${level}`}>
      <div className="risk-meter__value">{pct}%</div>
      <div className="risk-meter__label">THREAT LEVEL</div>
    </div>
  );
}
