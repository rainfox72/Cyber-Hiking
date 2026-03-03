/**
 * LogEntryComponent — renders a single log entry with optional typewriter animation.
 * AI entries get special typography with highlighted action names.
 */

import { useTypewriter } from "../../hooks/useTypewriter.ts";
import type { LogEntry as LogEntryType } from "../../engine/types.ts";

/** Renders AI log entries with highlighted action name */
function AILogText({ text }: { text: string }) {
  // Format: "[AI: ACTION_NAME] reasoning text"
  const match = text.match(/^\[AI:\s*([A-Z_ ]+)\]\s*(.*)$/);
  if (match) {
    const [, actionName, reasoning] = match;
    return (
      <>
        <span className="log-entry__ai-prefix">{">"} AI DECIDED TO </span>
        <span className="log-entry__ai-action">{actionName}</span>
        <span className="log-entry__ai-reasoning"> — {reasoning}</span>
      </>
    );
  }
  // Fallback: old format "[AI] reasoning"
  return <>{text}</>;
}

export function LogEntryComponent({ entry, isLatestNarrative }: { entry: LogEntryType; isLatestNarrative?: boolean }) {
  const { displayed, isComplete } = useTypewriter(
    isLatestNarrative ? entry.text : "",
    20,
  );

  const text = isLatestNarrative && !isComplete ? displayed : entry.text;

  // Special rendering for AI entries
  if (entry.type === "ai") {
    return (
      <div className="log-entry log-entry--ai">
        <span className="log-entry__timestamp">[{entry.timestamp}]</span>{" "}
        <AILogText text={entry.text} />
      </div>
    );
  }

  return (
    <div className={`log-entry log-entry--${entry.type}`}>
      <span className="log-entry__timestamp">[{entry.timestamp}]</span>{" "}
      {text}
      {isLatestNarrative && !isComplete && <span className="cursor-blink">_</span>}
    </div>
  );
}
