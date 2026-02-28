/**
 * Ao Tai Cyber-Hike — Main application component.
 * 3-panel layout: Status Dashboard | Center (Elevation + Log + HUD) | Navigation Console
 */

import "./App.css";
import { useGameStore } from "./store/gameStore.ts";
import { Scanlines } from "./components/effects/Scanlines.tsx";
import { ParticleCanvas } from "./components/effects/ParticleCanvas.tsx";
import TitleScreen from "./components/screens/TitleScreen.tsx";
import { StatusDashboard } from "./components/game/StatusDashboard.tsx";
import { InventoryPanel } from "./components/game/InventoryPanel.tsx";
import { RiskMeter } from "./components/game/RiskMeter.tsx";
import { WeatherDisplay } from "./components/game/WeatherDisplay.tsx";
import { DayNightIndicator } from "./components/game/DayNightIndicator.tsx";
import { LogWindow } from "./components/game/LogWindow.tsx";
import { NavigationConsole } from "./components/game/NavigationConsole.tsx";
import { LocationInfo } from "./components/game/LocationInfo.tsx";
import { Header } from "./components/game/Header.tsx";
import { GameOverlay } from "./components/game/GameOverlay.tsx";
import { OllamaPoller } from "./components/game/OllamaPoller.tsx";
import { TacticalMap } from "./components/map/TacticalMap.tsx";

// ── Main App ─────────────────────────────────

function App() {
  const isShaking = useGameStore((s) => s.isShaking);
  const gamePhase = useGameStore((s) => s.gamePhase);

  // Title screen: render only TitleScreen + Scanlines
  if (gamePhase === "title") {
    return (
      <>
        <Scanlines />
        <TitleScreen />
      </>
    );
  }

  return (
    <>
      <Scanlines />
      <ParticleCanvas />
      <OllamaPoller />
      <div className={`game-shell ${isShaking ? "shaking" : ""}`}>
        <Header />
        <div className="panel-left">
          <div className="panel">
            <div className="panel-header">VITALS</div>
            <StatusDashboard />
          </div>
          <div className="panel">
            <div className="panel-header">INVENTORY</div>
            <InventoryPanel />
          </div>
          <div className="panel">
            <div className="panel-header">RISK ASSESSMENT</div>
            <RiskMeter />
          </div>
        </div>
        <div className="panel-center">
          <LocationInfo />
          <TacticalMap />
          <LogWindow />
          <div style={{ display: "flex", gap: "2px" }}>
            <WeatherDisplay />
            <DayNightIndicator />
          </div>
        </div>
        <div className="panel-right">
          <NavigationConsole />
        </div>
      </div>
      <GameOverlay />
    </>
  );
}

export default App;
