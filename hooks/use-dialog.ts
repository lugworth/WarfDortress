'use client';
import { useEffect, useRef } from 'react';

export function useDialog(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => { closeRef.current = close; }, [close]);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    root?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key !== 'Tab' || !root) return;
      const elements = [...root.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea, [tabindex="0"]')];
      if (!elements.length) { event.preventDefault(); return; }
      const index = elements.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); elements.at(-1)?.focus(); }
      else if (!event.shiftKey && (index === elements.length - 1 || index < 0)) { event.preventDefault(); elements[0].focus(); }
    };
    root?.addEventListener('keydown', handler);
    return () => { root?.removeEventListener('keydown', handler); previous?.focus(); };
  }, [open]);
  return ref;
}
