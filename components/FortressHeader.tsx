"use client";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/types";
import { isTactileSfxMuted, setTactileSfxMuted, playTactileSfx } from "@/lib/audio";
import AsciiSelect from "./AsciiSelect";

interface Props {
  state: GameState;
  ordersVisible: boolean;
  chronicleVisible: boolean;
  onCommands: () => void;
  onDisplay: () => void;
  onGuild: () => void;
  onAdventure: () => void;
  onTrade: () => void;
  onDecrees: () => void;
  onPause: () => void;
  onStep: () => void;
  onSpeed: (speed: 1 | 2 | 4) => void;
  onSave: () => void;
  onOrders: () => void;
  onChronicle: () => void;
  onFullMap: () => void;
  onNewMap: () => void;
  onRealm: () => void;
}
const stockNames = {
  stone: "Stone",
  wood: "Timber",
  ironOre: "Iron ore",
  goldOre: "Gold ore",
  steelBars: "Steel",
  weapons: "Weapons",
  armor: "Armor",
  food: "Food",
  ale: "Ale",
  furniture: "Furniture",
  relics: "Relics",
  wealth: "Wealth",
} as const;

const stockGlyphs: Record<
  "food" | "ale" | "stone" | "wood" | "wealth",
  { glyph: string; color: string }
> = {
  food: { glyph: "♣", color: "text-[var(--ui-success)]" },
  ale: { glyph: "♫", color: "text-[var(--ui-violet)]" },
  stone: { glyph: "▓", color: "text-[var(--ui-bright)]" },
  wood: { glyph: "♠", color: "text-[var(--ui-warning)]" },
  wealth: { glyph: "☼", color: "text-[var(--ui-accent)]" },
};

const SPEED_OPTIONS = [
  { value: 1 as const, label: "1× Normal" },
  { value: 2 as const, label: "2× Fast" },
  { value: 4 as const, label: "4× Turbo" },
];

export default function FortressHeader(props: Props) {
  const { state } = props;
  const [more, setMore] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(() => isTactileSfxMuted());
  const moreRef = useRef<HTMLButtonElement>(null);

  const closeMore = () => {
    setMore(false);
    moreRef.current?.focus();
  };
  const run = (action: () => void) => {
    closeMore();
    action();
  };
  useEffect(() => {
    if (!more) return;
    const close = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !document.querySelector('[aria-modal="true"]')
      ) {
        event.preventDefault();
        setMore(false);
        moreRef.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [more]);
  const ready = Boolean(
    state.activities?.expeditions.active &&
    state.ticks >= state.activities.expeditions.active.returnsAt,
  );
  return (
    <header className="fortress-header shrink-0 border-b border-[var(--ui-border)] bg-[var(--ui-panel)]">
      <div className="fortress-heading flex flex-wrap items-center justify-between gap-x-5 gap-y-1 px-3 pt-2">
        <div className="min-w-0 flex items-center gap-2">
          <span aria-hidden="true" className="text-[var(--ui-accent)] font-bold">
            ╔═[
          </span>
          <strong className="text-[var(--ui-accent)] tracking-wide">
            {state.world.dwarvenName}
          </strong>
          <span aria-hidden="true" className="text-[var(--ui-accent)] font-bold">
            ]
          </span>
          <span className="ui-caption ml-1 text-[var(--ui-muted)] tabular-nums">
            Y{state.year} · {state.season.split(" ")[0]} · T{state.ticks}
          </span>
        </div>
        <dl
          aria-label="Essential stores"
          className="resource-strip flex gap-2 overflow-x-auto tabular-nums"
        >
          {(["food", "ale", "stone", "wood", "wealth"] as const).map((key) => {
            const meta = stockGlyphs[key];
            return (
              <div
                key={key}
                className="flex shrink-0 items-baseline gap-1.5 border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-0.5"
              >
                <span aria-hidden="true" className={`font-bold ${meta.color}`}>
                  {meta.glyph}
                </span>
                <dt className="ui-caption text-[var(--ui-muted)]">
                  {stockNames[key]}
                </dt>
                <dd className="font-bold text-[var(--ui-bright)]">
                  {state.resources[key]}
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <nav
        aria-label="Fortress controls"
        className="primary-controls flex flex-wrap items-center gap-1.5 px-3 py-2"
      >
        <button
          type="button"
          className="ui-button"
          onClick={props.onCommands}
          aria-keyshortcuts="/"
          aria-label="Search commands"
        >
          <span className="desktop-action">Commands</span>
          <span className="mobile-action">Search</span> <kbd>/</kbd>
        </button>
        <button
          type="button"
          className="ui-button desktop-action"
          onClick={props.onGuild}
        >
          Guild
        </button>
        <button
          type="button"
          className="ui-button desktop-action"
          onClick={props.onAdventure}
        >
          Adventure{ready ? " •" : ""}
        </button>
        <div className="desktop-action grow" />
        <button
          type="button"
          className="ui-button desktop-action"
          aria-pressed={props.ordersVisible}
          onClick={props.onOrders}
        >
          Orders
        </button>
        <button
          type="button"
          className="ui-button desktop-action"
          aria-pressed={props.chronicleVisible}
          onClick={props.onChronicle}
        >
          Chronicle
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={props.onPause}
          aria-keyshortcuts="Space"
        >
          {state.paused ? "▶ Resume" : "Ⅱ Pause"}
        </button>
        <button
          type="button"
          className="ui-button"
          onClick={props.onSave}
          aria-keyshortcuts="Control+s Meta+s"
        >
          Save
        </button>
        <button
          type="button"
          ref={moreRef}
          className="ui-button"
          aria-expanded={more}
          aria-controls="fortress-more-controls"
          onClick={() => setMore((v) => !v)}
        >
          More {more ? "▴" : "▾"}
        </button>
      </nav>
      {more && (
        <div
          id="fortress-more-controls"
          className="header-more border-t border-[var(--ui-border)] p-3"
          aria-label="More fortress controls"
        >
          <section>
            <h2 className="ui-caption mb-2 text-[var(--ui-muted)]">FORTRESS</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="ui-button"
                onClick={() => run(props.onGuild)}
              >
                Guild Hall
              </button>
              <button
                type="button"
                className="ui-button"
                onClick={() => run(props.onAdventure)}
              >
                Adventure Hall{ready ? " •" : ""}
              </button>
              <button
                type="button"
                className="ui-button"
                onClick={() => run(props.onTrade)}
              >
                Trade
              </button>
              <button
                type="button"
                className="ui-button"
                onClick={() => run(props.onDecrees)}
              >
                {state.activeEvent ? "Decree awaits" : "Decrees"}
              </button>
            </div>
          </section>
          <section>
            <h2 className="ui-caption mb-2 text-[var(--ui-muted)]">
              VIEW &amp; CLOCK
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="ui-button"
                onClick={() => run(props.onDisplay)}
              >
                Display
              </button>
              <button
                type="button"
                className="ui-button desktop-action"
                onClick={() => run(props.onFullMap)}
              >
                Full map
              </button>
              <button
                type="button"
                className="ui-button"
                onClick={props.onStep}
              >
                +1 tick
              </button>
              <button
                type="button"
                className="ui-button"
                aria-pressed={!sfxMuted}
                onClick={() => {
                  const nextMuted = !sfxMuted;
                  setSfxMuted(nextMuted);
                  setTactileSfxMuted(nextMuted);
                  if (!nextMuted) playTactileSfx("keycap");
                }}
              >
                SFX {sfxMuted ? "off" : "on"}
              </button>
              <div className="ui-caption flex items-center gap-2">
                <span>Speed</span>
                <AsciiSelect<1 | 2 | 4>
                  ariaLabel="Simulation speed"
                  value={state.speed}
                  options={SPEED_OPTIONS}
                  onChange={(nextSpeed) => props.onSpeed(nextSpeed)}
                />
              </div>
            </div>
          </section>
          <details>
            <summary className="ui-caption">All stores</summary>
            <dl className="stock-grid mt-2 gap-x-5 gap-y-1">
              {Object.entries(stockNames).map(([key, label]) => (
                <div key={key} className="flex justify-between gap-3">
                  <dt className="text-[var(--ui-muted)]">{label}</dt>
                  <dd className="tabular-nums">
                    {state.resources[key as keyof typeof stockNames]}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
          <section className="flex flex-wrap gap-2">
            <button
              type="button"
              className="ui-button"
              onClick={() => run(props.onRealm)}
            >
              Realm screen
            </button>
            <button
              type="button"
              className="ui-button"
              onClick={() => run(props.onNewMap)}
            >
              New map
            </button>
          </section>
        </div>
      )}
    </header>
  );
}

