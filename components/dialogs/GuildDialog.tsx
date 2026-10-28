'use client';

import { useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { DwarfPortrait } from '@/components/map/MapCards';
import { PixelDialog } from '@/components/pixel/PixelDialog';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';
import { QUIRKS, RELIC_TEMPLATES } from '@/lib/guild';
import { formatCost } from '@/lib/tool-catalog';
import type { Civilization, Commission, GuildAction } from '@/lib/types';

const TABS = { COMMISSIONS: 'Commissions', RELICS: 'Relics', CLAN: 'Clan stories' } as const;
type Tab = keyof typeof TABS;

export default function GuildDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { gameState, performGuildAction } = useGame();
  const [tab, setTab] = useState<Tab>('COMMISSIONS');
  const [status, setStatus] = useState('');
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [patrons, setPatrons] = useState<Record<string, Civilization['race']>>({});
  const { guild, resources, dwarves, ticks } = gameState;
  const active = guild.commissions.find((c) => c.status === 'ACTIVE');
  const offers = guild.commissions.filter((c) => c.status === 'OFFERED');
  const past = guild.commissions.filter((c) => c.status === 'COMPLETED' || c.status === 'EXPIRED');
  const act = (action: GuildAction, message: string) =>
    setStatus(performGuildAction(action) ? message : 'That did not work. Check your supplies and selection.');
  const select = (next: Tab) => { setTab(next); setStatus(''); };

  const commissionCard = (c: Commission) => {
    const { resource, amount } = c.requirement;
    const stock = resources[resource];
    const remaining = Math.max(0, c.deadline - ticks);
    const accepted = c.status === 'ACTIVE';
    const ready = stock >= amount;
    const blocked = remaining === 0 || (accepted ? !ready : Boolean(active));
    return (
      <article key={c.id} className="px-card" data-tone={accepted ? 'gold' : undefined} aria-label={c.title}>
        <div className="px-row px-row--between">
          <strong>{c.title}</strong>
          <span className="px-chip" data-tone={remaining === 0 ? 'red' : accepted && ready ? 'green' : accepted ? 'gold' : 'blue'}>
            {remaining === 0 ? 'Expired' : accepted ? (ready ? 'Ready' : 'In progress') : 'Offered'}
          </span>
        </div>
        <p className="px-muted" style={{ margin: '2px 0 6px', fontSize: '0.8em' }}>{c.patron} · {remaining} ticks left</p>
        <div className="px-row px-row--between" style={{ fontSize: '0.85em' }}>
          <span>Deliver <strong className="px-ember">{formatCost({ [resource]: amount })}</strong></span>
          <span className="px-num">{stock}/{amount}</span>
        </div>
        <PixelMeter value={stock} max={amount} label={`${c.title} delivery`} tone={ready ? 'green' : 'ember'} segments />
        <p style={{ margin: '6px 0', fontSize: '0.85em' }}>Reward <strong className="px-gold">{c.reward.wealth} wealth</strong> · +{c.reward.favor} favor · <span className="px-violet">{RELIC_TEMPLATES[c.reward.relic]?.name ?? 'a named relic'}</span></p>
        <details style={{ fontSize: '0.8em', marginBottom: 6 }}><summary>Details</summary><p className="px-muted" style={{ margin: '4px 0 0' }}>{c.description}</p></details>
        <button type="button" className={`px-btn px-btn--block ${accepted ? 'px-btn--green' : 'px-btn--gold'}`} disabled={blocked}
          onClick={() => (accepted
            ? act({ type: 'DELIVER_COMMISSION', id: c.id }, 'Delivered! Your reward waits in the relic vault.')
            : act({ type: 'ACCEPT_COMMISSION', id: c.id }, `Accepted ${c.title}. Gather the goods, then deliver them here.`))}>
          {accepted ? 'Deliver goods' : 'Accept commission'}
        </button>
        <small className="px-dim">
          {remaining === 0 ? 'This commission has expired.' : accepted && !ready ? `Still needed: ${formatCost({ [resource]: amount - stock })}.` : !accepted && active ? 'Finish your active commission first.' : 'Delivery spends the listed goods.'}
        </small>
      </article>
    );
  };

  return (
    <PixelDialog open={open} onClose={onClose} title="Guild hall" icon="icon_banner" width={760} subtitle="Commissions, heirlooms, and your clan's stories · Clock paused">
      <div className="drawer-tabs dialog-tabs" role="tablist" aria-label="Guild hall sections">
        {(Object.keys(TABS) as Tab[]).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => select(id)}>{TABS[id]}</button>
        ))}
      </div>
      {status && <p role="status" className="px-good" style={{ margin: 0 }}>{status}</p>}

      {tab === 'COMMISSIONS' && (
        <div className="px-stack">
          <p className="px-muted" style={{ margin: 0, fontSize: '0.85em' }}>Take one commission at a time. Gather the goods, then come back to deliver them.</p>
          {active && <section className="px-stack px-stack--tight" aria-label="Active commission"><div className="px-heading">Your commission</div>{commissionCard(active)}</section>}
          <section className="px-stack px-stack--tight" aria-label="Available commissions">
            <div className="px-heading">On offer</div>
            {offers.length ? offers.map(commissionCard) : <p className="px-dim" style={{ margin: 0 }}>No open offers. New commissions arrive next season.</p>}
          </section>
          <details className="px-card">
            <summary>Diplomacy & favor</summary>
            <p className="px-muted" style={{ fontSize: '0.8em' }}>Commissions earn favor with their patron: 15 favor opens a trade partnership, 30 an alliance. Allied goblins stop raiding.</p>
            <div className="px-stack px-stack--tight">
              {gameState.world.civilizations.map((civ) => (
                <div key={civ.id} className="px-row" style={{ fontSize: '0.85em' }}>
                  <span style={{ minWidth: 80 }}>{civ.race}</span>
                  <PixelMeter value={guild.favor[civ.race]} label={`${civ.race} favor`} tone="violet" className="flex-1" />
                  <span className="px-num px-dim">{guild.favor[civ.race]} · {civ.stance}</span>
                </div>
              ))}
            </div>
          </details>
          {past.length > 0 && (
            <details className="px-card">
              <summary>Past commissions ({past.length})</summary>
              <ul className="log-list" style={{ marginTop: 6 }}>
                {past.map((c) => <li key={c.id}><span className={c.status === 'COMPLETED' ? 'px-good' : 'px-bad'}>{c.status === 'COMPLETED' ? '✓' : '✗'}</span><span>{c.title}</span></li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      {tab === 'RELICS' && (
        <div className="px-stack">
          <p className="px-muted" style={{ margin: 0, fontSize: '0.85em' }}>Display a relic to bless the fortress, or give it to a dwarf to carry. Each dwarf carries one.</p>
          {guild.relics.length === 0 && (
            <div className="empty-state">
              <PixelSprite name="relic" scale={4} />
              <strong>The relic vault is empty</strong>
              <span className="px-muted">Complete a commission or recover a cavern relic to start your collection.</span>
              <button type="button" className="px-btn px-btn--gold" onClick={() => select('COMMISSIONS')}>See commissions</button>
            </div>
          )}
          {guild.relics.map((relic) => {
            const template = RELIC_TEMPLATES[relic.template];
            const candidate = owners[relic.id] || relic.ownerId || dwarves[0]?.id || '';
            const ownerId = dwarves.some((d) => d.id === candidate) ? candidate : dwarves[0]?.id || '';
            const patron = patrons[relic.id] || 'Dwarves';
            const bearer = dwarves.find((d) => d.id === relic.ownerId)?.name;
            const mode = relic.mode === 'EQUIPPED' ? `Carried by ${bearer ?? 'a dwarf'}` : relic.mode === 'GIFTED' ? `Gifted to ${relic.giftedTo}` : relic.mode === 'DISPLAYED' ? 'On display' : 'In storage';
            return (
              <article key={relic.id} className="px-card" data-tone="violet" aria-label={relic.name}>
                <div className="px-row">
                  <PixelSprite name="relic" scale={2} />
                  <span className="min-w-0" style={{ flex: 1 }}><strong>{relic.name}</strong><small className="px-muted" style={{ display: 'block' }}>Found by {relic.discoveredBy} · tick {relic.discoveredAt}</small></span>
                  <span className="px-chip" data-tone="gold">{mode}</span>
                </div>
                <dl className="tutorial-entries" style={{ margin: '8px 0' }}>
                  <div><dt>On display</dt><dd>{template?.display}</dd></div>
                  <div><dt>When carried</dt><dd>{template?.equip}</dd></div>
                </dl>
                {relic.mode !== 'GIFTED' && (
                  <div className="px-stack px-stack--tight">
                    <button type="button" className="px-btn px-btn--violet"
                      onClick={() => act({ type: 'SET_RELIC_MODE', id: relic.id, mode: relic.mode === 'DISPLAYED' ? 'STORED' : 'DISPLAYED' }, relic.mode === 'DISPLAYED' ? 'Relic stored. Its effects are inactive.' : 'Relic on display. Its blessing and upkeep apply every 20 ticks.')}>
                      {relic.mode === 'DISPLAYED' ? 'Return to storage' : 'Put on display'}
                    </button>
                    <details style={{ fontSize: '0.85em' }}>
                      <summary>Give to a bearer, or send as a gift</summary>
                      <div className="px-stack px-stack--tight" style={{ marginTop: 6 }}>
                        <div className="px-row">
                          <select className="px-input" aria-label={`Bearer for ${relic.name}`} value={ownerId} onChange={(e) => setOwners((p) => ({ ...p, [relic.id]: e.target.value }))}>
                            {dwarves.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                          <button type="button" className="px-btn px-btn--small" disabled={!ownerId || (relic.mode === 'EQUIPPED' && relic.ownerId === ownerId)}
                            onClick={() => act({ type: 'SET_RELIC_MODE', id: relic.id, mode: 'EQUIPPED', ownerId }, 'Relic entrusted. Their previous relic, if any, went to storage.')}>Equip</button>
                        </div>
                        <div className="px-row">
                          <select className="px-input" aria-label={`Gift recipient for ${relic.name}`} value={patron} onChange={(e) => setPatrons((p) => ({ ...p, [relic.id]: e.target.value as Civilization['race'] }))}>
                            {gameState.world.civilizations.map((civ) => <option key={civ.id} value={civ.race}>{civ.race}</option>)}
                          </select>
                          <button type="button" className="px-btn px-btn--small" onClick={() => act({ type: 'GIFT_RELIC', id: relic.id, patron }, 'Relic gifted for 15 favor. Its history stays in the archive.')}>Gift (+15 favor)</button>
                        </div>
                        <small className="px-dim">A gift is permanent.</small>
                        {relic.mode === 'EQUIPPED' && <button type="button" className="px-btn px-btn--small px-btn--ghost" onClick={() => act({ type: 'SET_RELIC_MODE', id: relic.id, mode: 'STORED' }, 'Relic returned to storage.')}>Return to storage</button>}
                      </div>
                    </details>
                  </div>
                )}
                <details style={{ fontSize: '0.8em', marginTop: 6 }}>
                  <summary>History ({relic.history.length})</summary>
                  <ol className="log-list" style={{ marginTop: 4 }}>{relic.history.map((entry, i) => <li key={`${entry.tick}-${i}`}><time>T{entry.tick}</time><span>{entry.text}</span></li>)}</ol>
                </details>
              </article>
            );
          })}
        </div>
      )}

      {tab === 'CLAN' && (
        <div className="px-stack px-stack--tight">
          <p className="px-muted" style={{ margin: 0, fontSize: '0.85em' }}>Open a dwarf to read their story, temperament, and closest bonds.</p>
          {dwarves.length === 0 && <p className="px-dim">Clan stories begin when dwarves arrive.</p>}
          {dwarves.map((dwarf) => {
            const quirk = dwarf.quirk && QUIRKS[dwarf.quirk];
            const bonds = guild.relationships.filter((r) => r.a === dwarf.id || r.b === dwarf.id).sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 3);
            return (
              <details key={dwarf.id} className="px-card" aria-label={`${dwarf.name} story`}>
                <summary className="px-row">
                  <DwarfPortrait dwarf={dwarf} scale={2} />
                  <span className="min-w-0" style={{ flex: 1 }}><strong>{dwarf.name}</strong><small className="px-muted" style={{ display: 'block' }}>{dwarf.title}</small></span>
                  <span className="px-num px-gold" style={{ fontSize: '0.85em' }}>{dwarf.happiness}% mood</span>
                </summary>
                <div className="px-stack px-stack--tight" style={{ marginTop: 8, fontSize: '0.9em' }}>
                  {quirk && <p style={{ margin: 0 }}><strong className="px-gold">{quirk.name}.</strong> <span className="px-muted">{quirk.description}</span></p>}
                  <blockquote style={{ margin: 0, fontStyle: 'italic' }}>“{dwarf.thought}”</blockquote>
                  {bonds.length === 0 ? <p className="px-dim" style={{ margin: 0 }}>Shared experiences will build their story.</p> : (
                    <ul className="log-list">
                      {bonds.map((bond) => {
                        const other = dwarves.find((d) => d.id === (bond.a === dwarf.id ? bond.b : bond.a));
                        const kind = bond.score >= 5 ? 'Friend' : bond.score <= -5 ? 'Rival' : 'Acquaintance';
                        return (
                          <li key={`${bond.a}-${bond.b}`}>
                            <PixelIcon name={bond.score >= 5 ? 'icon_heart' : bond.score <= -5 ? 'icon_skull' : 'icon_clan'} scale={1} />
                            <span><strong className={bond.score >= 5 ? 'px-good' : bond.score <= -5 ? 'px-bad' : undefined}>{kind}: {other?.name ?? 'someone'}</strong><br /><span className="px-muted">{bond.reason}</span></span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </PixelDialog>
  );
}
