"use client";

import { useEffect, useState } from "react";
import { useDialog } from "@/hooks/use-dialog";
import { useGame } from "./GameProvider";
import ExpeditionsPanel from "./ExpeditionsPanel";
import FestivalsPanel from "./FestivalsPanel";
import ResearchPanel from "./ResearchPanel";

const sections = {
  EXPEDITIONS: "Expeditions",
  FESTIVALS: "Celebrations",
  RESEARCH: "Engineering",
} as const;
const button =
  "border border-[var(--ui-border)] px-3 py-2 hover:bg-[var(--ui-selection)]";

export default function AdventureHallModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { gameState, setGameState, stepManualTick, performActivityAction } =
    useGame();
  const dialogRef = useDialog(isOpen, onClose);
  const [section, setSection] = useState<keyof typeof sections>("EXPEDITIONS");
  useEffect(() => {
    if (!isOpen) return;
    const worldId = gameState.id;
    let wasPaused = false;
    setGameState((previous) => {
      wasPaused = previous.paused;
      return { ...previous, paused: true };
    });
    return () =>
      setGameState((previous) =>
        previous.id === worldId ? { ...previous, paused: wasPaused } : previous,
      );
    // Capture the world and pause state at opening, not on every planning action.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, setGameState]);
  if (!isOpen) return null;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Adventure Hall"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4"
    >
      <section className="flex max-h-[94dvh] w-full max-w-5xl flex-col border-2 border-[var(--ui-accent)] bg-[var(--ui-bg)] text-[var(--ui-text)]">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--ui-border)] p-3">
          <div>
            <h2 className="font-bold text-[var(--ui-accent)]">
              [ ADVENTURE HALL ]
            </h2>
            <p className="text-xs text-[var(--ui-muted)]">
              Plan your next story · Tick {gameState.ticks} · Clock paused
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={stepManualTick}>
              [ +1 tick ]
            </button>
            <button type="button" className={button} onClick={onClose}>
              Close
            </button>
          </div>
        </header>
        <nav
          aria-label="Adventure Hall sections"
          className="button-grid border-b border-[var(--ui-border)] p-2"
        >
          {Object.entries(sections).map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={section === id}
              aria-label={
                id === "EXPEDITIONS"
                  ? "Expeditions"
                  : id === "FESTIVALS"
                    ? "Feasts"
                    : "Research"
              }
              className={`${button} ${section === id ? "border-[var(--ui-accent)] text-[var(--ui-accent)] bg-[var(--ui-selection)]" : ""}`}
              onClick={() => setSection(id as keyof typeof sections)}
            >
              {id === "EXPEDITIONS"
                ? "Expeditions"
                : id === "FESTIVALS"
                  ? "Feasts"
                  : "Research"}
            </button>
          ))}
        </nav>
        <p className="px-4 pt-2 text-xs text-[var(--ui-muted)]">
          Plans progress with simulation ticks. Close to return to play, or
          advance one tick here.
        </p>
        <div className="min-h-0 overflow-y-auto p-3 sm:p-4">
          {section === "EXPEDITIONS" && (
            <ExpeditionsPanel
              state={gameState}
              onAction={performActivityAction}
            />
          )}
          {section === "FESTIVALS" && (
            <FestivalsPanel
              state={gameState}
              onAction={performActivityAction}
            />
          )}
          {section === "RESEARCH" && (
            <ResearchPanel state={gameState} onAction={performActivityAction} />
          )}
        </div>
      </section>
    </div>
  );
}
