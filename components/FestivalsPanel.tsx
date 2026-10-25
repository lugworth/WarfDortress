"use client";
import { useState } from "react";
import type { GameState } from "@/lib/types";
import {
  FESTIVALS,
  FESTIVAL_DURATION,
  FESTIVAL_COOLDOWN,
  createFestivalState,
  festivalBlockers,
  type FestivalAction,
} from "@/lib/festivals";
import { formatCost } from "@/lib/tool-catalog";

export default function FestivalsPanel({
  state,
  onAction,
}: {
  state: GameState;
  onAction: (action: FestivalAction) => boolean;
}) {
  const [status, setStatus] = useState("");
  const festivals = state.activities?.festivals || createFestivalState();
  return (
    <section aria-label="Clan celebrations" className="space-y-3">
      <p>
        Spend a little of your stores to give the clan a story worth
        remembering. One celebration at a time; each lasts {FESTIVAL_DURATION}{" "}
        ticks and can be held again {FESTIVAL_COOLDOWN} ticks after its start.
      </p>
      <p role="status" className="text-[var(--ui-info)]">
        {status}
      </p>
      {festivals.active && (
        <p className="border border-[var(--ui-success)] p-2">
          Now celebrating:{" "}
          {FESTIVALS.find((f) => f.id === festivals.active!.festival)?.title} ·{" "}
          {Math.max(0, festivals.active.expiresAt - state.ticks)} ticks
          remaining
        </p>
      )}
      {FESTIVALS.map((festival) => {
        const blockers = festivalBlockers(state, festival.id);
        return (
          <article
            key={festival.id}
            className="space-y-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3"
          >
            <h3 className="font-bold text-[var(--ui-accent)]">
              {festival.title}
            </h3>
            <p>{festival.description}</p>
            <p className="text-[var(--ui-success)]">{festival.effect}</p>
            <p>Cost: {formatCost(festival.cost)}</p>
            <p>
              Requires:{" "}
              {festival.buildingLabel || "Starting camp — no building needed"}
            </p>
            <button
              type="button"
              className="border border-[var(--ui-info)] px-3 py-2"
              disabled={blockers.length > 0}
              aria-describedby={
                blockers.length ? `festival-${festival.id}-blockers` : undefined
              }
              onClick={() =>
                setStatus(
                  onAction({ type: "START_FESTIVAL", festival: festival.id })
                    ? `${festival.title} has begun. Close the hall or advance ticks to enjoy the celebration.`
                    : "Conditions changed. Check stores, buildings, and cooldowns.",
                )
              }
            >
              Hold {festival.title}
            </button>
            {blockers.length > 0 && (
              <p
                id={`festival-${festival.id}-blockers`}
                className="text-[var(--ui-warning)]"
              >
                {blockers.join(" · ")}
              </p>
            )}
          </article>
        );
      })}
      {festivals.memories.length > 0 && (
        <details open>
          <summary>Clan memories ({festivals.memories.length})</summary>
          <ol className="space-y-2 pt-2">
            {[...festivals.memories].reverse().map((m, i) => (
              <li key={`${m.tick}-${m.festival}-${i}`}>
                <span className="text-[var(--ui-muted)]">Tick {m.tick}:</span>{" "}
                {m.anecdote}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
