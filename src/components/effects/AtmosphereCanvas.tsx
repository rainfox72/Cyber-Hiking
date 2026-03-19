/**
 * Full-viewport canvas atmosphere renderer.
 * 7 weather modes, night overlay, lightning system, and UI interference.
 * Replaces the simpler ParticleCanvas with expanded visual effects.
 */

import { useRef, useEffect, useCallback } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import type { WeatherCondition, TimeOfDay } from "../../engine/types.ts";

// ── Particle type ────────────────────────────

interface Particle {
  x: number;
  y: number;
  speed: number;
  speedX: number;
  size: number;
  opacity: number;
  /** Sine-wave phase for snow wander */
  phase: number;
}

interface CloudBank {
  x: number;
  y: number;
  rx: number;
  ry: number;
  opacity: number;
  speed: number;
}

interface LightningState {
  active: boolean;
  /** Frames remaining in current flash */
  flashFrames: number;
  /** Frames remaining in fade-out */
  fadeFrames: number;
  /** Current fade opacity (0-1) */
  fadeOpacity: number;
  /** Remaining flashes in cluster */
  pendingFlashes: number;
  /** Frames to wait before next flash in cluster */
  gapFrames: number;
}

// ── Particle creation per weather type ───────

function createParticles(
  weather: WeatherCondition,
  w: number,
  h: number,
  intensity: number
): Particle[] {
  const configs: Record<WeatherCondition, { max: number; create: () => Particle }> = {
    clear: {
      max: 10,
      create: () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.1 + Math.random() * 0.3,
        speedX: (Math.random() - 0.5) * 0.4,
        size: 0.5 + Math.random() * 1,
        opacity: 0.05 + Math.random() * 0.1,
        phase: Math.random() * Math.PI * 2,
      }),
    },
    cloudy: {
      max: 30,
      create: () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.1 + Math.random() * 0.4,
        speedX: (Math.random() - 0.5) * 0.5,
        size: 0.8 + Math.random() * 1.5,
        opacity: 0.08 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
      }),
    },
    fog: {
      max: 25,
      create: () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.05 + Math.random() * 0.15,
        speedX: (Math.random() - 0.5) * 0.2,
        size: 1 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.15,
        phase: Math.random() * Math.PI * 2,
      }),
    },
    rain: {
      max: 120,
      create: () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 8 + Math.random() * 7,
        speedX: -1.5 - Math.random() * 1,
        size: 0.8 + Math.random() * 0.5,
        opacity: 0.3 + Math.random() * 0.15,
        phase: 0,
      }),
    },
    snow: {
      max: 100,
      create: () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 1 + Math.random() * 2,
        speedX: (Math.random() - 0.5) * 0.5,
        size: 1 + Math.random() * 2,
        opacity: 0.5 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      }),
    },
    wind: {
      max: 80,
      create: () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 0.5 + Math.random() * 1,
        speedX: 10 + Math.random() * 10,
        size: 0.5 + Math.random() * 1,
        opacity: 0.2 + Math.random() * 0.15,
        phase: 0,
      }),
    },
    blizzard: {
      max: 180,
      create: () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        speed: 2 + Math.random() * 4,
        speedX: -4 + Math.random() * 6,
        size: 1 + Math.random() * 2.5,
        opacity: 0.4 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      }),
    },
  };

  const cfg = configs[weather];
  const count = Math.round(cfg.max * intensity);
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push(cfg.create());
  }
  return particles;
}

function createCloudBanks(w: number, h: number): CloudBank[] {
  const banks: CloudBank[] = [];
  const count = 2 + Math.floor(Math.random() * 2); // 2-3
  for (let i = 0; i < count; i++) {
    banks.push({
      x: Math.random() * w,
      y: h * 0.15 + Math.random() * h * 0.35,
      rx: 100 + Math.random() * 100,
      ry: 40 + Math.random() * 40,
      opacity: 0.03 + Math.random() * 0.02,
      speed: 0.15 + Math.random() * 0.2,
    });
  }
  return banks;
}

// ── Render helpers ───────────────────────────

function drawNightOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, timeOfDay: TimeOfDay) {
  if (timeOfDay === "night" || timeOfDay === "dusk") {
    const alpha = timeOfDay === "night" ? 0.15 : 0.06;
    ctx.fillStyle = `rgba(0, 0, 20, ${alpha})`;
    ctx.fillRect(0, 0, w, h);
  }
}

function drawFogOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const gradient = ctx.createLinearGradient(0, h, 0, h * 0.3);
  gradient.addColorStop(0, "rgba(150, 150, 150, 0.2)");
  gradient.addColorStop(1, "rgba(150, 150, 150, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function drawRainOverlay(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "rgba(0, 0, 20, 0.05)";
  ctx.fillRect(0, 0, w, h);
}

function drawBlizzardWhiteout(ctx: CanvasRenderingContext2D, w: number, h: number, intensity: number) {
  const alpha = 0.1 + intensity * 0.15;
  // Edge-to-center wash
  const gradient = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.7);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.3})`);
  gradient.addColorStop(1, `rgba(255, 255, 255, ${alpha})`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function drawCloudBanks(ctx: CanvasRenderingContext2D, clouds: CloudBank[], w: number) {
  for (const c of clouds) {
    c.x += c.speed;
    if (c.x - c.rx > w) c.x = -c.rx;

    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.rx, c.ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180, 180, 190, ${c.opacity})`;
    ctx.fill();
  }
}

function drawLightning(ctx: CanvasRenderingContext2D, w: number, h: number, lightning: LightningState) {
  if (lightning.flashFrames > 0) {
    ctx.fillStyle = "rgba(240, 240, 255, 0.7)";
    ctx.fillRect(0, 0, w, h);
  } else if (lightning.fadeFrames > 0) {
    ctx.fillStyle = `rgba(240, 240, 255, ${lightning.fadeOpacity})`;
    ctx.fillRect(0, 0, w, h);
  }
}

// ── Update + draw particles per weather ──────

function updateAndDrawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  weather: WeatherCondition,
  w: number,
  h: number,
  frameCount: number
) {
  for (const p of particles) {
    // Movement
    switch (weather) {
      case "clear":
      case "cloudy":
        p.x += p.speedX;
        p.y += p.speed;
        break;
      case "fog":
        p.x += p.speedX;
        p.y += p.speed;
        break;
      case "rain":
        p.x += p.speedX;
        p.y += p.speed;
        break;
      case "snow":
        p.phase += 0.02;
        p.x += Math.sin(p.phase) * 0.6 + p.speedX;
        p.y += p.speed;
        break;
      case "wind":
        p.x += p.speedX;
        p.y += p.speed * (Math.random() > 0.5 ? 1 : -1);
        break;
      case "blizzard":
        // Chaotic: change direction slightly each frame
        p.speedX += (Math.random() - 0.5) * 0.8;
        p.speedX = Math.max(-8, Math.min(8, p.speedX));
        p.x += p.speedX;
        p.y += p.speed;
        break;
    }

    // Wrap around
    if (p.x > w + 20) p.x = -20;
    if (p.x < -20) p.x = w + 20;
    if (p.y > h + 20) {
      p.y = -20;
      p.x = Math.random() * w;
    }
    if (p.y < -20) p.y = h + 20;

    // Draw
    switch (weather) {
      case "clear":
      case "cloudy":
      case "fog":
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 200, 210, ${p.opacity})`;
        ctx.fill();
        break;

      case "rain": {
        // Angled streak at ~78 degrees
        const len = p.speed * 1.5;
        const angle = (78 * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(angle) * len * 0.3, p.y + Math.sin(angle) * len);
        ctx.strokeStyle = `rgba(150, 170, 200, ${p.opacity})`;
        ctx.lineWidth = p.size;
        ctx.stroke();
        break;
      }

      case "snow":
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
        break;

      case "wind": {
        // Horizontal streak
        const streakLen = 4 + Math.random() * 6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + streakLen, p.y + (Math.random() - 0.5) * 1);
        ctx.strokeStyle = `rgba(180, 170, 150, ${p.opacity})`;
        ctx.lineWidth = p.size;
        ctx.stroke();
        break;
      }

      case "blizzard":
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
        ctx.fill();
        break;
    }
  }
}

// ── Component ────────────────────────────────

export function AtmosphereCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const cloudsRef = useRef<CloudBank[]>([]);
  const animRef = useRef<number>(0);
  const frameCountRef = useRef<number>(0);
  const lightningRef = useRef<LightningState>({
    active: false,
    flashFrames: 0,
    fadeFrames: 0,
    fadeOpacity: 0,
    pendingFlashes: 0,
    gapFrames: 0,
  });

  const weather = useGameStore((s) => s.weather.current);
  const intensity = useGameStore((s) => s.weather.intensity);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);

  // Set data-weather attribute on panel grid for CSS interference
  useEffect(() => {
    const panelGrid = document.querySelector(".panel-grid");
    if (panelGrid) {
      panelGrid.setAttribute("data-weather", weather);
    }
  }, [weather]);

  // Reset particles and clouds when weather changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const w = canvas.width || window.innerWidth;
    const h = canvas.height || window.innerHeight;
    particlesRef.current = createParticles(weather, w, h, intensity);
    cloudsRef.current = weather === "cloudy" ? createCloudBanks(w, h) : [];
    // Reset lightning
    lightningRef.current = {
      active: false,
      flashFrames: 0,
      fadeFrames: 0,
      fadeOpacity: 0,
      pendingFlashes: 0,
      gapFrames: 0,
    };
  }, [weather, intensity]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    frameCountRef.current++;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Night overlay
    drawNightOverlay(ctx, w, h, timeOfDay);

    // Weather-specific overlays (behind particles)
    if (weather === "fog") {
      drawFogOverlay(ctx, w, h);
    } else if (weather === "rain") {
      drawRainOverlay(ctx, w, h);
    } else if (weather === "blizzard") {
      drawBlizzardWhiteout(ctx, w, h, intensity);
    }

    // Cloud banks for cloudy weather
    if (weather === "cloudy") {
      drawCloudBanks(ctx, cloudsRef.current, w);
    }

    // Particles
    updateAndDrawParticles(ctx, particlesRef.current, weather, w, h, frameCountRef.current);

    // Lightning system (blizzard always, wind at lower probability)
    const lightning = lightningRef.current;
    if (weather === "blizzard" || weather === "wind") {
      // Process ongoing lightning
      if (lightning.flashFrames > 0) {
        lightning.flashFrames--;
        if (lightning.flashFrames === 0) {
          // Start fade
          lightning.fadeFrames = 18;
          lightning.fadeOpacity = 0.4;
          // Check for cluster continuation
          if (lightning.pendingFlashes > 0) {
            lightning.gapFrames = 12; // ~200ms gap at 60fps
          }
        }
      } else if (lightning.gapFrames > 0) {
        lightning.gapFrames--;
        if (lightning.gapFrames === 0 && lightning.pendingFlashes > 0) {
          lightning.pendingFlashes--;
          lightning.flashFrames = 3;
          lightning.fadeFrames = 0;
          lightning.fadeOpacity = 0;
        }
      } else if (lightning.fadeFrames > 0) {
        lightning.fadeFrames--;
        lightning.fadeOpacity *= 0.85;
      } else if (!lightning.active) {
        // Chance to start a new lightning cluster
        // Target: ~1-2 clusters per 60 seconds at 60fps = 3600 frames
        // Probability per frame: ~1.5/3600 ≈ 0.00042
        const chance = weather === "blizzard" ? 0.00042 : 0.00015;
        if (Math.random() < chance) {
          lightning.active = true;
          lightning.flashFrames = 3; // ~50ms at 60fps
          // Cluster size: 60% single, 30% double, 10% triple
          const roll = Math.random();
          if (roll < 0.6) {
            lightning.pendingFlashes = 0;
          } else if (roll < 0.9) {
            lightning.pendingFlashes = 1;
          } else {
            lightning.pendingFlashes = 2;
          }
        }
      }

      // Reset active flag when cluster is fully done
      if (lightning.active && lightning.flashFrames === 0 && lightning.fadeFrames === 0 && lightning.gapFrames === 0 && lightning.pendingFlashes === 0) {
        lightning.active = false;
      }

      drawLightning(ctx, w, h, lightning);
    }

    animRef.current = requestAnimationFrame(render);
  }, [weather, intensity, timeOfDay]);

  // Animation loop + resize handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    animRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
      }}
    />
  );
}
