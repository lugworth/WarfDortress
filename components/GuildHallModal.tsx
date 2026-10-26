"use client";

import { useState } from "react";
import { useGame } from "./GameProvider";
import { usePauseWhileOpen } from "@/hooks/use-pause-while-open";
import { useDialog } from "@/hooks/use-dialog";
import { QUIRKS, RELIC_TEMPLATES } from "@/lib/guild";
import type { Civilization, GuildAction } from "@/lib/types";
import AsciiSelect from "./AsciiSelect";

const buttonClass =
  "border border-[#404040] px-2 py-1 text-[var(--ui-info)] hover:border-[var(--ui-info)] focus-visible:outline-2 focus-visible:outline-[var(--ui-accent)] disabled:opacity-40 disabled:cursor-not-allowed";
const cardClass =
  "border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3 space-y-2";
const TAB_NAMES = {
  COMMISSIONS: "Royal commissions",
  RELICS: "Named relics",
  CLAN: "Clan stories",
} as const;

export default function GuildHallModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { gameState, performGuildAction } = useGame();
  const dialogRef = useDialog(isOpen, onClose);
  const [tab, setTab] = useState<keyof typeof TAB_NAMES>("COMMISSIONS");
  const [status, setStatus] = useState("");
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [patrons, setPatrons] = useState<Record<string, Civilization["race"]>>(
    {},
  );

  usePauseWhileOpen(isOpen);

  if (!isOpen) return null;
  const { guild, resources, dwarves } = gameState;
  const active = guild.commissions.find((c) => c.status === "ACTIVE");
  const act = (action: GuildAction, message: string) => {
    setStatus(
      performGuildAction(action)
        ? message
        : "Conditions changed. Check your stocks, deadline, or chosen bearer and try again.",
    );
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Guild Hall"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 font-mono text-[var(--ui-text)]"
    >
      <section className="flex max-h-[92dvh] w-full max-w-4xl flex-col border-2 border-[var(--ui-accent)] bg-black text-sm">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] p-3">
          <div>
            <h2 className="font-bold text-[var(--ui-accent)]">
              [ GUILD HALL ]
            </h2>
            <p className="text-xs text-[var(--ui-muted)]">
              Commissions, heirlooms, and the stories of your clan · Clock
              paused
            </p>
          </div>
          <button type="button" onClick={onClose} className={buttonClass}>
            Close
          </button>
        </header>
        <nav
          aria-label="Guild Hall sections"
          className="button-grid border-b border-[var(--ui-border)] p-2"
        >
          {Object.entries(TAB_NAMES).map(([id, name]) => (
            <button
              key={id}
              type="button"
              aria-pressed={tab === id}
              onClick={() => {
                setTab(id as keyof typeof TAB_NAMES);
                setStatus("");
              }}
              className={`${buttonClass} ${tab === id ? "bg-[var(--ui-border)] text-[var(--ui-accent)]" : ""}`}
              aria-label={name}
            >
              {id === "COMMISSIONS"
                ? "Commissions"
                : id === "RELICS"
                  ? "Relics"
                  : "Clan"}
            </button>
          ))}
        </nav>
        <p
          role="status"
          aria-live="polite"
          className="px-3 pt-2 text-xs text-[var(--ui-success)]"
        >
          {status ||
            (active
              ? `Active charter: ${active.title}`
              : "No active commission. Choose a charter or explore your clan stories.")}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
          {tab === "COMMISSIONS" && (
            <>
              <p className="text-xs text-[var(--ui-muted)]">
                Two new offers arrive each season. Accept one at a time;
                delivery consumes the listed stock. An expired offer costs
                nothing. Every completed charter awards wealth, favor, and a
                named relic.
              </p>
              <div
                className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                aria-label="Civilization favor"
              >
                {gameState.world.civilizations.map((civ) => (
                  <div key={civ.id} className={cardClass}>
                    <div className="text-[var(--ui-info)]">{civ.race}</div>
                    <div className="text-xs">
                      Favor {guild.favor[civ.race]}/100 · {civ.stance}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-[var(--ui-muted)]">
                Favor 15 turns neutral patrons into trade partners; favor 30
                earns an alliance. Allied goblins stop sending automatic raids.
              </p>
              {guild.commissions.map((commission) => {
                const { resource, amount } = commission.requirement;
                const stock = resources[resource];
                const open =
                  commission.status === "OFFERED" ||
                  commission.status === "ACTIVE";
                const remaining = Math.max(
                  0,
                  commission.deadline - gameState.ticks,
                );
                return (
                  <article
                    key={commission.id}
                    className={cardClass}
                    aria-label={commission.title}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h3 className="font-bold text-[var(--ui-accent)]">
                        {commission.title}
                      </h3>
                      <span className="text-xs text-[var(--ui-info)]">
                        {commission.status} · {commission.patron}
                      </span>
                    </div>
                    <p>
                      Deliver{" "}
                      <strong>
                        {amount} {resource}
                      </strong>
                      {open ? ` · ${remaining} ticks left in the season` : ""}
                    </p>
                    {open && (
                      <>
                        <progress
                          aria-label={`${commission.title} delivery progress`}
                          className="w-full h-2 accent-[var(--ui-success)]"
                          value={Math.min(amount, stock)}
                          max={amount}
                        />
                        <p className="text-xs text-[var(--ui-muted)]">
                          In storage: {stock}/{amount}
                        </p>
                      </>
                    )}
                    <p className="text-xs">
                      Reward: {commission.reward.wealth} wealth ·{" "}
                      {commission.reward.favor} favor ·{" "}
                      {RELIC_TEMPLATES[commission.reward.relic].name}
                    </p>
                    {commission.status === "OFFERED" && (
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={Boolean(active) || remaining === 0}
                        onClick={() =>
                          act(
                            { type: "ACCEPT_COMMISSION", id: commission.id },
                            `Accepted ${commission.title}. Gather the goods, then deliver them here.`,
                          )
                        }
                      >
                        Accept commission
                      </button>
                    )}
                    {commission.status === "ACTIVE" && (
                      <button
                        type="button"
                        className={buttonClass}
                        disabled={stock < amount || remaining === 0}
                        onClick={() =>
                          act(
                            { type: "DELIVER_COMMISSION", id: commission.id },
                            "Delivery accepted. Your named relic is waiting in the relic vault.",
                          )
                        }
                      >
                        Deliver goods
                      </button>
                    )}
                  </article>
                );
              })}
            </>
          )}
          {tab === "RELICS" && (
            <>
              <p className="text-xs text-[var(--ui-muted)]">
                Recover cavern artifacts or complete a royal commission. Display
                a relic for a clan blessing, entrust it to a dwarf, or gift it
                for favor. A dwarf can carry one relic. Gifting is permanent.
              </p>
              {guild.relics.length === 0 && (
                <div className={cardClass}>
                  The vault is empty. Complete “Stone for the Royal Road” or
                  reclaim a cavern relic to begin its story.
                </div>
              )}
              {guild.relics.map((relic) => {
                const template = RELIC_TEMPLATES[relic.template];
                const selectedOwner =
                  owners[relic.id] || relic.ownerId || dwarves[0]?.id || "";
                const ownerId = dwarves.some((d) => d.id === selectedOwner)
                  ? selectedOwner
                  : dwarves[0]?.id || "";
                const patron = patrons[relic.id] || "Dwarves";
                return (
                  <article
                    key={relic.id}
                    className={cardClass}
                    aria-label={relic.name}
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h3 className="font-bold text-[var(--ui-accent)]">
                        {relic.name}
                      </h3>
                      <span className="text-xs text-[var(--ui-info)]">
                        {relic.mode}
                        {relic.ownerId
                          ? ` · ${dwarves.find((d) => d.id === relic.ownerId)?.name}`
                          : ""}
                        {relic.giftedTo ? ` · ${relic.giftedTo}` : ""}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--ui-muted)]">
                      Discovered by {relic.discoveredBy} at tick{" "}
                      {relic.discoveredAt}.
                    </p>
                    <p className="text-xs">
                      <strong>Display:</strong> {template.display}
                    </p>
                    <p className="text-xs">
                      <strong>Carry:</strong> {template.equip}
                    </p>
                    {relic.mode !== "GIFTED" && (
                      <div className="space-y-2 pt-1">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={buttonClass}
                            disabled={relic.mode === "DISPLAYED"}
                            onClick={() =>
                              act(
                                {
                                  type: "SET_RELIC_MODE",
                                  id: relic.id,
                                  mode: "DISPLAYED",
                                },
                                "Relic placed on display. Its blessing and upkeep apply every 20 ticks.",
                              )
                            }
                          >
                            Display relic
                          </button>
                          <button
                            type="button"
                            className={buttonClass}
                            disabled={relic.mode === "STORED"}
                            onClick={() =>
                              act(
                                {
                                  type: "SET_RELIC_MODE",
                                  id: relic.id,
                                  mode: "STORED",
                                },
                                "Relic safely returned to storage. Its effects are inactive.",
                              )
                            }
                          >
                            Store relic
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span>Bearer</span>
                            <AsciiSelect<string>
                              ariaLabel={`Bearer for ${relic.name}`}
                              size="sm"
                              value={ownerId}
                              options={dwarves.map((d) => ({
                                value: d.id,
                                label: d.name,
                              }))}
                              onChange={(nextOwner) =>
                                setOwners((previous) => ({
                                  ...previous,
                                  [relic.id]: nextOwner,
                                }))
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className={buttonClass}
                            onClick={() =>
                              act(
                                {
                                  type: "SET_RELIC_MODE",
                                  id: relic.id,
                                  mode: "EQUIPPED",
                                  ownerId,
                                },
                                "Relic entrusted to its bearer. Any previous relic they carried was stored.",
                              )
                            }
                          >
                            Equip relic
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-2 text-xs">
                            <span>Recipient</span>
                            <AsciiSelect<Civilization["race"]>
                              ariaLabel={`Gift recipient for ${relic.name}`}
                              size="sm"
                              value={patron}
                              options={gameState.world.civilizations.map(
                                (civ) => ({
                                  value: civ.race,
                                  label: civ.race,
                                }),
                              )}
                              onChange={(nextPatron) =>
                                setPatrons((previous) => ({
                                  ...previous,
                                  [relic.id]: nextPatron,
                                }))
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className={buttonClass}
                            onClick={() =>
                              act(
                                { type: "GIFT_RELIC", id: relic.id, patron },
                                "Relic gifted permanently. Gained 15 favor; its history remains in the archive.",
                              )
                            }
                          >
                            Gift (+15 favor)
                          </button>
                        </div>
                      </div>
                    )}
                    <details className="text-xs">
                      <summary className="cursor-pointer text-[var(--ui-info)]">
                        Relic history ({relic.history.length})
                      </summary>
                      <ol className="mt-2 space-y-1">
                        {relic.history.map((entry, i) => (
                          <li key={`${entry.tick}-${i}`}>
                            <span className="text-[var(--ui-muted)]">
                              T{entry.tick}
                            </span>{" "}
                            · {entry.text}
                          </li>
                        ))}
                      </ol>
                    </details>
                  </article>
                );
              })}
            </>
          )}
          {tab === "CLAN" && (
            <>
              <p className="text-xs text-[var(--ui-muted)]">
                Each dwarf has a lasting quirk. Nearby tavern companions grow
                closer, while loners and ale enthusiasts can clash. Shared
                victories strengthen bonds. Nearby friends lift morale; nearby
                rivals lower it, up to 2 points every 20 ticks.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dwarves.map((dwarf) => {
                  const quirk = dwarf.quirk && QUIRKS[dwarf.quirk];
                  const bonds = guild.relationships
                    .filter((r) => r.a === dwarf.id || r.b === dwarf.id)
                    .sort((a, b) => Math.abs(b.score) - Math.abs(a.score))
                    .slice(0, 3);
                  return (
                    <article
                      key={dwarf.id}
                      className={cardClass}
                      aria-label={`${dwarf.name} story`}
                    >
                      <h3 className="font-bold text-[var(--ui-accent)]">
                        {dwarf.name}
                      </h3>
                      <p className="text-xs">
                        {dwarf.title} · Morale {dwarf.happiness}%
                      </p>
                      <p className="text-[var(--ui-info)]">{quirk?.name}</p>
                      <p className="text-xs">{quirk?.description}</p>
                      <p className="text-xs italic text-[var(--ui-muted)]">
                        “{dwarf.thought}”
                      </p>
                      {bonds.length === 0 && (
                        <p className="text-xs text-[var(--ui-muted)]">
                          New to the clan. Shared experiences will build a
                          story.
                        </p>
                      )}
                      {bonds.map((bond) => {
                        const companion = dwarves.find(
                          (d) =>
                            d.id === (bond.a === dwarf.id ? bond.b : bond.a),
                        );
                        return (
                          <div
                            key={`${bond.a}-${bond.b}`}
                            className="border-t border-[var(--ui-border)] pt-2 text-xs"
                          >
                            <p
                              className={
                                bond.score >= 5
                                  ? "text-[var(--ui-success)]"
                                  : bond.score <= -5
                                    ? "text-[var(--ui-warning)]"
                                    : "text-[var(--ui-info)]"
                              }
                            >
                              {bond.score >= 5
                                ? "Friend"
                                : bond.score <= -5
                                  ? "Rival"
                                  : "Acquaintance"}
                              : {companion?.name} ({bond.score > 0 ? "+" : ""}
                              {bond.score})
                            </p>
                            <p className="text-[var(--ui-muted)]">
                              {bond.reason}
                            </p>
                          </div>
                        );
                      })}
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
