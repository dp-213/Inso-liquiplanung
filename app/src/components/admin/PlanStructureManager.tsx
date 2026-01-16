"use client";

import { useState, useCallback } from "react";

interface Line {
  id: string;
  name: string;
  description: string | null;
  displayOrder: number;
}

interface Category {
  id: string;
  name: string;
  flowType: "INFLOW" | "OUTFLOW";
  estateType: "ALTMASSE" | "NEUMASSE";
  displayOrder: number;
  lines: Line[];
}

interface PlanStructureManagerProps {
  caseId: string;
  categories: Category[];
  onUpdate: () => void;
  onClose: () => void;
}

type ModalType = "addCategory" | "addLine" | "editCategory" | "editLine" | "deleteCategory" | "deleteLine" | null;

interface FormState {
  categoryId?: string;
  lineId?: string;
  name: string;
  description: string;
  flowType: "INFLOW" | "OUTFLOW";
  estateType: "ALTMASSE" | "NEUMASSE";
}

const initialFormState: FormState = {
  name: "",
  description: "",
  flowType: "INFLOW",
  estateType: "ALTMASSE",
};

/**
 * Component for managing plan structure (categories and lines)
 */
export default function PlanStructureManager({
  caseId,
  categories,
  onUpdate,
  onClose,
}: PlanStructureManagerProps) {
  const [modalType, setModalType] = useState<ModalType>(null);
  const [formState, setFormState] = useState<FormState>(initialFormState);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map((c) => c.id))
  );

  // Toggle category expansion
  const toggleCategory = useCallback((categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }, []);

  // Open modal for adding category
  const openAddCategory = useCallback(() => {
    setFormState(initialFormState);
    setModalType("addCategory");
    setError(null);
  }, []);

  // Open modal for editing category
  const openEditCategory = useCallback((category: Category) => {
    setFormState({
      categoryId: category.id,
      name: category.name,
      description: "",
      flowType: category.flowType,
      estateType: category.estateType,
    });
    setModalType("editCategory");
    setError(null);
  }, []);

  // Open modal for deleting category
  const openDeleteCategory = useCallback((category: Category) => {
    setFormState({
      categoryId: category.id,
      name: category.name,
      description: "",
      flowType: category.flowType,
      estateType: category.estateType,
    });
    setModalType("deleteCategory");
    setError(null);
  }, []);

  // Open modal for adding line
  const openAddLine = useCallback((categoryId: string) => {
    setFormState({
      ...initialFormState,
      categoryId,
    });
    setModalType("addLine");
    setError(null);
  }, []);

  // Open modal for editing line
  const openEditLine = useCallback((line: Line, categoryId: string) => {
    setFormState({
      categoryId,
      lineId: line.id,
      name: line.name,
      description: line.description || "",
      flowType: "INFLOW",
      estateType: "ALTMASSE",
    });
    setModalType("editLine");
    setError(null);
  }, []);

  // Open modal for deleting line
  const openDeleteLine = useCallback((line: Line, categoryId: string) => {
    setFormState({
      categoryId,
      lineId: line.id,
      name: line.name,
      description: "",
      flowType: "INFLOW",
      estateType: "ALTMASSE",
    });
    setModalType("deleteLine");
    setError(null);
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setModalType(null);
    setFormState(initialFormState);
    setError(null);
  }, []);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError(null);

    try {
      let url: string;
      let method: string;
      let body: Record<string, unknown>;

      switch (modalType) {
        case "addCategory":
          url = `/api/cases/${caseId}/plan/categories`;
          method = "POST";
          body = {
            name: formState.name,
            flowType: formState.flowType,
            estateType: formState.estateType,
          };
          break;

        case "editCategory":
          url = `/api/cases/${caseId}/plan/categories/${formState.categoryId}`;
          method = "PUT";
          body = {
            name: formState.name,
            flowType: formState.flowType,
            estateType: formState.estateType,
          };
          break;

        case "deleteCategory":
          url = `/api/cases/${caseId}/plan/categories/${formState.categoryId}`;
          method = "DELETE";
          body = {};
          break;

        case "addLine":
          url = `/api/cases/${caseId}/plan/lines`;
          method = "POST";
          body = {
            categoryId: formState.categoryId,
            name: formState.name,
            description: formState.description || null,
          };
          break;

        case "editLine":
          url = `/api/cases/${caseId}/plan/lines/${formState.lineId}`;
          method = "PUT";
          body = {
            name: formState.name,
            description: formState.description || null,
          };
          break;

        case "deleteLine":
          url = `/api/cases/${caseId}/plan/lines/${formState.lineId}`;
          method = "DELETE";
          body = {};
          break;

        default:
          return;
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method !== "DELETE" ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Operation fehlgeschlagen");
      }

      closeModal();
      onUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setSaving(false);
    }
  }, [caseId, formState, modalType, closeModal, onUpdate]);

  // Separate categories by flow type
  const inflowCategories = categories.filter((c) => c.flowType === "INFLOW");
  const outflowCategories = categories.filter((c) => c.flowType === "OUTFLOW");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-[var(--foreground)]">
            Planstruktur verwalten
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Add Category Button */}
          <div className="mb-6">
            <button
              onClick={openAddCategory}
              className="btn-primary flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Neue Kategorie
            </button>
          </div>

          {/* Inflows Section */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-green-700 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              Einzahlungen ({inflowCategories.length})
            </h3>
            <div className="space-y-2">
              {inflowCategories.map((category) => (
                <CategoryItem
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                  onEdit={() => openEditCategory(category)}
                  onDelete={() => openDeleteCategory(category)}
                  onAddLine={() => openAddLine(category.id)}
                  onEditLine={(line) => openEditLine(line, category.id)}
                  onDeleteLine={(line) => openDeleteLine(line, category.id)}
                />
              ))}
              {inflowCategories.length === 0 && (
                <p className="text-sm text-gray-500 italic">
                  Keine Einzahlungs-Kategorien vorhanden
                </p>
              )}
            </div>
          </div>

          {/* Outflows Section */}
          <div>
            <h3 className="text-sm font-semibold text-red-700 mb-3 flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              Auszahlungen ({outflowCategories.length})
            </h3>
            <div className="space-y-2">
              {outflowCategories.map((category) => (
                <CategoryItem
                  key={category.id}
                  category={category}
                  isExpanded={expandedCategories.has(category.id)}
                  onToggle={() => toggleCategory(category.id)}
                  onEdit={() => openEditCategory(category)}
                  onDelete={() => openDeleteCategory(category)}
                  onAddLine={() => openAddLine(category.id)}
                  onEditLine={(line) => openEditLine(line, category.id)}
                  onDeleteLine={(line) => openDeleteLine(line, category.id)}
                />
              ))}
              {outflowCategories.length === 0 && (
                <p className="text-sm text-gray-500 italic">
                  Keine Auszahlungs-Kategorien vorhanden
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button onClick={onClose} className="btn-secondary">
            Schliessen
          </button>
        </div>
      </div>

      {/* Modal for Add/Edit/Delete */}
      {modalType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-[var(--foreground)] mb-4">
              {modalType === "addCategory" && "Neue Kategorie erstellen"}
              {modalType === "editCategory" && "Kategorie bearbeiten"}
              {modalType === "deleteCategory" && "Kategorie loeschen"}
              {modalType === "addLine" && "Neue Zeile erstellen"}
              {modalType === "editLine" && "Zeile bearbeiten"}
              {modalType === "deleteLine" && "Zeile loeschen"}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Delete Confirmation */}
            {(modalType === "deleteCategory" || modalType === "deleteLine") && (
              <div className="mb-6">
                <p className="text-[var(--muted)]">
                  Moechten Sie{" "}
                  <span className="font-semibold text-[var(--foreground)]">
                    {formState.name}
                  </span>{" "}
                  wirklich loeschen?
                </p>
                {modalType === "deleteCategory" && (
                  <p className="text-sm text-amber-600 mt-2">
                    Hinweis: Kategorien mit Werten koennen nicht geloescht werden.
                  </p>
                )}
                {modalType === "deleteLine" && (
                  <p className="text-sm text-amber-600 mt-2">
                    Alle zugehoerigen Werte werden ebenfalls geloescht.
                  </p>
                )}
              </div>
            )}

            {/* Category Form */}
            {(modalType === "addCategory" || modalType === "editCategory") && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="z.B. Mieteinnahmen"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Art
                  </label>
                  <select
                    value={formState.flowType}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        flowType: e.target.value as "INFLOW" | "OUTFLOW",
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="INFLOW">Einzahlung</option>
                    <option value="OUTFLOW">Auszahlung</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Masse-Typ
                  </label>
                  <select
                    value={formState.estateType}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        estateType: e.target.value as "ALTMASSE" | "NEUMASSE",
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="ALTMASSE">Altmasse</option>
                    <option value="NEUMASSE">Neumasse</option>
                  </select>
                </div>
              </div>
            )}

            {/* Line Form */}
            {(modalType === "addLine" || modalType === "editLine") && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="z.B. Miete Objekt A"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
                    Beschreibung (optional)
                  </label>
                  <input
                    type="text"
                    value={formState.description}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optionale Beschreibung"
                  />
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeModal}
                className="btn-secondary"
                disabled={saving}
              >
                Abbrechen
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving || (!formState.name && modalType !== "deleteCategory" && modalType !== "deleteLine")}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  modalType === "deleteCategory" || modalType === "deleteLine"
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-blue-500 hover:bg-blue-600 text-white"
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 animate-spin"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Speichern...
                  </span>
                ) : modalType === "deleteCategory" || modalType === "deleteLine" ? (
                  "Loeschen"
                ) : (
                  "Speichern"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Category item component
interface CategoryItemProps {
  category: Category;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddLine: () => void;
  onEditLine: (line: Line) => void;
  onDeleteLine: (line: Line) => void;
}

function CategoryItem({
  category,
  isExpanded,
  onToggle,
  onEdit,
  onDelete,
  onAddLine,
  onEditLine,
  onDeleteLine,
}: CategoryItemProps) {
  const bgClass =
    category.flowType === "INFLOW" ? "bg-green-50" : "bg-red-50";
  const borderClass =
    category.flowType === "INFLOW" ? "border-green-200" : "border-red-200";

  return (
    <div className={`border ${borderClass} rounded-lg overflow-hidden`}>
      {/* Category Header */}
      <div
        className={`${bgClass} px-4 py-3 flex items-center justify-between cursor-pointer`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-gray-500 transition-transform ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="font-medium text-[var(--foreground)]">
            {category.name}
          </span>
          <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
            {category.estateType === "ALTMASSE" ? "Alt" : "Neu"}
          </span>
          <span className="text-xs text-gray-500">
            ({category.lines.length} Zeilen)
          </span>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onAddLine}
            className="p-1.5 hover:bg-white/50 rounded transition-colors"
            title="Zeile hinzufuegen"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 hover:bg-white/50 rounded transition-colors"
            title="Bearbeiten"
          >
            <svg
              className="w-4 h-4 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-white/50 rounded transition-colors"
            title="Loeschen"
          >
            <svg
              className="w-4 h-4 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Lines */}
      {isExpanded && (
        <div className="bg-white divide-y divide-gray-100">
          {category.lines.map((line) => (
            <div
              key={line.id}
              className="px-4 py-2 pl-11 flex items-center justify-between hover:bg-gray-50"
            >
              <div>
                <span className="text-sm text-[var(--foreground)]">
                  {line.name}
                </span>
                {line.description && (
                  <span className="text-xs text-gray-500 ml-2">
                    - {line.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEditLine(line)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Bearbeiten"
                >
                  <svg
                    className="w-3.5 h-3.5 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => onDeleteLine(line)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Loeschen"
                >
                  <svg
                    className="w-3.5 h-3.5 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
          {category.lines.length === 0 && (
            <div className="px-4 py-3 pl-11 text-sm text-gray-500 italic">
              Keine Zeilen vorhanden
            </div>
          )}
        </div>
      )}
    </div>
  );
}
