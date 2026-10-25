"use client";

import { useMemo, useState } from "react";
import { useGame } from "./GameProvider";
import { getFortressNotices } from "@/lib/ui-model";

const noticeStyle = {
  DANGER: { symbol: "!", name: "Danger", color: "text-[var(--ui-danger)]" },
  WARN: { symbol: "△", name: "Warning", color: "text-[var(--ui-warning)]" },
  INFO: { symbol: "i", name: "Info", color: "text-[var(--ui-info)]" },
  DISCOVERY: {
    symbol: "◇",
    name: "Discovery",
    color: "text-[var(--ui-accent)]",
  },
} as const;

const actionClass =
  "shrink-0 border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-info)] hover:border-[var(--ui-info)] focus-visible:outline-2 focus-visible:outline-[var(--ui-accent)] disabled:cursor-not-allowed disabled:opacity-50";

export default function FortressNotices({
  onOpenGuild,
  onShowMap,
}: {
  onOpenGuild: () => void;
  onShowMap: () => void;
}) {
  const { gameState, jumpToLocation, performGuildAction } = useGame();
  const [deliveryStatus, setDeliveryStatus] = useState<{
    worldId: string;
    text: string;
    success: boolean;
  } | null>(null);
  const notices = useMemo(() => {
    const all = getFortressNotices(gameState);
    // Keep one notice from each category before filling spare slots, so a group
    // of raiders cannot hide low supplies or a delivery awaiting the player.
    const selected = (["DANGER", "WARN", "INFO", "DISCOVERY"] as const)
      .map((severity) => all.find((notice) => notice.severity === severity))
      .filter((notice) => notice !== undefined);
    return [
      ...selected,
      ...all.filter((notice) => !selected.includes(notice)),
    ].slice(0, 4);
  }, [gameState]);
  const commission = gameState.guild.commissions.find(
    (c) => c.status === "ACTIVE",
  );
  const remaining = commission
    ? Math.max(0, commission.deadline - gameState.ticks)
    : 0;
  const stock = commission
    ? gameState.resources[commission.requirement.resource]
    : 0;
  const ready = Boolean(
    commission && remaining > 0 && stock >= commission.requirement.amount,
  );

  return (
    <section
      aria-label="Fortress priorities"
      className="shrink-0 border-b border-[var(--ui-border)] bg-[var(--ui-panel)] px-3 py-2 font-mono text-xs"
    >
      <div className="flex min-w-0 items-center gap-3 overflow-x-auto pb-1">
        <h2 className="shrink-0 font-bold text-[var(--ui-accent)]">
          [ PRIORITIES ]
        </h2>
        <ul
          className="flex min-w-0 flex-1 items-stretch gap-2"
          aria-label="Current notices"
        >
          {notices.map((notice) => {
            const style = noticeStyle[notice.severity];
            return (
              <li
                key={notice.id}
                className="flex shrink-0 items-center gap-2 border border-[var(--ui-border)] px-2 py-1"
              >
                <span className={`font-bold ${style.color}`}>
                  <span aria-hidden="true">{style.symbol} </span>
                  {style.name}:
                </span>
                <span className="max-w-64 truncate" title={notice.label}>
                  {notice.label}
                </span>
                {notice.coord && (
                  <button
                    type="button"
                    className={actionClass}
                    aria-label={`Show on map: ${notice.label}`}
                    onClick={() => {
                      const target = notice.coord;
                      if (!target) return;
                      onShowMap();
                      const { x, y, z } = target;
                      jumpToLocation(x, y, z);
                    }}
                  >
                    Map · Z-{notice.coord.z}
                  </button>
                )}
                {notice.action === "GUILD" && (
                  <button
                    type="button"
                    className={actionClass}
                    onClick={onOpenGuild}
                  >
                    Open guild
                  </button>
                )}
              </li>
            );
          })}
          {notices.length === 0 && (
            <li className="shrink-0 py-1 text-[var(--ui-muted)]">
              No urgent notices.
            </li>
          )}
        </ul>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
        {commission ? (
          <>
            <button
              type="button"
              className="text-left text-[var(--ui-info)] underline underline-offset-2"
              onClick={onOpenGuild}
            >
              {commission.title}
            </button>
            <label className="flex items-center gap-2">
              <span>
                Stored: {stock}/{commission.requirement.amount}{" "}
                {commission.requirement.resource}
              </span>
              <progress
                aria-label={`${commission.title} stored goods`}
                max={commission.requirement.amount}
                value={Math.min(stock, commission.requirement.amount)}
                className="h-2 w-24 accent-[var(--ui-success)]"
              />
            </label>
            <span className="text-[var(--ui-muted)]">
              {remaining} ticks until deadline
            </span>
            <button
              type="button"
              className={actionClass}
              disabled={!ready}
              aria-label={`Deliver ${commission.title}`}
              onClick={() => {
                const success = performGuildAction({
                  type: "DELIVER_COMMISSION",
                  id: commission.id,
                });
                setDeliveryStatus({
                  worldId: gameState.id,
                  success,
                  text: success
                    ? `Delivered ${commission.title}. Your reward is in the guild hall.`
                    : "Delivery unavailable. Check the current stock and deadline in the guild hall.",
                });
              }}
            >
              Deliver {commission.requirement.amount}{" "}
              {commission.requirement.resource}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="text-[var(--ui-info)] underline underline-offset-2"
            onClick={onOpenGuild}
          >
            Open guild hall · commissions, relics, and clan stories
          </button>
        )}
        {deliveryStatus?.worldId === gameState.id && (
          <p
            role="status"
            className={
              deliveryStatus.success
                ? "text-[var(--ui-success)]"
                : "text-[var(--ui-danger)]"
            }
          >
            {deliveryStatus.text}
          </p>
        )}
      </div>
    </section>
  );
}
