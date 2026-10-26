"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { playTactileSfx } from "@/lib/audio";

export interface AsciiSelectOption<T extends string | number = string> {
  value: T;
  label: string;
  badge?: string;
}

interface AsciiSelectProps<T extends string | number = string> {
  value: T;
  options: readonly AsciiSelectOption<T>[];
  onChange: (value: T) => void;
  ariaLabel?: string;
  id?: string;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  size?: "sm" | "md";
}

export default function AsciiSelect<T extends string | number = string>({
  value,
  options,
  onChange,
  ariaLabel,
  id,
  placeholder,
  className = "",
  align = "left",
  size = "md",
}: AsciiSelectProps<T>) {
  const autoId = useId();
  const selectId = id || `ascii-select-${autoId}`;
  const listboxId = `${selectId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const selectedIndex = options.findIndex((o) => o.value === value);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(
    selectedIndex >= 0 ? selectedIndex : 0,
  );

  const selectedOption =
    selectedIndex >= 0 ? options[selectedIndex] : undefined;

  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updateMenuPosition = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const maxH = Math.max(120, Math.min(240, spaceBelow));
    setMenuStyle({
      position: "fixed",
      top: `${Math.round(rect.bottom + 3)}px`,
      left:
        align === "right"
          ? undefined
          : `${Math.max(8, Math.min(window.innerWidth - rect.width - 8, Math.round(rect.left)))}px`,
      right:
        align === "right"
          ? `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`
          : undefined,
      minWidth: `${Math.round(rect.width)}px`,
      maxHeight: `${maxH}px`,
    });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    const onPointerDown = (event: PointerEvent) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onScrollOrResize = () => updateMenuPosition();
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updateMenuPosition]);

  const commitOption = (index: number) => {
    const opt = options[index];
    if (!opt) return;
    playTactileSfx("keycap");
    onChange(opt.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      if (!open) {
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        updateMenuPosition();
        setOpen(true);
        playTactileSfx("keycap");
      } else if (options.length > 0) {
        setHighlightedIndex((prev) => (prev + 1) % options.length);
      }
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (!open) {
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        updateMenuPosition();
        setOpen(true);
        playTactileSfx("keycap");
      } else if (options.length > 0) {
        setHighlightedIndex(
          (prev) => (prev - 1 + options.length) % options.length,
        );
      }
    } else if (event.key === "Home" && open && options.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      setHighlightedIndex(0);
    } else if (event.key === "End" && open && options.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      setHighlightedIndex(options.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      if (!open) {
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
        updateMenuPosition();
        setOpen(true);
        playTactileSfx("keycap");
      } else {
        commitOption(highlightedIndex);
      }
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab" && open) {
      setOpen(false);
    }
  };

  return (
    <div
      ref={rootRef}
      className={`ascii-select relative inline-flex min-w-0 ${className}`}
    >
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        onClick={(e) => {
          e.stopPropagation();
          playTactileSfx("keycap");
          setOpen((prev) => {
            if (!prev) {
              setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
              updateMenuPosition();
            }
            return !prev;
          });
        }}
        className={`ascii-select-trigger w-full flex items-center justify-between gap-2 font-mono text-left transition-transform ${
          size === "sm"
            ? "min-h-[28px] px-2 py-0.5 text-[11px]"
            : "min-h-[34px] px-2.5 py-1 text-xs"
        }`}
      >
        <span className="truncate text-[var(--ui-bright)]">
          {selectedOption ? selectedOption.label : placeholder || "Select…"}
        </span>
        <span
          aria-hidden="true"
          className="ascii-select-caret shrink-0 text-[var(--ui-accent)] font-bold"
        >
          {open ? "[▴]" : "[▾]"}
        </span>
      </button>

      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          style={menuStyle}
          className="ascii-select-menu z-[120] w-max max-w-[min(22rem,88vw)] overflow-y-auto custom-scrollbar"
        >
          {options.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;
            return (
              <li
                key={String(opt.value)}
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setHighlightedIndex(idx)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  commitOption(idx);
                }}
                className={`ascii-select-option flex items-center justify-between gap-2 px-2.5 py-1.5 cursor-pointer font-mono text-xs select-none ${
                  isHighlighted
                    ? "bg-[var(--ui-selection)] text-[var(--ui-accent)] font-bold"
                    : isSelected
                      ? "text-[var(--ui-success)] bg-[var(--ui-panel)]"
                      : "text-[var(--ui-text)]"
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0 truncate">
                  <span
                    aria-hidden="true"
                    className={`shrink-0 ${
                      isSelected
                        ? "text-[var(--ui-success)]"
                        : isHighlighted
                          ? "text-[var(--ui-accent)]"
                          : "text-[var(--ui-muted)]"
                    }`}
                  >
                    {isSelected ? "▸" : "·"}
                  </span>
                  <span className="truncate">{opt.label}</span>
                </span>
                {opt.badge && (
                  <span className="shrink-0 text-[10px] text-[var(--ui-info)]">
                    [{opt.badge}]
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
