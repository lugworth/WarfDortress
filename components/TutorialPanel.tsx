'use client';

import { useEffect, useRef } from 'react';
import { useGame } from './GameProvider';
import { FORTRESS_RANKS } from '@/lib/progression';
import { TUTORIAL_STEPS, type TutorialAction } from '@/lib/tutorial';

export default function TutorialPanel({ step, onStep, onClose, onFinish, onAction }: {
  step: number;
  onStep: (step: number) => void;
  onClose: () => void;
  onFinish: () => void;
  onAction: (action: TutorialAction) => void;
}) {
  const { gameState, progression } = useGame();
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bodyRef.current?.scrollTo({ top: 0 }); }, [step]);
  const current = TUTORIAL_STEPS[step];
  const target = FORTRESS_RANKS[FORTRESS_RANKS.length - 1].minScore;
  return <aside className="workspace-sidebar workspace-sidebar--right tutorial-panel" aria-label="New colony guide">
    <div className="workspace-sidebar-heading"><strong>New colony guide</strong><button onClick={onClose} aria-label="Close tutorial">×</button></div>
    <div className="tutorial-topic"><label htmlFor="tutorial-topic">Jump to a topic</label><select id="tutorial-topic" value={step} onChange={e => onStep(Number(e.target.value))}>{TUTORIAL_STEPS.map((s, i) => <option key={s.title} value={i}>{i + 1}. {s.title}</option>)}</select></div>
    <div className="tutorial-body" ref={bodyRef}>
      <p className="tutorial-position">Step {step + 1} of {TUTORIAL_STEPS.length} · {gameState.paused ? 'Clock paused' : 'Colony running'}</p>
      <div aria-live="polite"><h2>{current.title}</h2><p className="tutorial-intro">{current.body}</p></div>
      {(step === 0 || step === TUTORIAL_STEPS.length - 1) && <div className="tutorial-goal"><strong>Mountainhome Capital</strong><progress aria-label="Mountainhome goal progress" value={Math.min(target, progression.score)} max={target} /><span>{progression.score.toLocaleString()} / {target.toLocaleString()} fortress score</span></div>}
      <dl>{current.entries.map(entry => <div key={entry.name}><dt>{entry.name}</dt><dd>{entry.text}</dd></div>)}</dl>
      {current.action && <button className="ui-button tutorial-action" onClick={() => onAction(current.action!.target)}>{current.action.label} →</button>}
    </div>
    <footer className="tutorial-footer"><div><button className="ui-button" disabled={step === 0} onClick={() => onStep(step - 1)}>Back</button>{step === TUTORIAL_STEPS.length - 1 ? <button className="ui-button tutorial-next" onClick={onFinish}>Finish & resume</button> : <button className="ui-button tutorial-next" onClick={() => onStep(step + 1)}>Next →</button>}</div><p>Close anytime. Reopen from Menu → How to play.</p></footer>
  </aside>;
}
