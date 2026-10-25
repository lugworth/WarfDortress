"use client";

import { useEffect, useMemo, useState } from "react";
import { useDialog } from "@/hooks/use-dialog";
import { FONT_SIZES, MAP_ZOOMS } from "@/lib/ui-preferences";
import { TOOL_KEYS } from "@/lib/game-rules";
import { getConstructionCost } from "@/lib/game-engine";
import { TOOL_NAMES } from "@/lib/ui-labels";
import { TOOLS, formatCost } from "@/lib/tool-catalog";
import { useGame } from "./GameProvider";
import { useUI } from "./UIProvider";

const button =
  "border border-[var(--ui-border)] px-3 py-2 text-left hover:bg-[var(--ui-selection)]";

export default function UIOverlay({ onShowMap }: { onShowMap: () => void }) {
  const {
    overlay,
    closeOverlay,
    preferences,
    updatePreferences,
    storageError,
  } = useUI();
  const { gameState, setGameState, setSelectedTool, setInspectMode } =
    useGame();
  const dialogRef = useDialog(overlay !== null, closeOverlay);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const filtered = useMemo(
    () =>
      TOOLS.filter((t) =>
        `${t.label} ${t.desc} ${t.group}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      ),
    [query],
  );
  const activeIndex = Math.min(selected, Math.max(0, filtered.length - 1));

  useEffect(() => {
    if (overlay === "commands")
      dialogRef.current?.querySelector("input")?.focus();
  }, [overlay, dialogRef]);
  useEffect(() => {
    if (overlay === "commands")
      dialogRef.current
        ?.querySelector('[data-command-active="true"]')
        ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, overlay, dialogRef]);

  useEffect(() => {
    if (!overlay) return;
    const id = gameState.id;
    let wasPaused = false;
    setGameState((previous) => {
      wasPaused = previous.paused;
      return { ...previous, paused: true };
    });
    return () =>
      setGameState((previous) =>
        previous.id === id ? { ...previous, paused: wasPaused } : previous,
      );
    // Capture only the world and pause state at the moment the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlay, setGameState]);

  if (!overlay) return null;
  const choose = (index: number) => {
    const tool = filtered[index];
    if (!tool) return;
    setSelectedTool(tool.id);
    setInspectMode(false);
    onShowMap();
    closeOverlay();
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLCanvasElement>('[data-testid="ascii-map-canvas"]')
        ?.focus(),
    );
  };
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={
        overlay === "commands" ? "Command search" : "Display settings"
      }
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3"
    >
      <section className="flex max-h-[90dvh] w-full max-w-2xl flex-col border-2 border-[var(--ui-accent)] bg-[var(--ui-bg)] text-[var(--ui-text)]">
        <header className="flex items-center justify-between gap-2 border-b border-[var(--ui-border)] p-3">
          <h2 className="font-bold">
            [ {overlay === "commands" ? "COMMANDS" : "DISPLAY & ACCESSIBILITY"}{" "}
            ]
          </h2>
          <button className={button} onClick={closeOverlay}>
            Close
          </button>
        </header>
        {overlay === "commands" ? (
          <div className="min-h-0 overflow-y-auto p-3">
            <label className="block" htmlFor="command-search">
              Find an order
            </label>
            <input
              id="command-search"
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelected(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setSelected(
                    (activeIndex +
                      (e.key === "ArrowDown" ? 1 : -1) +
                      filtered.length) %
                      (filtered.length || 1),
                  );
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  choose(activeIndex);
                }
              }}
              aria-controls="command-results"
              className="my-2 w-full border border-[var(--ui-border)] bg-[var(--ui-panel)] p-3"
              placeholder="Try mine, brewery, defense…"
            />
            <p className="mb-2 text-xs text-[var(--ui-muted)]">
              ↑ ↓ select · Enter choose · Esc close · Clock paused
            </p>
            <p role="status" className="sr-only">
              {filtered[activeIndex]
                ? `Selected: ${filtered[activeIndex].label}`
                : "No matching commands"}
            </p>
            <div
              id="command-results"
              className="space-y-2"
              aria-label="Matching commands"
            >
              {filtered.length === 0 ? (
                <p role="status">
                  No matching commands. Try a building or resource name.
                </p>
              ) : (
                filtered.map((tool, i) => (
                  <button
                    key={tool.id}
                    data-command-active={i === activeIndex}
                    className={`${button} command-result w-full ${i === activeIndex ? "border-[var(--ui-accent)] bg-[var(--ui-selection)]" : ""}`}
                    onClick={() => choose(i)}
                    aria-label={`${tool.label}: ${tool.desc}`}
                  >
                    <span className="flex flex-wrap justify-between gap-2">
                      <strong>
                        {i === activeIndex ? "> " : ""}
                        {TOOL_NAMES[tool.id]}
                      </strong>
                      <kbd>
                        {Object.entries(TOOL_KEYS)
                          .find(([, id]) => id === tool.id)?.[0]
                          .toUpperCase()}
                      </kbd>
                    </span>
                    <span className="block text-xs text-[var(--ui-info)]">
                      {tool.group} · {formatCost(getConstructionCost(tool.id))}
                    </span>
                    <span className="block text-xs text-[var(--ui-muted)]">
                      {tool.desc}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5 overflow-y-auto p-4">
            <label className="flex flex-wrap items-center justify-between gap-2">
              Interface text size
              <select
                aria-label="Interface text size"
                value={preferences.fontSize}
                onChange={(e) =>
                  updatePreferences({ fontSize: Number(e.target.value) })
                }
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}px{size === 14 ? " · Default" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-wrap items-center justify-between gap-2">
              Map zoom
              <select
                aria-label="Map zoom"
                value={preferences.mapZoom}
                onChange={(e) =>
                  updatePreferences({
                    mapZoom:
                      e.target.value === "fit" ? "fit" : Number(e.target.value),
                  })
                }
              >
                <option value="fit">Fit whole map</option>
                {MAP_ZOOMS.map((zoom) => (
                  <option key={zoom} value={zoom}>
                    {zoom}%
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-[var(--ui-muted)]">
              Text size and map zoom are independent. At larger map sizes,
              scroll or use the arrow keys to explore.
            </p>
            <label className="flex flex-wrap items-center justify-between gap-2">
              Color theme
              <select
                aria-label="Color theme"
                value={preferences.theme}
                onChange={(e) =>
                  updatePreferences({
                    theme: e.target.value as "terminal" | "contrast",
                  })
                }
              >
                <option value="terminal">Isotope Dark</option>
                <option value="contrast">High contrast</option>
              </select>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.labels}
                onChange={(e) =>
                  updatePreferences({ labels: e.target.checked })
                }
              />
              Show object labels on the map
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={preferences.reducedMotion}
                onChange={(e) =>
                  updatePreferences({ reducedMotion: e.target.checked })
                }
              />
              Reduce animation and motion
            </label>
            <p className="text-xs text-[var(--ui-muted)]">
              Settings and favorites are saved in this browser. Your system’s
              reduced-motion setting is also respected.
            </p>
            <p className="text-xs">
              Keyboard: / commands · I inspect · arrows move map cursor · Tab
              cycles objects while the map is focused · Enter inspects ·
              Shift+arrows and Enter designate a rectangle.
            </p>
            {storageError && <p role="status">{storageError}</p>}
          </div>
        )}
      </section>
    </div>
  );
}
