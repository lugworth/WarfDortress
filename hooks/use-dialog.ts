'use client';

import { useEffect, useRef } from 'react';

export function useDialog(isOpen: boolean, onClose: () => void): React.RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const element = ref.current;
    const focusable = () => Array.from(element?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter(node => node.getClientRects().length > 0);
    (focusable()[0] ?? element)?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab') {
        const nodes = focusable();
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (!first) { event.preventDefault(); element?.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === element || !element?.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === element || !element?.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [isOpen]);
  return ref;
}
