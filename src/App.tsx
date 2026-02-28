/**
 * Ao Tai Cyber-Hike — Main application component.
 * 3-panel layout: Status Dashboard | Center (Elevation + Log + HUD) | Navigation Console
 */

import { useRef, useEffect, useMemo, useState, useCallback } from "react";
import "./App.css";
import { useGameStore } from "./store/gameStore.ts";
import { WAYPOINTS } from "./data/waypoints.ts";
import type { GameAction, LogEntry as LogEntryType, WeatherCondition, TimeOfDay } from "./engine/types.ts";
import { calculateRisk } from "./engine/riskCalculator.ts";
import { Scanlines } from "./components/effects/Scanlines.tsx";
import { ParticleCanvas } from "./components/effects/ParticleCanvas.tsx";
import TitleScreen from "./components/screens/TitleScreen.tsx";
import { useTypewriter } from "./hooks/useTypewriter.ts";
import { checkOllamaHealth } from "./services/ollamaService.ts";

// ── Utility ──────────────────────────────────

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function vitalColor(value: number): string {
  if (value > 60) return "var(--neon-green)";
  if (value > 30) return "var(--amber)";
  return "var(--danger)";
}

const WEATHER_ICONS: Record<WeatherCondition, string> = {
  clear: "\u2600",
  cloudy: "\u2601",
  fog: "\uD83C\uDF2B\uFE0F",
  rain: "\uD83C\uDF27\uFE0F",
  snow: "\u2744\uFE0F",
  blizzard: "\uD83C\uDF28\uFE0F",
  wind: "\uD83D\uDCA8",
};

const TIME_ICONS: Record<TimeOfDay, string> = {
  dawn: "\uD83C\uDF05",
  morning: "\u2600\uFE0F",
  midday: "\u2600\uFE0F",
  afternoon: "\u26C5",
  dusk: "\uD83C\uDF07",
  night: "\uD83C\uDF19",
};

const ACTION_CONFIG: { action: GameAction; label: string; cost: string }[] = [
  { action: "push_forward", label: "PUSH FORWARD", cost: "3-5h | Advance to next waypoint" },
  { action: "set_camp", label: "SET CAMP", cost: "4h | Recover vitals" },
  { action: "descend", label: "DESCEND", cost: "2h | Retreat to prev waypoint" },
  { action: "check_map", label: "CHECK MAP", cost: "1h | Reveal risk info" },
  { action: "rest", label: "REST", cost: "2h | Partial recovery" },
  { action: "eat", label: "EAT RATION", cost: "0.5h | Energy +20" },
  { action: "drink", label: "DRINK WATER", cost: "0.5h | Hydration +25" },
  { action: "use_medicine", label: "USE MEDICINE", cost: "0.5h | O2 +15, Temp normalize" },
];

// ── Components ───────────────────────────────

function VitalBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color ?? vitalColor(value);
  const isCritical = value < 30;
  return (
    <div className={`vital-bar ${isCritical ? "vital-bar--critical" : ""}`}>
      <div className="vital-bar__label">
        <span className="vital-bar__label-name">{label}</span>
        <span className="vital-bar__label-value" style={{ color: c }}>{Math.round(value)}%</span>
      </div>
      <div className="vital-bar__track">
        <div className="vital-bar__fill" style={{ width: `${clamp(value, 0, 100)}%`, backgroundColor: c }} />
      </div>
    </div>
  );
}

function InventoryPanel() {
  const food = useGameStore((s) => s.player.food);
  const water = useGameStore((s) => s.player.water);
  const gear = useGameStore((s) => s.player.gear);
  const medicine = useGameStore((s) => s.player.medicine);
  return (
    <div className="inventory-grid">
      <div className="inventory-item">
        <span className="inventory-item__label">Food</span>
        <span className="inventory-item__value">{food}</span>
      </div>
      <div className="inventory-item">
        <span className="inventory-item__label">Water</span>
        <span className="inventory-item__value">{water.toFixed(1)}L</span>
      </div>
      <div className="inventory-item">
        <span className="inventory-item__label">Gear</span>
        <span className="inventory-item__value" style={{ color: vitalColor(gear) }}>{Math.round(gear)}%</span>
      </div>
      <div className="inventory-item">
        <span className="inventory-item__label">Medicine</span>
        <span className="inventory-item__value">{medicine}</span>
      </div>
    </div>
  );
}

function StatusDashboard() {
  const energy = useGameStore((s) => s.player.energy);
  const hydration = useGameStore((s) => s.player.hydration);
  const bodyTemp = useGameStore((s) => s.player.bodyTemp);
  const o2 = useGameStore((s) => s.player.o2Saturation);
  const morale = useGameStore((s) => s.player.morale);
  return (
    <>
      <VitalBar label="Energy" value={energy} />
      <VitalBar label="Hydration" value={hydration} color="var(--cyan)" />
      <VitalBar label="Body Temp" value={bodyTemp} color={bodyTemp < 30 ? "var(--danger)" : bodyTemp > 70 ? "var(--danger)" : "var(--amber)"} />
      <VitalBar label="O2 Sat" value={o2} color="var(--amber)" />
      <VitalBar label="Morale" value={morale} color="var(--magenta)" />
    </>
  );
}

function RiskMeter() {
  const player = useGameStore((s) => s.player);
  const weather = useGameStore((s) => s.weather);
  const time = useGameStore((s) => s.time);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const mapRevealed = useGameStore((s) => s.mapRevealed);
  const gamePhase = useGameStore((s) => s.gamePhase);
  const defeatCause = useGameStore((s) => s.defeatCause);

  const risk = useMemo(() => {
    const state = { player, weather, time, turnNumber, log: [], gamePhase, defeatCause, mapRevealed };
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

function WeatherDisplay() {
  const weather = useGameStore((s) => s.weather);
  return (
    <div className="weather-display panel" style={{ flex: 1 }}>
      <span className="weather-display__icon">{WEATHER_ICONS[weather.current]}</span>
      <div className="weather-display__info">
        <span className="weather-display__condition">{weather.current}</span>
        <span className="weather-display__detail">Int: {Math.round(weather.intensity * 100)}% | Wind: {Math.round(weather.windSpeed)} km/h</span>
      </div>
    </div>
  );
}

function DayNightIndicator() {
  const time = useGameStore((s) => s.time);
  return (
    <div className="day-night panel" style={{ flex: 1 }}>
      <span className="day-night__icon">{TIME_ICONS[time.timeOfDay]}</span>
      <span className="day-night__time">Day {time.day} {String(Math.floor(time.hour)).padStart(2, "0")}:00</span>
      <span className="day-night__period">{time.timeOfDay}</span>
    </div>
  );
}

function LogEntryComponent({ entry, isLatestNarrative }: { entry: LogEntryType; isLatestNarrative?: boolean }) {
  const { displayed, isComplete } = useTypewriter(
    isLatestNarrative ? entry.text : "",
    20,
  );

  const text = isLatestNarrative && !isComplete ? displayed : entry.text;

  return (
    <div className={`log-entry log-entry--${entry.type}`}>
      <span className="log-entry__timestamp">[{entry.timestamp}]</span>{" "}
      {text}
      {isLatestNarrative && !isComplete && <span className="cursor-blink">_</span>}
    </div>
  );
}

function LogWindow() {
  const log = useGameStore((s) => s.log);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log.length]);
  return (
    <div className="log-window" ref={scrollRef}>
      {log.length === 0 && (
        <>
          <div className="log-entry log-entry--system">
            <span className="log-entry__timestamp">[SYS]</span>{" "}
            AO TAI TACTICAL SYSTEM initialized. Awaiting operator input.
          </div>
          <div className="log-entry log-entry--system">
            <span className="log-entry__timestamp">[SYS]</span>{" "}
            Route loaded: 塘口 → 拔仙台 | 80km | 13 waypoints
          </div>
        </>
      )}
      {log.map((entry, i) => {
        const isLatestNarrative = entry.type === "narrative" && i === log.length - 1;
        return (
          <LogEntryComponent
            key={`${entry.turnNumber}-${i}`}
            entry={entry}
            isLatestNarrative={isLatestNarrative}
          />
        );
      })}
    </div>
  );
}

function ActionButton({ action, label, cost }: { action: GameAction; label: string; cost: string }) {
  const performAction = useGameStore((s) => s.performAction);
  const isValid = useGameStore((s) => s.isActionValid(action));
  const isProcessing = useGameStore((s) => s.isProcessing);
  const handleClick = useCallback(() => { performAction(action); }, [performAction, action]);
  return (
    <button className="action-button" disabled={!isValid || isProcessing} onClick={handleClick}>
      {label}
      <span className="action-button__cost">{cost}</span>
    </button>
  );
}

function NavigationConsole() {
  return (
    <div className="panel">
      <div className="panel-header">NAVIGATION CONSOLE</div>
      {ACTION_CONFIG.map((cfg) => (
        <ActionButton key={cfg.action} {...cfg} />
      ))}
    </div>
  );
}

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

function LocationInfo() {
  const index = useGameStore((s) => s.player.currentWaypointIndex);
  const wp = WAYPOINTS[index];
  return (
    <div className="panel" style={{ padding: "6px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <span style={{ color: "var(--amber)", fontSize: "12px", letterSpacing: "1px" }}>{wp.name}</span>
          <span style={{ color: "var(--text-dim)", fontSize: "10px", marginLeft: "6px" }}>{wp.nameCN}</span>
        </div>
        <div style={{ color: "var(--neon-green)", fontSize: "14px", letterSpacing: "2px" }}>{wp.elevation}m</div>
      </div>
      <div style={{ color: "var(--text-dim)", fontSize: "9px", marginTop: "2px", letterSpacing: "0.5px" }}>
        {wp.terrain.replace("_", " ").toUpperCase()} | {wp.distanceFromStart}km from start
        {wp.canCamp ? " | CAMP OK" : ""}{wp.shelterAvailable ? " | SHELTER" : ""}
      </div>
    </div>
  );
}

function Header() {
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

function GameOverlay() {
  const gamePhase = useGameStore((s) => s.gamePhase);
  const defeatCause = useGameStore((s) => s.defeatCause);
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
    const timer = setTimeout(() => setShowContent(true), 500);
    return () => clearTimeout(timer);
  }, [gamePhase]);

  if (gamePhase === "playing" || gamePhase === "title") return null;
  if (!showContent) return <div className="screen-overlay" style={{ background: "black" }} />;

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

  if (gamePhase === "victory") {
    return (
      <div className="screen-overlay screen-overlay--victory">
        <div className="screen-overlay__glow-pulse" />
        <div className="screen-overlay__title">SUMMIT REACHED</div>
        <div className="screen-overlay__roof-subtitle">// THE ROOF OF QINLING</div>
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

// ── Ollama Health Poller ──────────────────────

function OllamaPoller() {
  const setOllamaConnected = useGameStore((s) => s.setOllamaConnected);
  useEffect(() => {
    const poll = () => {
      checkOllamaHealth().then(setOllamaConnected);
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [setOllamaConnected]);
  return null;
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
