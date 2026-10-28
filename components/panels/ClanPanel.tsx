'use client';

import { useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { DwarfPortrait } from '@/components/map/MapCards';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';
import { playTactileSfx } from '@/lib/audio';
import { QUIRKS } from '@/lib/guild';
import { ensureMilitiaState } from '@/lib/militia';
import type { SpriteName } from '@/lib/pixel/sprites';
import { getSentimentBadge } from '@/lib/thoughts';
import type { DwarfEntity, DwarfLabor, LaborPresetId, MilitiaDoctrine, MilitiaSquadId } from '@/lib/types';

const LABORS: { id: DwarfLabor; label: string; icon: SpriteName }[] = [
  { id: 'MINING', label: 'Mining', icon: 'icon_mine' },
  { id: 'WOODCUTTING', label: 'Woodcutting', icon: 'icon_chop' },
  { id: 'MASONRY', label: 'Masonry', icon: 'icon_stone' },
  { id: 'CARPENTRY', label: 'Carpentry', icon: 'icon_wood' },
  { id: 'FARMING', label: 'Farming', icon: 'icon_food' },
  { id: 'SMITHING', label: 'Smithing', icon: 'icon_hammer' },
  { id: 'COMBAT', label: 'Combat', icon: 'icon_sword' },
  { id: 'HAULING', label: 'Hauling', icon: 'icon_barrel' },
];

const PRESETS: { id: LaborPresetId; label: string; icon: SpriteName }[] = [
  { id: 'ALL_HANDS', label: 'All hands', icon: 'icon_clan' },
  { id: 'MINING_DELVE', label: 'Miners', icon: 'icon_mine' },
  { id: 'SMITH_FORTIFY', label: 'Smiths', icon: 'icon_hammer' },
  { id: 'HARVEST_BREW', label: 'Farmers', icon: 'icon_food' },
];

const DOCTRINES: { id: MilitiaDoctrine; label: string }[] = [
  { id: 'DEFENSIVE', label: 'Defend' },
  { id: 'PATROL', label: 'Patrol' },
  { id: 'SALLY_FORTH', label: 'Sally' },
];

const SENTIMENT_CLASS: Record<string, string> = {
  EUPHORIC: 'px-info',
  POSITIVE: 'px-good',
  NEUTRAL: 'px-muted',
  NEGATIVE: 'px-ember',
  TERRIFIED: 'px-bad',
};

function stateLabel(state: string) {
  return state.toLowerCase().replace(/_/g, ' ');
}

function Militia() {
  const { gameState, currentZ, selectedTool, setSelectedTool, setInspectMode, setMilitiaDoctrine, triggerGoblinRaid, jumpToLocation, dispatchMilitiaAction, triggerAIRaidAnalysis } = useGame();
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const militia = ensureMilitiaState(gameState);
  const squads = Object.values(militia.squads);
  const active = militia.squads[militia.activeSquadId] || squads[0];
  const members = gameState.dwarves.filter((d) => d.squadId === active.id || active.memberIds.includes(d.id));
  const slain = militia.battleLog.filter((b) => b.outcome === 'VANQUISHED' || b.outcome === 'TRAP_CRUSH').length;
  const cx = Math.floor(gameState.world.width / 2);
  const cy = Math.floor(gameState.world.height / 2);
  const run = (action: Parameters<typeof dispatchMilitiaAction>[0], sound: 'tool' | 'stamp' = 'stamp') => {
    playTactileSfx(sound);
    setStatus(dispatchMilitiaAction(action).message);
  };
  const pickTool = (tool: 'MILITIA_STATION' | 'MILITIA_PATROL') => {
    playTactileSfx('tool');
    setInspectMode(false);
    setSelectedTool(tool);
    setStatus(`${tool === 'MILITIA_STATION' ? 'Station' : 'Patrol'} tool selected for ${active.callsign}: ${tool === 'MILITIA_STATION' ? 'select a tile' : 'drag a route'} on the map.`);
  };

  return (
    <details className="px-card" data-tone="red" data-testid="militia-command-panel" open={gameState.hostiles.length > 0 || undefined}>
      <summary className="px-row px-row--between">
        <span className="px-row"><PixelIcon name="icon_sword" /> <strong>Militia & defense</strong></span>
        <span className="px-num" style={{ fontSize: '0.8em' }}>
          <span className="px-bad">{gameState.hostiles.length} threats</span> · <span className="px-good">{slain} slain</span>
        </span>
      </summary>
      <div className="px-stack" style={{ marginTop: 8 }}>
        <div className="px-row" role="group" aria-label="Doctrine">
          {DOCTRINES.map((doc) => (
            <button key={doc.id} type="button" className="px-btn px-btn--small" aria-pressed={gameState.militiaDoctrine === doc.id} onClick={() => setMilitiaDoctrine(doc.id)}>{doc.label}</button>
          ))}
        </div>
        <div className="px-grid-2">
          {squads.map((sq) => {
            const count = gameState.dwarves.filter((d) => d.squadId === sq.id || sq.memberIds.includes(d.id)).length;
            return (
              <button key={sq.id} type="button" className="build-item" data-testid={`select-${sq.id}-btn`} aria-pressed={sq.id === active.id}
                onClick={() => run({ type: 'SELECT_SQUAD', squadId: sq.id }, 'tool')}>
                <PixelIcon name={sq.id === 'squad-1' ? 'icon_station' : 'icon_patrol'} scale={2} />
                <span className="min-w-0">
                  <strong style={{ color: sq.color }}>{sq.callsign}</strong> <span className="px-num px-info">{count}</span>
                  <small>{sq.order.label}</small>
                </span>
              </button>
            );
          })}
        </div>
        <div className="px-inset" style={{ padding: 8 }} data-testid="active-squad-orders">
          <div className="px-row px-row--between">
            <strong>{active.name} <span className="px-dim">({members.length})</span></strong>
            <button type="button" className="px-btn px-btn--small px-btn--ghost" onClick={() => jumpToLocation(active.order.x, active.order.y, active.order.z)}>
              <PixelIcon name="icon_target" /> Depth {active.order.z}
            </button>
          </div>
          <p className="px-good" style={{ margin: '4px 0', fontSize: '0.8em' }}>Order: {active.order.label}</p>
          <div className="px-grid-2">
            <button type="button" className="px-btn px-btn--small" data-testid="squad-map-station-tool-btn" aria-pressed={selectedTool === 'MILITIA_STATION'} onClick={() => pickTool('MILITIA_STATION')}>
              <PixelIcon name="icon_station" /> Station on map
            </button>
            <button type="button" className="px-btn px-btn--small" data-testid="squad-map-patrol-tool-btn" aria-pressed={selectedTool === 'MILITIA_PATROL'} onClick={() => pickTool('MILITIA_PATROL')}>
              <PixelIcon name="icon_patrol" /> Patrol on map
            </button>
            <button type="button" className="px-btn px-btn--small" data-testid="squad-quick-station-gate-btn"
              onClick={() => run({ type: 'ISSUE_SQUAD_ORDER', squadId: active.id, orderType: 'STATION', x: cx - 5, y: cy, z: currentZ })}>
              Hold the gate
            </button>
            <button type="button" className="px-btn px-btn--small" data-testid="squad-quick-patrol-perimeter-btn"
              onClick={() => run({ type: 'ISSUE_SQUAD_ORDER', squadId: active.id, orderType: 'PATROL', x: Math.max(3, cx - 10), y: cy - 3, z: currentZ, x2: Math.min(gameState.world.width - 4, cx + 10), y2: cy + 3 })}>
              Walk the walls
            </button>
            <button type="button" className="px-btn px-btn--small" data-testid="squad-equip-armory-btn" onClick={() => run({ type: 'EQUIP_SQUAD_ARMORY', squadId: active.id })}>
              <PixelIcon name="icon_armor" /> Equip ({gameState.resources.weapons}/{gameState.resources.armor})
            </button>
            <button type="button" className="px-btn px-btn--small px-btn--ghost" data-testid="squad-clear-order-btn"
              onClick={() => run({ type: 'ISSUE_SQUAD_ORDER', squadId: active.id, orderType: 'FOLLOW_DOCTRINE', x: cx, y: cy, z: currentZ }, 'tool')}>
              Follow doctrine
            </button>
          </div>
        </div>
        {militia.activeRaidPlan && (
          <div className="px-card" data-tone="red" data-testid="ai-raid-battle-plan" style={{ fontSize: '0.85em' }}>
            <div className="px-row px-row--between"><strong className="px-bad">{militia.activeRaidPlan.warlordName}</strong><span className="px-ember">{militia.activeRaidPlan.tactic.replace(/_/g, ' ').toLowerCase()} · {militia.activeRaidPlan.threatLevel}</span></div>
            <p style={{ margin: '4px 0', fontStyle: 'italic' }}>“{militia.activeRaidPlan.warlordQuote.replace(/^["“]+|["”]+$/g, '')}”</p>
            <span className="px-info">Counter: {militia.activeRaidPlan.recommendedCounter}</span>
          </div>
        )}
        {status && <p role="status" data-testid="militia-action-status" className="px-ember" style={{ margin: 0, fontSize: '0.85em' }}>{status}</p>}
        <div className="px-grid-2">
          <button type="button" className="px-btn px-btn--small px-btn--blue" data-testid="ai-tactical-brief-btn" disabled={busy}
            onClick={async () => { setBusy(true); setStatus((await triggerAIRaidAnalysis(false)).message); setBusy(false); }}>
            <PixelIcon name="icon_scroll" /> {busy ? 'Scouting…' : 'Scout report'}
          </button>
          <button type="button" className="px-btn px-btn--small px-btn--red" data-testid="sound-war-horn-btn" onClick={triggerGoblinRaid}>
            <PixelIcon name="icon_warning" /> Sound war horn
          </button>
        </div>
      </div>
    </details>
  );
}

function DwarfCard({ dwarf, selected }: { dwarf: DwarfEntity; selected: boolean }) {
  const { setSelectedDwarfId, jumpToLocation, toggleDwarfLabor, dispatchMilitiaAction } = useGame();
  const [status, setStatus] = useState('');
  const thoughts = dwarf.thoughtLog?.length ? dwarf.thoughtLog : [{ id: `t-${dwarf.id}`, text: dwarf.thought, sentiment: 'NEUTRAL' as const, moraleDelta: 0 }];
  const squads: { id: MilitiaSquadId | null; label: string }[] = [
    { id: null, label: 'None' },
    { id: 'squad-1', label: 'Shield-1' },
    { id: 'squad-2', label: 'Watch-2' },
  ];
  return (
    <article className="px-card dwarf-card" data-tone={selected ? 'gold' : undefined} aria-label={dwarf.name}>
      <button type="button" className="dwarf-head" aria-expanded={selected} onClick={() => setSelectedDwarfId(selected ? null : dwarf.id)}>
        <span className="dwarf-portrait"><DwarfPortrait dwarf={dwarf} scale={2} /></span>
        <span className="min-w-0" style={{ flex: 1 }}>
          <strong>{dwarf.name}</strong>
          <small className="px-muted">{dwarf.title} · <span className="px-info">{stateLabel(dwarf.state)}</span></small>
          <span className="dwarf-meters">
            <PixelMeter value={dwarf.hp} max={dwarf.maxHp} label="Health" tone={dwarf.hp < dwarf.maxHp / 2 ? 'red' : 'green'} />
            <PixelMeter value={dwarf.thirst} label="Ale" tone={dwarf.thirst < 30 ? 'red' : 'violet'} />
            <PixelMeter value={dwarf.happiness} label="Mood" tone="gold" />
          </span>
        </span>
        <span className="dwarf-gear" aria-label="Equipment">
          {dwarf.weaponEquipped && <PixelIcon name="icon_weapons" label="Armed" />}
          {dwarf.armorEquipped && <PixelIcon name="icon_armor" label="Armored" />}
        </span>
      </button>
      {selected && (
        <div className="px-stack" style={{ marginTop: 8 }}>
          <div className="px-row px-row--between" style={{ fontSize: '0.8em' }}>
            <span className="px-num">Health {dwarf.hp}/{dwarf.maxHp} · Ale {Math.round(dwarf.thirst)}% · Mood {Math.round(dwarf.happiness)}%</span>
            <button type="button" className="px-btn px-btn--small px-btn--ghost" onClick={() => jumpToLocation(dwarf.x, dwarf.y, dwarf.z)}>
              <PixelIcon name="icon_target" /> Find
            </button>
          </div>
          {dwarf.quirk && <p className="px-gold" style={{ margin: 0, fontSize: '0.85em' }} title={QUIRKS[dwarf.quirk].description}>{QUIRKS[dwarf.quirk].name}: <span className="px-muted">{QUIRKS[dwarf.quirk].description}</span></p>}
          <ul className="log-list" data-testid={`dwarf-thought-log-${dwarf.id}`} aria-label={`${dwarf.name}'s thoughts`}>
            {thoughts.slice(0, 4).map((entry) => {
              const badge = getSentimentBadge(entry.sentiment);
              return (
                <li key={entry.id}>
                  <span className={SENTIMENT_CLASS[entry.sentiment]} title={badge.label}>{badge.glyph}</span>
                  <span>“{entry.text}”{entry.moraleDelta ? <strong className={entry.moraleDelta > 0 ? 'px-good' : 'px-bad'}> {entry.moraleDelta > 0 ? '+' : ''}{entry.moraleDelta}</strong> : null}</span>
                </li>
              );
            })}
          </ul>
          <div>
            <div className="px-dim" style={{ fontSize: '0.75em', marginBottom: 2 }}>Labors</div>
            <div className="labor-grid">
              {LABORS.map((labor) => (
                <button key={labor.id} type="button" className="px-btn px-btn--small" aria-pressed={dwarf.labors[labor.id]} title={labor.label}
                  onClick={() => toggleDwarfLabor(dwarf.id, labor.id)}>
                  <PixelIcon name={labor.icon} /> <span>{labor.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="px-row" role="group" aria-label="Squad">
            <span className="px-dim" style={{ fontSize: '0.75em' }}>Squad</span>
            {squads.map((opt) => (
              <button key={opt.label} type="button" className="px-btn px-btn--small" data-testid={`assign-${dwarf.id}-${opt.id ?? 'none'}`} aria-pressed={(dwarf.squadId ?? null) === opt.id}
                onClick={() => { playTactileSfx('tool'); setStatus(dispatchMilitiaAction({ type: 'ASSIGN_DWARF_SQUAD', dwarfId: dwarf.id, squadId: opt.id }).message); }}>
                {opt.label}
              </button>
            ))}
          </div>
          {status && <p role="status" className="px-ember" style={{ margin: 0, fontSize: '0.8em' }}>{status}</p>}
        </div>
      )}
    </article>
  );
}

export default function ClanPanel() {
  const { gameState, selectedDwarfId, applyPreset } = useGame();
  return (
    <div className="px-stack">
      <Militia />
      <section aria-label="Labor presets" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_clan" /> Work presets <small>applies to everyone</small></div>
        <div className="px-grid-2">
          {PRESETS.map((preset) => (
            <button key={preset.id} type="button" className="px-btn px-btn--small" onClick={() => applyPreset(preset.id)}>
              <PixelIcon name={preset.icon} /> {preset.label}
            </button>
          ))}
        </div>
      </section>
      <section aria-label="Dwarves" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_population" /> Dwarves <small>{gameState.dwarves.length} in the clan</small></div>
        {gameState.dwarves.map((dwarf) => <DwarfCard key={dwarf.id} dwarf={dwarf} selected={selectedDwarfId === dwarf.id} />)}
        {gameState.dwarves.length === 0 && <p className="px-muted">No dwarves remain. Trade for migrants or start a new realm.</p>}
      </section>
    </div>
  );
}
