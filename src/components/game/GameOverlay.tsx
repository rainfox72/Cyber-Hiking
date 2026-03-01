/**
 * GameOverlay component — full-screen overlay for defeat and victory end-game screens.
 */

import { useState, useEffect } from "react";
import { useGameStore } from "../../store/gameStore.ts";

export function GameOverlay() {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const defeatCause = useGameStore((s) => s.defeatCause);
  const dyingCause = useGameStore((s) => s.dyingCause);
  const endingType = useGameStore((s) => s.endingType);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const distanceTraveled = useGameStore((s) => s.player.distanceTraveled);
  const day = useGameStore((s) => s.time.day);
  const initGame = useGameStore((s) => s.initGame);

  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (gamePhase === "playing" || gamePhase === "title") {
      setShowContent(false);
      return;
    }
    if (gamePhase === "dying") {
      setShowContent(true);
      return;
    }
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, [gamePhase]);

  if (gamePhase === "playing" || gamePhase === "title") return null;
  if (!showContent) return <div className="screen-overlay" style={{ background: "black" }} />;

  if (gamePhase === "dying") {
    return (
      <div className="screen-overlay screen-overlay--dying">
        <div className="screen-overlay__dying-cause">{dyingCause}</div>
      </div>
    );
  }

  if (gamePhase === "defeat") {
    return (
      <div className="screen-overlay screen-overlay--defeat">
        <div className="screen-overlay__static-noise" />
        <div className="screen-overlay__transmission">// TRANSMISSION TERMINATED</div>
        <div className="screen-overlay__title">SIGNAL LOST</div>
        <div className="screen-overlay__subtitle">{defeatCause}</div>
        <div className="screen-overlay__stats">
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">DAYS SURVIVED</span>
            <span className="screen-overlay__stat-value">{day}</span>
          </div>
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">DISTANCE</span>
            <span className="screen-overlay__stat-value">{distanceTraveled.toFixed(1)}km</span>
          </div>
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">TURNS</span>
            <span className="screen-overlay__stat-value">{turnNumber}</span>
          </div>
        </div>
        <button className="action-button" style={{ width: "200px" }} onClick={initGame}>RESTART MISSION</button>
      </div>
    );
  }

  if (gamePhase === "victory" && endingType === "escape") {
    return (
      <div className="screen-overlay screen-overlay--escape">
        <div className="screen-overlay__glow-pulse screen-overlay__glow-pulse--amber" />
        <div className="screen-overlay__title">ESCAPE</div>
        <div className="screen-overlay__roof-subtitle">// ENDING 1 &mdash; YOU SURVIVED</div>
        <div className="screen-overlay__subtitle">{"\u5858\u53E3"} TANGKOU 1740m</div>
        <div className="screen-overlay__stats">
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">DAYS</span>
            <span className="screen-overlay__stat-value screen-overlay__stat-value--escape">{day}</span>
          </div>
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">DISTANCE</span>
            <span className="screen-overlay__stat-value screen-overlay__stat-value--escape">{distanceTraveled.toFixed(1)}km</span>
          </div>
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">TURNS</span>
            <span className="screen-overlay__stat-value screen-overlay__stat-value--escape">{turnNumber}</span>
          </div>
        </div>
        <div className="screen-overlay__flavor-text">
          You turned back and lived. The mountain remains unconquered.
        </div>
        <button className="action-button" style={{ width: "200px" }} onClick={initGame}>NEW EXPEDITION</button>
      </div>
    );
  }

  if (gamePhase === "victory") {
    return (
      <div className="screen-overlay screen-overlay--victory">
        <div className="screen-overlay__glow-pulse" />
        <div className="screen-overlay__title">SUMMIT REACHED</div>
        <div className="screen-overlay__roof-subtitle">// ENDING 2 &mdash; THE ROOF OF QINLING</div>
        <div className="screen-overlay__subtitle">{"\u62D4\u4ED9\u53F0"} BAXIAN PLATFORM 3767m</div>
        <div className="screen-overlay__stats">
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">DAYS</span>
            <span className="screen-overlay__stat-value screen-overlay__stat-value--victory">{day}</span>
          </div>
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">DISTANCE</span>
            <span className="screen-overlay__stat-value screen-overlay__stat-value--victory">{distanceTraveled.toFixed(1)}km</span>
          </div>
          <div className="screen-overlay__stat-row">
            <span className="screen-overlay__stat-label">TURNS</span>
            <span className="screen-overlay__stat-value screen-overlay__stat-value--victory">{turnNumber}</span>
          </div>
        </div>
        <div className="screen-overlay__flavor-text">
          You have conquered the most dangerous ridge traverse in China.
        </div>
        <button className="action-button" style={{ width: "200px" }} onClick={initGame}>NEW EXPEDITION</button>
      </div>
    );
  }

  return null;
}
