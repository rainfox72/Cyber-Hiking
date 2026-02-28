/**
 * Animated SVG hiking figure marker for the TacticalMap.
 * Bobs up and down, color shifts with health status.
 */

interface HumanMarkerProps {
  x: number;
  y: number;
  healthPercent: number; // 0-100, average of vitals
}

export function HumanMarker({ x, y, healthPercent }: HumanMarkerProps) {
  const color =
    healthPercent > 60 ? "var(--neon-green)" :
    healthPercent > 30 ? "var(--amber)" :
    "var(--danger)";

  return (
    <g
      className="human-marker"
      transform={`translate(${x}, ${y})`}
      style={{ transition: "transform 1.2s ease-in-out" }}
    >
      {/* Head */}
      <circle cx="0" cy="-12" r="3" fill={color} />
      {/* Body */}
      <line x1="0" y1="-9" x2="0" y2="0" stroke={color} strokeWidth="2" />
      {/* Arms */}
      <line x1="-4" y1="-6" x2="4" y2="-6" stroke={color} strokeWidth="1.5" />
      {/* Legs */}
      <line x1="0" y1="0" x2="-3" y2="6" stroke={color} strokeWidth="1.5" />
      <line x1="0" y1="0" x2="3" y2="6" stroke={color} strokeWidth="1.5" />
      {/* Backpack */}
      <rect x="1" y="-9" width="3" height="5" rx="0.5" fill="none" stroke={color} strokeWidth="1" />
      {/* Pulsing glow */}
      <circle cx="0" cy="-3" r="8" fill="none" stroke={color} strokeWidth="0.5" opacity="0.4">
        <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.4;0.1;0.4" dur="2s" repeatCount="indefinite" />
      </circle>
    </g>
  );
}
