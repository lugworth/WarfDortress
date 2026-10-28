'use client';

import { useGame } from '@/components/GameProvider';
import { PixelIcon, PixelSprite } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';
import { ToolGlyph } from '@/components/map/MapCards';
import { playTactileSfx } from '@/lib/audio';
import { FORTRESS_RANKS } from '@/lib/progression';
import { formatCost } from '@/lib/tool-catalog';
import ExpeditionsPanel from './ExpeditionsPanel';

const GOAL = FORTRESS_RANKS[FORTRESS_RANKS.length - 1].minScore;

export default function QuestsPanel() {
  const { gameState, progression, selectedTool, setSelectedTool, setInspectMode, claimMilestone, startStrangeMood, completeStrangeMood, performExpeditionAction } = useGame();
  const rank = progression.currentRank;
  const mood = progression.strangeMood;
  const tiers = progression.buildingUnlocks.filter((b) => b.tier > 0);
  const milestones = [...progression.milestones].sort((a, b) => Number(b.completed && !b.claimed) - Number(a.completed && !a.claimed) || Number(a.claimed) - Number(b.claimed));

  return (
    <div className="px-stack" data-testid="progression-panel">
      <section className="px-card" data-tone="gold" aria-label="Mountainhome goal">
        <div className="px-heading"><PixelIcon name="icon_trophy" /> {progression.score >= GOAL ? 'Mountainhome reached!' : 'Build a Mountainhome'}</div>
        <PixelMeter value={progression.score} max={GOAL} label="Mountainhome progress" tone="gold" segments />
        <p className="px-muted" style={{ margin: '6px 0 0', fontSize: '0.85em' }}>
          <strong className="px-gold px-num">{progression.score.toLocaleString()}</strong> / {GOAL.toLocaleString()} fortress score from wealth, population, workshops, depth, and relics.
        </p>
      </section>

      <section className="px-card" data-testid="fortress-rank-card" aria-label="Fortress rank">
        <div className="px-heading">
          <PixelIcon name="icon_star" /> Rank {rank.tier}: {rank.title}
          <small>“{rank.dwarvenTitle}”</small>
        </div>
        <p className="px-good" style={{ margin: '0 0 6px', fontSize: '0.85em' }}>{rank.perk}</p>
        {progression.nextRank ? (
          <>
            <PixelMeter value={progression.rankProgressPercent} label={`Progress to ${progression.nextRank.title}`} tone="ember" segments />
            <p className="px-dim" style={{ margin: '4px 0 0', fontSize: '0.8em' }}>Next: {progression.nextRank.title} at {progression.nextRank.minScore.toLocaleString()} · {progression.rankProgressPercent}%</p>
          </>
        ) : <p className="px-gold" style={{ margin: 0 }}>Sovereign of the deep realm.</p>}
      </section>

      <section className="px-card" data-tone="violet" data-testid="strange-mood-card" aria-label="Strange mood">
        <div className="px-heading"><PixelSprite name="relic" scale={1} /> Strange mood <small>{gameState.guild.relics.length} relics</small></div>
        {mood ? (
          <div className="px-stack px-stack--tight" style={{ fontSize: '0.85em' }}>
            <strong>{mood.dwarfName} is {mood.moodKind.toLowerCase()}</strong>
            <span className="px-violet">Forging “{mood.artifactName}”</span>
            <span className="px-ember">Needs {formatCost(mood.demands)} · {Math.max(0, mood.deadline - gameState.ticks)} ticks left</span>
            <button type="button" className="px-btn px-btn--violet px-btn--block" disabled={!progression.canFulfillMood}
              onClick={() => { playTactileSfx('stamp'); completeStrangeMood(); }}>
              <PixelIcon name="icon_relic" /> Supply the artisan
            </button>
          </div>
        ) : (
          <div className="px-stack px-stack--tight" style={{ fontSize: '0.85em' }}>
            <span className="px-muted">Inspire a skilled artisan to claim a workshop and forge a legendary artifact (+350 wealth and a relic blessing).</span>
            <button type="button" className="px-btn px-btn--violet px-btn--block" onClick={() => { playTactileSfx('tool'); startStrangeMood(); }}>
              <PixelIcon name="icon_star" /> Inspire a strange mood
            </button>
          </div>
        )}
      </section>

      <section aria-label="Milestones" data-testid="milestones-list" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_check" /> Milestones <small>{progression.milestones.filter((m) => m.claimed).length}/{progression.milestones.length} claimed</small></div>
        {milestones.map((ms) => (
          <article key={ms.id} className="px-card" data-tone={ms.completed && !ms.claimed ? 'green' : undefined} style={{ opacity: ms.claimed ? 0.65 : 1 }}>
            <div className="px-row px-row--between">
              <strong>{ms.claimed ? '✓ ' : ''}{ms.title}</strong>
              <span className="px-num px-info" style={{ fontSize: '0.8em' }}>{Math.min(ms.progress, ms.target)}/{ms.target}</span>
            </div>
            <PixelMeter value={ms.progress} max={ms.target} label={`${ms.title} progress`} tone={ms.completed ? 'green' : 'blue'} />
            <p className="px-muted" style={{ margin: '4px 0 2px', fontSize: '0.8em' }}>{ms.description}</p>
            <span className="px-ember" style={{ fontSize: '0.8em' }}>Reward: {ms.rewardSummary}</span>
            {ms.completed && !ms.claimed && (
              <button type="button" className="px-btn px-btn--green px-btn--block" style={{ marginTop: 6 }}
                onClick={() => { playTactileSfx('stamp'); claimMilestone(ms.id); }}>
                <PixelIcon name="icon_star" /> Claim reward
              </button>
            )}
          </article>
        ))}
      </section>

      <section aria-label="Blueprints" data-testid="building-unlocks-list" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_hammer" /> Blueprints <small>{tiers.filter((b) => b.unlocked).length}/{tiers.length} unlocked</small></div>
        {tiers.map((b) => (
          <article key={b.tool} className="px-card blueprint" data-testid={`tech-unlock-${b.tool}`} data-tone={b.unlocked && selectedTool === b.tool ? 'gold' : undefined}>
            <ToolGlyph tool={b.tool} locked={!b.unlocked} animate={b.unlocked} />
            <div className="min-w-0" style={{ flex: 1 }}>
              <div className="px-row px-row--between">
                <strong className={b.unlocked ? 'px-good' : undefined}>{b.title}</strong>
                <span className="px-dim" style={{ fontSize: '0.75em' }}>Tier {b.tier}</span>
              </div>
              {b.unlocked
                ? <span className="px-muted" style={{ fontSize: '0.8em' }}>Cost {formatCost(b.cost)}</span>
                : <>
                  <PixelMeter value={b.progressPercent} label={`${b.title} unlock progress`} tone="ember" />
                  <span className="px-muted" style={{ fontSize: '0.8em' }}>{b.requirementLabel} · <span className="px-info">{b.progressText}</span></span>
                </>}
            </div>
            {b.unlocked && (
              <button type="button" className="px-btn px-btn--small" aria-pressed={selectedTool === b.tool}
                onClick={() => { playTactileSfx('tool'); setInspectMode(false); setSelectedTool(b.tool); }}>
                Build
              </button>
            )}
          </article>
        ))}
      </section>

      <section aria-label="Scouting expeditions" className="px-stack px-stack--tight">
        <div className="px-heading"><PixelIcon name="icon_scroll" /> Scouting expeditions</div>
        <ExpeditionsPanel state={gameState} onAction={performExpeditionAction} />
      </section>
    </div>
  );
}
