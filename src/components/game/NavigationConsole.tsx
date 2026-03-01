/**
 * NavigationConsole component — panel containing all available player action buttons.
 */

import { ActionButton } from "./ActionButton.tsx";
import type { GameAction } from "../../engine/types.ts";

export const ACTION_CONFIG: { action: GameAction; label: string; cost: string }[] = [
  { action: "push_forward", label: "PUSH FORWARD", cost: "3-5h | Advance (drains all vitals)" },
  { action: "set_camp", label: "SET CAMP", cost: "4h day / until-dawn night | Major recovery" },
  { action: "descend", label: "DESCEND", cost: "2h | Retreat to prev waypoint" },
  { action: "check_map", label: "CHECK MAP", cost: "1h | Navigation aid (reduces getting lost)" },
  { action: "rest", label: "REST", cost: "2h | Recovery / wait out weather" },
  { action: "eat", label: "EAT RATION", cost: "0.5h | Energy +25, Morale +5" },
  { action: "drink", label: "DRINK WATER", cost: "0.5h | Hydration +30, Morale +3" },
  { action: "use_medicine", label: "USE MEDICINE", cost: "0.5h | O2 +15, Temp normalize" },
];

export function NavigationConsole() {
  return (
    <div className="panel">
      <div className="panel-header">NAVIGATION CONSOLE</div>
      {ACTION_CONFIG.map((cfg) => (
        <ActionButton key={cfg.action} {...cfg} />
      ))}
    </div>
  );
}
