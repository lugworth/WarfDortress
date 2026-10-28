"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { DesignationType } from "@/lib/types";
import {
  DEFAULT_UI,
  UI_STORAGE_KEY,
  parseUIPreferences,
  serializeUIPreferences,
  type UIPreferences,
} from "@/lib/ui-preferences";
import { playTactileSfx } from "@/lib/audio";

type Overlay = "commands" | "settings" | null;
interface UIContextValue {
  preferences: UIPreferences;
  updatePreferences: (patch: Partial<UIPreferences>) => void;
  toggleFavorite: (id: DesignationType) => void;
  overlay: Overlay;
  openOverlay: (overlay: Exclude<Overlay, null>) => void;
  closeOverlay: () => void;
  storageError: string;
  /** The in-game setting or the system preference asks for less motion. */
  reducedMotion: boolean;
}
const UIContext = createContext<UIContextValue | null>(null);

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<UIPreferences>(DEFAULT_UI);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        setPreferences(
          parseUIPreferences(localStorage.getItem(UI_STORAGE_KEY)),
        );
      } catch {
        setStorageError(
          "Browser storage unavailable. Display settings apply for this session.",
        );
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!ready) return;
    let frame = 0;
    try {
      localStorage.setItem(UI_STORAGE_KEY, serializeUIPreferences(preferences));
    } catch {
      frame = requestAnimationFrame(() =>
        setStorageError(
          "Display settings could not be saved. They still apply for this session.",
        ),
      );
    }
    return () => cancelAnimationFrame(frame);
  }, [preferences, ready]);
  const updatePreferences = useCallback(
    (patch: Partial<UIPreferences>) =>
      setPreferences((p) => ({ ...p, ...patch })),
    [],
  );
  const toggleFavorite = useCallback(
    (id: DesignationType) =>
      setPreferences((p) => ({
        ...p,
        favorites: p.favorites.includes(id)
          ? p.favorites.filter((t) => t !== id)
          : [...p.favorites, id],
      })),
    [],
  );
  const openOverlay = useCallback(
    (next: Exclude<Overlay, null>) => setOverlay(next),
    [],
  );
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const systemReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCE_QUERY).matches,
    () => false,
  );
  const reducedMotion = preferences.reducedMotion || systemReducedMotion;
  return (
    <UIContext.Provider
      value={{
        preferences,
        updatePreferences,
        toggleFavorite,
        overlay,
        openOverlay,
        closeOverlay,
        storageError,
        reducedMotion,
      }}
    >
      <div
        className="app"
        data-theme={preferences.theme}
        data-reduced-motion={preferences.reducedMotion}
        onClickCapture={(e) => {
          const btn = (e.target as HTMLElement)?.closest?.("button");
          if (btn && !(btn as HTMLButtonElement).disabled) {
            playTactileSfx("keycap");
          }
        }}
        style={
          {
            fontSize: `${preferences.fontSize}px`,
          } as React.CSSProperties
        }
      >
        {children}
      </div>
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error("useUI must be used within UIProvider");
  return context;
}
