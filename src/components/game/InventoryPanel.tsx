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
  return (
    <div className="inventory-grid">
      <div className="inventory-item">
        <span className="inventory-item__label">Food</span>
        <span className="inventory-item__value">{food}</span>
      </div>
      <div className="inventory-item">
        <span className="inventory-item__label">Water</span>
        <span className="inventory-item__value">{water.toFixed(1)}L</span>
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
