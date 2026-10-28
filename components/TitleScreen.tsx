'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { useUI } from '@/components/UIProvider';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { TitleScene } from '@/lib/pixel/title-scene';
import { generateDeterministicWorldMeta, generateRandomWorldSeed, getSurfaceArchetype } from '@/lib/world-gen';

function SceneCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { reducedMotion } = useUI();
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    if (!canvas || !ctx) return;
    const scene = new TitleScene();
    let raf = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      scene.draw(ctx, canvas.width, canvas.height, performance.now(), !reducedMotion);
    };
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      scene.draw(ctx, canvas.width, canvas.height, now, true);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    if (!reducedMotion) raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [reducedMotion]);
  return <canvas ref={ref} className="title-scene" aria-hidden="true" />;
}

export default function TitleScreen({ onEmbark }: { onEmbark: (seed: string) => Promise<void> }) {
  const { gameState, user, cloudSaves, saveStatus, localSave, resumeLocalSave, handleGoogleSignIn, handleSignOut, loadCloudSave } = useGame();
  const [seedInput, setSeedInput] = useState<string | null>(null);
  const seed = seedInput ?? gameState.world.seed ?? 'Khazad-251';
  const [embarking, setEmbarking] = useState(false);
  const world = useMemo(() => generateDeterministicWorldMeta(seed || 'Khazad-251'), [seed]);
  const archetype = useMemo(() => getSurfaceArchetype(seed || 'Khazad-251'), [seed]);

  const start = async () => {
    if (embarking) return;
    setEmbarking(true);
    try { await onEmbark(seed); } finally { setEmbarking(false); }
  };

  return (
    <main className="title-screen">
      <SceneCanvas />
      <div className="title-content">
        <h1 className="title-logo">
          Deep Anvil
          <small>A dwarven colony in pixels</small>
        </h1>

        <div className="title-grid">
          <section className="px-panel title-card" aria-label="Found a fortress">
            <h2 className="px-title">Found a fortress</h2>
            <label className="px-stack px-stack--tight" htmlFor="world-seed-input">
              <span className="px-muted" style={{ fontSize: '0.85em' }}>World seed</span>
              <span className="px-row" style={{ flexWrap: 'nowrap' }}>
                <input id="world-seed-input" className="px-input" style={{ flex: 1 }} value={seed}
                  onChange={(e) => setSeedInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && start()} />
                <button type="button" className="px-btn px-btn--icon" aria-label="Roll a new seed" title="Roll a new seed" onClick={() => setSeedInput(generateRandomWorldSeed())}>
                  <PixelIcon name="icon_star" />
                </button>
              </span>
            </label>

            <dl className="realm-facts">
              <div><dt>Realm</dt><dd className="px-gold">{world.name}</dd></div>
              <div><dt>Surface</dt><dd className="px-good">{archetype.label}</dd></div>
              <div><dt>Map</dt><dd className="px-num">{world.width}×{world.height} · {world.depth} levels</dd></div>
              <div><dt>Clan</dt><dd>7 pioneers</dd></div>
            </dl>

            <ul className="strata-preview" aria-label="Rock layers">
              {world.strata.slice(0, 4).map((st) => (
                <li key={st.zLevel}>
                  <PixelIcon name={st.zLevel === 0 ? 'grass_0' : st.zLevel < 2 ? 'soil_front' : st.zLevel < 4 ? 'rock_front' : 'granite_front'} scale={1} />
                  <span className="min-w-0">{st.zLevel === 0 ? st.name : `Depth ${st.zLevel} · ${st.name}`}</span>
                  <span className="px-ember">{st.ores[0]}</span>
                </li>
              ))}
            </ul>

            {localSave && (
              <button type="button" className="px-btn px-btn--blue px-btn--block resume" onClick={resumeLocalSave}>
                <PixelIcon name="icon_save" />
                <span>Continue {localSave.name}<small>Year {localSave.year} · tick {localSave.ticks}</small></span>
              </button>
            )}
            {saveStatus && <p role="status" className="px-info" style={{ margin: 0, fontSize: '0.85em' }}>{saveStatus}</p>}
            <button type="button" data-start="true" className="px-btn px-btn--gold px-btn--block title-start" disabled={embarking} onClick={start}>
              <PixelSprite name="dwarf_mine" scale={2} />
              {embarking ? 'Striking the earth…' : 'Strike the earth!'}
            </button>

            <div className="cloud-saves">
              <div className="px-row px-row--between">
                <strong style={{ fontSize: '0.85em' }}><PixelIcon name="icon_save" scale={1} /> Cloud saves</strong>
                {user
                  ? <button type="button" className="px-link" onClick={handleSignOut}>Sign out</button>
                  : <button type="button" className="px-link" onClick={handleGoogleSignIn}>Sign in with Google</button>}
              </div>
              {cloudSaves.length > 0 ? (
                <ul className="px-stack px-stack--tight" style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
                  {cloudSaves.map((save) => (
                    <li key={save.id}>
                      <button type="button" className="px-btn px-btn--ghost px-btn--block px-btn--small" style={{ justifyContent: 'space-between' }} onClick={() => loadCloudSave(save)}>
                        <span>{save.dwarvenName}</span>
                        <span className="px-num px-dim">Year {save.year} · {save.wealth} wealth</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-dim" style={{ margin: '4px 0 0', fontSize: '0.8em' }}>
                  {user ? 'No cloud saves yet. Use Save during play.' : 'Play right away; sign in to keep fortresses in the cloud.'}
                </p>
              )}
            </div>
          </section>

          <section className="px-panel title-card" aria-label={`The world of ${world.name}`}>
            <h2 className="px-title">The world of {world.name}</h2>
            <p style={{ margin: 0 }}>{world.backstory}</p>
            <div className="civ-grid">
              {world.civilizations.map((civ) => (
                <div key={civ.id} className="px-card">
                  <div className="px-row px-row--between"><strong>{civ.name}</strong><span className="px-chip" data-tone={civ.stance === 'Hostile' ? 'red' : civ.stance === 'Allied' ? 'green' : civ.stance === 'Trade Partner' ? 'blue' : 'gold'}>{civ.stance}</span></div>
                  <small className="px-muted" style={{ display: 'block' }}>{civ.race} · {civ.ruler}</small>
                  <small className="px-info">{civ.specialty}</small>
                </div>
              ))}
            </div>
            <div>
              <h3 className="px-heading" style={{ fontSize: '0.9em' }}><PixelIcon name="icon_scroll" /> Annals <small>{world.history.length} eras</small></h3>
              <ol className="log-list annals px-scroll">
                {world.history.map((ev, i) => (
                  <li key={i}><time>Y{ev.year}</time><span><strong className="px-gold">{ev.title}.</strong> {ev.description}</span></li>
                ))}
              </ol>
            </div>
          </section>
        </div>
        <p className="title-hint">Pick a tool · drag an area · Enter to queue · Space to pause · / to find any command</p>
      </div>
    </main>
  );
}
