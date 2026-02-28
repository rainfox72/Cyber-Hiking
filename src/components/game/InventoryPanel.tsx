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

  const foodColor = food <= 0 ? "var(--danger)" : food <= 2 ? "var(--amber)" : undefined;
  const waterColor = water <= 0 ? "var(--danger)" : water <= 1 ? "var(--amber)" : undefined;

  return (
    <div className="inventory-grid">
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
