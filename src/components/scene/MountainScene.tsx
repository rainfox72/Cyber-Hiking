import React, { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../store/gameStore";
import {
  getTerrainBand,
  TERRAIN_PROFILES,
  type RidgePoints,
  type TerrainBandName,
  type TerrainProfile,
} from "../../data/terrainProfiles";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SHIFT = 150;
const PARALLAX_FACTOR: Record<number, number> = {
  1: 1.0,
  2: 0.7,
  3: 0.45,
  4: 0.25,
  5: 0.1,
};

const LAYER_OPACITY: Record<number, [number, number]> = {
  5: [0.15, 0.25],
  4: [0.25, 0.35],
  3: [0.40, 0.55],
  2: [0.55, 0.70],
  1: [0.70, 0.85],
};

const STORM_WEATHERS = new Set([
  "cloudy",
  "fog",
  "rain",
  "snow",
  "wind",
  "blizzard",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ridgeToPath(points: RidgePoints): string {
  const scaled = points.map(([x, y]) => `${x * 1000},${y * 600}`);
  return `M 0,600 L ${scaled.join(" L ")} L 1000,600 Z`;
}

function getColorSet(
  profile: TerrainProfile,
  timeOfDay: string,
  weather: string,
): string[] {
  if (STORM_WEATHERS.has(weather)) return profile.colors.storm;
  if (timeOfDay === "dawn") return profile.colors.dawn;
  if (timeOfDay === "night" || timeOfDay === "dusk") return profile.colors.night;
  return profile.colors.base;
}

/** Pick opacity from the layer's range. Storm weather dims; dawn/dusk use lower end. */
function getLayerOpacity(
  layer: number,
  timeOfDay: string,
  weather: string,
): number {
  const [lo, hi] = LAYER_OPACITY[layer];
  if (STORM_WEATHERS.has(weather)) return lo;
  if (timeOfDay === "night") return lo;
  if (timeOfDay === "dawn" || timeOfDay === "dusk") return (lo + hi) / 2;
  return hi;
}

// ---------------------------------------------------------------------------
// Sub-component: one terrain band rendered as 5 SVG paths
// ---------------------------------------------------------------------------

interface BandLayersProps {
  profile: TerrainProfile;
  waypointIndex: number;
  timeOfDay: string;
  weather: string;
  opacity: number; // overall band opacity for crossfade
}

const BandLayers: React.FC<BandLayersProps> = ({
  profile,
  waypointIndex,
  timeOfDay,
  weather,
  opacity,
}) => {
  const colors = getColorSet(profile, timeOfDay, weather);

  // Render layers 5 (farthest) to 1 (nearest) so nearer layers paint over
  return (
    <g
      style={{
        opacity,
        transition: "opacity 1.5s ease",
      }}
    >
      {([5, 4, 3, 2, 1] as const).map((layerNum) => {
        const offset =
          (waypointIndex / 12) * MAX_SHIFT * PARALLAX_FACTOR[layerNum];
        const layerOpacity = getLayerOpacity(layerNum, timeOfDay, weather);

        return (
          <path
            key={layerNum}
            d={ridgeToPath(profile.layers[layerNum])}
            fill={colors[layerNum - 1]}
            opacity={layerOpacity}
            style={{
              transform: `translateX(${offset}px)`,
              transition: "opacity 1.5s ease, fill 2s ease",
            }}
          />
        );
      })}
    </g>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const MountainScene: React.FC = () => {
  const waypointIndex = useGameStore((s) => s.player.currentWaypointIndex);
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const weather = useGameStore((s) => s.weather.current);

  const currentBand = getTerrainBand(waypointIndex);
  const [previousBand, setPreviousBand] = useState<TerrainBandName | null>(
    null,
  );
  const [fadingOut, setFadingOut] = useState(false);
  const prevBandRef = useRef<TerrainBandName>(currentBand);

  // Detect band transitions and trigger crossfade
  useEffect(() => {
    if (currentBand !== prevBandRef.current) {
      setPreviousBand(prevBandRef.current);
      setFadingOut(true);
      prevBandRef.current = currentBand;

      // After the crossfade completes, remove the old band
      const timer = setTimeout(() => {
        setFadingOut(false);
        setPreviousBand(null);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [currentBand]);

  const currentProfile = TERRAIN_PROFILES[currentBand];

  return (
    <div className="mountain-layer">
      <svg
        viewBox="0 0 1000 600"
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        {/* Outgoing band (fading out during crossfade) */}
        {previousBand && fadingOut && (
          <BandLayers
            profile={TERRAIN_PROFILES[previousBand]}
            waypointIndex={waypointIndex}
            timeOfDay={timeOfDay}
            weather={weather}
            opacity={0}
          />
        )}

        {/* Current band */}
        <BandLayers
          profile={currentProfile}
          waypointIndex={waypointIndex}
          timeOfDay={timeOfDay}
          weather={weather}
          opacity={1}
        />
      </svg>
    </div>
  );
};

export default MountainScene;
