'use client';

import type { BuildingUnlockStatus } from '@/lib/progression';
import type { DesignationPreview, MapPoint, TileHoverMetadata } from '@/lib/ui-model';
import type { DesignationType, DwarfEntity, GameState, HostileEntity, Tile } from '@/lib/types';
import { getBuildingTileFunctionInfo, getConstructionCost } from '@/lib/game-engine';
import { TOOL_KEYS } from '@/lib/game-rules';
import { formatCost, getTool } from '@/lib/tool-catalog';
import { TOOL_NAMES } from '@/lib/ui-labels';
import { getTileHoverMetadata } from '@/lib/ui-model';
import { dwarfSlots } from '@/lib/pixel/appearance';
import { SPRITES } from '@/lib/pixel/sprites';
import { DESIGNATION_SPRITE, HOSTILE_SPRITE, tileSprites, dwarfAnimation, dwarfSpriteName } from '@/lib/pixel/tiles';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';

export const PRIMARY_TOOLS: { id: DesignationType; label: string }[] = [
  { id: 'MINE', label: 'Mine' },
  { id: 'CHOP', label: 'Chop' },
  { id: 'GATHER', label: 'Gather' },
  { id: 'STAIRS', label: 'Stairs' },
  { id: 'STOCKPILE', label: 'Stock' },
];

export const BUILD_TOOLS: { id: DesignationType; label: string }[] = [
  { id: 'BUILD_WALL', label: 'Wall' },
  { id: 'BUILD_DOOR', label: 'Door' },
  { id: 'BUILD_BED', label: 'Bed' },
  { id: 'BUILD_FARM', label: 'Farm' },
  { id: 'BUILD_TRAP', label: 'Trap' },
  { id: 'BUILD_MASON', label: 'Mason' },
  { id: 'BUILD_CARPENTER', label: 'Carpenter' },
  { id: 'BUILD_STILL', label: 'Still' },
  { id: 'BUILD_SMELTER', label: 'Smeltery' },
  { id: 'BUILD_FORGE', label: 'Forge' },
  { id: 'BUILD_TAVERN', label: 'Tavern' },
  { id: 'BUILD_TEMPLE', label: 'Temple' },
  { id: 'BUILD_DEPOT', label: 'Depot' },
  { id: 'MILITIA_STATION', label: 'Station' },
  { id: 'MILITIA_PATROL', label: 'Patrol' },
  { id: 'RECLAIM_RELIC', label: 'Relic' },
];

export const HOTKEYS = Object.fromEntries(
  Object.entries(TOOL_KEYS).map(([key, tool]) => [tool, key.toUpperCase()]),
) as Partial<Record<DesignationType, string>>;

export function lockedMessage(unlock: BuildingUnlockStatus): string {
  return `Locked blueprint: ${unlock.title} needs ${unlock.requirementLabel} (${unlock.progressText}).`;
}

/** A tool's sprite centered in a fixed square, so 12px icons and 16px buildings line up. */
export function ToolGlyph({ tool, locked = false, animate = false }: { tool: DesignationType; locked?: boolean; animate?: boolean }) {
  const name = locked ? 'icon_lock' : DESIGNATION_SPRITE[tool];
  return (
    <span className="tool-glyph">
      {animate && SPRITES[name].frames.length > 1 ? <PixelSprite name={name} scale={2} /> : <PixelIcon name={name} scale={2} />}
    </span>
  );
}

/** A dwarf's animated, individually recolored sprite. */
export function DwarfPortrait({ dwarf, scale = 3 }: { dwarf: DwarfEntity; scale?: number }) {
  const { slots, key } = dwarfSlots(dwarf.id);
  const anim = dwarfAnimation(dwarf.state, Boolean(dwarf.weaponEquipped), false);
  return <PixelSprite name={dwarfSpriteName(anim, Boolean(dwarf.armorEquipped))} scale={scale} slots={slots} slotKey={key} label={dwarf.name} />;
}

// ------------------------------------------------------------------ dock ---

export function ToolDock({ selectedTool, inspectMode, buildOpen, unlocks, tooltips, onSelect, onToggleBuild, onToggleInspect }: {
  selectedTool: DesignationType;
  inspectMode: boolean;
  buildOpen: boolean;
  unlocks: Map<DesignationType, BuildingUnlockStatus>;
  tooltips: boolean;
  onSelect: (tool: DesignationType) => void;
  onToggleBuild: () => void;
  onToggleInspect: () => void;
}) {
  const buildActive = BUILD_TOOLS.some((t) => t.id === selectedTool) && !inspectMode;
  return (
    <div role="toolbar" aria-label="Map tools" className="tool-dock px-panel">
      {PRIMARY_TOOLS.map((item) => {
        const unlock = unlocks.get(item.id);
        const locked = Boolean(unlock && !unlock.unlocked);
        return (
          <button
            key={item.id}
            type="button"
            className="tool-btn"
            aria-pressed={!inspectMode && selectedTool === item.id}
            data-locked={locked || undefined}
            title={tooltips ? (locked && unlock ? lockedMessage(unlock) : `${TOOL_NAMES[item.id]} — ${getTool(item.id).desc}`) : undefined}
            onClick={() => onSelect(item.id)}
          >
            <ToolGlyph tool={item.id} locked={locked} />
            <span>{item.label}</span>
            <kbd>{HOTKEYS[item.id]}</kbd>
          </button>
        );
      })}
      <span className="tool-sep" aria-hidden="true" />
      <button type="button" className="tool-btn" aria-expanded={buildOpen} aria-pressed={buildActive}
        aria-controls="build-drawer" title={tooltips ? 'Workshops, walls, beds, and defenses' : undefined} onClick={onToggleBuild}>
        <span className="tool-glyph"><PixelIcon name="icon_hammer" scale={2} /></span>
        <span>Build</span>
        <kbd>{buildActive ? HOTKEYS[selectedTool] : '▴'}</kbd>
      </button>
      <button type="button" className="tool-btn" aria-pressed={inspectMode} title={tooltips ? 'Inspect a tile, dwarf, or threat' : undefined} onClick={onToggleInspect}>
        <span className="tool-glyph"><PixelIcon name="icon_inspect" scale={2} /></span>
        <span>Inspect</span>
        <kbd>I</kbd>
      </button>
      <button type="button" className="tool-btn" aria-pressed={!inspectMode && selectedTool === 'CANCEL'}
        title={tooltips ? 'Clear queued orders' : undefined} onClick={() => onSelect('CANCEL')}>
        <ToolGlyph tool="CANCEL" />
        <span>Clear</span>
        <kbd>K</kbd>
      </button>
    </div>
  );
}

export function BuildDrawer({ selectedTool, inspectMode, unlocks, tooltips, onSelect, onClose }: {
  selectedTool: DesignationType;
  inspectMode: boolean;
  unlocks: Map<DesignationType, BuildingUnlockStatus>;
  tooltips: boolean;
  onSelect: (tool: DesignationType) => void;
  onClose: () => void;
}) {
  const tiers = [...unlocks.values()].filter((u) => u.tier > 0);
  return (
    <section id="build-drawer" aria-label="Build catalog" className="map-card px-panel">
      <div className="px-heading">
        <PixelIcon name="icon_hammer" />
        Build catalog
        <small>{tiers.filter((u) => u.unlocked).length}/{tiers.length} advanced blueprints</small>
        <button type="button" className="px-btn px-btn--icon px-btn--ghost px-btn--small" aria-label="Close build catalog" onClick={onClose}>
          <PixelIcon name="icon_close" />
        </button>
      </div>
      <p className="px-muted" style={{ margin: '0 0 8px', fontSize: '0.8em' }}>
        Gather stone, wood, ore, and steel to unlock higher tiers. Materials are spent when a job finishes.
      </p>
      <div className="build-grid">
        {BUILD_TOOLS.map((item) => {
          const unlock = unlocks.get(item.id);
          const locked = Boolean(unlock && !unlock.unlocked);
          return (
            <button
              key={item.id}
              type="button"
              className="build-item"
              aria-pressed={!inspectMode && selectedTool === item.id}
              data-locked={locked || undefined}
              title={tooltips ? (locked && unlock ? lockedMessage(unlock) : getTool(item.id).desc) : undefined}
              onClick={() => onSelect(item.id)}
            >
              <ToolGlyph tool={item.id} locked={locked} animate={!locked} />
              <span>
                <strong>{item.label} <kbd className="px-kbd">{HOTKEYS[item.id]}</kbd></strong>
                {locked && unlock
                  ? <small className="px-ember">Tier {unlock.tier} · {unlock.progressText}</small>
                  : <small>{formatCost(getConstructionCost(item.id))}</small>}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ----------------------------------------------------------------- cards ---

export function OrderPreviewCard({ tool, preview, pending, onCancel, onCommit }: {
  tool: DesignationType;
  preview: DesignationPreview;
  pending: boolean;
  onCancel: () => void;
  onCommit: () => void;
}) {
  const reasons = [...new Set(preview.tiles.filter((t) => !t.valid).map((t) => t.reason))];
  return (
    <section aria-label="Order preview" className="map-card px-panel">
      <div className="px-heading">
        <ToolGlyph tool={tool} />
        {getTool(tool).label}
        <small>
          <span className="px-good">{preview.accepted} ok</span>
          {preview.skipped > 0 && <> · <span className="px-bad">{preview.skipped} blocked</span></>}
          {preview.alreadyDesignated > 0 && <> · {preview.alreadyDesignated} queued</>}
        </small>
      </div>
      <div className="px-stack px-stack--tight" style={{ fontSize: '0.85em' }}>
        <span>Cost <span className="px-ember">{formatCost(preview.cost)}</span> <span className="px-dim">· spent when built</span></span>
        {Object.keys(preview.missing).length > 0 && <span className="px-ember">Short by {formatCost(preview.missing)}. The order waits for supplies.</span>}
        {reasons.length > 0 && <span className="px-dim">{reasons.join(' · ')}</span>}
      </div>
      {pending && (
        <div className="px-row px-row--between" style={{ marginTop: 10 }}>
          <button type="button" className="px-btn px-btn--ghost px-btn--small" onClick={onCancel}>
            <kbd className="px-kbd">Esc</kbd> Cancel
          </button>
          <button type="button" className="px-btn px-btn--green" disabled={preview.accepted === 0} onClick={onCommit}>
            <PixelIcon name="icon_check" /> Queue {preview.accepted} {preview.accepted === 1 ? 'tile' : 'tiles'} <kbd className="px-kbd">Enter</kbd>
          </button>
        </div>
      )}
    </section>
  );
}

export function InspectorCard({ state, coord, tile, dwarf, hostile, onDesignate, onToggleMilitia, onActivate, onClose }: {
  state: GameState;
  coord: { x: number; y: number; z: number };
  tile: Tile;
  dwarf: DwarfEntity | null;
  hostile: HostileEntity | null;
  onDesignate: (tool: DesignationType, x2?: number) => void;
  onToggleMilitia: (dwarf: DwarfEntity) => void;
  onActivate: () => void;
  onClose: () => void;
}) {
  const meta = getTileHoverMetadata(state, tile);
  const sprites = tileSprites(tile, state.grid[coord.z]?.[coord.y + 1]?.[coord.x]);
  const building = tile.revealed ? getBuildingTileFunctionInfo(state, tile) : null;
  return (
    <section aria-label="Tile inspector" className="map-card px-panel">
      <div className="px-heading">
        <span className="tool-glyph tile-swatch">
          <PixelIcon name={sprites.base} scale={2} />
          {sprites.overlay && <PixelIcon name={sprites.overlay} scale={2} className="tile-swatch-overlay" />}
        </span>
        <span className="min-w-0">
          {tile.revealed ? meta.terrainLabel : 'Unexplored rock'}
          <small className="px-dim" style={{ display: 'block', marginLeft: 0 }}>
            {coord.x}, {coord.y} · depth {coord.z}{tile.revealed && tile.resourceDrop ? ` · yields ${tile.resourceDrop.amount} ${tile.resourceDrop.type}` : ''}
          </small>
        </span>
        <button type="button" className="px-btn px-btn--icon px-btn--ghost px-btn--small" aria-label="Close inspector" onClick={onClose}>
          <PixelIcon name="icon_close" />
        </button>
      </div>
      {tile.revealed && <p className="px-muted" style={{ margin: '0 0 8px', fontSize: '0.8em' }}>{meta.materialType} · {meta.temperature} · {meta.liquidLevel}</p>}

      <div className="px-grid-2">
        {dwarf ? (
          <div className="px-card inspector-entity">
            <DwarfPortrait dwarf={dwarf} scale={2} />
            <div className="min-w-0">
              <strong>{dwarf.name}</strong>
              <small className="px-muted">{dwarf.title} · {dwarf.state.toLowerCase().replace('_', ' ')}</small>
              <PixelMeter value={dwarf.hp} max={dwarf.maxHp} label={`${dwarf.name} health`} tone={dwarf.hp < dwarf.maxHp / 2 ? 'red' : 'green'} />
            </div>
            <button type="button" className={`px-btn px-btn--small ${dwarf.labors.COMBAT ? 'px-btn--red' : ''}`} aria-pressed={dwarf.labors.COMBAT} onClick={() => onToggleMilitia(dwarf)}>
              <PixelIcon name="icon_sword" /> {dwarf.labors.COMBAT ? 'Militia' : 'Draft'}
            </button>
          </div>
        ) : <div className="px-card px-dim inspector-empty">No dwarf here.</div>}
        {hostile ? (
          <div className="px-card inspector-entity" data-tone="red">
            <PixelSprite name={HOSTILE_SPRITE[hostile.kind]} scale={2} label={hostile.name} />
            <div className="min-w-0">
              <strong className="px-bad">{hostile.name}</strong>
              <small className="px-muted">Attack {hostile.attack}</small>
              <PixelMeter value={hostile.hp} max={hostile.maxHp} label={`${hostile.name} health`} tone="red" />
            </div>
          </div>
        ) : <div className="px-card px-dim inspector-empty">No threat here.</div>}
      </div>

      {building && (
        <div className="px-card" data-tone="green" style={{ marginTop: 8 }} data-testid="inspect-building-function">
          <div className="px-row px-row--between">
            <div className="min-w-0" style={{ flex: 1 }}>
              <strong className="px-good">{building.passiveFunction}</strong>
              <div className="px-muted" style={{ fontSize: '0.8em' }}>{building.actionDescription} · <span className="px-ember">{formatCost(building.cost)}</span></div>
            </div>
            <button type="button" className="px-btn px-btn--green px-btn--small" disabled={!building.canActivate} onClick={onActivate}>
              {building.actionLabel}{building.readyInTicks > 0 ? ` · ${building.readyInTicks}t` : ''}
            </button>
          </div>
        </div>
      )}

      <div className="px-row" style={{ marginTop: 8 }}>
        {tile.revealed && tile.terrain === 'CAVERN_RELIC' && (
          <button type="button" className="px-btn px-btn--gold px-btn--small" onClick={() => onDesignate('RECLAIM_RELIC')}>
            <PixelIcon name="icon_relic" /> Reclaim relic
          </button>
        )}
        <button type="button" className="px-btn px-btn--small" onClick={() => onDesignate('MINE')}><PixelIcon name="icon_mine" /> Mine</button>
        <button type="button" className="px-btn px-btn--small" onClick={() => onDesignate('BUILD_TRAP')}><PixelIcon name="trap" /> Trap</button>
        <button type="button" className="px-btn px-btn--small" data-testid="inspect-station-squad-btn" onClick={() => onDesignate('MILITIA_STATION')}><PixelIcon name="icon_station" /> Station squad</button>
        <button type="button" className="px-btn px-btn--small" data-testid="inspect-patrol-squad-btn" onClick={() => onDesignate('MILITIA_PATROL', Math.min(state.world.width - 1, coord.x + 5))}><PixelIcon name="icon_patrol" /> Patrol here</button>
      </div>
    </section>
  );
}

export function MapOptionsCard({ state, z, panMode, labels, tooltips, points, onTogglePan, onToggleLabels, onToggleTooltips, onCycleWeather, onQuick, onLocate, onClose }: {
  state: GameState;
  z: number;
  panMode: boolean;
  labels: boolean;
  tooltips: boolean;
  points: MapPoint[];
  onTogglePan: () => void;
  onToggleLabels: () => void;
  onToggleTooltips: () => void;
  onCycleWeather: () => void;
  onQuick: (kind: 'mine' | 'chop' | 'workshops') => void;
  onLocate: (point: MapPoint) => void;
  onClose: () => void;
}) {
  const stratum = state.world.strata[z] || state.world.strata[0];
  return (
    <section id="map-options" aria-label="Map options" className="map-card map-card--top map-options px-panel">
      <div className="px-heading">
        <PixelIcon name="icon_gear" />
        Map options
        <button type="button" className="px-btn px-btn--icon px-btn--ghost px-btn--small" aria-label="Close map options" onClick={onClose}>
          <PixelIcon name="icon_close" />
        </button>
      </div>
      <p className="px-muted" style={{ margin: '0 0 8px', fontSize: '0.8em' }}>{stratum.name} · {stratum.primaryRock}</p>
      <div className="px-stack">
        <div className="px-row">
          <button type="button" className="px-btn px-btn--small" aria-pressed={panMode} onClick={onTogglePan}><PixelIcon name="icon_hand" /> Pan with drag</button>
          <button type="button" className="px-btn px-btn--small" aria-pressed={labels} onClick={onToggleLabels}><PixelIcon name="icon_tag" /> Labels</button>
          <button type="button" className="px-btn px-btn--small" data-testid="toggle-tooltips-btn" aria-pressed={tooltips} onClick={onToggleTooltips}><PixelIcon name="icon_inspect" /> Tile tips</button>
          <button type="button" className="px-btn px-btn--small" onClick={onCycleWeather}><PixelIcon name="icon_rain" /> Next weather</button>
        </div>
        <div>
          <div className="px-dim" style={{ fontSize: '0.75em', marginBottom: 2 }}>Quick orders</div>
          <div className="px-row">
            <button type="button" className="px-btn px-btn--small" onClick={() => onQuick('mine')}><PixelIcon name="icon_mine" /> Dig into the cliff</button>
            <button type="button" className="px-btn px-btn--small" onClick={() => onQuick('chop')}><PixelIcon name="icon_chop" /> Fell timber</button>
            <button type="button" className="px-btn px-btn--small" onClick={() => onQuick('workshops')}><PixelIcon name="icon_hammer" /> Starter workshops</button>
          </div>
        </div>
        <label className="px-stack px-stack--tight">
          <span className="px-dim" style={{ fontSize: '0.75em' }}>Find on this level</span>
          <select className="px-input" value="" aria-label="Find map object" onChange={(e) => {
            const point = points.find((p) => p.id === e.target.value);
            if (point) onLocate(point);
          }}>
            <option value="">{points.length} dwarves, threats, and buildings…</option>
            {points.map((point) => <option key={point.id} value={point.id}>{point.label} ({point.x}, {point.y})</option>)}
          </select>
        </label>
      </div>
    </section>
  );
}

export function TileTooltip({ meta, left, top, flip }: { meta: TileHoverMetadata; left: number; top: number; flip: boolean }) {
  const people = meta.occupancy.filter((o) => o.startsWith('☺') || o.includes('HP)'));
  return (
    <aside data-testid="hover-tile-inspector" aria-hidden="true" className="tile-tooltip px-panel"
      style={{ left, top, translate: flip ? '-100% 0' : undefined }}>
      <strong>{meta.terrainLabel}</strong>
      <span className="px-muted">{meta.materialType}</span>
      {meta.yieldLabel && <span className="px-ember">{meta.yieldLabel}</span>}
      {meta.designationLabel && <span className="px-gold">{meta.designationLabel}</span>}
      {people.length > 0 && <span>{people.join(' · ')}</span>}
      <span className="px-dim">{meta.x}, {meta.y}</span>
    </aside>
  );
}

