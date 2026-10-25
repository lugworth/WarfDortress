"use client";
import { useState } from "react";
import type { GameState } from "@/lib/types";
import {
  EXPEDITION_ROUTES,
  createExpeditionState,
  expeditionActionAvailable,
  type ExpeditionAction,
  type ExpeditionApproach,
} from "@/lib/expeditions";
import { formatCost } from "@/lib/tool-catalog";

export default function ExpeditionsPanel({
  state,
  onAction,
}: {
  state: GameState;
  onAction: (action: ExpeditionAction) => boolean;
}) {
  const [status, setStatus] = useState("");
  const [approaches, setApproaches] = useState<
    Record<string, ExpeditionApproach>
  >({});
  const expeditions = state.activities?.expeditions || createExpeditionState(),
    active = expeditions.active;
  const act = (action: ExpeditionAction, message: string) =>
    setStatus(
      onAction(action)
        ? message
        : "Conditions changed. Check supplies, the active trip, and its return time.",
    );
  return (
    <section aria-label="Caravan expeditions" className="space-y-3">
      <p>
        Hire external scouts while your dwarves keep working. Choose a safer
        route or risk a faster, richer trip. Supplies are spent at departure;
        cargo is awarded once when you claim it. Setbacks return the smaller
        cargo shown below.
      </p>
      <p role="status" className="text-[var(--ui-info)]">
        {status}
      </p>
      {active && (
        <div className="space-y-2 border border-[var(--ui-accent)] p-3">
          <h3 className="font-bold">
            {EXPEDITION_ROUTES.find((r) => r.id === active.routeId)?.name} ·{" "}
            {state.ticks >= active.returnsAt ? "Returned" : "Travelling"}
          </h3>
          <p>
            {active.approach === "BOLD" ? "Bold" : "Cautious"} approach ·{" "}
            {Math.max(0, active.returnsAt - state.ticks)} ticks remaining
          </p>
          <progress
            aria-label="Expedition travel progress"
            className="w-full"
            max={active.returnsAt - active.startedAt}
            value={Math.min(
              active.returnsAt - active.startedAt,
              state.ticks - active.startedAt,
            )}
          />
          <button
            type="button"
            className="border border-[var(--ui-success)] px-3 py-2"
            disabled={
              !expeditionActionAvailable(state, {
                type: "CLAIM_EXPEDITION",
                id: active.id,
              })
            }
            onClick={() =>
              act(
                { type: "CLAIM_EXPEDITION", id: active.id },
                "Cargo claimed. Read the journey account below.",
              )
            }
          >
            Claim cargo
          </button>
        </div>
      )}
      {EXPEDITION_ROUTES.map((route) => {
        const approach = approaches[route.id] || "CAUTIOUS",
          plan = route.approaches[approach];
        return (
          <article
            key={route.id}
            className="space-y-2 border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3"
          >
            <h3 className="font-bold text-[var(--ui-accent)]">{route.name}</h3>
            <p>{route.description}</p>
            <p>Departure cost: {formatCost(route.cost)}</p>
            <label className="flex flex-wrap items-center gap-2">
              Approach for {route.name}
              <select
                value={approach}
                onChange={(e) =>
                  setApproaches((p) => ({
                    ...p,
                    [route.id]: e.target.value as ExpeditionApproach,
                  }))
                }
              >
                <option value="CAUTIOUS">Cautious</option>
                <option value="BOLD">Bold</option>
              </select>
            </label>
            <p>
              {plan.duration} ticks · {plan.setbackChance}% setback risk
            </p>
            <p className="text-[var(--ui-success)]">
              Success cargo: {formatCost(plan.reward)}
              {route.relicOnSuccess ? " · one named heirloom" : ""}
            </p>
            <p className="text-[var(--ui-warning)]">
              Setback cargo: {formatCost(route.setbackReward)}
            </p>
            <button
              type="button"
              className="border border-[var(--ui-info)] px-3 py-2"
              disabled={
                !expeditionActionAvailable(state, {
                  type: "START_EXPEDITION",
                  routeId: route.id,
                  approach,
                })
              }
              aria-label={`Launch ${route.name}`}
              onClick={() =>
                act(
                  { type: "START_EXPEDITION", routeId: route.id, approach },
                  `${route.name} has departed. Resume the clock or advance ticks to travel.`,
                )
              }
            >
              Launch scouts
            </button>
            {active && (
              <p className="text-xs text-[var(--ui-muted)]">
                Claim the current expedition before launching another.
              </p>
            )}
          </article>
        );
      })}
      {expeditions.history.length > 0 && (
        <details open>
          <summary>Journey accounts ({expeditions.history.length})</summary>
          <ol className="space-y-2 pt-2">
            {expeditions.history.map((result) => (
              <li
                key={result.id}
                className="border-b border-[var(--ui-border)] pb-2"
              >
                <strong>
                  {EXPEDITION_ROUTES.find((r) => r.id === result.routeId)?.name}
                </strong>{" "}
                · {result.outcome === "SUCCESS" ? "Safe return" : "Setback"} ·
                Tick {result.claimedAt}
                <p>
                  {formatCost(result.reward)}
                  {result.relicId
                    ? " · Named relic added to the Guild Hall"
                    : ""}
                </p>
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
