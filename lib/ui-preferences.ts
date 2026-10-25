import { TOOL_KEYS } from "./game-rules.ts";
import type { DesignationType } from "./types.ts";

export const UI_STORAGE_KEY = "warf-ui-v1";
export const FONT_SIZES = [14, 16, 18, 22, 28] as const;
export const MAP_ZOOMS = [60, 80, 100, 125, 150, 200] as const;
export interface UIPreferences {
  fontSize: number;
  mapZoom: number | "fit";
  theme: "terminal" | "contrast";
  reducedMotion: boolean;
  labels: boolean;
  favorites: DesignationType[];
}
export const DEFAULT_UI: UIPreferences = {
  fontSize: 14,
  mapZoom: 100,
  theme: "terminal",
  reducedMotion: false,
  labels: false,
  favorites: ["MINE", "STAIRS", "BUILD_TAVERN"],
};

export function parseUIPreferences(raw: string | null): UIPreferences {
  const fallback = { ...DEFAULT_UI, favorites: [...DEFAULT_UI.favorites] };
  try {
    const value = JSON.parse(raw || "null");
    if (
      !value ||
      value.version !== 1 ||
      !value.preferences ||
      typeof value.preferences !== "object"
    )
      return fallback;
    const p = value.preferences;
    const validTools = new Set(Object.values(TOOL_KEYS));
    return {
      fontSize: FONT_SIZES.includes(p.fontSize)
        ? p.fontSize
        : fallback.fontSize,
      mapZoom:
        p.mapZoom === "fit" || MAP_ZOOMS.includes(p.mapZoom)
          ? p.mapZoom
          : fallback.mapZoom,
      theme: p.theme === "contrast" ? "contrast" : "terminal",
      reducedMotion:
        typeof p.reducedMotion === "boolean"
          ? p.reducedMotion
          : fallback.reducedMotion,
      labels: typeof p.labels === "boolean" ? p.labels : fallback.labels,
      favorites: Array.isArray(p.favorites)
        ? [
            ...new Set<DesignationType>(
              p.favorites.filter((id: DesignationType) => validTools.has(id)),
            ),
          ].slice(0, 20)
        : fallback.favorites,
    };
  } catch {
    return fallback;
  }
}

export function serializeUIPreferences(preferences: UIPreferences): string {
  return JSON.stringify({ version: 1, preferences });
}
