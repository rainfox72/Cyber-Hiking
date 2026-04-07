/**
 * VitalBar component — displays a labeled progress bar for player vitals.
 * Also exports clamp() and vitalColor() utilities used by other components.
 */

// eslint-disable-next-line react-refresh/only-export-components
export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// eslint-disable-next-line react-refresh/only-export-components
export function vitalColor(value: number): string {
  if (value > 60) return "var(--neon-green)";
  if (value > 30) return "var(--amber)";
  return "var(--danger)";
}

export function VitalBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color ?? vitalColor(value);
  const isCritical = value < 30;
  return (
    <div className={`vital-bar ${isCritical ? "vital-bar--critical" : ""}`}>
      <div className="vital-bar__label">
        <span className="vital-bar__label-name">{label}</span>
        <span className="vital-bar__label-value" style={{ color: c }}>{Math.round(value)}%</span>
      </div>
      <div className="vital-bar__track">
        <div className="vital-bar__fill" style={{ width: `${clamp(value, 0, 100)}%`, backgroundColor: c }} />
      </div>
    </div>
  );
}
