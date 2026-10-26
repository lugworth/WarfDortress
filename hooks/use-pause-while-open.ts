'use client';

import { useEffect } from 'react';
import { useGame } from '@/components/GameProvider';

/** Decision dialogs suspend the clock, then restore the same fortress's prior state. */
export function usePauseWhileOpen(open: boolean) {
  const { gameState, setGameState } = useGame();
  useEffect(() => {
    if (!open) return;
    const { id, paused } = gameState;
    setGameState(previous => ({ ...previous, paused: true }));
    return () => setGameState(previous => previous.id === id ? { ...previous, paused } : previous);
    // Capture the clock only when the dialog opens, not on simulation updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, setGameState]);
}
