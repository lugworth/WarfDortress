'use client';

import { useState } from 'react';
import { useGame } from './GameProvider';
import { usePauseWhileOpen } from '@/hooks/use-pause-while-open';
import { useDialog } from '@/hooks/use-dialog';
import { QUIRKS, RELIC_TEMPLATES } from '@/lib/guild';
import { formatCost } from '@/lib/tool-catalog';
import type { Civilization, Commission, GuildAction } from '@/lib/types';
import AsciiSelect from './AsciiSelect';

const TABS = { COMMISSIONS: 'Commissions', RELICS: 'Relics', CLAN: 'Clan stories' } as const;
type GuildTab = keyof typeof TABS;

export default function GuildHallModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { gameState, performGuildAction } = useGame();
  const dialogRef = useDialog(isOpen, onClose);
  const [tab, setTab] = useState<GuildTab>('COMMISSIONS');
  const [status, setStatus] = useState('');
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [patrons, setPatrons] = useState<Record<string, Civilization['race']>>({});
  usePauseWhileOpen(isOpen);

  if (!isOpen) return null;
  const { guild, resources, dwarves, ticks } = gameState;
  const active = guild.commissions.find(c => c.status === 'ACTIVE');
  const offers = guild.commissions.filter(c => c.status === 'OFFERED');
  const past = guild.commissions.filter(c => c.status === 'COMPLETED' || c.status === 'EXPIRED');
  const act = (action: GuildAction, message: string) => {
    setStatus(performGuildAction(action) ? message : 'Unable to complete that action. Check your supplies and selection.');
  };
  const selectTab = (next: GuildTab) => { setTab(next); setStatus(''); };

  const commissionCard = (commission: Commission) => {
    const { resource, amount } = commission.requirement;
    const stock = resources[resource];
    const remaining = Math.max(0, commission.deadline - ticks);
    const accepted = commission.status === 'ACTIVE';
    const ready = stock >= amount;
    const label = remaining === 0 ? 'Expired' : accepted ? ready ? 'Ready to deliver' : 'In progress' : 'Available';
    const blocked = remaining === 0 || (accepted ? !ready : Boolean(active));
    return (
      <article key={commission.id} className={`guild-card${accepted ? ' guild-card-active' : ''}`} aria-label={commission.title}>
        <div className="guild-card-heading">
          <h3>{commission.title}</h3>
          <span className={`guild-badge${accepted && ready && remaining > 0 ? ' guild-ready' : ''}`}>{label}</span>
        </div>
        <p className="guild-muted">{commission.patron} · {remaining} ticks remaining</p>
        <div className="guild-delivery">
          <strong>Deliver {formatCost({ [resource]: amount })}</strong>
          <span>{stock} / {amount} in storage</span>
        </div>
        <progress aria-label={`${commission.title} delivery progress`} value={Math.min(stock, amount)} max={amount} />
        <p className="guild-reward">Reward: <strong>{commission.reward.wealth} wealth</strong> · +{commission.reward.favor} favor · a named relic</p>
        <details className="guild-details">
          <summary>Commission details</summary>
          <p>{commission.description}</p>
          <p>Relic reward: {RELIC_TEMPLATES[commission.reward.relic]?.name ?? commission.reward.relic}</p>
        </details>
        <div className="guild-card-footer">
          <button className="guild-button guild-primary" disabled={blocked} onClick={() => accepted
            ? act({ type: 'DELIVER_COMMISSION', id: commission.id }, 'Goods delivered. Your reward is in the relic vault.')
            : act({ type: 'ACCEPT_COMMISSION', id: commission.id }, `Accepted ${commission.title}. Gather the supplies, then deliver them here.`)}>
            {accepted ? 'Deliver goods' : 'Accept commission'}
          </button>
          <span className="guild-muted">{remaining === 0 ? 'This commission has expired.' : accepted && !ready
            ? `Still needed: ${formatCost({ [resource]: amount - stock })}.`
            : !accepted && active ? 'Finish your active commission first.' : 'Delivery uses the listed supplies.'}</span>
        </div>
      </article>
    );
  };

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Guild Hall" tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 font-mono text-[var(--ui-text)]">
      <section className="guild-hall">
        <header className="guild-header">
          <div><h2>[ GUILD HALL ]</h2><p>Royal commissions, heirlooms, and your clan.</p></div>
          <div className="guild-header-actions"><span>Clock paused</span><button className="guild-button" onClick={onClose}>Close</button></div>
        </header>
        <nav className="guild-tabs" aria-label="Guild Hall sections">
          {(Object.keys(TABS) as GuildTab[]).map(id => <button key={id} aria-pressed={tab === id} onClick={() => selectTab(id)}>{TABS[id]}</button>)}
        </nav>
        {status && <p className="guild-feedback" role="status">{status}</p>}
        <div className="guild-body">
          {tab === 'COMMISSIONS' && <>
            <p className="guild-intro">Accept one commission at a time. Gather the requested supplies, then return here to deliver them.</p>
            {active && <section className="guild-section" aria-label="Active commission"><h3 className="guild-section-title">Your active commission</h3>{commissionCard(active)}</section>}
            <section className="guild-section" aria-label="Available commissions">
              <h3 className="guild-section-title">Available commissions</h3>
              {offers.length ? offers.map(commissionCard) : <p className="guild-empty-note">No open offers. New commissions arrive next season.</p>}
            </section>
            <details className="guild-disclosure">
              <summary>Diplomacy & favor</summary>
              <p className="guild-muted">Completed commissions earn favor with their patron. 15 favor earns a trade partnership; 30 earns an alliance.</p>
              <dl className="guild-favor-list">{gameState.world.civilizations.map(civ => <div key={civ.id}><dt>{civ.race}</dt><dd>{guild.favor[civ.race]}/100 <span>· {civ.stance}</span></dd></div>)}</dl>
              <p className="guild-muted">Allied goblins stop sending automatic raids.</p>
            </details>
            {past.length > 0 && <details className="guild-disclosure"><summary>Past commissions ({past.length})</summary><ul className="guild-history-list">{past.map(c => <li key={c.id}><span>{c.title}</span><span className="guild-muted">{c.status === 'COMPLETED' ? 'Completed' : 'Expired'}</span></li>)}</ul></details>}
          </>}

          {tab === 'RELICS' && <>
            <p className="guild-intro">Display a relic to bless the fortress, or entrust it to a dwarf. Each dwarf can carry one relic.</p>
            {guild.relics.length === 0 && <div className="guild-empty-state"><span className="guild-empty-glyph" aria-hidden="true">☼</span><h3>Your relic vault is empty</h3><p>Complete a commission or recover an ancient cavern relic to begin your collection.</p><button className="guild-button guild-primary" onClick={() => selectTab('COMMISSIONS')}>View commissions</button></div>}
            {guild.relics.map(relic => {
              const template = RELIC_TEMPLATES[relic.template];
              const candidate = owners[relic.id] || relic.ownerId || dwarves[0]?.id || '';
              const ownerId = dwarves.some(d => d.id === candidate) ? candidate : dwarves[0]?.id || '';
              const patron = patrons[relic.id] || 'Dwarves';
              const bearer = dwarves.find(d => d.id === relic.ownerId)?.name;
              const mode = relic.mode === 'EQUIPPED' ? `Carried by ${bearer ?? 'a dwarf'}` : relic.mode === 'GIFTED' ? `Gifted to ${relic.giftedTo}` : relic.mode === 'DISPLAYED' ? 'On display' : 'In storage';
              return <article key={relic.id} className="guild-card" aria-label={relic.name}>
                <div className="guild-card-heading"><h3>{relic.name}</h3><span className="guild-badge">{mode}</span></div>
                <p className="guild-muted">Found by {relic.discoveredBy} · Tick {relic.discoveredAt}</p>
                <dl className="guild-relic-effects"><div><dt>On display</dt><dd>{template?.display}</dd></div><div><dt>When carried</dt><dd>{template?.equip}</dd></div></dl>
                {relic.mode !== 'GIFTED' && <>
                  <button className="guild-button guild-primary" onClick={() => act({ type: 'SET_RELIC_MODE', id: relic.id, mode: relic.mode === 'DISPLAYED' ? 'STORED' : 'DISPLAYED' }, relic.mode === 'DISPLAYED' ? 'Relic returned to storage. Its effects are inactive.' : 'Relic on display. Its blessing and upkeep apply every 20 ticks.')}>
                    {relic.mode === 'DISPLAYED' ? 'Return to storage' : 'Display relic'}
                  </button>
                  <details className="guild-details guild-manage"><summary>Assign a bearer or send a gift</summary>
                    <div className="guild-control-row"><label>Bearer<AsciiSelect<string> ariaLabel={`Bearer for ${relic.name}`} value={ownerId} options={dwarves.map(d => ({ value: d.id, label: d.name }))} onChange={value => setOwners(previous => ({ ...previous, [relic.id]: value }))} /></label>
                      <button className="guild-button" disabled={!ownerId || (relic.mode === 'EQUIPPED' && relic.ownerId === ownerId)} onClick={() => act({ type: 'SET_RELIC_MODE', id: relic.id, mode: 'EQUIPPED', ownerId }, 'Relic entrusted to its bearer. Their previous relic, if any, was stored.')}>Equip relic</button>
                    </div>
                    <div className="guild-control-row"><label>Gift recipient<AsciiSelect<Civilization['race']> ariaLabel={`Gift recipient for ${relic.name}`} value={patron} options={gameState.world.civilizations.map(civ => ({ value: civ.race, label: civ.race }))} onChange={value => setPatrons(previous => ({ ...previous, [relic.id]: value }))} /></label>
                      <button className="guild-button" onClick={() => act({ type: 'GIFT_RELIC', id: relic.id, patron }, 'Relic gifted. Gained 15 favor; its history remains in the archive.')}>Gift for +15 favor</button>
                    </div>
                    <p className="guild-muted">Gifting permanently gives the relic away.</p>
                    {relic.mode === 'EQUIPPED' && <button className="guild-button" onClick={() => act({ type: 'SET_RELIC_MODE', id: relic.id, mode: 'STORED' }, 'Relic returned to storage.')}>Return to storage</button>}
                  </details>
                </>}
                <details className="guild-details"><summary>Relic history ({relic.history.length})</summary><ol>{relic.history.map((entry, i) => <li key={`${entry.tick}-${i}`}><span className="guild-muted">Tick {entry.tick}</span> · {entry.text}</li>)}</ol></details>
              </article>;
            })}
          </>}

          {tab === 'CLAN' && <>
            <p className="guild-intro">Select a dwarf to read their story, personality, and closest bonds.</p>
            {dwarves.length === 0 && <p className="guild-empty-note">Clan stories begin when dwarves arrive.</p>}
            {dwarves.map(dwarf => {
              const quirk = dwarf.quirk && QUIRKS[dwarf.quirk];
              const bonds = guild.relationships.filter(r => r.a === dwarf.id || r.b === dwarf.id).sort((a,b) => Math.abs(b.score)-Math.abs(a.score)).slice(0,3);
              return <details key={dwarf.id} className="guild-dwarf" aria-label={`${dwarf.name} story`}>
                <summary><span><strong>{dwarf.name}</strong><span className="guild-dwarf-role">{dwarf.title}</span></span><span className="guild-dwarf-morale">{dwarf.happiness}% morale</span></summary>
                <div className="guild-dwarf-story">{quirk && <><h4>{quirk.name}</h4><p>{quirk.description}</p></>}
                  <blockquote>“{dwarf.thought}”</blockquote>
                  {bonds.length === 0 ? <p className="guild-muted">Shared experiences will build their story.</p> : <ul className="guild-bonds">{bonds.map(bond => {
                    const companion = dwarves.find(d => d.id === (bond.a === dwarf.id ? bond.b : bond.a));
                    return <li key={`${bond.a}-${bond.b}`}><strong className={bond.score >= 5 ? 'guild-friend' : bond.score <= -5 ? 'guild-rival' : ''}>{bond.score >= 5 ? 'Friend' : bond.score <= -5 ? 'Rival' : 'Acquaintance'}: {companion?.name ?? 'Unknown dwarf'}</strong><p>{bond.reason}</p></li>;
                  })}</ul>}
                </div>
              </details>;
            })}
          </>}
        </div>
      </section>
    </div>
  );
}
