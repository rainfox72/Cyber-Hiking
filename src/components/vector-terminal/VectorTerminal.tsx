/**
 * VectorTerminal — CRT monitor popup overlay for location/event artwork.
 *
 * Renders a full-screen overlay with a CRT bezel frame containing
 * a secondary R3F Canvas that displays procedural vector art scenes.
 *
 * Lifecycle: fade-in (300ms) → boot text (600ms) → scene (2.8s) → fade-out (500ms)
 * Total visible: ~4s, auto-dismisses. Click to skip.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import "./VectorTerminal.css";
import { useGameStore } from "../../store/gameStore.ts";
import type { PopupRequest } from "./types.ts";
import { VectorScene } from "./VectorScene.tsx";
import { getSceneDef } from "./sceneDefinitions.ts";

const BOOT_DURATION = 500;    // ms for boot text
const SCENE_DURATION = 5000;  // ms for scene display (longer since non-blocking)
const FADE_OUT_DURATION = 600; // ms for fade out

export function VectorTerminal() {
  const popup = useGameStore((s) => s.activePopup);

  const [phase, setPhase] = useState<"boot" | "scene" | "fadeout" | "hidden">("hidden");
  const [currentPopup, setCurrentPopup] = useState<PopupRequest | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastTimestampRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const dismiss = useCallback(() => {
    clearAllTimers();
    setPhase("fadeout");
    const t = setTimeout(() => {
      setPhase("hidden");
      setCurrentPopup(null);
      useGameStore.getState().clearPopup();
    }, FADE_OUT_DURATION);
    timersRef.current.push(t);
  }, [clearAllTimers]);

  // Trigger popup lifecycle when a new popup arrives
  useEffect(() => {
    if (!popup || popup.timestamp === lastTimestampRef.current) return;
    lastTimestampRef.current = popup.timestamp;

    clearAllTimers();
    setCurrentPopup(popup);
    setPhase("boot");

    // Boot → Scene → Fadeout → Hidden
    const t1 = setTimeout(() => {
      setPhase("scene");

      const t2 = setTimeout(() => {
        setPhase("fadeout");

        const t3 = setTimeout(() => {
          setPhase("hidden");
          setCurrentPopup(null);
          useGameStore.getState().clearPopup();
        }, FADE_OUT_DURATION);
        timersRef.current.push(t3);
      }, SCENE_DURATION);
      timersRef.current.push(t2);
    }, BOOT_DURATION);
    timersRef.current.push(t1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  // Skip popup on click
  const handleClick = useCallback(() => {
    if (phase === "scene" || phase === "boot") {
      dismiss();
    }
  }, [phase, dismiss]);

  if (phase === "hidden" || !currentPopup) return null;

  const sceneDef = getSceneDef(currentPopup.type, currentPopup.id);
  const isEvent = currentPopup.type === "event";
  const headerText = isEvent ? "EVENT DETECTED" : "LOCATION SCAN";
  const bootText = isEvent ? "ANALYZING..." : "SCANNING...";

  return (
    <div
      className={`vector-terminal-corner ${phase === "fadeout" ? "fading-out" : ""}`}
      onClick={handleClick}
      style={{ cursor: "pointer", pointerEvents: "auto" }}
    >
      <div className={`vector-terminal__bezel ${isEvent ? "vector-terminal--event" : ""}`}>
        {/* Header */}
        <div className="vector-terminal__header">
          <span className={`vector-terminal__header-title ${isEvent ? "vector-terminal--event" : ""}`}>
            {headerText}
          </span>
          <span className="vector-terminal__header-signal">|||&nbsp;|</span>
        </div>

        {/* Screen */}
        <div className="vector-terminal__screen">
          {/* Boot text */}
          <div className={`vector-terminal__boot ${phase !== "boot" ? "hidden" : ""}`}>
            {bootText}
          </div>

          {/* R3F Canvas */}
          {phase !== "boot" && sceneDef && (
            <div className="vector-terminal__canvas">
              <Canvas
                orthographic
                camera={{
                  zoom: sceneDef.camera.zoom ?? 80,
                  position: sceneDef.camera.position,
                  near: -50,
                  far: 50,
                }}
                gl={{ alpha: false, antialias: true }}
                onCreated={({ camera }) => {
                  camera.lookAt(...sceneDef.camera.lookAt);
                }}
                style={{ background: "#020504" }}
              >
                <VectorScene scene={sceneDef} />
              </Canvas>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="vector-terminal__footer">
          <div>
            <span className="vector-terminal__footer-title">{currentPopup.title}</span>
            {currentPopup.titleCN && (
              <span className="vector-terminal__footer-title-cn">{currentPopup.titleCN}</span>
            )}
          </div>
          <span className="vector-terminal__footer-subtitle">{currentPopup.subtitle}</span>
        </div>
      </div>
    </div>
  );
}
