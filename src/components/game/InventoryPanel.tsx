/**
 * InventoryPanel component — displays the player's carried supplies (food, water, gear, medicine).
 */

import { useGameStore } from "../../store/gameStore.ts";
import { vitalColor } from "./VitalBar.tsx";

export function InventoryPanel() {
  const food = useGameStore((s) => s.player.food);
  const water = useGameStore((s) => s.player.water);
  const gear = useGameStore((s) => s.player.gear);
  const medicine = useGameStore((s) => s.player.medicine);
  const isLost = useGameStore((s) => s.player.isLost);
  const hasFallInjury = useGameStore((s) => s.player.statusEffects.some(e => e.id === "fall_injury"));

  const foodColor = food <= 0 ? "var(--hazard-red)" : food <= 2 ? "var(--amber)" : undefined;
  const waterColor = water <= 0 ? "var(--hazard-red)" : water <= 1 ? "var(--amber)" : undefined;

  return (
    <div className="inventory-grid">
      {isLost && (
        <div className="inventory-item" style={{
          gridColumn: "1 / -1",
          color: "var(--hazard-red)",
          textAlign: "center",
          fontSize: "10px",
          letterSpacing: "1px",
        }}>
          ⚠ LOST
        </div>
      )}
      {hasFallInjury && (
        <div className="inventory-item" style={{
          gridColumn: "1 / -1",
          color: "var(--amber)",
          textAlign: "center",
          fontSize: "10px",
          letterSpacing: "1px",
        }}>
          🩹 FALL INJURY
        </div>
      )}
      <div className="inventory-item">
        <span className="inventory-item__label">Food</span>
        <span className="inventory-item__value" style={foodColor ? { color: foodColor } : undefined}>
          {food}{food <= 0 ? " [STARVING]" : ""}
        </span>
      </div>
      <div className="inventory-item">
        <span className="inventory-item__label">Water</span>
        <span className="inventory-item__value" style={waterColor ? { color: waterColor } : undefined}>
          {water.toFixed(1)}L{water <= 0 ? " [DEHYDRATED]" : ""}
        </span>
      </div>
      <div className="inventory-item">
        <span className="inventory-item__label">Gear</span>
        <span className="inventory-item__value" style={{ color: vitalColor(gear) }}>{Math.round(gear)}%</span>
      </div>
      <div className="inventory-item">
        <span className="inventory-item__label">Medicine</span>
        <span className="inventory-item__value">{medicine}</span>
      </div>
    </div>
  );
}
