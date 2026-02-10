"use client";

import { useState } from "react";

export interface ColumnFilterValue {
  type: 'multiselect' | 'text' | 'range';
  values?: string[];
  text?: string;
  min?: number;
  max?: number;
}

interface ColumnFilterProps {
  columnId: string;
  filterType: 'multiselect' | 'text' | 'range';
  options?: { value: string; label: string }[];
  currentFilter?: ColumnFilterValue;
  onFilterChange: (columnId: string, filter: ColumnFilterValue | null) => void;
}

export function ColumnFilter({ columnId, filterType, options, currentFilter, onFilterChange }: ColumnFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasActiveFilter = currentFilter && (
    (currentFilter.values && currentFilter.values.length > 0) ||
    (currentFilter.text && currentFilter.text.trim()) ||
    (currentFilter.min !== undefined || currentFilter.max !== undefined)
  );

  const handleFilterChange = (update: Partial<ColumnFilterValue>) => {
    if (!update.values?.length && !update.text?.trim() && update.min === undefined && update.max === undefined) {
      onFilterChange(columnId, null);
    } else {
      onFilterChange(columnId, { ...currentFilter, ...update, type: filterType });
    }
  };

  const toggleValue = (value: string) => {
    const current = currentFilter?.values || [];
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    handleFilterChange({ values: newValues });
  };

  const clearFilter = () => {
    onFilterChange(columnId, null);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className={`ml-1 p-0.5 rounded hover:bg-gray-200 ${hasActiveFilter ? 'text-blue-600' : 'text-gray-400'}`}
        title="Filter"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1 bg-white border rounded-md shadow-lg z-20 min-w-[200px] max-h-[300px] overflow-y-auto">
            <div className="p-2">
              {filterType === 'text' && (
                <input
                  type="text"
                  placeholder="Suchen..."
                  value={currentFilter?.text || ''}
                  onChange={(e) => handleFilterChange({ text: e.target.value })}
                  className="w-full px-2 py-1 text-sm border rounded"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              )}

              {filterType === 'multiselect' && options && (
                <div className="space-y-1">
                  {options.map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={currentFilter?.values?.includes(opt.value) || false}
                        onChange={() => toggleValue(opt.value)}
                        className="rounded"
                      />
                      <span className="truncate">{opt.label}</span>
                    </label>
                  ))}
                </div>
              )}

              {filterType === 'range' && (
                <div className="space-y-2">
                  <input
                    type="number"
                    placeholder="Min (€)"
                    value={currentFilter?.min ?? ''}
                    onChange={(e) => handleFilterChange({ min: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                  <input
                    type="number"
                    placeholder="Max (€)"
                    value={currentFilter?.max ?? ''}
                    onChange={(e) => handleFilterChange({ max: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              )}

              {hasActiveFilter && (
                <button
                  onClick={clearFilter}
                  className="mt-2 w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                >
                  Filter zurücksetzen
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
