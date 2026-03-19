/**
 * Ao Tai Cyber-Hike — Main application component.
 * Full-bleed layered viewport with floating instrument panels.
 * Z-stack: sky → mountain → atmosphere → danger → panels → scanlines → modals
 */

import "./App.css";
import { useState, useEffect } from "react";
import { useGameStore } from "./store/gameStore.ts";
import { Scanlines } from "./components/effects/Scanlines.tsx";
import { AtmosphereCanvas } from "./components/effects/AtmosphereCanvas.tsx";
import { Vignette } from "./components/effects/Vignette.tsx";
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
import SkyLayer from "./components/scene/SkyLayer.tsx";
import MountainScene from "./components/scene/MountainScene.tsx";
import { soundManager } from "./services/soundManager.ts";
import { WAYPOINTS } from "./data/waypoints.ts";

// ── Ambient sound controller ─────────────────

function SoundAmbience() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const weather = useGameStore((s) => s.weather);

  useEffect(() => {
    const altitude = WAYPOINTS[currentIndex].elevation;
    soundManager.updateWind(altitude, weather.intensity, weather.current);
    soundManager.updateAltitudeHum(altitude);
  }, [currentIndex, weather]);

  // Background music: start on mount, stop on unmount
  useEffect(() => {
    soundManager.startMusic();
    return () => soundManager.stopMusic();
  }, []);

  return null;
}

function SoundControls() {
  const [muted, setMutedState] = useState(soundManager.isMuted());
  const toggle = () => {
    const next = !muted;
    soundManager.setMuted(next);
    setMutedState(next);
  };
  return (
    <button className="sound-toggle" onClick={toggle} title={muted ? "Unmute" : "Mute"}>
      {muted ? "M" : "S"}
    </button>
  );
}

// ── Main App ─────────────────────────────────

function App() {
  const isShaking = useGameStore((s) => s.isShaking);
  const gamePhase = useGameStore((s) => s.gamePhase);

  return (
    <div className={`game-shell ${isShaking ? "shaking" : ""}`}>
      {/* z:0 — Sky gradient */}
      <SkyLayer />
      {/* z:1 — Mountain ridgelines */}
      <MountainScene />
      {/* z:2 — Atmosphere */}
      <AtmosphereCanvas />
      {/* z:3 — Danger overlays (existing Vignette) */}
      <Vignette />

      {/* z:4 — Floating panel grid */}
      {gamePhase !== "title" && (
        <div className="panel-grid">
          <div className="panel panel--header">
            <Header />
          </div>
          <div className="panel panel--left">
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
          <div className="panel panel--center">
            <LocationInfo />
            <TacticalMap />
            <LogWindow />
            <div style={{ display: "flex", gap: "2px" }}>
              <WeatherDisplay />
              <DayNightIndicator />
            </div>
          </div>
          <div className="panel panel--right">
            <NavigationConsole />
          </div>
        </div>
      )}

      {/* Non-visual game services */}
      {gamePhase !== "title" && (
        <>
          <OllamaPoller />
          <SoundAmbience />
          <SoundControls />
        </>
      )}

      {/* z:5 — Scanlines */}
      <Scanlines />

      {/* z:6+ — Screen overlays (title, game over, victory) */}
      {gamePhase === "title" && <TitleScreen />}
      {(gamePhase === "dying" || gamePhase === "defeat" || gamePhase === "victory") && <GameOverlay />}
    </div>
  );
}

export default App;
