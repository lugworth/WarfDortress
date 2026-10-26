import type { DesignationType } from "./types";

export const FONT_SIZES = [12, 14, 16, 18, 20] as const;
export const MAP_ZOOMS = [50, 75, 100, 125, 150, 200] as const;

export const UI_STORAGE_KEY = "ascii_fortress_ui_prefs_v1";

export interface UIPreferences {
  theme: "terminal" | "contrast";
  fontSize: number;
  mapZoom: number | "fit";
  reducedMotion: boolean;
  labels: boolean;
  favorites: DesignationType[];
}

export const DEFAULT_UI: UIPreferences = {
  theme: "terminal",
  fontSize: 14,
  mapZoom: 100,
  reducedMotion: false,
  labels: true,
  favorites: ["MINE", "CHOP", "STAIRS", "BUILD_WALL", "BUILD_DOOR", "CANCEL"],
};

export function parseUIPreferences(raw: string | null): UIPreferences {
  if (!raw) return DEFAULT_UI;
  try {
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === "contrast" ? "contrast" : "terminal",
      fontSize: typeof parsed.fontSize === "number" && FONT_SIZES.includes(parsed.fontSize as any)
        ? parsed.fontSize
        : DEFAULT_UI.fontSize,
      mapZoom: parsed.mapZoom === "fit" || (typeof parsed.mapZoom === "number" && parsed.mapZoom >= 20 && parsed.mapZoom <= 300)
        ? parsed.mapZoom
        : DEFAULT_UI.mapZoom,
      reducedMotion: Boolean(parsed.reducedMotion),
      labels: typeof parsed.labels === "boolean" ? parsed.labels : DEFAULT_UI.labels,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : DEFAULT_UI.favorites,
    };
  } catch {
    return DEFAULT_UI;
  }
}

export function serializeUIPreferences(prefs: UIPreferences): string {
  return JSON.stringify(prefs);
}
