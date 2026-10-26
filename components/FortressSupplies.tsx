'use client';

import { useGame } from './GameProvider';
import { getCurrentWeather } from '@/lib/weather';
import type { FortressResources } from '@/lib/types';

const resources: { key: keyof FortressResources; label: string; color?: string }[] = [
  { key: 'food', label: 'Food' }, { key: 'ale', label: 'Ale', color: '#cc00ff' },
  { key: 'stone', label: 'Stone' }, { key: 'wood', label: 'Wood', color: '#ff9900' },
  { key: 'ironOre', label: 'Iron', color: '#ff9900' }, { key: 'steelBars', label: 'Steel', color: '#00ffff' },
  { key: 'wealth', label: 'Wealth', color: '#ff0099' },
];

export default function FortressSupplies() {
  const { gameState: state } = useGame();
  const weather = getCurrentWeather(state);
  return (
      <div className="map-resource-row" role="group" aria-label="Fortress supplies">
        <span className="population-stat" title="Dwarf population">☺ <strong>{state.dwarves.length}</strong></span>
        {resources.map(({ key, label, color }) => {
          const low = (key === 'food' || key === 'ale') && state.resources[key] < state.dwarves.length * 2;
          return <span key={key} className={`resource-stat${low ? ' resource-low' : ''}`} title={low ? `${label} supplies are low` : label}>
            <span>{label}</span><strong style={low ? undefined : { color }}>{state.resources[key]}</strong>{low && <span aria-label="Low supplies">!</span>}
          </span>;
        })}
        <span className="resource-weather" style={{ color: weather.color }} title={weather.summary}>{weather.glyph} {weather.shortLabel} {weather.surfaceTempF}°F</span>
      </div>
  );
}
