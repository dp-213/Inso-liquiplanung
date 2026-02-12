"use client";

import { useState, useMemo } from "react";

interface TableControlsConfig<T> {
  searchFields: (keyof T)[];
  defaultSort: { key: keyof T; dir: "asc" | "desc" };
}

export function useTableControls<T>(items: T[], config: TableControlsConfig<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<keyof T>(config.defaultSort.key);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(config.defaultSort.dir);

  const toggleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const result = useMemo(() => {
    const term = search.toLowerCase().trim();

    const filtered = term
      ? items.filter((item) =>
          config.searchFields.some((field) => {
            const val = item[field];
            if (val === null || val === undefined) return false;
            return String(val).toLowerCase().includes(term);
          })
        )
      : items;

    const sorted = [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];

      // nulls/undefined always last
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();

      const aNum = Number(aVal);
      const bNum = Number(bVal);
      const bothNumeric = !isNaN(aNum) && !isNaN(bNum) && aStr !== "" && bStr !== "";

      let cmp: number;
      if (bothNumeric) {
        cmp = aNum - bNum;
      } else {
        cmp = aStr.localeCompare(bStr, "de");
      }

      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [items, search, sortKey, sortDir, config.searchFields]);

  return { search, setSearch, sortKey, sortDir, toggleSort, result };
}
