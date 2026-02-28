/**
 * Title screen with simulated tactical system boot sequence.
 * Displays terminal-style text line by line, then shows the game title
 * with a blinking "PRESS ENTER TO BEGIN" prompt.
 */

import { useState, useEffect, useCallback } from "react";
import { useGameStore } from "../../store/gameStore.ts";

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

const ASCII_MOUNTAIN = [
  "                          /\\",
  "                         /  \\       /\\",
  "                   /\\   /    \\     /  \\",
  "                  /  \\ /      \\   /    \\",
  "            /\\   /    \\        \\ /      \\",
  "      /\\   /  \\ /              \\        \\",
  "     /  \\ /    \\                         \\",
  "    /    \\                                \\",
  "___/                                       \\___",
];

/** Delay in ms between boot lines appearing. */
const LINE_DELAY = 280;

/** Extra delay before boot complete line (the progress bar). */
const BOOT_COMPLETE_EXTRA_DELAY = 400;

function TitleScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const [visibleLines, setVisibleLines] = useState(0);
  const [bootComplete, setBootComplete] = useState(false);

  // Sequentially reveal boot lines
  useEffect(() => {
    if (visibleLines >= BOOT_LINES.length) {
      // Small delay after last line before showing title block
      const timer = setTimeout(() => setBootComplete(true), 600);
      return () => clearTimeout(timer);
    }

    // The progress bar line gets extra delay for dramatic effect
    const isProgressBar = visibleLines === BOOT_LINES.length - 1;
    const delay = isProgressBar
      ? LINE_DELAY + BOOT_COMPLETE_EXTRA_DELAY
      : LINE_DELAY;

    const timer = setTimeout(() => {
      setVisibleLines((prev) => prev + 1);
    }, delay);

    return () => clearTimeout(timer);
  }, [visibleLines]);

  // Listen for Enter key to start the game
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Enter" && bootComplete) {
        startGame();
      }
    },
    [bootComplete, startGame],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="title-screen">
      <div className="title-screen__terminal">
        {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className={`title-screen__boot-line ${
              line.includes("BOOT COMPLETE")
                ? "title-screen__boot-line--complete"
                : ""
            }`}
          >
            {line || "\u00A0"}
          </div>
        ))}

        {bootComplete && (
          <div className="title-screen__title-block">
            <pre className="title-screen__mountain">
              {ASCII_MOUNTAIN.join("\n")}
            </pre>
            <div className="title-screen__title">AO TAI CYBER-HIKE</div>
            <div className="title-screen__subtitle">
              {"\u9CCC\u592A\u7EBF\u7A7F\u8D8A\u6A21\u62DF\u7CFB\u7EDF"}
            </div>
            <div className="title-screen__prompt">
              [PRESS ENTER TO BEGIN]
              <span className="cursor-blink">_</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TitleScreen;
