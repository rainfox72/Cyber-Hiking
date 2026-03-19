/**
 * VisualStateBridge — sole Zustand subscriber for visual state.
 * Writes derived VisualState to a shared ref distributed via React context.
 * All atmosphere/scene children read from the ref in useFrame, zero re-renders.
 */

import { createContext, useContext, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../../store/gameStore.ts';
import { deriveVisualState } from '../../store/visualState.ts';
import type { VisualState } from '../../store/visualState.ts';

const defaultState: VisualState = deriveVisualState(0, 'night', 'clear', 0.5);

const VisualStateContext = createContext<React.MutableRefObject<VisualState>>(
  { current: defaultState } as React.MutableRefObject<VisualState>
);

export function useVisualState(): React.MutableRefObject<VisualState> {
  return useContext(VisualStateContext);
}

function VisualStateUpdater({ stateRef }: { stateRef: React.MutableRefObject<VisualState> }) {
  const waypointIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const weather = useGameStore((s) => s.weather.current);
  const intensity = useGameStore((s) => s.weather.intensity);

  useFrame(() => {
    stateRef.current = deriveVisualState(waypointIndex, timeOfDay, weather, intensity);
  });

  return null;
}

export function VisualStateBridge({ children }: { children: ReactNode }) {
  // Initialize with real store values to avoid one-frame stale default
  const store = useGameStore.getState();
  const stateRef = useRef<VisualState>(
    deriveVisualState(
      store.player.currentWaypointIndex,
      store.time.timeOfDay,
      store.weather.current,
      store.weather.intensity,
    )
  );

  return (
    <VisualStateContext.Provider value={stateRef}>
      <VisualStateUpdater stateRef={stateRef} />
      {children}
    </VisualStateContext.Provider>
  );
}
