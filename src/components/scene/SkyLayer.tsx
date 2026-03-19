import React from "react";
import { useGameStore } from "../../store/gameStore";
import { getSkyGradient } from "../../data/terrainProfiles";

const SkyLayer: React.FC = () => {
  const timeOfDay = useGameStore((s) => s.time.timeOfDay);
  const weather = useGameStore((s) => s.weather.current);
  const gradient = getSkyGradient(timeOfDay, weather);

  return (
    <div
      className="sky-layer"
      style={{ background: gradient, transition: "background 2.5s ease" }}
    />
  );
};

export default SkyLayer;
