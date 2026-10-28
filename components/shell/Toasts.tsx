'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/components/GameProvider';
import { PixelIcon } from '@/components/pixel/PixelIcon';
import type { SpriteName } from '@/lib/pixel/sprites';
import type { ChronicleEntry } from '@/lib/types';

interface Toast { id: string; text: string; tone: 'danger' | 'good' | 'info'; icon: SpriteName }

const TOAST_FOR: Partial<Record<ChronicleEntry['type'], Pick<Toast, 'tone' | 'icon'>>> = {
  ALERT: { tone: 'danger', icon: 'icon_warning' },
  COMBAT: { tone: 'danger', icon: 'icon_sword' },
  CRAFT: { tone: 'good', icon: 'icon_star' },
};

/** Pops up alerts, fights, and masterworks from the chronicle, plus save results. */
export default function Toasts() {
  const { gameState, saveStatus } = useGame();
  const head = gameState.chronicle[0]?.id ?? '';
  const [feed, setFeed] = useState({ fortress: gameState.id, head, toasts: [] as Toast[] });

  if (feed.fortress !== gameState.id) {
    setFeed({ fortress: gameState.id, head, toasts: [] });
  } else if (feed.head !== head) {
    const fresh: Toast[] = [];
    for (const entry of gameState.chronicle) {
      if (entry.id === feed.head || fresh.length >= 3) break;
      const style = TOAST_FOR[entry.type];
      if (style) fresh.push({ id: entry.id, text: entry.text, ...style });
    }
    setFeed({ ...feed, head, toasts: [...fresh, ...feed.toasts].slice(0, 4) });
  }

  // The oldest toast leaves every few seconds.
  useEffect(() => {
    if (!feed.toasts.length) return;
    const timer = window.setTimeout(() => setFeed((f) => ({ ...f, toasts: f.toasts.slice(0, -1) })), 4500);
    return () => window.clearTimeout(timer);
  }, [feed.toasts]);

  const dismiss = (id: string) => setFeed((f) => ({ ...f, toasts: f.toasts.filter((t) => t.id !== id) }));

  return (
    <div className="toasts" aria-live="polite">
      {saveStatus && (
        <div key={saveStatus} className="toast px-panel" data-tone="good" role="status">
          <PixelIcon name="icon_save" />
          <span>{saveStatus}</span>
        </div>
      )}
      {feed.toasts.map((toast) => (
        <button key={toast.id} type="button" className="toast px-panel" data-tone={toast.tone} onClick={() => dismiss(toast.id)}>
          <PixelIcon name={toast.icon} />
          <span>{toast.text}</span>
        </button>
      ))}
    </div>
  );
}
