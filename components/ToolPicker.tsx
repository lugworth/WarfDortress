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
import { TOOL_NAMES } from "@/lib/ui-labels";
import { useGame } from "./GameProvider";
import { useUI } from "./UIProvider";
type ToolFilter = "All" | "Favorites" | ToolGroup;
const FILTERS: ToolFilter[] = ["Favorites", "All", ...TOOL_GROUPS];
const KEY_HINTS = Object.fromEntries(
  Object.entries(TOOL_KEYS).map(([key, id]) => [id, key.toUpperCase()]),
);
export default function ToolPicker() {
  const { selectedTool, setSelectedTool, setInspectMode } = useGame();
  const { preferences, toggleFavorite } = useUI();
  const [filter, setFilter] = useState<ToolFilter>("Favorites");
  const [search, setSearch] = useState("");
  const searchId = useId();
  const selected = getTool(selectedTool),
    query = search.trim().toLowerCase();
  const tools = TOOLS.filter(
    (tool) =>
      (filter === "All" ||
        (filter === "Favorites"
          ? preferences.favorites.includes(tool.id)
          : tool.group === filter)) &&
      `${tool.label} ${tool.desc} ${tool.group} ${KEY_HINTS[tool.id]} ${TOOL_NAMES[tool.id]}`
        .toLowerCase()
        .includes(query),
  );
  return (
    <section
      aria-label="Build and designation tools"
      className="space-y-3"
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") event.stopPropagation();
      }}
    >
      <label htmlFor={searchId} className="sr-only">
        Find a tool
      </label>
      <input
        id={searchId}
        type="search"
        value={search}
        onChange={(event) => {
          setSearch(event.target.value);
          if (event.target.value) setFilter("All");
        }}
        placeholder="Find a tool…"
        className="w-full"
      />
      <label className="flex items-center gap-2 ui-caption text-[var(--ui-muted)]">
        Show
        <select
          aria-label="Tool category"
          className="min-w-0 flex-1"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value as ToolFilter);
            setSearch("");
          }}
        >
          {FILTERS.map((name) => (
            <option key={name} value={name}>
              {name}
              {name === "Favorites" ? ` (${preferences.favorites.length})` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="tool-list space-y-1" aria-label="Available tools">
        {tools.map((tool) => {
          const favorite = preferences.favorites.includes(tool.id);
          return (
            <div
              key={tool.id}
              className={`flex min-w-0 border ${tool.id === selectedTool ? "border-[var(--ui-accent)] bg-[var(--ui-selection)]" : "border-transparent"}`}
            >
              <button
                type="button"
                className="tool-choice flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left hover:bg-[var(--ui-panel)]"
                aria-pressed={tool.id === selectedTool}
                aria-label={`${TOOL_NAMES[tool.id]} (${KEY_HINTS[tool.id]})`}
                title={`${tool.desc} · ${formatCost(getConstructionCost(tool.id))}`}
                onClick={() => {
                  setSelectedTool(tool.id);
                  setInspectMode(false);
                }}
              >
                <kbd className="ui-caption w-5 text-[var(--ui-muted)]">
                  {KEY_HINTS[tool.id]}
                </kbd>
                <span>{TOOL_NAMES[tool.id]}</span>
              </button>
              <button
                type="button"
                className={`tool-star w-9 shrink-0 ${favorite ? "text-[var(--ui-warning)]" : "text-[var(--ui-muted)]"}`}
                aria-pressed={favorite}
                aria-label={`${favorite ? "Remove" : "Add"} ${TOOL_NAMES[tool.id].toLowerCase()} ${favorite ? "from" : "to"} favorites`}
                onClick={() => toggleFavorite(tool.id)}
              >
                {favorite ? "★" : "☆"}
              </button>
            </div>
          );
        })}
        {tools.length === 0 && (
          <div className="space-y-2">
            <p className="ui-caption text-[var(--ui-muted)]">
              {filter === "Favorites"
                ? "Star a tool to keep it here."
                : "No matching tools."}
            </p>
            <button
              type="button"
              className="ui-button"
              onClick={() => {
                setSearch("");
                setFilter("All");
              }}
            >
              All tools
            </button>
          </div>
        )}
      </div>
      <section
        aria-label="Selected tool details"
        className="space-y-1 border-t border-[var(--ui-border)] pt-3"
      >
        <h3 className="font-bold">
          {TOOL_NAMES[selectedTool]}{" "}
          <kbd className="ui-caption text-[var(--ui-accent)]">
            {KEY_HINTS[selectedTool]}
          </kbd>
        </h3>
        <p className="ui-caption text-[var(--ui-muted)]">{selected.desc}</p>
        <p className="ui-caption">
          {formatCost(getConstructionCost(selected.id))}
        </p>
      </section>
    </section>
  );
}
