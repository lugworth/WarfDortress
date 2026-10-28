'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGame } from '@/components/GameProvider';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import { playTactileSfx } from '@/lib/audio';
import { scanWorldStrata } from '@/lib/game-engine';
import { MINIMAP_CELL, drawMinimap } from '@/lib/pixel/minimap';

export default function RadarPanel() {
  const { gameState, currentZ, setCurrentZ, jumpToLocation } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strata = useMemo(() => scanWorldStrata(gameState), [gameState]);
  const { width, height } = gameState.world;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) drawMinimap(ctx, gameState, currentZ, null, 0, 0, 0);
  }, [gameState, currentZ]);

  return (
    <div className="px-stack">
      <section aria-label="Level radar" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_radar" /> Depth {currentZ} radar <small>select to jump</small></div>
        <canvas
          ref={canvasRef}
          className="radar-canvas px-inset"
          width={width * MINIMAP_CELL}
          height={height * MINIMAP_CELL}
          role="img"
          aria-label={`Radar of depth ${currentZ}. Select a point to move the map there.`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.max(0, Math.min(width - 1, Math.floor(((e.clientX - rect.left) / rect.width) * width)));
            const y = Math.max(0, Math.min(height - 1, Math.floor(((e.clientY - rect.top) / rect.height) * height)));
            jumpToLocation(x, y, currentZ);
          }}
        />
        <div className="px-row" style={{ fontSize: '0.75em' }}>
          <span className="px-chip" data-tone="green">■ Dwarf</span>
          <span className="px-chip" data-tone="red">■ Threat</span>
          <span className="px-chip" data-tone="gold">■ Gold</span>
          <span className="px-chip" data-tone="blue">■ Water</span>
        </div>
      </section>

      <section aria-label="Strata scanner" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_layers" /> Strata scanner</div>
        {strata.map((row) => {
          const meta = gameState.world.strata[row.zLevel];
          return (
            <article key={row.zLevel} className="px-card" data-tone={row.zLevel === currentZ ? 'gold' : undefined}>
              <button type="button" className="strata-head" aria-pressed={row.zLevel === currentZ} onClick={() => { playTactileSfx('zlevel'); setCurrentZ(row.zLevel); }}>
                <strong>{row.zLevel === 0 ? row.name : `Depth ${row.zLevel} · ${row.name}`}</strong>
                {meta && <small className="px-muted">{meta.primaryRock} · {meta.hazard}</small>}
              </button>
              <div className="strata-counts px-num">
                <span title="Iron veins"><PixelIcon name="icon_iron" scale={1} /> {row.ironTiles}</span>
                <span title="Gold veins"><PixelIcon name="icon_gold" scale={1} /> {row.goldTiles}</span>
                <span title="Mithril veins"><PixelIcon name="ore_mithril" scale={1} /> {row.mithrilTiles}</span>
                <span title="Relics"><PixelIcon name="icon_relic" scale={1} /> {row.relicTiles}</span>
                {row.hostiles > 0 && <span className="px-bad" title="Threats"><PixelIcon name="icon_skull" scale={1} /> {row.hostiles}</span>}
              </div>
              {row.relicTiles > 0 && (
                <button type="button" className="px-btn px-btn--small px-btn--gold" onClick={() => {
                  playTactileSfx('zlevel');
                  const relic = gameState.grid[row.zLevel]?.flat().find((t) => t.terrain === 'CAVERN_RELIC');
                  if (relic) jumpToLocation(relic.x, relic.y, row.zLevel);
                  else setCurrentZ(row.zLevel);
                }}>
                  <PixelIcon name="icon_target" /> Find relic
                </button>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
