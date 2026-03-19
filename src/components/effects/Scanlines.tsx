/**
 * CRT scanline overlay effect. Pure CSS, no game logic.
 */

const scanlineStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  zIndex: 5,
  background: `repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.02) 2px,
    rgba(0, 0, 0, 0.02) 4px
  )`,
};

const sweepStyle: React.CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "3px",
  background: "rgba(61, 139, 55, 0.015)",
  animation: "scanline-sweep 8s linear infinite",
};

export function Scanlines() {
  return (
    <div style={scanlineStyle}>
      <div style={sweepStyle} />
      <style>{`
        @keyframes scanline-sweep {
          0% { top: -3px; }
          100% { top: 100%; }
        }
      `}</style>
    </div>
  );
}
