/**
 * Ao Tai Cyber-Hike — Main application component.
 * Full-bleed 3D Canvas with floating instrument panels.
 */

import "./App.css";
import { useState, useEffect, Component } from "react";
import type { ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { useGameStore } from "./store/gameStore.ts";
import { Scanlines } from "./components/effects/Scanlines.tsx";
import { DangerOverlay } from "./components/effects/DangerOverlay.tsx";
import { Skybox } from "./components/effects/Skybox.tsx";
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
import { SceneContent, TacticalMap3D } from "./components/map/TacticalMap3D.tsx";
import { VisualStateBridge } from "./components/map/VisualStateBridge.tsx";
import { soundManager } from "./services/soundManager.ts";
import { WAYPOINTS } from "./data/waypoints.ts";

// ── WebGL error boundary for full-bleed fallback ──

interface ErrorBoundaryState { hasError: boolean }

class FullBleedErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback : this.props.children; }
}

// ── Ambient sound controller ─────────────────

function SoundAmbience() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const weather = useGameStore((s) => s.weather);

  useEffect(() => {
    const altitude = WAYPOINTS[currentIndex].elevation;
    soundManager.updateWind(altitude, weather.intensity, weather.current);
    soundManager.updateAltitudeHum(altitude);
  }, [currentIndex, weather]);

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

// ── WebGL fallback — degraded CSS atmosphere + legacy map ──

function WebGLFallback() {
  return (
    <>
      <Skybox />
      <ParticleCanvas />
      <div className="fallback-map-container">
        <TacticalMap3D />
      </div>
    </>
  );
}

// ── Main App ─────────────────────────────────

function App() {
  const isShaking = useGameStore((s) => s.isShaking);
  const gamePhase = useGameStore((s) => s.gamePhase);

  // Title screen
  if (gamePhase === "title") {
    return (
      <>
        <Skybox />
        <Scanlines />
        <TitleScreen />
      </>
    );
  }

  return (
    <>
      {/* Full-bleed 3D Canvas */}
      <FullBleedErrorBoundary fallback={<WebGLFallback />}>
        <Canvas
          style={{ position: "fixed", inset: 0, zIndex: 0 }}
          gl={{ alpha: false, antialias: false }}
          dpr={Math.min(window.devicePixelRatio, 1.5)}
          camera={{ fov: 45, near: 0.1, far: 50, position: [2, 3, 4] }}
          frameloop="always"
          onCreated={({ gl }) => gl.setClearColor('#050510')}
        >
          <VisualStateBridge>
            <SceneContent />
          </VisualStateBridge>
        </Canvas>
      </FullBleedErrorBoundary>

      {/* Floating DOM panels */}
      <Scanlines />
      <DangerOverlay />
      <OllamaPoller />
      <SoundAmbience />
      <div className={`game-shell ${isShaking ? "shaking" : ""}`}>
        <Header />
        <SoundControls />
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
