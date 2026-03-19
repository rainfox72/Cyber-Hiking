/**
 * VitalBar component — displays a labeled progress bar for player vitals.
 * Also exports clamp() and vitalColor() utilities used by other components.
 */

export function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function vitalColor(value: number): string {
  if (value > 60) return "var(--tactical-green-bright)";
  if (value > 30) return "var(--amber)";
  if (value > 15) return "var(--hazard-red)";
  return "var(--critical-red)";
}

function vitalDangerClass(value: number): string {
  if (value < 15) return "vital-bar--critical-intense";
  if (value < 30) return "vital-bar--critical";
  return "";
}

export function VitalBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const c = color ?? vitalColor(value);
  const dangerClass = color ? "" : vitalDangerClass(value);
  return (
    <div className={`vital-bar ${dangerClass}`}>
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
