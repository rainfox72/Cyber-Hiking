/**
 * GameOverlay — full-screen overlay for defeat and victory end-game screens.
 * Phase 1 (dying): desaturated scene + cause text + static burst.
 * Phase 2 (defeat/victory): floating expedition report + RunSummary.
 */

import { useState, useEffect, useRef } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";
import { RunSummary } from "./RunSummary.tsx";

export function GameOverlay() {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const defeatCause = useGameStore((s) => s.defeatCause);
  const dyingCause = useGameStore((s) => s.dyingCause);
  const endingType = useGameStore((s) => s.endingType);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const distanceTraveled = useGameStore((s) => s.player.distanceTraveled);
  const currentWaypointIndex = useGameStore(
    (s) => s.player.currentWaypointIndex,
  );
  const day = useGameStore((s) => s.time.day);
  const hour = useGameStore((s) => s.time.hour);
  const weather = useGameStore((s) => s.weather.current);
  const initGame = useGameStore((s) => s.initGame);

  const [showReport, setShowReport] = useState(false);
  const [staticBurst, setStaticBurst] = useState(false);
  const shellRef = useRef<HTMLElement | null>(null);

  // Apply/remove desaturation on .game-shell during dying/defeat
  useEffect(() => {
    const shell = document.querySelector(".game-shell") as HTMLElement | null;
    shellRef.current = shell;

    if (gamePhase === "dying" || gamePhase === "defeat") {
      shell?.classList.add("game-shell--desaturated");
    } else {
      shell?.classList.remove("game-shell--desaturated");
    }

    return () => {
      shell?.classList.remove("game-shell--desaturated");
    };
  }, [gamePhase]);

  // Phase transitions
  useEffect(() => {
    if (gamePhase === "playing" || gamePhase === "title") {
      setShowReport(false);
      setStaticBurst(false);
      return;
    }

    if (gamePhase === "dying") {
      // Static burst at start of dying phase
      setStaticBurst(true);
      const burstTimer = setTimeout(() => setStaticBurst(false), 100);
      return () => clearTimeout(burstTimer);
    }

    if (gamePhase === "defeat" || gamePhase === "victory") {
      // Small delay before showing the report
      const timer = setTimeout(() => setShowReport(true), 600);
      return () => clearTimeout(timer);
    }
  }, [gamePhase]);

  if (gamePhase === "playing" || gamePhase === "title") return null;

  const wp = WAYPOINTS[currentWaypointIndex];
  const timeStr = `${String(Math.floor(hour)).padStart(2, "0")}:00`;
  const weatherStr = weather.toUpperCase();

  // ── Phase 1: The Moment (dying) ─────────────────
  if (gamePhase === "dying") {
    return (
      <div className="game-overlay game-overlay--dying">
        {staticBurst && <div className="game-overlay__static-burst" />}
        <div className="game-overlay__dying-cause">{dyingCause}</div>
      </div>
    );
  }

  // ── Phase 2: Defeat Report ──────────────────────
  if (gamePhase === "defeat") {
    return (
      <div className="game-overlay game-overlay--defeat">
        {showReport ? (
          <div className="game-overlay__report-panel panel">
            <div className="game-overlay__report-header">// SIGNAL LOST</div>
            <div className="game-overlay__report-lines">
              <div className="game-overlay__report-line">
                // LAST KNOWN POSITION: {wp.nameCN} {wp.name} {wp.elevation}m
              </div>
              <div className="game-overlay__report-line game-overlay__report-line--cause">
                // CAUSE: {defeatCause}
              </div>
              <div className="game-overlay__report-line">
                // DAY {day} &middot; HOUR {timeStr} &middot; {weatherStr}
              </div>
              <div className="game-overlay__report-line">
                // DISTANCE: {distanceTraveled.toFixed(1)}km / 80km
              </div>
              <div className="game-overlay__report-line">
                // WAYPOINTS REACHED: {currentWaypointIndex + 1} / 13
              </div>
              <div className="game-overlay__report-line">
                // TURNS SURVIVED: {turnNumber}
              </div>
            </div>
            <RunSummary outcome="defeat" />
            <button className="action-button game-overlay__restart" onClick={initGame}>
              RESTART MISSION
            </button>
          </div>
        ) : (
          <div className="game-overlay__loading">// COMPILING REPORT...</div>
        )}
      </div>
    );
  }

  // ── Victory: Summit (Ending 2) ──────────────────
  if (gamePhase === "victory" && endingType === "summit") {
    return (
      <div className="game-overlay game-overlay--victory-summit">
        {showReport ? (
          <div className="game-overlay__report-panel panel">
            <div className="game-overlay__summit-title">SUMMIT REACHED</div>
            <div className="game-overlay__summit-subtitle">
              {"\u62D4\u4ED9\u53F0"} &middot; BAXIAN PLATFORM &middot; 3767m
            </div>
            <div className="game-overlay__report-lines">
              <div className="game-overlay__report-line">
                // DAY {day} &middot; HOUR {timeStr} &middot; {weatherStr}
              </div>
              <div className="game-overlay__report-line">
                // DISTANCE: {distanceTraveled.toFixed(1)}km / 80km
              </div>
              <div className="game-overlay__report-line">
                // WAYPOINTS REACHED: {currentWaypointIndex + 1} / 13
              </div>
              <div className="game-overlay__report-line">
                // TURNS SURVIVED: {turnNumber}
              </div>
            </div>
            <RunSummary outcome="victory" />
            <button className="action-button game-overlay__restart" onClick={initGame}>
              NEW EXPEDITION
            </button>
          </div>
        ) : (
          <div className="game-overlay__loading">// COMPILING REPORT...</div>
        )}
      </div>
    );
  }

  // ── Victory: Escape (Ending 1) ──────────────────
  if (gamePhase === "victory" && endingType === "escape") {
    return (
      <div className="game-overlay game-overlay--victory-escape">
        {showReport ? (
          <div className="game-overlay__report-panel panel">
            <div className="game-overlay__escape-title">ESCAPE</div>
            <div className="game-overlay__escape-subtitle">
              You turned back. You lived. Most don&rsquo;t.
            </div>
            <div className="game-overlay__report-lines">
              <div className="game-overlay__report-line">
                // DAY {day} &middot; HOUR {timeStr} &middot; {weatherStr}
              </div>
              <div className="game-overlay__report-line">
                // DISTANCE: {distanceTraveled.toFixed(1)}km / 80km
              </div>
              <div className="game-overlay__report-line">
                // WAYPOINTS REACHED: {currentWaypointIndex + 1} / 13
              </div>
              <div className="game-overlay__report-line">
                // TURNS SURVIVED: {turnNumber}
              </div>
            </div>
            <RunSummary outcome="victory" />
            <button className="action-button game-overlay__restart" onClick={initGame}>
              NEW EXPEDITION
            </button>
          </div>
        ) : (
          <div className="game-overlay__loading">// COMPILING REPORT...</div>
        )}
      </div>
    );
  }

  return null;
}
