/**
 * SceneAlerts — 3D text warnings displayed in the scene near the hiker.
 *
 * Shows alerts like "OFF TRAIL", "BLIZZARD WARNING", "FALL!", "NIGHT TRAVEL"
 * as billboard text in 3D space. Since the map is now the main console,
 * critical game events need to be visible directly in the scene.
 *
 * Uses drei Html component for crisp DOM text positioned in 3D space.
 */

import { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useGameStore } from '../../store/gameStore.ts';
import { useVisualState } from './VisualStateBridge.tsx';

interface Alert {
  id: number;
  text: string;
  color: string;
  born: number;
  duration: number;
}

let alertIdCounter = 0;

export function SceneAlerts({ hikerPosRef }: { hikerPosRef: { current: THREE.Vector3 } }) {
  const isLost = useGameStore((s) => s.player.isLost);
  const lastAction = useGameStore((s) => s.lastAction);
  const lastVisualEvent = useGameStore((s) => s.lastVisualEvent);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const lastEvents = useGameStore((s) => s.lastEvents);
  const vsRef = useVisualState();

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const prevLostRef = useRef(false);
  const prevEventTimestamp = useRef(0);
  const prevActionRef = useRef(lastAction);
  const prevEventsLenRef = useRef(0);

  // Push a new alert
  function pushAlert(text: string, color: string, duration = 3) {
    setAlerts((prev) => [
      ...prev.slice(-1), // keep max 2 alerts
      { id: ++alertIdCounter, text, color, born: performance.now() / 1000, duration },
    ]);
  }

  // Lost state
  useEffect(() => {
    if (isLost && !prevLostRef.current) {
      pushAlert('⚠ OFF TRAIL', '#ff4444', 5);
    } else if (!isLost && prevLostRef.current) {
      pushAlert('✓ TRAIL FOUND', '#00ff41', 2.5);
    }
    prevLostRef.current = isLost;
  }, [isLost]);

  // Visual events (fall, weather change)
  useEffect(() => {
    if (!lastVisualEvent || lastVisualEvent.timestamp === prevEventTimestamp.current) return;
    prevEventTimestamp.current = lastVisualEvent.timestamp;

    switch (lastVisualEvent.type) {
      case 'fall':
        pushAlert('⚠ FALL!', '#ff4444', 3);
        break;
      case 'weather_change': {
        const w = vsRef.current.weather;
        if (w === 'blizzard') pushAlert('⚠ BLIZZARD', '#ff8800', 4);
        else if (w === 'snow') pushAlert('SNOWFALL', '#aaccff', 3);
        else if (w === 'fog') pushAlert('FOG CLOSING IN', '#888888', 3);
        else if (w === 'wind') pushAlert('HIGH WINDS', '#ccaa66', 3);
        else if (w === 'rain') pushAlert('RAIN', '#6688aa', 2);
        break;
      }
    }
  }, [lastVisualEvent, vsRef]);

  // Night travel warning
  useEffect(() => {
    if (lastAction === 'push_forward' && (timeOfDay === 'night' || timeOfDay === 'dusk')) {
      if (prevActionRef.current !== lastAction) {
        pushAlert('NIGHT TRAVEL', '#ffb000', 2.5);
      }
    }
    prevActionRef.current = lastAction;
  }, [lastAction, timeOfDay]);

  // Critical game events (from engine)
  useEffect(() => {
    if (lastEvents.length > prevEventsLenRef.current) {
      for (let i = prevEventsLenRef.current; i < lastEvents.length; i++) {
        const evt = lastEvents[i];
        if (evt.severity === 'critical' || evt.severity === 'major') {
          pushAlert(`⚠ ${evt.name.toUpperCase()}`, '#ff4444', 4);
        }
      }
    }
    prevEventsLenRef.current = lastEvents.length;
  }, [lastEvents]);

  // Sustained lost indicator
  const showLostIndicator = isLost;

  // Clean up expired alerts
  useFrame(({ clock }) => {
    const now = clock.elapsedTime;
    setAlerts((prev) => prev.filter((a) => now - a.born < a.duration));
  });

  const pos = hikerPosRef.current;

  return (
    <>
      {/* Sustained lost indicator — highest position */}
      {showLostIndicator && (
        <Html
          position={[pos.x, pos.y + 1.0, pos.z]}
          center
          style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
        >
          <div style={{
            color: '#ff4444',
            fontSize: '14px',
            fontFamily: "'Courier New', monospace",
            fontWeight: 'bold',
            letterSpacing: '3px',
            textShadow: '0 0 8px rgba(255, 68, 68, 0.6)',
            animation: 'pulse-alert 1.5s ease-in-out infinite',
          }}>
            ⚠ OFF TRAIL — FIND WAY BACK
          </div>
        </Html>
      )}

      {/* Transient alerts — below sustained, stacked downward */}
      {alerts.map((alert, i) => {
        const baseY = showLostIndicator ? 0.7 : 0.9;
        return (
          <Html
            key={alert.id}
            position={[pos.x, pos.y + baseY - i * 0.2, pos.z]}
            center
            style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
          >
            <div style={{
              color: alert.color,
              fontSize: '12px',
              fontFamily: "'Courier New', monospace",
              fontWeight: 'bold',
              letterSpacing: '2px',
              textShadow: `0 0 6px ${alert.color}40`,
              opacity: 1,
              animation: 'fade-up-alert 0.5s ease-out',
            }}>
              {alert.text}
            </div>
          </Html>
        );
      })}
    </>
  );
}
