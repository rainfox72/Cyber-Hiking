/**
 * Canvas-based weather particle system.
 * Renders snow, rain, fog, dust particles driven by weather state.
 */

import { useRef, useEffect } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import type { WeatherCondition, TimeOfDay } from "../../engine/types.ts";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  life: number;
}

const PARTICLE_CONFIGS: Record<string, {
  count: number;
  color: string;
  minSize: number;
  maxSize: number;
  minVx: number;
  maxVx: number;
  minVy: number;
  maxVy: number;
  opacity: number;
}> = {
  snow: { count: 80, color: "255,255,255", minSize: 1, maxSize: 3, minVx: -0.5, maxVx: 0.5, minVy: 0.5, maxVy: 1.5, opacity: 0.7 },
  rain: { count: 120, color: "150,200,255", minSize: 1, maxSize: 1.5, minVx: -1, maxVx: 0, minVy: 6, maxVy: 10, opacity: 0.4 },
  blizzard: { count: 150, color: "255,255,255", minSize: 1, maxSize: 4, minVx: -3, maxVx: 1, minVy: 1, maxVy: 4, opacity: 0.8 },
  fog: { count: 20, color: "200,200,200", minSize: 30, maxSize: 80, minVx: -0.2, maxVx: 0.2, minVy: -0.1, maxVy: 0.1, opacity: 0.04 },
  wind: { count: 60, color: "180,180,150", minSize: 0.5, maxSize: 1.5, minVx: 3, maxVx: 8, minVy: -0.5, maxVy: 0.5, opacity: 0.3 },
};

function shouldRenderParticles(weather: WeatherCondition): boolean {
  return weather !== "clear" && weather !== "cloudy";
}

function createParticle(w: number, h: number, config: typeof PARTICLE_CONFIGS["snow"]): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: config.minVx + Math.random() * (config.maxVx - config.minVx),
    vy: config.minVy + Math.random() * (config.maxVy - config.minVy),
    size: config.minSize + Math.random() * (config.maxSize - config.minSize),
    opacity: config.opacity * (0.5 + Math.random() * 0.5),
    life: Math.random(),
  };
}

export function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animRef = useRef<number>(0);
  const weather = useGameStore((s) => s.weather.current);
  const intensity = useGameStore((s) => s.weather.intensity);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;

      // Night overlay
      const isNight = timeOfDay === "night" || timeOfDay === "dusk";
      ctx.clearRect(0, 0, w, h);
      if (isNight) {
        ctx.fillStyle = `rgba(0, 0, 10, ${timeOfDay === "night" ? 0.15 : 0.06})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (!shouldRenderParticles(weather)) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      const config = PARTICLE_CONFIGS[weather];
      if (!config) {
        animRef.current = requestAnimationFrame(render);
        return;
      }

      // Ensure we have particles
      const targetCount = Math.round(config.count * intensity);
      while (particlesRef.current.length < targetCount) {
        particlesRef.current.push(createParticle(w, h, config));
      }
      while (particlesRef.current.length > targetCount) {
        particlesRef.current.pop();
      }

      // Update and draw
      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;

        // Wrap around
        if (p.x > w + 10) p.x = -10;
        if (p.x < -10) p.x = w + 10;
        if (p.y > h + 10) {
          p.y = -10;
          p.x = Math.random() * w;
        }
        if (p.y < -10) p.y = h + 10;

        if (weather === "fog") {
          // Fog: large circles
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${config.color}, ${p.opacity})`;
          ctx.fill();
        } else if (weather === "rain") {
          // Rain: streaks
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 0.5, p.y + p.vy * 1.5);
          ctx.strokeStyle = `rgba(${config.color}, ${p.opacity})`;
          ctx.lineWidth = p.size;
          ctx.stroke();
        } else {
          // Snow, blizzard, wind, dust: dots
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${config.color}, ${p.opacity})`;
          ctx.fill();
        }
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [weather, intensity, timeOfDay]);

  // Reset particles when weather changes
  useEffect(() => {
    particlesRef.current = [];
  }, [weather]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9998,
      }}
    />
  );
}
