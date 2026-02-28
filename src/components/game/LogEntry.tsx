/**
 * LogEntryComponent — renders a single log entry with optional typewriter animation.
 */

import { useTypewriter } from "../../hooks/useTypewriter.ts";
import type { LogEntry as LogEntryType } from "../../engine/types.ts";

export function LogEntryComponent({ entry, isLatestNarrative }: { entry: LogEntryType; isLatestNarrative?: boolean }) {
  const { displayed, isComplete } = useTypewriter(
    isLatestNarrative ? entry.text : "",
    20,
  );

  const text = isLatestNarrative && !isComplete ? displayed : entry.text;

  return (
    <div className={`log-entry log-entry--${entry.type}`}>
      <span className="log-entry__timestamp">[{entry.timestamp}]</span>{" "}
      {text}
      {isLatestNarrative && !isComplete && <span className="cursor-blink">_</span>}
    </div>
  );
}
