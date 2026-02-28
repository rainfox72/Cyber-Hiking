/**
 * OllamaPoller component — periodically checks Ollama health and updates connection status.
 */

import { useEffect } from "react";
import { useGameStore } from "../../store/gameStore.ts";
import { checkOllamaHealth } from "../../services/ollamaService.ts";

export function OllamaPoller() {
  const setOllamaConnected = useGameStore((s) => s.setOllamaConnected);
  useEffect(() => {
    const poll = () => {
      checkOllamaHealth().then(setOllamaConnected);
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [setOllamaConnected]);
  return null;
}
