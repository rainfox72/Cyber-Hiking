/**
 * Cyberpunk SVG hiking figure marker for the TacticalMap.
 * Geometric silhouette with glitch scanline effects.
 * Color shifts with health status (green/amber/red).
 * Condition modifiers overlay environmental/health effects on top of poses.
 */

import type { GameAction } from "../../engine/types.ts";
import {
  type HikerPose,
  type ConditionModifier,
  getActivePose,
  getConditionModifiers,
  getConditionClasses,
  getPostureTransform,
} from "../../utils/hikerPose.ts";
import { useGameStore } from "../../store/gameStore.ts";

/** Direction the hiker faces: right = forward/ascending, left = descending/retreating */
type FacingDirection = "right" | "left";

interface HumanMarkerProps {
  healthPercent: number;
  lastAction: GameAction | null;
  isLost?: boolean;
}

function actionToFacing(action: GameAction | null): FacingDirection {
  return action === "descend" ? "left" : "right";
}

/** Horizontal scanlines overlaid on the figure for CRT/hologram effect */
function GlitchOverlay({ healthPercent }: { healthPercent: number }) {
  const baseOpacity = healthPercent > 30 ? 0.15 : healthPercent > 10 ? 0.35 : 0.55;
  return (
    <g className="glitch-scanlines" style={{ pointerEvents: "none" }}>
      <rect x="-5" y="-12" width="10" height="0.6" fill="currentColor" opacity={baseOpacity}>
        <animate attributeName="opacity" values={`${baseOpacity};0.05;${baseOpacity}`} dur="0.8s" repeatCount="indefinite" />
      </rect>
      <rect x="-5" y="-6" width="10" height="0.6" fill="currentColor" opacity={baseOpacity * 0.7}>
        <animate attributeName="opacity" values={`${baseOpacity * 0.7};0.03;${baseOpacity * 0.7}`} dur="1.2s" repeatCount="indefinite" />
      </rect>
      <rect x="-5" y="1" width="10" height="0.6" fill="currentColor" opacity={baseOpacity * 0.5}>
        <animate attributeName="opacity" values={`${baseOpacity * 0.5};0.02;${baseOpacity * 0.5}`} dur="0.6s" repeatCount="indefinite" />
      </rect>
    </g>
  );
}

/** Diamond-shaped scan field replacing the circular glow ring */
function ScanField({ color }: { color: string }) {
  return (
    <g className="scan-field">
      <polygon
        points="0,-14 10,-3 0,8 -10,-3"
        fill="none"
        stroke={color}
        strokeWidth="0.4"
        strokeDasharray="3,2"
        opacity="0.3"
      >
        <animate attributeName="stroke-dashoffset" values="0;10" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.12;0.3" dur="2.5s" repeatCount="indefinite" />
      </polygon>
    </g>
  );
}

/* ── Condition Modifier Overlays ────────────────────────── */

/** Breath vapor circles above the head for cold conditions */
function ColdBreath() {
  return (
    <g className="cold-breath" style={{ pointerEvents: "none" }}>
      <circle cx="-1" cy="-18" r="1" fill="var(--ice-blue)" opacity="0">
        <animate attributeName="opacity" values="0.6;0" dur="2s" repeatCount="indefinite" />
        <animate attributeName="cy" values="-18;-26" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="1" cy="-17" r="0.7" fill="var(--ice-blue)" opacity="0">
        <animate attributeName="opacity" values="0.5;0" dur="2s" begin="0.6s" repeatCount="indefinite" />
        <animate attributeName="cy" values="-17;-25" dur="2s" begin="0.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="0" cy="-19" r="0.5" fill="var(--ice-blue)" opacity="0">
        <animate attributeName="opacity" values="0.4;0" dur="2s" begin="1.2s" repeatCount="indefinite" />
        <animate attributeName="cy" values="-19;-27" dur="2s" begin="1.2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/** Jacket flutter line near the backpack for wind conditions */
function WindFlutter() {
  return (
    <g className="wind-flutter" style={{ pointerEvents: "none" }}>
      <line x1="4" y1="-8" x2="7" y2="-7" stroke="currentColor" strokeWidth="0.8" opacity="0.5">
        <animate attributeName="x2" values="7;9;7" dur="0.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="0.4s" repeatCount="indefinite" />
      </line>
    </g>
  );
}

/** Headlamp cone projecting from the head for night/dusk */
function Headlamp() {
  return (
    <g className="headlamp" style={{ pointerEvents: "none" }}>
      <defs>
        <linearGradient id="headlamp-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--amber)" stopOpacity="0.6" />
          <stop offset="100%" stopColor="var(--amber)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Light cone triangle projecting forward-right from head */}
      <polygon
        points="3,-14 14,-18 14,-10"
        fill="url(#headlamp-grad)"
        className="headlamp-cone"
      />
      {/* Small bright point at the lamp source */}
      <circle cx="2.5" cy="-14" r="0.8" fill="var(--amber)" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.6;0.8" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/** Golden glow behind the figure for summit victory */
function SummitGlow() {
  return (
    <g className="summit-glow" style={{ pointerEvents: "none" }}>
      <circle cx="0" cy="-6" r="12" fill="var(--amber)" opacity="0" className="summit-glow-ring">
        <animate attributeName="opacity" values="0;0.2;0" dur="2s" repeatCount="indefinite" />
        <animate attributeName="r" values="12;16;12" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/* ── Geometric Pose Components ────────────────────────── */

function IdlePose({ color }: { color: string }) {
  return (
    <g>
      <polygon points="-2,-15 2,-15 2.5,-12 -2.5,-12" fill={color} />
      <polygon points="-2.5,-12 2.5,-12 3.5,-3 -3.5,-3" fill={color} opacity="0.9" />
      <rect x="2.5" y="-11" width="2.5" height="7" fill={color} opacity="0.6" />
      <polygon points="-3.5,-3 -1,-3 -2,5 -4,5" fill={color} opacity="0.85" />
      <polygon points="1,-3 3.5,-3 4,5 2,5" fill={color} opacity="0.85" />
      <line x1="-2.5" y1="-10" x2="-5" y2="-4" stroke={color} strokeWidth="1.5" />
      <line x1="2.5" y1="-10" x2="5" y2="-4" stroke={color} strokeWidth="1.5" />
    </g>
  );
}

function WalkingPose({ color, facing }: { color: string; facing: FacingDirection }) {
  const scaleTransform = facing === "left" ? "scale(-1, 1)" : "scale(1, 1)";
  return (
    <g className="hiker-walking">
      <g transform={scaleTransform}>
        <polygon points="-2,-15 2,-15 2.5,-12 -2.5,-12" fill={color} />
        <polygon points="-2,-12 3,-12 4,-3 -2.5,-3" fill={color} opacity="0.9" />
        <rect x="-4.5" y="-11" width="2.5" height="7" fill={color} opacity="0.6" />
        <polygon points="1,-3 3.5,-3 5,5 3,5" fill={color} opacity="0.85" />
        <polygon points="-2.5,-3 0,-3 -3,5 -5,5" fill={color} opacity="0.85" />
        <line x1="-2" y1="-10" x2="-6" y2="-3" stroke={color} strokeWidth="1.5" />
        <line x1="-6" y1="-3" x2="-5" y2="6" stroke={color} strokeWidth="0.8" opacity="0.6" />
        <line x1="3" y1="-10" x2="5" y2="-5" stroke={color} strokeWidth="1.5" />
      </g>
    </g>
  );
}

function CampingPose({ color }: { color: string }) {
  return (
    <g>
      <polygon points="-2,-9 2,-9 2.5,-6.5 -2.5,-6.5" fill={color} />
      <polygon points="-2.5,-6.5 2.5,-6.5 3,0 -3,0" fill={color} opacity="0.9" />
      <polygon points="-3,0 3,0 4,3 -4,3" fill={color} opacity="0.85" />
      <rect x="4" y="-3" width="2.5" height="5" fill={color} opacity="0.5" />
      <line x1="-2.5" y1="-5" x2="-4" y2="-2" stroke={color} strokeWidth="1.5" />
      <line x1="2.5" y1="-5" x2="4" y2="-2" stroke={color} strokeWidth="1.5" />
      <circle cx="0" cy="4.5" r="1.2" fill="var(--amber)" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.3;0.7" dur="0.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="0.5" cy="4" r="0.8" fill="var(--hazard-red)" opacity="0.5">
        <animate attributeName="opacity" values="0.5;0.2;0.5" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function EatingPose({ color }: { color: string }) {
  return (
    <g>
      <polygon points="-2,-9 2,-9 2.5,-6.5 -2.5,-6.5" fill={color} />
      <polygon points="-2.5,-6.5 2.5,-6.5 3,0 -3,0" fill={color} opacity="0.9" />
      <polygon points="-3,0 3,0 4,3 -4,3" fill={color} opacity="0.85" />
      <line x1="2.5" y1="-5" x2="1" y2="-8" stroke={color} strokeWidth="1.5" />
      <line x1="-2.5" y1="-5" x2="-4" y2="-1" stroke={color} strokeWidth="1.5" />
      <rect x="4" y="-3" width="2.5" height="5" fill={color} opacity="0.5" />
    </g>
  );
}

function DrinkingPose({ color }: { color: string }) {
  return (
    <g>
      <polygon points="-2,-15 2,-15 3,-12 -1.5,-12" fill={color} />
      <polygon points="-2.5,-12 2.5,-12 3.5,-3 -3.5,-3" fill={color} opacity="0.9" />
      <rect x="2.5" y="-11" width="2.5" height="7" fill={color} opacity="0.6" />
      <line x1="-2.5" y1="-10" x2="-3.5" y2="-14" stroke={color} strokeWidth="1.5" />
      <rect x="-5" y="-15.5" width="2" height="2.5" rx="0.5" fill="var(--teal-muted)" opacity="0.7" />
      <line x1="2.5" y1="-10" x2="5" y2="-5" stroke={color} strokeWidth="1.5" />
      <polygon points="-3.5,-3 -1,-3 -1.5,5 -4,5" fill={color} opacity="0.85" />
      <polygon points="1,-3 3.5,-3 4,5 1.5,5" fill={color} opacity="0.85" />
    </g>
  );
}

function RestingPose({ color }: { color: string }) {
  return (
    <g className="hiker-resting">
      <polygon points="-2.5,-9 1.5,-9 2,-6.5 -3,-6.5" fill={color} />
      <polygon points="-3,-6.5 2,-6.5 2.5,0 -3.5,0" fill={color} opacity="0.9" />
      <polygon points="-3.5,0 2.5,0 5,3 -2,3" fill={color} opacity="0.85" />
      <line x1="-3" y1="-5" x2="-5" y2="-1" stroke={color} strokeWidth="1.5" />
      <line x1="2" y1="-5" x2="4" y2="-1" stroke={color} strokeWidth="1.5" />
      <rect x="-6" y="-7" width="3" height="6" rx="0.5" fill={color} opacity="0.45" />
    </g>
  );
}

function MappingPose({ color }: { color: string }) {
  return (
    <g>
      <polygon points="-2,-14 2,-14 2.5,-11 -2.5,-11" fill={color} />
      <polygon points="-2.5,-11 2.5,-11 3.5,-3 -3.5,-3" fill={color} opacity="0.9" />
      <line x1="-2.5" y1="-9" x2="-6" y2="-9" stroke={color} strokeWidth="1.5" />
      <line x1="2.5" y1="-9" x2="6" y2="-9" stroke={color} strokeWidth="1.5" />
      <rect x="-6" y="-10.5" width="12" height="4" rx="0.3" fill="none"
        stroke="var(--amber)" strokeWidth="0.7" opacity="0.7" />
      <line x1="-3" y1="-10.5" x2="-3" y2="-6.5" stroke="var(--amber)" strokeWidth="0.3" opacity="0.4" />
      <line x1="3" y1="-10.5" x2="3" y2="-6.5" stroke="var(--amber)" strokeWidth="0.3" opacity="0.4" />
      <polygon points="-3.5,-3 -1,-3 -1.5,5 -4,5" fill={color} opacity="0.85" />
      <polygon points="1,-3 3.5,-3 4,5 1.5,5" fill={color} opacity="0.85" />
      <rect x="3" y="-10" width="2.5" height="6" fill={color} opacity="0.5" />
    </g>
  );
}

function MedicinePose({ color }: { color: string }) {
  return (
    <g>
      <polygon points="-2,-9 2,-9 2.5,-6.5 -2.5,-6.5" fill={color} />
      <polygon points="-2.5,-6.5 2.5,-6.5 3,0 -3,0" fill={color} opacity="0.9" />
      <polygon points="-3,0 3,0 2,4 -2,4" fill={color} opacity="0.85" />
      <line x1="-2.5" y1="-5" x2="-5" y2="-6" stroke={color} strokeWidth="1.5" />
      <line x1="-6" y1="-6" x2="-4" y2="-6" stroke="var(--hazard-red)" strokeWidth="1" />
      <line x1="-5" y1="-7" x2="-5" y2="-5" stroke="var(--hazard-red)" strokeWidth="1" />
      <line x1="2.5" y1="-5" x2="4" y2="-2" stroke={color} strokeWidth="1.5" />
      <rect x="4" y="-5" width="2.5" height="5" fill={color} opacity="0.5" />
    </g>
  );
}

/** Summit victory pose: arms raised wide */
function SummitPose({ color }: { color: string }) {
  return (
    <g>
      {/* Head */}
      <polygon points="-2,-15 2,-15 2.5,-12 -2.5,-12" fill={color} />
      {/* Torso */}
      <polygon points="-2.5,-12 2.5,-12 3.5,-3 -3.5,-3" fill={color} opacity="0.9" />
      {/* Backpack */}
      <rect x="2.5" y="-11" width="2.5" height="7" fill={color} opacity="0.6" />
      {/* Legs */}
      <polygon points="-3.5,-3 -1,-3 -2,5 -4,5" fill={color} opacity="0.85" />
      <polygon points="1,-3 3.5,-3 4,5 2,5" fill={color} opacity="0.85" />
      {/* Arms raised wide in V shape */}
      <line x1="-2.5" y1="-10" x2="-7" y2="-16" stroke={color} strokeWidth="1.5" />
      <line x1="2.5" y1="-10" x2="7" y2="-16" stroke={color} strokeWidth="1.5" />
    </g>
  );
}

export function HumanMarker({ healthPercent, lastAction, isLost }: HumanMarkerProps) {
  // Read condition-relevant state from the game store
  const player = useGameStore((s) => s.player);
  const weather = useGameStore((s) => s.weather);
  const time = useGameStore((s) => s.time);

  const color =
    healthPercent > 60 ? "var(--tactical-green)" :
    healthPercent > 30 ? "var(--amber)" :
    "var(--hazard-red)";

  const pose: HikerPose = getActivePose(
    lastAction,
    player.currentWaypointIndex,
    player.hasReachedSummit,
  );
  const facing = actionToFacing(lastAction);

  // Compute condition modifiers
  const modifiers = getConditionModifiers(player, weather, time);
  const modifierIds = new Set(modifiers.map((m) => m.id));
  const conditionClasses = getConditionClasses(modifiers);
  const postureTransform = getPostureTransform(modifiers);

  // Build CSS class
  const jitterClass = healthPercent <= 10 ? " hiker-jitter" : "";
  const extraClasses = conditionClasses ? ` ${conditionClasses}` : "";

  return (
    <g
      className={`human-marker${jitterClass}${extraClasses}`}
      style={{ color }}
    >
      {/* Summit glow behind the figure */}
      {pose === "summit" && <SummitGlow />}

      {/* Figure group with posture transform (wind lean, exhaustion lean) */}
      <g transform={postureTransform || undefined}>
        {pose === "idle" && <IdlePose color={color} />}
        {pose === "walking" && <WalkingPose color={color} facing={facing} />}
        {pose === "camping" && <CampingPose color={color} />}
        {pose === "eating" && <EatingPose color={color} />}
        {pose === "drinking" && <DrinkingPose color={color} />}
        {pose === "resting" && <RestingPose color={color} />}
        {pose === "mapping" && <MappingPose color={color} />}
        {pose === "medicine" && <MedicinePose color={color} />}
        {pose === "summit" && <SummitPose color={color} />}

        {/* Cold breath vapor */}
        {modifierIds.has("cold-breath") && <ColdBreath />}

        {/* Wind jacket flutter */}
        {modifierIds.has("wind-flutter") && <WindFlutter />}

        {/* Headlamp for night/dusk */}
        {modifierIds.has("headlamp") && <Headlamp />}
      </g>

      {/* Glitch scanlines */}
      <GlitchOverlay healthPercent={healthPercent} />

      {/* Diamond scan field */}
      <ScanField color={color} />

      {/* Lost label */}
      {isLost && (
        <g className="lost-marker">
          <text x="0" y="12" textAnchor="middle" fill="var(--hazard-red)"
            fontSize="5" fontFamily="monospace" fontWeight="bold"
            stroke="rgba(0,0,0,0.6)" strokeWidth="0.3">LOST</text>
        </g>
      )}
    </g>
  );
}
