"use client";
import { useEffect, useRef, useState } from "react";
import type { GameState } from "@/lib/types";

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

export default function FortressHeader(props: Props) {
  const { state } = props;
  const [more, setMore] = useState(false);
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
        <div className="min-w-0">
          <strong className="text-[var(--ui-accent)]">
            {state.world.dwarvenName}
          </strong>
          <span className="ui-caption ml-3 text-[var(--ui-muted)]">
            Y{state.year} · {state.season.split(" ")[0]} · T{state.ticks}
          </span>
        </div>
        <dl
          aria-label="Essential stores"
          className="resource-strip flex gap-4 overflow-x-auto tabular-nums"
        >
          {(["food", "ale", "stone", "wood", "wealth"] as const).map((key) => (
            <div key={key} className="flex shrink-0 items-baseline gap-1.5">
              <dt className="ui-caption text-[var(--ui-muted)]">
                {stockNames[key]}
              </dt>
              <dd>{state.resources[key]}</dd>
            </div>
          ))}
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
              VIEW & CLOCK
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
              <label className="ui-caption flex items-center gap-2">
                Speed
                <select
                  aria-label="Simulation speed"
                  value={state.speed}
                  onChange={(event) =>
                    props.onSpeed(Number(event.target.value) as 1 | 2 | 4)
                  }
                >
                  <option value="1">1×</option>
                  <option value="2">2×</option>
                  <option value="4">4×</option>
                </select>
              </label>
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
