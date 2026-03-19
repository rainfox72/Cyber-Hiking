/**
 * Tiny hiker figure rendered inside the MountainScene SVG.
 * Uses the same pose and condition logic as HumanMarker
 * but at a much smaller scale (15-20 SVG units tall).
 */

import { useGameStore } from "../../store/gameStore.ts";
import {
  type HikerPose,
  getActivePose,
  getConditionModifiers,
  getConditionClasses,
  getPostureTransform,
} from "../../utils/hikerPose.ts";

const MAX_SHIFT = 150;
const PARALLAX_L2 = 0.7;

function getHealthColor(energy: number, hydration: number, bodyTemp: number): string {
  // Average of key vitals for overall health
  const avg = (energy + hydration + bodyTemp) / 3;
  if (avg > 60) return "var(--tactical-green)";
  if (avg > 30) return "var(--amber)";
  return "var(--hazard-red)";
}

/** Simplified standing figure (about 18 SVG units tall) */
function TinyFigure({ color, pose }: { color: string; pose: HikerPose }) {
  // Summit pose: arms raised
  if (pose === "summit") {
    return (
      <g>
        {/* Head */}
        <circle cx="0" cy="-15" r="2" fill={color} />
        {/* Body */}
        <rect x="-2" y="-13" width="4" height="8" fill={color} opacity="0.9" />
        {/* Backpack */}
        <rect x="2" y="-12" width="2" height="5" fill={color} opacity="0.6" />
        {/* Legs */}
        <line x1="-1" y1="-5" x2="-2" y2="3" stroke={color} strokeWidth="1.2" />
        <line x1="1" y1="-5" x2="2" y2="3" stroke={color} strokeWidth="1.2" />
        {/* Arms raised wide */}
        <line x1="-2" y1="-11" x2="-6" y2="-16" stroke={color} strokeWidth="1" />
        <line x1="2" y1="-11" x2="6" y2="-16" stroke={color} strokeWidth="1" />
      </g>
    );
  }

  // Camping/sitting pose
  if (pose === "camping" || pose === "resting" || pose === "eating") {
    return (
      <g>
        <circle cx="0" cy="-9" r="2" fill={color} />
        <rect x="-2" y="-7" width="4" height="5" fill={color} opacity="0.9" />
        <rect x="2" y="-6" width="2" height="4" fill={color} opacity="0.6" />
        <line x1="-2" y1="-2" x2="-3" y2="3" stroke={color} strokeWidth="1.2" />
        <line x1="2" y1="-2" x2="3" y2="3" stroke={color} strokeWidth="1.2" />
        <line x1="-2" y1="-5" x2="-4" y2="-3" stroke={color} strokeWidth="1" />
        <line x1="2" y1="-5" x2="4" y2="-3" stroke={color} strokeWidth="1" />
      </g>
    );
  }

  // Default standing/walking figure
  return (
    <g>
      {/* Head */}
      <circle cx="0" cy="-15" r="2" fill={color} />
      {/* Body */}
      <rect x="-2" y="-13" width="4" height="8" fill={color} opacity="0.9" />
      {/* Backpack */}
      <rect x="2" y="-12" width="2" height="5" fill={color} opacity="0.6" />
      {/* Legs */}
      <line x1="-1" y1="-5" x2="-2" y2="3" stroke={color} strokeWidth="1.2" />
      <line x1="1" y1="-5" x2="2" y2="3" stroke={color} strokeWidth="1.2" />
      {/* Arms */}
      <line x1="-2" y1="-11" x2="-4" y2="-6" stroke={color} strokeWidth="1" />
      <line x1="2" y1="-11" x2="4" y2="-6" stroke={color} strokeWidth="1" />
    </g>
  );
}

/** Tiny cold breath puffs at scene scale */
function TinyColdBreath() {
  return (
    <g style={{ pointerEvents: "none" }}>
      <circle cx="1" cy="-19" r="0.8" fill="var(--ice-blue)" opacity="0">
        <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
        <animate attributeName="cy" values="-19;-24" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="-0.5" cy="-18" r="0.5" fill="var(--ice-blue)" opacity="0">
        <animate attributeName="opacity" values="0.4;0" dur="2s" begin="0.7s" repeatCount="indefinite" />
        <animate attributeName="cy" values="-18;-23" dur="2s" begin="0.7s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

/** Tiny headlamp cone at scene scale */
function TinyHeadlamp() {
  return (
    <g style={{ pointerEvents: "none" }}>
      <polygon
        points="2,-15 10,-18 10,-12"
        fill="var(--amber)"
        opacity="0.3"
      />
      <circle cx="2" cy="-15" r="0.6" fill="var(--amber)" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.5;0.7" dur="1.5s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

const SceneHiker: React.FC = () => {
  const waypointIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const lastAction = useGameStore((s) => s.lastAction);
  const player = useGameStore((s) => s.player);
  const weather = useGameStore((s) => s.weather);
  const time = useGameStore((s) => s.time);

  // Position in the SVG viewBox (1000x600)
  const progress = waypointIndex / 12;
  const baseX = 100 + progress * 800;
  const parallaxOffset = progress * MAX_SHIFT * PARALLAX_L2;
  const x = baseX + parallaxOffset;
  const y = 400;

  const color = getHealthColor(player.energy, player.hydration, player.bodyTemp);
  const pose: HikerPose = getActivePose(
    lastAction,
    waypointIndex,
    player.hasReachedSummit,
  );

  // Condition modifiers
  const modifiers = getConditionModifiers(player, weather, time);
  const modifierIds = new Set(modifiers.map((m) => m.id));
  const conditionClasses = getConditionClasses(modifiers);
  const postureTransform = getPostureTransform(modifiers);

  return (
    <g
      className={`scene-hiker ${conditionClasses}`.trim()}
      transform={`translate(${x}, ${y})`}
    >
      {/* Summit glow behind figure */}
      {pose === "summit" && (
        <circle cx="0" cy="-6" r="10" fill="var(--amber)" opacity="0">
          <animate attributeName="opacity" values="0;0.15;0" dur="2s" repeatCount="indefinite" />
          <animate attributeName="r" values="10;14;10" dur="2s" repeatCount="indefinite" />
        </circle>
      )}

      {/* Figure with posture transform */}
      <g transform={postureTransform || undefined}>
        <TinyFigure color={color} pose={pose} />
        {modifierIds.has("cold-breath") && <TinyColdBreath />}
        {modifierIds.has("headlamp") && <TinyHeadlamp />}
      </g>
    </g>
  );
};

export default SceneHiker;
