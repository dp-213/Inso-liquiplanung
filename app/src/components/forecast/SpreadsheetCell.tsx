"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "./types";

type CellStatus = "idle" | "editing" | "saving" | "saved" | "error";

interface SpreadsheetCellProps {
  /** Anzeige-Wert im Idle-Zustand (formatiert, z.B. "28.600") */
  displayValue: string;
  /** Edit-Wert beim Fokus (z.B. "28600,00") */
  editValue: string;
  /** Readonly – kein Editing erlaubt (z.B. IST-Zellen) */
  readonly?: boolean;
  /** Callback wenn Wert gespeichert wird. Gibt den neuen String zurück. */
  onSave?: (newValue: string) => Promise<void>;
  /** Keyboard-Navigation: Tab → nächste Zelle */
  onTabNext?: () => void;
  /** Keyboard-Navigation: Shift+Tab → vorherige Zelle */
  onTabPrev?: () => void;
  /** Extra CSS-Klassen */
  className?: string;
  /** Tooltip */
  title?: string;
  /** Ref-Callback für externe Fokus-Steuerung */
  inputRef?: (el: HTMLInputElement | null) => void;
  /** Placeholder im IST-Bereich */
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

  // Sync edit value wenn sich Props ändern (z.B. nach Neuberechnung)
  useEffect(() => {
    if (status === "idle") {
      setCurrentValue(editValue);
    }
  }, [editValue, status]);

  const handleFocus = useCallback(() => {
    if (readonly) return;
    setStatus("editing");
    setCurrentValue(editValue);
    // Text selektieren beim Fokus
    setTimeout(() => localRef.current?.select(), 0);
  }, [readonly, editValue]);

  const handleBlur = useCallback(async () => {
    if (status !== "editing") return;

    // Keine Änderung?
    if (currentValue === editValue) {
      setStatus("idle");
      return;
    }

    if (!onSave) {
      setStatus("idle");
      return;
    }

    setStatus("saving");
    try {
      await onSave(currentValue);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1200);
    } catch {
      setStatus("error");
      setCurrentValue(editValue);
      setTimeout(() => setStatus("idle"), 2000);
    }
  }, [status, currentValue, editValue, onSave]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setCurrentValue(editValue);
      setStatus("idle");
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Tab") {
      e.preventDefault();
      // Erst blur (speichern), dann navigieren
      (e.target as HTMLInputElement).blur();
      if (e.shiftKey) {
        onTabPrev?.();
      } else {
        onTabNext?.();
      }
    }
  }, [editValue, onTabNext, onTabPrev]);

  const statusClasses: Record<CellStatus, string> = {
    idle: "",
    editing: "ring-2 ring-yellow-400 bg-yellow-50",
    saving: "bg-blue-50",
    saved: "bg-green-50",
    error: "bg-red-50",
  };

  // Readonly: einfaches td
  if (readonly) {
    return (
      <td
        className={cn(
          "text-right p-2 px-3 tabular-nums",
          className
        )}
        title={title}
      >
        {placeholder ?? displayValue}
      </td>
    );
  }

  // Editable: Input-Zelle
  const isEditing = status === "editing" || status === "saving";

  return (
    <td
      className={cn(
        "p-1 px-1",
        className
      )}
      title={title}
    >
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
