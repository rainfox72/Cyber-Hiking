/**
 * CRT scanline overlay effect. Pure CSS, no game logic.
 */

const scanlineStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 9999,
  background: `repeating-linear-gradient(
    0deg,
    transparent,
    transparent 2px,
    rgba(0, 0, 0, 0.06) 2px,
    rgba(0, 0, 0, 0.06) 4px
  )`,
};

const sweepStyle: React.CSSProperties = {
  position: "absolute",
  width: "100%",
  height: "3px",
  background: "rgba(0, 255, 65, 0.04)",
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
