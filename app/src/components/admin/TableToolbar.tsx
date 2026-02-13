"use client";

import { ReactNode } from "react";

interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  children?: ReactNode;
}

export function TableToolbar({
  search,
  onSearchChange,
  resultCount,
  totalCount,
  children,
}: TableToolbarProps) {
  return (
    <div className="px-4 py-3 border-b border-[var(--border)] flex flex-wrap items-center gap-3">
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Suchen..."
          className="input w-full pl-9 py-1.5 text-sm"
        />
      </div>
      {children}
      <span className="text-xs text-[var(--muted)] ml-auto whitespace-nowrap">
        {resultCount === totalCount
          ? `${totalCount} Einträge`
          : `${resultCount} von ${totalCount} Einträgen`}
      </span>
    </div>
  );
}

interface SortableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string;
  currentSortDir: "asc" | "desc";
  onToggle: (key: string) => void;
  className?: string;
  align?: "left" | "right";
}

export function SortableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDir,
  onToggle,
  className = "px-4 py-3 text-xs font-semibold text-[var(--secondary)] uppercase",
  align = "left",
}: SortableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  const alignClass = align === "right" ? "text-right" : "text-left";
  const flexJustify = align === "right" ? "justify-end" : "";
  return (
    <th
      className={`${className} ${alignClass} cursor-pointer select-none hover:text-[var(--foreground)] transition-colors`}
      onClick={() => onToggle(sortKey)}
    >
      <span className={`inline-flex items-center gap-1 ${flexJustify}`}>
        {label}
        <span className={`text-[10px] ${isActive ? "text-[var(--primary)]" : "text-[var(--muted)] opacity-40"}`}>
          {isActive ? (currentSortDir === "asc" ? "\u25B2" : "\u25BC") : "\u25B2"}
        </span>
      </span>
    </th>
  );
}
