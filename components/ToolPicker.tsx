"use client";

import { useId, useState } from "react";
import { getConstructionCost } from "@/lib/game-engine";
import { TOOL_KEYS } from "@/lib/game-rules";
import {
  TOOLS,
  TOOL_GROUPS,
  formatCost,
  getTool,
  type ToolGroup,
} from "@/lib/tool-catalog";
import { useGame } from "./GameProvider";
import { useUI } from "./UIProvider";

type ToolFilter = "All" | "Favorites" | ToolGroup;
const FILTERS: ToolFilter[] = ["All", "Favorites", ...TOOL_GROUPS];
const KEY_HINTS = Object.fromEntries(
  Object.entries(TOOL_KEYS).map(([key, id]) => [id, key.toUpperCase()]),
);

export default function ToolPicker() {
  const { currentZ, selectedTool, setSelectedTool, setInspectMode } = useGame();
  const { preferences, toggleFavorite } = useUI();
  const [filter, setFilter] = useState<ToolFilter>("All");
  const [search, setSearch] = useState("");
  const searchId = useId();
  const selected = getTool(selectedTool);
  const query = search.trim().toLowerCase();
  const tools = TOOLS.filter((tool) => {
    const matchesGroup =
      filter === "All" ||
      (filter === "Favorites"
        ? preferences.favorites.includes(tool.id)
        : tool.group === filter);
    const searchableText = `${tool.label} ${tool.desc} ${tool.group} ${KEY_HINTS[tool.id] || ""}`;
    return matchesGroup && searchableText.toLowerCase().includes(query);
  });

  return (
    <section
      aria-label="Build and designation tools"
      className="space-y-3 text-[var(--ui-text)]"
      onKeyDown={(event) => {
        // Keep native button activation from reaching the map's Space shortcut.
        if (event.key === " " || event.key === "Enter") event.stopPropagation();
      }}
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <h2 className="font-bold text-[var(--ui-info)]">TOOLS</h2>
        <span className="shrink-0 tabular-nums text-[var(--ui-muted)]">
          Depth Z-{currentZ}
        </span>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={searchId}
          className="block text-xs text-[var(--ui-muted)]"
        >
          Find a tool
        </label>
        <div className="flex gap-1">
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools or shortcuts…"
            className="min-w-0 flex-1 border border-[var(--ui-border)] bg-[var(--ui-bg)] px-2 py-1.5 text-xs outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--ui-info)]"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="shrink-0 border border-[var(--ui-border)] px-2 text-xs text-[var(--ui-info)] focus-visible:outline-2 focus-visible:outline-[var(--ui-info)]"
              aria-label="Clear tool search"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        role="group"
        aria-label="Tool categories"
        className="flex flex-wrap gap-1"
      >
        {FILTERS.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed={filter === name}
            onClick={() => setFilter(name)}
            className={`whitespace-normal border px-2 py-1 text-xs leading-snug focus-visible:outline-2 focus-visible:outline-[var(--ui-info)] ${
              filter === name
                ? "border-[var(--ui-accent)] bg-[var(--ui-bg)] text-[var(--ui-accent)]"
                : "border-[var(--ui-border)] text-[var(--ui-muted)] hover:text-[var(--ui-text)]"
            }`}
          >
            {name}
            {name === "Favorites" ? ` (${preferences.favorites.length})` : ""}
          </button>
        ))}
      </div>

      <div
        className="space-y-1 border border-[var(--ui-accent)] bg-[var(--ui-bg)] p-2"
        aria-label="Selected tool details"
      >
        <p className="text-[10px] uppercase tracking-wide text-[var(--ui-muted)]">
          Selected · {selected.group}
        </p>
        <p className={`break-words font-bold ${selected.color}`}>
          [{KEY_HINTS[selected.id]}] {selected.label}
        </p>
        <p className="text-xs leading-relaxed text-[var(--ui-text)]">
          {selected.desc}
        </p>
        <p className="text-xs text-[var(--ui-info)]">
          Cost: {formatCost(getConstructionCost(selected.id))}
        </p>
        <p className="text-[10px] leading-relaxed text-[var(--ui-muted)]">
          Select a tool, then click or drag on the map. Press its letter
          shortcut to select it directly.
        </p>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="text-[10px] text-[var(--ui-muted)]"
      >
        {tools.length} {tools.length === 1 ? "tool" : "tools"} shown
      </p>

      <div className="space-y-1.5">
        {tools.map((tool) => {
          const favorite = preferences.favorites.includes(tool.id);
          return (
            <div
              key={tool.id}
              className={`grid grid-cols-[minmax(0,1fr)_2.25rem] border bg-[var(--ui-bg)] ${
                tool.id === selectedTool
                  ? "border-[var(--ui-accent)]"
                  : "border-[var(--ui-border)]"
              }`}
            >
              <button
                type="button"
                aria-pressed={tool.id === selectedTool}
                onClick={() => {
                  setSelectedTool(tool.id);
                  setInspectMode(false);
                }}
                className="min-w-0 whitespace-normal p-2 text-left leading-snug hover:bg-[var(--ui-panel)] focus-visible:outline-2 focus-visible:outline-[var(--ui-info)]"
              >
                <span
                  className={`block break-words text-xs font-bold ${tool.color}`}
                >
                  [{KEY_HINTS[tool.id]}] {tool.label}
                </span>
                <span className="mt-1 block break-words text-[10px] text-[var(--ui-muted)]">
                  {formatCost(getConstructionCost(tool.id))}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={favorite}
                aria-label={`${favorite ? "Remove" : "Add"} ${tool.label.toLowerCase()} ${favorite ? "from" : "to"} favorites`}
                title={favorite ? "Remove from favorites" : "Add to favorites"}
                onClick={() => toggleFavorite(tool.id)}
                className={`border-l border-[var(--ui-border)] text-lg hover:bg-[var(--ui-panel)] focus-visible:outline-2 focus-visible:outline-[var(--ui-info)] ${
                  favorite
                    ? "text-[var(--ui-warning)]"
                    : "text-[var(--ui-muted)]"
                }`}
              >
                <span aria-hidden="true">{favorite ? "★" : "☆"}</span>
              </button>
            </div>
          );
        })}
        {tools.length === 0 && (
          <div className="space-y-2 border border-[var(--ui-border)] bg-[var(--ui-bg)] p-3 text-xs leading-relaxed">
            <p className="text-[var(--ui-muted)]">
              {filter === "Favorites" && preferences.favorites.length === 0
                ? "No favorites yet. Use a star beside any tool to keep it here."
                : "No tools match this search and category."}
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter("All");
                setSearch("");
              }}
              className="whitespace-normal border border-[var(--ui-border)] px-2 py-1 text-[var(--ui-info)] focus-visible:outline-2 focus-visible:outline-[var(--ui-info)]"
            >
              Show all tools
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
