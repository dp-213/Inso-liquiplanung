"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "./types";

type CellStatus = "idle" | "editing" | "saving" | "saved" | "error";

interface SpreadsheetCellProps {
  displayValue: string;
  editValue: string;
  readonly?: boolean;
  onSave?: (newValue: string) => Promise<void>;
  onTabNext?: () => void;
  onTabPrev?: () => void;
  className?: string;
  title?: string;
  inputRef?: (el: HTMLInputElement | null) => void;
  placeholder?: string;
}

export default function SpreadsheetCell({
  displayValue,
  editValue,
  readonly,
  onSave,
  onTabNext,
  onTabPrev,
  className,
  title,
  inputRef,
  placeholder,
}: SpreadsheetCellProps) {
  const [status, setStatus] = useState<CellStatus>("idle");
  const [currentValue, setCurrentValue] = useState(editValue);
  const localRef = useRef<HTMLInputElement | null>(null);

  // Undo: vorherigen Wert merken nach erfolgreichem Save
  const previousValueRef = useRef<string | null>(null);

  // Tab-Navigation: blur überspringen wenn Tab den Save schon erledigt hat
  const skipBlurRef = useRef(false);

  // Sync edit value wenn sich Props ändern (z.B. nach Neuberechnung)
  useEffect(() => {
    if (status === "idle") {
      setCurrentValue(editValue);
    }
  }, [editValue, status]);

  // ── Zentraler Save ──────────────────────────────────────────────
  // Gibt true zurück wenn Save erfolgreich (oder nicht nötig)
  const doSave = useCallback(async (valueToSave: string): Promise<boolean> => {
    if (valueToSave === editValue) {
      setStatus("idle");
      return true;
    }
    if (!onSave) {
      setStatus("idle");
      return true;
    }

    setStatus("saving");
    try {
      previousValueRef.current = editValue; // Für Undo merken
      await onSave(valueToSave);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1200);
      return true;
    } catch {
      previousValueRef.current = null; // Undo zurücksetzen bei Fehler
      setStatus("error");
      setCurrentValue(editValue);
      setTimeout(() => setStatus("idle"), 2000);
      return false;
    }
  }, [editValue, onSave]);

  // ── Focus ───────────────────────────────────────────────────────
  const handleFocus = useCallback(() => {
    if (readonly) return;
    setStatus("editing");
    setCurrentValue(editValue);
    setTimeout(() => localRef.current?.select(), 0);
  }, [readonly, editValue]);

  // ── Blur ────────────────────────────────────────────────────────
  const handleBlur = useCallback(async () => {
    // Tab hat den Save schon erledigt → blur ignorieren
    if (skipBlurRef.current) {
      skipBlurRef.current = false;
      return;
    }
    if (status !== "editing") return;
    await doSave(currentValue);
  }, [status, currentValue, doSave]);

  // ── Keyboard ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    // ── Enter: Save & blur ──
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
      return;
    }

    // ── Escape: Abbrechen (oder Undo wenn gerade erst fokussiert) ──
    if (e.key === "Escape") {
      e.preventDefault();
      setCurrentValue(editValue);
      setStatus("idle");
      (e.target as HTMLInputElement).blur();
      return;
    }

    // ── Tab: Save → erst bei Erfolg navigieren ──
    if (e.key === "Tab") {
      e.preventDefault();

      // Blur überspringen – Tab handelt den Save selbst
      skipBlurRef.current = true;

      const success = await doSave(currentValue);
      if (success) {
        // Navigieren
        if (e.shiftKey) {
          onTabPrev?.();
        } else {
          onTabNext?.();
        }
      } else {
        // Fehlgeschlagen → in Zelle bleiben
        skipBlurRef.current = false;
        setStatus("editing");
        localRef.current?.focus();
      }
      return;
    }

    // ── Ctrl/Cmd+Z: Undo letzten Save ──
    if (e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (previousValueRef.current !== null) {
        e.preventDefault();
        const prevVal = previousValueRef.current;
        previousValueRef.current = null; // Einmal-Undo
        setCurrentValue(prevVal);

        // Direkt rückspeichern (doSave handelt saved→idle Transition)
        if (status === "editing") {
          await doSave(prevVal);
        }
      }
      return;
    }
  }, [editValue, currentValue, status, doSave, onTabNext, onTabPrev]);

  // ── Status-Styling ──────────────────────────────────────────────
  const statusClasses: Record<CellStatus, string> = {
    idle: "",
    editing: "ring-2 ring-yellow-400 bg-yellow-50",
    saving: "bg-blue-50",
    saved: "bg-green-50",
    error: "bg-red-50 ring-2 ring-red-300",
  };

  // ── Readonly: einfaches td ──────────────────────────────────────
  if (readonly) {
    return (
      <td
        className={cn("text-right p-2 px-3 tabular-nums", className)}
        title={title}
      >
        {placeholder ?? displayValue}
      </td>
    );
  }

  // ── Editable: Input-Zelle ───────────────────────────────────────
  const isEditing = status === "editing" || status === "saving";

  return (
    <td className={cn("p-1 px-1", className)} title={title}>
      <input
        ref={(el) => {
          localRef.current = el;
          inputRef?.(el);
        }}
        type="text"
        value={isEditing ? currentValue : displayValue}
        onChange={(e) => setCurrentValue(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly={readonly}
        className={cn(
          "w-full text-right px-2 py-1.5 rounded border border-transparent text-sm tabular-nums transition-colors",
          "hover:border-gray-300 focus:outline-none",
          statusClasses[status],
          status === "idle" && "bg-transparent cursor-pointer"
        )}
      />
    </td>
  );
}
