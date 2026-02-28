/**
 * SoundManager — Procedural audio synthesis using Web Audio API.
 * All sounds are generated in real-time, no audio files required.
 * Singleton pattern: import { soundManager } from this module.
 */

type TerrainSound = "forest" | "meadow" | "stone_sea" | "ridge" | "summit" | "scree" | "stream_valley";

class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted: boolean;
  private volume: number;

  // Active ambient nodes
  private windNode: AudioNode | null = null;
  private windGain: GainNode | null = null;
  private rainNode: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private humNode: OscillatorNode | null = null;
  private humGain: GainNode | null = null;
  private musicElement: HTMLAudioElement | null = null;
  private musicFadeTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.muted = localStorage.getItem("ao-tai-muted") === "true";
    this.volume = parseFloat(localStorage.getItem("ao-tai-volume") ?? "0.5");
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getMaster(): GainNode {
    this.ensureContext();
    return this.masterGain!;
  }

  // ── UI Sounds ──

  click(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  }

  alert(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.setValueAtTime(900, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  }

  injury(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.setValueAtTime(500, ctx.currentTime + 0.15);
    osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.55);
  }

  boot(): void {
    const ctx = this.ensureContext();
    const notes = [200, 300, 400, 500, 600, 700, 800, 900, 1000];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.28;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      osc.connect(gain).connect(this.getMaster());
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  footstep(terrain: TerrainSound): void {
    const ctx = this.ensureContext();
    const filterFreq: Record<TerrainSound, number> = {
      forest: 1200,
      meadow: 800,
      stream_valley: 600,
      scree: 3000,
      stone_sea: 2500,
      ridge: 2000,
      summit: 1800,
    };

    for (let i = 0; i < 3; i++) {
      const bufferSize = 1024;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = filterFreq[terrain];
      filter.Q.value = 2;
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      source.connect(filter).connect(gain).connect(this.getMaster());
      source.start(t);
      source.stop(t + 0.08);
    }
  }

  campfire(): void {
    const ctx = this.ensureContext();
    for (let i = 0; i < 8; i++) {
      const bufferSize = 512;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 800 + Math.random() * 2000;
      const gain = ctx.createGain();
      const t = ctx.currentTime + Math.random() * 1.5;
      gain.gain.setValueAtTime(0.08, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05 + Math.random() * 0.1);
      source.connect(filter).connect(gain).connect(this.getMaster());
      source.start(t);
      source.stop(t + 0.2);
    }
  }

  eatDrink(): void {
    const ctx = this.ensureContext();
    const bufferSize = 2048;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) {
      data[j] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    source.connect(filter).connect(gain).connect(this.getMaster());
    source.start(ctx.currentTime);
    source.stop(ctx.currentTime + 0.15);
  }

  thunder(): void {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 40;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);
    osc.connect(gain).connect(this.getMaster());
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 3.5);
  }

  // ── Ambient Loops ──

  updateWind(altitude: number, weatherIntensity: number, weatherCondition: string): void {
    const ctx = this.ensureContext();
    const targetVolume = Math.max(0, (altitude - 2000) / 1767) * 0.3 *
      (weatherCondition === "wind" || weatherCondition === "blizzard" ? 2 : 1) *
      weatherIntensity;

    if (!this.windNode) {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 400;
      filter.Q.value = 0.5;

      this.windGain = ctx.createGain();
      this.windGain.gain.value = 0;

      source.connect(filter).connect(this.windGain).connect(this.getMaster());
      source.start();
      this.windNode = source;
    }

    if (this.windGain) {
      this.windGain.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 1);
    }
  }

  updateAltitudeHum(altitude: number): void {
    const ctx = this.ensureContext();
    const targetVolume = altitude > 3200 ? ((altitude - 3200) / 567) * 0.05 : 0;

    if (!this.humNode && targetVolume > 0) {
      this.humNode = ctx.createOscillator();
      this.humNode.type = "sine";
      this.humNode.frequency.value = 100;
      this.humGain = ctx.createGain();
      this.humGain.gain.value = 0;
      this.humNode.connect(this.humGain).connect(this.getMaster());
      this.humNode.start();
    }

    if (this.humGain) {
      this.humGain.gain.linearRampToValueAtTime(targetVolume, ctx.currentTime + 2);
    }
  }

  // ── Background Music ──

  private static readonly MUSIC_VOLUME = 0.3;
  private static readonly MUSIC_FADE_MS = 3000;
  private static readonly MUSIC_FADE_STEPS = 60;

  startMusic(): void {
    if (this.musicElement) return; // already playing

    const audio = new Audio("/music/Witch Parade Assassin.mp3");
    audio.loop = true;
    audio.volume = 0;
    this.musicElement = audio;

    audio.play().then(() => {
      // 3-second fade-in from 0 to MUSIC_VOLUME
      const targetVol = this.muted ? 0 : SoundManager.MUSIC_VOLUME;
      const stepMs = SoundManager.MUSIC_FADE_MS / SoundManager.MUSIC_FADE_STEPS;
      const volStep = targetVol / SoundManager.MUSIC_FADE_STEPS;
      let currentStep = 0;

      this.musicFadeTimer = setInterval(() => {
        currentStep++;
        if (currentStep >= SoundManager.MUSIC_FADE_STEPS) {
          audio.volume = targetVol;
          if (this.musicFadeTimer) {
            clearInterval(this.musicFadeTimer);
            this.musicFadeTimer = null;
          }
        } else {
          audio.volume = volStep * currentStep;
        }
      }, stepMs);
    }).catch(() => {
      // Autoplay blocked — browser requires user gesture first; ignore gracefully
      this.musicElement = null;
    });
  }

  stopMusic(): void {
    if (this.musicFadeTimer) {
      clearInterval(this.musicFadeTimer);
      this.musicFadeTimer = null;
    }
    if (this.musicElement) {
      this.musicElement.pause();
      this.musicElement = null;
    }
  }

  // ── Controls ──

  setMuted(muted: boolean): void {
    this.muted = muted;
    localStorage.setItem("ao-tai-muted", String(muted));
    if (this.masterGain) {
      this.masterGain.gain.linearRampToValueAtTime(
        muted ? 0 : this.volume,
        (this.ctx?.currentTime ?? 0) + 0.1,
      );
    }
    if (this.musicElement) {
      this.musicElement.volume = muted ? 0 : SoundManager.MUSIC_VOLUME;
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem("ao-tai-volume", String(this.volume));
    if (this.masterGain && !this.muted) {
      this.masterGain.gain.linearRampToValueAtTime(
        this.volume,
        (this.ctx?.currentTime ?? 0) + 0.1,
      );
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  getVolume(): number {
    return this.volume;
  }
}

export const soundManager = new SoundManager();
