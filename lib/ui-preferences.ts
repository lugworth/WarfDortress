import type { DesignationType } from "./types";

export const FONT_SIZES = [14, 16, 18, 20, 22] as const;
/** Map zoom presets: percent of one sprite pixel per CSS pixel. */
export const MAP_ZOOMS = [100, 150, 200, 300, 400] as const;

export const UI_STORAGE_KEY = "deep_anvil_ui_prefs_v2";

export interface UIPreferences {
  theme: "pixel" | "contrast";
  fontSize: number;
  mapZoom: number | "fit";
  reducedMotion: boolean;
  labels: boolean;
  tooltips: boolean;
  favorites: DesignationType[];
}

export const DEFAULT_UI: UIPreferences = {
  theme: "pixel",
  fontSize: 16,
  mapZoom: 200,
  reducedMotion: false,
  labels: false,
  tooltips: true,
  favorites: ["MINE", "CHOP", "STAIRS", "BUILD_WALL", "BUILD_DOOR", "CANCEL"],
};

export function parseUIPreferences(raw: string | null): UIPreferences {
  if (!raw) return DEFAULT_UI;
  try {
    const parsed = JSON.parse(raw);
    return {
      theme: parsed.theme === "contrast" ? "contrast" : "pixel",
      fontSize: typeof parsed.fontSize === "number" && FONT_SIZES.includes(parsed.fontSize)
        ? parsed.fontSize
        : DEFAULT_UI.fontSize,
      mapZoom: parsed.mapZoom === "fit" || MAP_ZOOMS.includes(parsed.mapZoom)
        ? parsed.mapZoom
        : DEFAULT_UI.mapZoom,
      reducedMotion: Boolean(parsed.reducedMotion),
      labels: typeof parsed.labels === "boolean" ? parsed.labels : DEFAULT_UI.labels,
      tooltips: typeof parsed.tooltips === "boolean" ? parsed.tooltips : DEFAULT_UI.tooltips,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : DEFAULT_UI.favorites,
    };
  } catch {
    return DEFAULT_UI;
  }
}

export function serializeUIPreferences(prefs: UIPreferences): string {
  return JSON.stringify(prefs);
}
