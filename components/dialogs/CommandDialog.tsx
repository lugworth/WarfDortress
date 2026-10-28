'use client';

import { useMemo, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { useUI } from '@/components/UIProvider';
import { HOTKEYS, ToolGlyph } from '@/components/map/MapCards';
import { PixelDialog } from '@/components/pixel/PixelDialog';
import { getConstructionCost } from '@/lib/game-engine';
import { TOOLS, formatCost } from '@/lib/tool-catalog';

/** Search every map order by name, purpose, or group. */
export default function CommandDialog({ onChosen }: { onChosen: () => void }) {
  const { overlay, closeOverlay } = useUI();
  const { progression, setSelectedTool, setInspectMode } = useGame();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const unlocks = useMemo(() => new Map(progression.buildingUnlocks.map((u) => [u.tool, u])), [progression.buildingUnlocks]);
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return TOOLS.filter((t) => `${t.label} ${t.desc} ${t.group}`.toLowerCase().includes(q));
  }, [query]);
  const active = Math.min(selected, Math.max(0, results.length - 1));

  const choose = (index: number) => {
    const tool = results[index];
    if (!tool || unlocks.get(tool.id)?.unlocked === false) return;
    setSelectedTool(tool.id);
    setInspectMode(false);
    closeOverlay();
    onChosen();
    requestAnimationFrame(() => document.querySelector<HTMLCanvasElement>('[data-testid="pixel-map-canvas"]')?.focus());
  };

  return (
    <PixelDialog open={overlay === 'commands'} onClose={closeOverlay} title="Find a command" icon="icon_inspect" width={620} subtitle="↑ ↓ to choose · Enter to select · Esc to close · Clock paused">
      <input
        data-autofocus
        className="px-input"
        style={{ width: '100%' }}
        value={query}
        role="combobox"
        aria-expanded="true"
        aria-controls="command-results"
        aria-activedescendant={results[active] ? `command-${results[active].id}` : undefined}
        aria-label="Search commands"
        placeholder="Try mine, ale, defense…"
        onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % (results.length || 1);
            setSelected(next);
            document.getElementById(`command-${results[next]?.id}`)?.scrollIntoView({ block: 'nearest' });
          } else if (e.key === 'Enter') {
            e.preventDefault();
            choose(active);
          }
        }}
      />
      <ul id="command-results" role="listbox" aria-label="Matching commands" className="command-list">
        {results.map((tool, i) => {
          const unlock = unlocks.get(tool.id);
          const locked = unlock?.unlocked === false;
          return (
            <li key={tool.id} id={`command-${tool.id}`} role="option" aria-selected={i === active} aria-disabled={locked || undefined}
              className="command-item" onPointerMove={() => setSelected(i)} onClick={() => choose(i)}>
              <ToolGlyph tool={tool.id} locked={locked} />
              <span className="min-w-0" style={{ flex: 1 }}>
                <strong>{tool.label}</strong>
                <small className="px-info" style={{ display: 'block' }}>{tool.group} · {formatCost(getConstructionCost(tool.id))}{locked && unlock ? ` · locked: ${unlock.requirementLabel}` : ''}</small>
                <small className="px-muted" style={{ display: 'block' }}>{tool.desc}</small>
              </span>
              {HOTKEYS[tool.id] && <kbd className="px-kbd">{HOTKEYS[tool.id]}</kbd>}
            </li>
          );
        })}
        {results.length === 0 && <li className="px-dim" role="status">No matching commands. Try a building or resource name.</li>}
      </ul>
    </PixelDialog>
  );
}
