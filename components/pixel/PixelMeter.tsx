type Tone = 'green' | 'gold' | 'red' | 'blue' | 'violet' | 'ember';

const FILL: Record<Tone, string> = {
  green: 'var(--green)',
  gold: 'var(--gold)',
  red: 'var(--red)',
  blue: 'var(--blue)',
  violet: 'var(--violet)',
  ember: 'var(--ember)',
};

/** A segmented pixel bar. */
export function PixelMeter({ value, max = 100, label, tone = 'green', segments = false, className = '' }: {
  value: number;
  max?: number;
  label: string;
  tone?: Tone;
  segments?: boolean;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(max, value));
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(clamped)}
      className={`px-meter ${className}`}
      data-segments={segments || undefined}
      style={{ '--fill': FILL[tone], '--value': `${percent}%` } as React.CSSProperties}
    >
      <span />
    </div>
  );
}
