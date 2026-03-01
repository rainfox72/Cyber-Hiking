/**
 * Animated SVG hiking figure marker for the TacticalMap.
 * Shows different poses based on the last action taken.
 * Color shifts with health status (green/amber/red).
 */

import type { GameAction } from "../../engine/types.ts";

type HikerPose = "idle" | "walking" | "camping" | "eating" | "drinking" | "resting" | "mapping" | "medicine";

interface HumanMarkerProps {
  healthPercent: number;
  lastAction: GameAction | null;
}

function actionToPose(action: GameAction | null): HikerPose {
  switch (action) {
    case "push_forward":
    case "descend":
      return "walking";
    case "set_camp":
      return "camping";
    case "eat":
      return "eating";
    case "drink":
      return "drinking";
    case "rest":
      return "resting";
    case "check_map":
      return "mapping";
    case "use_medicine":
      return "medicine";
    default:
      return "idle";
  }
}

function IdlePose({ color }: { color: string }) {
  return (
    <g>
      <circle cx="0" cy="-14" r="3" fill={color} />
      <line x1="0" y1="-11" x2="0" y2="-2" stroke={color} strokeWidth="2" />
      <line x1="0" y1="-8" x2="-4" y2="-4" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-8" x2="4" y2="-4" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-2" x2="-2" y2="5" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-2" x2="2" y2="5" stroke={color} strokeWidth="1.5" />
      <rect x="1" y="-11" width="4" height="6" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
    </g>
  );
}

function WalkingPose({ color }: { color: string }) {
  return (
    <g className="hiker-walking">
      <g transform="scale(-1, 1)">
        <circle cx="0" cy="-14" r="3" fill={color} />
        <line x1="0" y1="-11" x2="1" y2="-2" stroke={color} strokeWidth="2" />
        <line x1="0" y1="-8" x2="-5" y2="-5" stroke={color} strokeWidth="1.5" />
        <line x1="0" y1="-8" x2="3" y2="-3" stroke={color} strokeWidth="1.5" />
        <line x1="-5" y1="-5" x2="-6" y2="5" stroke={color} strokeWidth="1" />
        <line x1="1" y1="-2" x2="-3" y2="5" stroke={color} strokeWidth="1.5" />
        <line x1="1" y1="-2" x2="4" y2="5" stroke={color} strokeWidth="1.5" />
        <rect x="2" y="-11" width="4" height="7" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
      </g>
    </g>
  );
}

function CampingPose({ color }: { color: string }) {
  return (
    <g>
      <circle cx="0" cy="-8" r="3" fill={color} />
      <line x1="0" y1="-5" x2="0" y2="0" stroke={color} strokeWidth="2" />
      <line x1="0" y1="-3" x2="-4" y2="-1" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-3" x2="4" y2="-1" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="-3" y2="3" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="3" y2="3" stroke={color} strokeWidth="1.5" />
      <rect x="5" y="-2" width="3" height="5" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
      <circle cx="-1" cy="4" r="1" fill="var(--amber)" opacity="0.8">
        <animate attributeName="opacity" values="0.8;0.4;0.8" dur="0.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="1" cy="3.5" r="0.8" fill="var(--danger)" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.3;0.6" dur="0.8s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}

function EatingPose({ color }: { color: string }) {
  return (
    <g>
      <circle cx="0" cy="-8" r="3" fill={color} />
      <line x1="0" y1="-5" x2="0" y2="0" stroke={color} strokeWidth="2" />
      <line x1="0" y1="-3" x2="-2" y2="-6" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-3" x2="4" y2="-1" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="-3" y2="3" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="3" y2="3" stroke={color} strokeWidth="1.5" />
      <rect x="5" y="-2" width="3" height="5" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
    </g>
  );
}

function DrinkingPose({ color }: { color: string }) {
  return (
    <g>
      <circle cx="0" cy="-14" r="3" fill={color} />
      <line x1="0" y1="-11" x2="0" y2="-2" stroke={color} strokeWidth="2" />
      <line x1="0" y1="-8" x2="-3" y2="-12" stroke={color} strokeWidth="1.5" />
      <rect x="-4" y="-14" width="2" height="3" rx="0.5" fill="var(--cyan)" stroke={color} strokeWidth="0.5" />
      <line x1="0" y1="-8" x2="4" y2="-4" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-2" x2="-2" y2="5" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-2" x2="2" y2="5" stroke={color} strokeWidth="1.5" />
      <rect x="1" y="-11" width="4" height="6" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
    </g>
  );
}

function RestingPose({ color }: { color: string }) {
  return (
    <g className="hiker-resting">
      <circle cx="-1" cy="-8" r="3" fill={color} />
      <line x1="0" y1="-5" x2="0" y2="0" stroke={color} strokeWidth="2" />
      <line x1="0" y1="-3" x2="-4" y2="0" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-3" x2="4" y2="0" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="-3" y2="4" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="3" y2="4" stroke={color} strokeWidth="1.5" />
      <rect x="3" y="-4" width="4" height="6" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
    </g>
  );
}

function MappingPose({ color }: { color: string }) {
  return (
    <g>
      <circle cx="0" cy="-13" r="3" fill={color} />
      <line x1="0" y1="-10" x2="0" y2="-2" stroke={color} strokeWidth="2" />
      <line x1="0" y1="-7" x2="-5" y2="-7" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-7" x2="5" y2="-7" stroke={color} strokeWidth="1.5" />
      <rect x="-5" y="-9" width="10" height="4" rx="0.5" fill="none" stroke="var(--amber)" strokeWidth="0.8" opacity="0.7" />
      <line x1="0" y1="-2" x2="-2" y2="5" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="-2" x2="2" y2="5" stroke={color} strokeWidth="1.5" />
      <rect x="1" y="-10" width="4" height="6" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
    </g>
  );
}

function MedicinePose({ color }: { color: string }) {
  return (
    <g>
      <circle cx="0" cy="-8" r="3" fill={color} />
      <line x1="0" y1="-5" x2="0" y2="0" stroke={color} strokeWidth="2" />
      <line x1="0" y1="-3" x2="-4" y2="-5" stroke={color} strokeWidth="1.5" />
      <line x1="-5" y1="-5" x2="-3" y2="-5" stroke="var(--danger)" strokeWidth="1" />
      <line x1="-4" y1="-6" x2="-4" y2="-4" stroke="var(--danger)" strokeWidth="1" />
      <line x1="0" y1="-3" x2="4" y2="-1" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="-3" y2="3" stroke={color} strokeWidth="1.5" />
      <line x1="-3" y1="3" x2="-1" y2="5" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="3" y2="5" stroke={color} strokeWidth="1.5" />
      <rect x="4" y="-3" width="3" height="5" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
    </g>
  );
}

export function HumanMarker({ healthPercent, lastAction }: HumanMarkerProps) {
  const color =
    healthPercent > 60 ? "var(--neon-green)" :
    healthPercent > 30 ? "var(--amber)" :
    "var(--danger)";

  const pose = actionToPose(lastAction);

  return (
    <g className="human-marker">

      {pose === "idle" && <IdlePose color={color} />}
      {pose === "walking" && <WalkingPose color={color} />}
      {pose === "camping" && <CampingPose color={color} />}
      {pose === "eating" && <EatingPose color={color} />}
      {pose === "drinking" && <DrinkingPose color={color} />}
      {pose === "resting" && <RestingPose color={color} />}
      {pose === "mapping" && <MappingPose color={color} />}
      {pose === "medicine" && <MedicinePose color={color} />}

      {/* Pulsing glow */}
      <circle cx="0" cy="-3" r="8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.3">
        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}
