/**
 * Header component — top bar showing game title, turn number, and Ollama connection status.
 */

import { useGameStore } from "../../store/gameStore.ts";

export function Header() {
  const turnNumber = useGameStore((s) => s.turnNumber);
  const ollamaConnected = useGameStore((s) => s.ollamaConnected);
  return (
    <header className="game-header">
      <div>
        <span className="game-header__title">AO TAI CYBER-HIKE</span>
        <span className="game-header__subtitle"> // 鳌太线 TACTICAL SYSTEM v1.0</span>
      </div>
      <div className="game-header__status">
        <span className="game-header__turn">TURN {turnNumber}</span>
        <span className={`game-header__ollama-dot game-header__ollama-dot--${ollamaConnected ? "connected" : "disconnected"}`} />
        <span style={{ color: "var(--text-dim)", fontSize: "9px" }}>OLLAMA</span>
      </div>
    </header>
  );
}
