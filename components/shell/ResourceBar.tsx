'use client';

import { useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import type { SpriteName } from '@/lib/pixel/sprites';
import type { FortressResources } from '@/lib/types';

const RESOURCES: { key: keyof FortressResources; label: string; icon: SpriteName }[] = [
  { key: 'food', label: 'Food', icon: 'icon_food' },
  { key: 'ale', label: 'Ale', icon: 'icon_ale' },
  { key: 'stone', label: 'Stone', icon: 'icon_stone' },
  { key: 'wood', label: 'Wood', icon: 'icon_wood' },
  { key: 'ironOre', label: 'Iron ore', icon: 'icon_iron' },
  { key: 'steelBars', label: 'Steel', icon: 'icon_steel' },
  { key: 'wealth', label: 'Wealth', icon: 'icon_wealth' },
];

/** A counter that hops up or dips down when its value changes. */
function Counter({ icon, label, value, low = false }: { icon: SpriteName; label: string; value: number; low?: boolean }) {
  const [track, setTrack] = useState<{ value: number; dir: 'up' | 'down' | undefined }>({ value, dir: undefined });
  if (track.value !== value) setTrack({ value, dir: value > track.value ? 'up' : 'down' });
  return (
    <span className="resource" data-low={low || undefined} data-bump={track.dir} title={low ? `${label} is running low` : label}>
      <PixelIcon name={icon} scale={2} />
      <span className="sr-only">{label}</span>
      <strong key={value}>{value.toLocaleString()}</strong>
      {low && <span className="sr-only">(low)</span>}
    </span>
  );
}

export default function ResourceBar({ className = '' }: { className?: string }) {
  const { gameState: state } = useGame();
  return (
    <div className={`resource-bar ${className}`} role="group" aria-label="Fortress supplies">
      <Counter icon="icon_population" label="Dwarves" value={state.dwarves.length} />
      {RESOURCES.map(({ key, label, icon }) => (
        <Counter key={key} icon={icon} label={label} value={state.resources[key]}
          low={(key === 'food' || key === 'ale') && state.resources[key] < state.dwarves.length * 2} />
      ))}
    </div>
  );
}
