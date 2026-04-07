/**
 * Skybox — Full-screen time-of-day gradient background.
 * Uses opacity crossfade between two stacked gradient divs for smooth transitions.
 * Renders a star canvas overlay during night phase.
 */

import { useRef, useEffect, useState } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import type { TimeOfDay, WeatherCondition } from "../../engine/types.ts";

interface GradientDef {
  top: string;
  bottom: string;
}

const TIME_GRADIENTS: Record<TimeOfDay, GradientDef> = {
  dawn:      { top: "#1a0a2e", bottom: "#4a2040" },
  morning:   { top: "#0d1a2d", bottom: "#1a3a4a" },
  midday:    { top: "#0a1520", bottom: "#152530" },
  afternoon: { top: "#0d1520", bottom: "#2a2a1a" },
  dusk:      { top: "#2a1525", bottom: "#1a0a0a" },
  night:     { top: "#050510", bottom: "#0a0a0a" },
};

const SKY_TINTS: Record<TimeOfDay, string> = {
  dawn:      "rgba(74, 32, 64, 0.03)",
  morning:   "rgba(26, 58, 74, 0.02)",
  midday:    "rgba(0, 0, 0, 0)",
  afternoon: "rgba(42, 42, 26, 0.02)",
  dusk:      "rgba(42, 21, 37, 0.03)",
  night:     "rgba(5, 5, 16, 0.04)",
};

function getWeatherModifiedGradient(
  base: GradientDef,
  weather: WeatherCondition,
  intensity: number,
): GradientDef {
  if (weather === "cloudy" || weather === "fog") {
    const gray = Math.round(intensity * 15);
    const grayHex = gray.toString(16).padStart(2, "0");
    return {
      top: blendHex(base.top, `#${grayHex}${grayHex}${grayHex}`, intensity * 0.3),
      bottom: blendHex(base.bottom, `#${grayHex}${grayHex}${grayHex}`, intensity * 0.2),
    };
  }
  if (weather === "blizzard") {
    return {
      top: blendHex(base.top, "#303030", intensity * 0.4),
      bottom: blendHex(base.bottom, "#202020", intensity * 0.3),
    };
  }
  return base;
}

function blendHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [
    parseInt(h.slice(1, 3), 16),
    parseInt(h.slice(3, 5), 16),
    parseInt(h.slice(5, 7), 16),
  ];
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

interface Star {
  x: number;
  y: number;
  size: number;
  baseOpacity: number;
  twinkleOffset: number;
  twinklePeriod: number;
}

function generateStars(w: number, h: number, count: number): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h * 0.4,
      size: 0.5 + Math.random() * 1.5,
      baseOpacity: 0.3 + Math.random() * 0.3,
      twinkleOffset: Math.random() * Math.PI * 2,
      twinklePeriod: 2000 + Math.random() * 2000,
    });
  }
  return stars;
}

export function Skybox() {
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const weather = useGameStore((s) => s.weather.current);
  const intensity = useGameStore((s) => s.weather.intensity);
  const gamePhase = useGameStore((s) => s.gamePhase);

  const [state, setState] = useState(() => {
    const g = TIME_GRADIENTS.night;
    const bg = `linear-gradient(180deg, ${g.top} 0%, ${g.bottom} 100%)`;
    return { gradients: [bg, bg] as [string, string], activeLayer: 0 };
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const animRef = useRef<number>(0);

  const effectiveTime = gamePhase === "title" ? "night" as TimeOfDay : timeOfDay;

  useEffect(() => {
    const base = TIME_GRADIENTS[effectiveTime];
    const modified = getWeatherModifiedGradient(base, weather, intensity);
    const bg = `linear-gradient(180deg, ${modified.top} 0%, ${modified.bottom} 100%)`;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((prev) => {
      const newActive = prev.activeLayer === 0 ? 1 : 0;
      const gradients: [string, string] = [prev.gradients[0], prev.gradients[1]];
      gradients[newActive] = bg;
      return { gradients, activeLayer: newActive };
    });

    document.documentElement.style.setProperty("--sky-tint", SKY_TINTS[effectiveTime]);
  }, [effectiveTime, weather, intensity]);

  const isNight = effectiveTime === "night" || effectiveTime === "dusk";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      starsRef.current = generateStars(canvas.width, canvas.height, 40);
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!isNight) {
        return; // Don't loop during daytime — canvas is faded out anyway
      }

      const now = performance.now();
      for (const star of starsRef.current) {
        const twinkle = Math.sin((now + star.twinkleOffset) / star.twinklePeriod * Math.PI * 2);
        const opacity = star.baseOpacity + twinkle * 0.15;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, opacity)})`;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [isNight]);

  const baseStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    zIndex: 0,
    transition: "opacity 2s ease",
  };

  return (
    <>
      <div style={{ ...baseStyle, background: state.gradients[0], opacity: state.activeLayer === 0 ? 1 : 0 }} />
      <div style={{ ...baseStyle, background: state.gradients[1], opacity: state.activeLayer === 1 ? 1 : 0 }} />
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 0,
          opacity: isNight ? 1 : 0,
          transition: "opacity 2s ease",
        }}
      />
    </>
  );
}
