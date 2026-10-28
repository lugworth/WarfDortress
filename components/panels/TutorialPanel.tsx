'use client';

import { useEffect, useRef } from 'react';
import { useGame } from '@/components/GameProvider';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import { PixelMeter } from '@/components/pixel/PixelMeter';
import { FORTRESS_RANKS } from '@/lib/progression';
import { TUTORIAL_STEPS, type TutorialAction } from '@/lib/tutorial';

const GOAL = FORTRESS_RANKS[FORTRESS_RANKS.length - 1].minScore;

export default function TutorialPanel({ step, onStep, onFinish, onAction }: {
  step: number;
  onStep: (step: number) => void;
  onFinish: () => void;
  onAction: (action: TutorialAction) => void;
}) {
  const { gameState, progression } = useGame();
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);
  const current = TUTORIAL_STEPS[step];
  const last = step === TUTORIAL_STEPS.length - 1;

  return (
    <div className="tutorial">
      <div className="drawer-body px-scroll" ref={bodyRef}>
        <label className="px-stack px-stack--tight">
          <span className="px-dim" style={{ fontSize: '0.75em' }}>Topic</span>
          <select className="px-input" value={step} onChange={(e) => onStep(Number(e.target.value))}>
            {TUTORIAL_STEPS.map((s, i) => <option key={s.title} value={i}>{i + 1}. {s.title}</option>)}
          </select>
        </label>
        <div className="tutorial-steps" aria-hidden="true">
          {TUTORIAL_STEPS.map((s, i) => <span key={s.title} data-done={i < step || undefined} data-current={i === step || undefined} />)}
        </div>
        <div aria-live="polite">
          <p className="px-dim" style={{ margin: '0 0 4px', fontSize: '0.8em' }}>Step {step + 1} of {TUTORIAL_STEPS.length} · {gameState.paused ? 'clock paused' : 'clock running'}</p>
          <h3 className="px-title" style={{ fontSize: '0.7rem' }}>{current.title}</h3>
          <p style={{ margin: '8px 0 0' }}>{current.body}</p>
        </div>
        {(step === 0 || last) && (
          <div className="px-card" data-tone="gold">
            <strong className="px-gold">Mountainhome capital</strong>
            <PixelMeter value={progression.score} max={GOAL} label="Mountainhome goal progress" tone="gold" segments />
            <small className="px-num px-muted">{progression.score.toLocaleString()} / {GOAL.toLocaleString()} fortress score</small>
          </div>
        )}
        <dl className="tutorial-entries">
          {current.entries.map((entry) => <div key={entry.name}><dt>{entry.name}</dt><dd>{entry.text}</dd></div>)}
        </dl>
        {current.action && (
          <button type="button" className="px-btn px-btn--gold px-btn--block" onClick={() => onAction(current.action!.target)}>
            {current.action.label} <PixelIcon name="icon_play" />
          </button>
        )}
      </div>
      <footer className="dialog-foot">
        <button type="button" className="px-btn px-btn--small" disabled={step === 0} onClick={() => onStep(step - 1)}>Back</button>
        <span className="spacer" />
        {last
          ? <button type="button" className="px-btn px-btn--green" onClick={onFinish}><PixelIcon name="icon_play" /> Finish & play</button>
          : <button type="button" className="px-btn px-btn--gold" onClick={() => onStep(step + 1)}>Next</button>}
      </footer>
    </div>
  );
}
