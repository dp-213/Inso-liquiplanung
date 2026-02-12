"use client";

import { useState, useRef, useEffect } from "react";

interface MultiSelectFilterOption {
  value: string;
  label: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectFilterOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  allowNull?: boolean;
  nullLabel?: string;
}

export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  allowNull = false,
  nullLabel = "(Leer)",
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const allOptions: MultiSelectFilterOption[] = allowNull
    ? [{ value: "null", label: nullLabel }, ...options]
    : options;

  const filtered = search.trim()
    ? allOptions.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase().trim())
      )
    : allOptions;

  const activeCount = selected.length;

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    onChange(allOptions.map((o) => o.value));
  };

  const selectNone = () => {
    onChange([]);
  };

  const buttonLabel =
    activeCount === 0
      ? label
      : activeCount === 1
        ? allOptions.find((o) => o.value === selected[0])?.label || label
        : `${label} (${activeCount})`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-md transition-colors ${
          activeCount > 0
            ? "bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100"
            : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
        }`}
      >
        <span className="truncate max-w-[180px]">{buttonLabel}</span>
        <svg
          className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[220px] max-w-[300px]">
          {/* Alle/Keine Buttons */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">{label}</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Alle
              </button>
              <button
                type="button"
                onClick={selectNone}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Keine
              </button>
            </div>
          </div>

          {/* Suchfeld (bei >5 Optionen) */}
          {allOptions.length > 5 && (
            <div className="px-3 py-2 border-b border-gray-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Suchen..."
                className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-300"
                autoFocus
              />
            </div>
          )}

          {/* Optionsliste */}
          <div className="max-h-[250px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">Keine Treffer</div>
            ) : (
              filtered.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => toggleValue(opt.value)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm truncate">{opt.label}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
