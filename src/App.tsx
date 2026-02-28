/**
 * Ao Tai Cyber-Hike — Main application component.
 * 3-panel layout: Status Dashboard | Center (Elevation + Log + HUD) | Navigation Console
 */

import "./App.css";
import { useGameStore } from "./store/gameStore.ts";
import { WAYPOINTS } from "./data/waypoints.ts";
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

// ── ElevationProfile (inline — tightly coupled to WAYPOINTS SVG layout) ──

function ElevationProfile() {
  const currentIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const maxDist = WAYPOINTS[WAYPOINTS.length - 1].distanceFromStart;
  const minElev = 1500;
  const maxElev = 4000;
  const toX = (km: number) => (km / maxDist) * 100;
  const toY = (elev: number) => 100 - ((elev - minElev) / (maxElev - minElev)) * 100;

  return (
    <div className="elevation-profile">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {[2000, 2500, 3000, 3500].map((elev) => (
          <line key={elev} x1="0" y1={toY(elev)} x2="100" y2={toY(elev)} stroke="var(--bg-panel-border)" strokeWidth="0.3" />
        ))}
        <polygon
          points={`${WAYPOINTS.map((wp) => `${toX(wp.distanceFromStart)},${toY(wp.elevation)}`).join(" ")} ${toX(maxDist)},100 0,100`}
          fill="rgba(0,255,65,0.05)"
        />
        {currentIndex > 0 && (
          <polyline
            points={WAYPOINTS.slice(0, currentIndex + 1).map((wp) => `${toX(wp.distanceFromStart)},${toY(wp.elevation)}`).join(" ")}
            fill="none" stroke="var(--neon-green)" strokeWidth="0.8" filter="url(#glow)"
          />
        )}
        <polyline
          points={WAYPOINTS.slice(currentIndex).map((wp) => `${toX(wp.distanceFromStart)},${toY(wp.elevation)}`).join(" ")}
          fill="none" stroke="var(--text-dim)" strokeWidth="0.5" strokeDasharray="1,1"
        />
        {WAYPOINTS.map((wp, i) => (
          <circle
            key={wp.id} cx={toX(wp.distanceFromStart)} cy={toY(wp.elevation)}
            r={i === currentIndex ? 1.5 : 0.8}
            fill={i < currentIndex ? "var(--neon-green)" : i === currentIndex ? "var(--amber)" : "var(--text-muted)"}
          />
        ))}
        <circle
          cx={toX(WAYPOINTS[currentIndex].distanceFromStart)} cy={toY(WAYPOINTS[currentIndex].elevation)}
          r="2.5" fill="none" stroke="var(--amber)" strokeWidth="0.3" opacity="0.6"
        >
          <animate attributeName="r" values="2;3.5;2" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="0.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
}

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
          <ElevationProfile />
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
