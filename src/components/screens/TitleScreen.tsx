/**
 * Title screen overlay rendered OVER the mountain scene (always in background).
 * Sequence: black fade → boot console → route trace → title reveal → dossier → prompt.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { soundManager } from "../../services/soundManager.ts";
import { WAYPOINTS } from "../../data/waypoints.ts";

const BOOT_LINES = [
  "INITIALIZING AO TAI TACTICAL SYSTEM...",
  "LOADING TERRAIN DATA: \u9CCC\u592A\u7EBF (AO TAI LINE)",
  "ROUTE: TANGKOU (1740m) \u2192 BAXIAN PLATFORM (3767m)",
  "DISTANCE: 80km | WAYPOINTS: 13",
  "WEATHER SYSTEM: ONLINE",
  "RISK ENGINE: CALIBRATED",
  "OLLAMA NARRATOR: [CHECKING...]",
  "",
  "\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593\u2593 BOOT COMPLETE",
];

const dossierLines = [
  "// WARNING: Route officially closed since 2018",
  "// 47 confirmed fatalities on record",
  "// Weather window: unpredictable beyond Day 3",
  "// Solo traverse not recommended",
  '// Last signal received: Day 6, \u91D1\u5B57\u5854 sector',
  "// Search and rescue response time: 48+ hours",
  "// Blizzard probability above 3400m: 60%+",
  "// No reliable communication past \u90FD\u7763\u95E8",
];

/** Delay in ms between boot lines appearing. */
const LINE_DELAY = 200;
/** Extra delay before boot complete line (the progress bar). */
const BOOT_COMPLETE_EXTRA_DELAY = 400;
/** Duration of route trace animation in ms. */
const ROUTE_TRACE_DURATION = 2000;
/** Dossier rotation interval in ms. */
const DOSSIER_INTERVAL = 4000;

// SVG route layout dimensions
const ROUTE_SVG_WIDTH = 500;
const ROUTE_SVG_HEIGHT = 60;
const ROUTE_PADDING = 30;

function TitleScreen() {
  const startGame = useGameStore((s) => s.startGame);

  // Sequence phases
  const [fadePhase, setFadePhase] = useState<"black" | "fading" | "done">("black");
  const [visibleLines, setVisibleLines] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);
  const [routeTracing, setRouteTracing] = useState(false);
  const [routeComplete, setRouteComplete] = useState(false);
  const [titleRevealed, setTitleRevealed] = useState(false);
  const [dossierIndex, setDossierIndex] = useState(0);
  const [promptVisible, setPromptVisible] = useState(false);

  const routeRef = useRef<SVGPolylineElement>(null);

  // Phase 1: Black overlay fading to transparent (2s)
  useEffect(() => {
    // Start fading immediately
    const fadeTimer = setTimeout(() => setFadePhase("fading"), 100);
    const doneTimer = setTimeout(() => setFadePhase("done"), 2100);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  // Phase 2: Boot sequence — lines appear at LINE_DELAY/line
  useEffect(() => {
    if (visibleLines === 0) {
      soundManager.boot();
    }
    if (visibleLines >= BOOT_LINES.length) {
      const timer = setTimeout(() => setBootComplete(true), 400);
      return () => clearTimeout(timer);
    }

    const isProgressBar = visibleLines === BOOT_LINES.length - 1;
    const delay = isProgressBar ? LINE_DELAY + BOOT_COMPLETE_EXTRA_DELAY : LINE_DELAY;

    const timer = setTimeout(() => {
      setVisibleLines((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleLines]);

  // Phase 3: Route drawing after boot complete
  useEffect(() => {
    if (!bootComplete) return;
    setRouteTracing(true);
    const timer = setTimeout(() => {
      setRouteComplete(true);
      setRouteTracing(false);
    }, ROUTE_TRACE_DURATION);
    return () => clearTimeout(timer);
  }, [bootComplete]);

  // Phase 4: Title reveal after route complete
  useEffect(() => {
    if (!routeComplete) return;
    const timer = setTimeout(() => setTitleRevealed(true), 300);
    return () => clearTimeout(timer);
  }, [routeComplete]);

  // Phase 5: Prompt after title
  useEffect(() => {
    if (!titleRevealed) return;
    const timer = setTimeout(() => setPromptVisible(true), 600);
    return () => clearTimeout(timer);
  }, [titleRevealed]);

  // Dossier rotation
  useEffect(() => {
    if (!titleRevealed) return;
    const interval = setInterval(() => {
      setDossierIndex((prev) => (prev + 1) % dossierLines.length);
    }, DOSSIER_INTERVAL);
    return () => clearInterval(interval);
  }, [titleRevealed]);

  // Enter key to start
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && promptVisible) {
        startGame();
      }
    },
    [promptVisible, startGame],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Compute route polyline points
  const routePoints = WAYPOINTS.map((wp, i) => {
    const x =
      ROUTE_PADDING +
      (i / (WAYPOINTS.length - 1)) * (ROUTE_SVG_WIDTH - ROUTE_PADDING * 2);
    const minElev = 1740;
    const maxElev = 3767;
    const normalizedElev = (wp.elevation - minElev) / (maxElev - minElev);
    const y = ROUTE_SVG_HEIGHT - 10 - normalizedElev * (ROUTE_SVG_HEIGHT - 20);
    return `${x},${y}`;
  }).join(" ");

  // Calculate total polyline length for stroke-dasharray animation
  const routeLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < WAYPOINTS.length; i++) {
      const x1 =
        ROUTE_PADDING +
        ((i - 1) / (WAYPOINTS.length - 1)) *
          (ROUTE_SVG_WIDTH - ROUTE_PADDING * 2);
      const x2 =
        ROUTE_PADDING +
        (i / (WAYPOINTS.length - 1)) * (ROUTE_SVG_WIDTH - ROUTE_PADDING * 2);
      const minElev = 1740;
      const maxElev = 3767;
      const y1 =
        ROUTE_SVG_HEIGHT -
        10 -
        ((WAYPOINTS[i - 1].elevation - minElev) / (maxElev - minElev)) *
          (ROUTE_SVG_HEIGHT - 20);
      const y2 =
        ROUTE_SVG_HEIGHT -
        10 -
        ((WAYPOINTS[i].elevation - minElev) / (maxElev - minElev)) *
          (ROUTE_SVG_HEIGHT - 20);
      len += Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    }
    return len;
  }, []);

  return (
    <div className="title-overlay">
      {/* Black fade overlay */}
      <div
        className={`title-overlay__fade ${
          fadePhase === "fading" ? "title-overlay__fade--fading" : ""
        } ${fadePhase === "done" ? "title-overlay__fade--done" : ""}`}
      />

      {/* Floating console panel */}
      <div className="title-overlay__console panel">
        {/* Boot lines */}
        <div className="title-overlay__boot">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className={`title-overlay__boot-line ${
                line.includes("BOOT COMPLETE")
                  ? "title-overlay__boot-line--complete"
                  : ""
              }`}
            >
              {line || "\u00A0"}
            </div>
          ))}
        </div>

        {/* Route trace SVG */}
        {bootComplete && (
          <div className="title-overlay__route-container">
            <svg
              className="title-overlay__route-svg"
              viewBox={`0 0 ${ROUTE_SVG_WIDTH} ${ROUTE_SVG_HEIGHT}`}
              width="100%"
              height={ROUTE_SVG_HEIGHT}
            >
              <polyline
                ref={routeRef}
                points={routePoints}
                fill="none"
                stroke="var(--tactical-green)"
                strokeWidth="1.5"
                className={`title-overlay__route-line ${routeTracing ? "title-overlay__route-line--tracing" : ""}`}
                strokeDasharray={routeLength}
                strokeDashoffset={routeComplete || routeTracing ? 0 : routeLength}
              />
              {/* Waypoint dots — appear after route is drawn */}
              {routeComplete &&
                WAYPOINTS.map((wp, i) => {
                  const x =
                    ROUTE_PADDING +
                    (i / (WAYPOINTS.length - 1)) *
                      (ROUTE_SVG_WIDTH - ROUTE_PADDING * 2);
                  const minElev = 1740;
                  const maxElev = 3767;
                  const normalizedElev =
                    (wp.elevation - minElev) / (maxElev - minElev);
                  const y =
                    ROUTE_SVG_HEIGHT -
                    10 -
                    normalizedElev * (ROUTE_SVG_HEIGHT - 20);
                  return (
                    <circle
                      key={wp.id}
                      cx={x}
                      cy={y}
                      r={i === 0 || i === WAYPOINTS.length - 1 ? 3 : 2}
                      fill="var(--tactical-green)"
                      className="title-overlay__waypoint-dot"
                    />
                  );
                })}
            </svg>
          </div>
        )}

        {/* Title reveal */}
        {titleRevealed && (
          <div className="title-overlay__title-block">
            <div className="title-overlay__title">AO TAI CYBER-HIKE</div>
            <div className="title-overlay__subtitle">
              {"\u9CCC\u592A\u7EBF\u7A7F\u8D8A\u6A21\u62DF\u7CFB\u7EDF"}
            </div>
            <div className="title-overlay__route-stats">
              80km &middot; 13 waypoints &middot; 3767m summit &middot; &lt;10%
              survival rate
            </div>
          </div>
        )}

        {/* Expedition dossier — rotating flavor text */}
        {titleRevealed && (
          <div className="title-overlay__dossier" key={dossierIndex}>
            {dossierLines[dossierIndex]}
          </div>
        )}

        {/* Prompt */}
        {promptVisible && (
          <div className="title-overlay__prompt">
            PRESS ENTER TO BEGIN EXPEDITION
            <span className="cursor-blink">_</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default TitleScreen;
