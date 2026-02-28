/**
 * LogWindow component — scrollable container for game log entries with auto-scroll.
 */

import { useRef, useEffect } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { LogEntryComponent } from "./LogEntry.tsx";

export function LogWindow() {
  const log = useGameStore((s) => s.log);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log.length]);
  return (
    <div className="log-window" ref={scrollRef}>
      {log.length === 0 && (
        <>
          <div className="log-entry log-entry--system">
            <span className="log-entry__timestamp">[SYS]</span>{" "}
            AO TAI TACTICAL SYSTEM initialized. Awaiting operator input.
          </div>
          <div className="log-entry log-entry--system">
            <span className="log-entry__timestamp">[SYS]</span>{" "}
            Route loaded: 塘口 → 拔仙台 | 80km | 13 waypoints
          </div>
        </>
      )}
      {log.map((entry, i) => {
        const isLatestNarrative = entry.type === "narrative" && i === log.length - 1;
        return (
          <LogEntryComponent
            key={`${entry.turnNumber}-${i}`}
            entry={entry}
            isLatestNarrative={isLatestNarrative}
          />
        );
      })}
    </div>
  );
}
