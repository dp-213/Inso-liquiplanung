"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TRANSFORMATION_TYPES,
  TRANSFORMATION_TYPE_LABELS,
  TARGET_FIELDS,
  TARGET_FIELD_LABELS,
  TARGET_FIELD_REQUIREMENTS,
  TransformationType,
  TargetField,
  FieldMapping,
  CategoryMapping,
} from "@/lib/ingestion/types";

interface JobData {
  id: string;
  fileName: string;
  sourceType: string;
  case: {
    caseNumber: string;
    debtorName: string;
  };
  records: Array<{
    rowNumber: number;
    rawData: Record<string, string>;
  }>;
}

interface MappingTemplate {
  id: string;
  name: string;
  description: string | null;
  sourceType: string;
  fieldMappings: string;
  valueMappings: string;
  categoryMappings: string;
}

interface Plan {
  id: string;
  name: string;
  planStartDate: string;
}

interface DefaultCategory {
  name: string;
  flowType: "INFLOW" | "OUTFLOW";
  estateType: "NEUMASSE" | "ALTMASSE";
}

const DEFAULT_CATEGORIES: DefaultCategory[] = [
  { name: "Umsatzerlöse", flowType: "INFLOW", estateType: "NEUMASSE" },
  { name: "Forderungseinzüge", flowType: "INFLOW", estateType: "ALTMASSE" },
  { name: "Sonstige Einzahlungen Neu", flowType: "INFLOW", estateType: "NEUMASSE" },
  { name: "Löhne und Gehälter", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Miete und Nebenkosten", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Material und Waren", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Sonstige Auszahlungen Neu", flowType: "OUTFLOW", estateType: "NEUMASSE" },
  { name: "Altmasseverbindlichkeiten", flowType: "OUTFLOW", estateType: "ALTMASSE" },
];

export default function MappingPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  const [job, setJob] = useState<JobData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detected source columns
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [sampleData, setSampleData] = useState<Record<string, string>[]>([]);

  // Mapping state
  const [fieldMappings, setFieldMappings] = useState<
    Array<{
      id: string;
      sourceField: string;
      targetField: TargetField;
      transformationType: TransformationType;
    }>
  >([]);

  const [categoryMappings, setCategoryMappings] = useState<
    Array<{
      id: string;
      sourceValue: string;
      categoryName: string;
      flowType: "INFLOW" | "OUTFLOW";
      estateType: "ALTMASSE" | "NEUMASSE";
    }>
  >([]);

  // Configuration options
  const [dateFormat, setDateFormat] = useState("DD.MM.YYYY");
  const [decimalSeparator, setDecimalSeparator] = useState(",");
  const [thousandsSeparator, setThousandsSeparator] = useState(".");
  const [planStartDate, setPlanStartDate] = useState("");
  const [defaultValueType, setDefaultValueType] = useState<"PLAN" | "IST">("PLAN");
  const [defaultCategory, setDefaultCategory] = useState(DEFAULT_CATEGORIES[0]);

  // Template modal
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [jobRes, templatesRes] = await Promise.all([
          fetch(`/api/ingestion/${resolvedParams.jobId}`),
          fetch("/api/ingestion/templates"),
        ]);

        if (jobRes.ok) {
          const jobData = await jobRes.json();
          setJob(jobData);

          // Extract columns from first record
          if (jobData.records.length > 0) {
            const cols = Object.keys(jobData.records[0].rawData);
            setSourceColumns(cols);
            setSampleData(jobData.records.slice(0, 5).map((r: { rawData: Record<string, string> }) => r.rawData));

            // Auto-detect common column mappings
            const autoMappings: typeof fieldMappings = [];
            const dateKeywords = ["datum", "date", "buchungstag", "valuta"];
            const amountKeywords = ["betrag", "amount", "summe", "wert", "saldo"];
            const descKeywords = ["verwendungszweck", "beschreibung", "description", "text", "name"];
            const categoryKeywords = ["kategorie", "category", "art", "type"];

            cols.forEach((col) => {
              const lowerCol = col.toLowerCase();
              if (dateKeywords.some((k) => lowerCol.includes(k))) {
                autoMappings.push({
                  id: `auto-${col}`,
                  sourceField: col,
                  targetField: "date",
                  transformationType: "DATE_TO_WEEK_OFFSET",
                });
              } else if (amountKeywords.some((k) => lowerCol.includes(k))) {
                autoMappings.push({
                  id: `auto-${col}`,
                  sourceField: col,
                  targetField: "amount_cents",
                  transformationType: "DECIMAL_TO_CENTS",
                });
              } else if (descKeywords.some((k) => lowerCol.includes(k))) {
                autoMappings.push({
                  id: `auto-${col}`,
                  sourceField: col,
                  targetField: "line_name",
                  transformationType: "DIRECT",
                });
              } else if (categoryKeywords.some((k) => lowerCol.includes(k))) {
                autoMappings.push({
                  id: `auto-${col}`,
                  sourceField: col,
                  targetField: "category",
                  transformationType: "DIRECT",
                });
              }
            });

            if (autoMappings.length > 0) {
              setFieldMappings(autoMappings);
            }

            // Fetch plans for this case
            const plansRes = await fetch(`/api/cases/${jobData.caseId}`);
            if (plansRes.ok) {
              const caseData = await plansRes.json();
              if (caseData.plans) {
                setPlans(caseData.plans);
                const activePlan = caseData.plans.find((p: Plan) => p);
                if (activePlan) {
                  setPlanStartDate(activePlan.planStartDate.split("T")[0]);
                }
              }
            }
          }
        }

        if (templatesRes.ok) {
          const templatesData = await templatesRes.json();
          setTemplates(templatesData);
        }
      } catch (err) {
        setError("Fehler beim Laden der Daten");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [resolvedParams.jobId]);

  const addFieldMapping = () => {
    setFieldMappings([
      ...fieldMappings,
      {
        id: `new-${Date.now()}`,
        sourceField: sourceColumns[0] || "",
        targetField: "line_name",
        transformationType: "DIRECT",
      },
    ]);
  };

  const removeFieldMapping = (id: string) => {
    setFieldMappings(fieldMappings.filter((m) => m.id !== id));
  };

  const updateFieldMapping = (
    id: string,
    field: keyof (typeof fieldMappings)[0],
    value: string
  ) => {
    setFieldMappings(
      fieldMappings.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      )
    );
  };

  const addCategoryMapping = () => {
    setCategoryMappings([
      ...categoryMappings,
      {
        id: `new-${Date.now()}`,
        sourceValue: "",
        categoryName: DEFAULT_CATEGORIES[0].name,
        flowType: DEFAULT_CATEGORIES[0].flowType,
        estateType: DEFAULT_CATEGORIES[0].estateType,
      },
    ]);
  };

  const removeCategoryMapping = (id: string) => {
    setCategoryMappings(categoryMappings.filter((m) => m.id !== id));
  };

  const updateCategoryMapping = (
    id: string,
    field: keyof (typeof categoryMappings)[0],
    value: string
  ) => {
    setCategoryMappings(
      categoryMappings.map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      )
    );
  };

  const applyTemplate = (template: MappingTemplate) => {
    try {
      const fields = JSON.parse(template.fieldMappings);
      const categories = JSON.parse(template.categoryMappings);

      // Map template fields to current columns
      const mappedFields = fields
        .filter((f: FieldMapping) => sourceColumns.includes(f.sourceField))
        .map((f: FieldMapping) => ({
          ...f,
          id: `template-${f.sourceField}`,
        }));

      if (mappedFields.length > 0) {
        setFieldMappings(mappedFields);
      }

      if (categories.length > 0) {
        setCategoryMappings(
          categories.map((c: CategoryMapping) => ({
            ...c,
            id: `template-${c.matchValue || Date.now()}`,
          }))
        );
      }
    } catch (err) {
      setError("Fehler beim Laden der Vorlage");
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName) {
      setError("Bitte Vorlagenname eingeben");
      return;
    }

    try {
      const res = await fetch("/api/ingestion/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          sourceType: job?.sourceType,
          fieldMappings: JSON.stringify(fieldMappings),
          valueMappings: JSON.stringify([]),
          categoryMappings: JSON.stringify(categoryMappings),
          dateFormat,
          decimalSeparator,
          thousandsSeparator,
        }),
      });

      if (res.ok) {
        setShowSaveTemplate(false);
        setTemplateName("");
        setTemplateDescription("");
        // Refresh templates
        const templatesRes = await fetch("/api/ingestion/templates");
        if (templatesRes.ok) {
          setTemplates(await templatesRes.json());
        }
      } else {
        throw new Error("Fehler beim Speichern");
      }
    } catch (err) {
      setError("Fehler beim Speichern der Vorlage");
    }
  };

  const handleSubmit = async () => {
    // Validation
    const hasDateMapping = fieldMappings.some((m) => m.targetField === "date" || m.targetField === "week_offset");
    const hasAmountMapping = fieldMappings.some((m) => m.targetField === "amount_cents");
    const hasNameMapping = fieldMappings.some((m) => m.targetField === "line_name");

    if (!hasDateMapping) {
      setError("Bitte eine Spalte für das Datum zuordnen");
      return;
    }
    if (!hasAmountMapping) {
      setError("Bitte eine Spalte für den Betrag zuordnen");
      return;
    }
    if (!hasNameMapping) {
      setError("Bitte eine Spalte für die Bezeichnung zuordnen");
      return;
    }
    if (!planStartDate) {
      setError("Bitte das Startdatum des Plans angeben");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/ingestion/${resolvedParams.jobId}/map`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldMappings: fieldMappings.map((m) => ({
            sourceField: m.sourceField,
            targetField: m.targetField,
            transformationType: m.transformationType,
          })),
          categoryMappings: categoryMappings.map((m) => ({
            sourceValue: m.sourceValue,
            categoryName: m.categoryName,
            flowType: m.flowType,
            estateType: m.estateType,
          })),
          planStartDate,
          dateFormat,
          decimalSeparator,
          thousandsSeparator,
          defaultValueType,
          defaultCategory,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Zuordnung fehlgeschlagen");
      }

      // Redirect based on result
      if (data.status === "REVIEW" || data.warningCount > 0) {
        router.push(`/admin/ingestion/${resolvedParams.jobId}/review`);
      } else if (data.status === "READY") {
        router.push(`/admin/ingestion/${resolvedParams.jobId}`);
      } else {
        router.push(`/admin/ingestion/${resolvedParams.jobId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Zuordnung fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
            <span className="ml-3 text-[var(--secondary)]">Laden...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <div className="admin-card p-8 text-center">
          <div className="text-[var(--danger)]">Importvorgang nicht gefunden</div>
          <Link href="/admin/ingestion" className="text-[var(--primary)] hover:underline mt-4 block">
            Zurück
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href={`/admin/ingestion/${resolvedParams.jobId}`}
            className="text-[var(--secondary)] hover:text-[var(--foreground)]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-[var(--foreground)]">
              Spaltenzuordnung
            </h1>
            <p className="text-sm text-[var(--secondary)]">
              {job.fileName} - {job.case.caseNumber}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowSaveTemplate(true)}
            className="btn-secondary"
          >
            Als Vorlage speichern
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? "Verarbeite..." : "Zuordnung anwenden"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Template Selection */}
      {templates.length > 0 && (
        <div className="admin-card">
          <div className="p-4 border-b border-[var(--border)]">
            <h3 className="font-medium text-[var(--foreground)]">Vorlage verwenden</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {templates.map((template) => (
              <button
                key={template.id}
                onClick={() => applyTemplate(template)}
                className="btn-secondary text-sm"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data Preview */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">Datenvorschau</h3>
          <p className="text-sm text-[var(--secondary)] mt-1">
            Erste 5 Zeilen der importierten Daten
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table text-sm">
            <thead>
              <tr>
                <th className="w-12">#</th>
                {sourceColumns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleData.map((row, idx) => (
                <tr key={idx}>
                  <td className="font-mono">{idx + 1}</td>
                  {sourceColumns.map((col) => (
                    <td key={col} className="max-w-xs truncate">
                      {row[col] || "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--foreground)]">Konfiguration</h3>
        </div>
        <div className="p-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Planstartdatum *
            </label>
            <input
              type="date"
              value={planStartDate}
              onChange={(e) => setPlanStartDate(e.target.value)}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Datumsformat
            </label>
            <select
              value={dateFormat}
              onChange={(e) => setDateFormat(e.target.value)}
              className="input-field"
            >
              <option value="DD.MM.YYYY">DD.MM.YYYY (deutsch)</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD (ISO)</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="MM/DD/YYYY">MM/DD/YYYY (US)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Dezimaltrennzeichen
            </label>
            <select
              value={decimalSeparator}
              onChange={(e) => setDecimalSeparator(e.target.value)}
              className="input-field"
            >
              <option value=",">, (Komma - deutsch)</option>
              <option value=".">. (Punkt - englisch)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Tausendertrennzeichen
            </label>
            <select
              value={thousandsSeparator}
              onChange={(e) => setThousandsSeparator(e.target.value)}
              className="input-field"
            >
              <option value=".">. (Punkt - deutsch)</option>
              <option value=",">, (Komma - englisch)</option>
              <option value=" ">Leerzeichen</option>
              <option value="">Keines</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Standard Werttyp
            </label>
            <select
              value={defaultValueType}
              onChange={(e) => setDefaultValueType(e.target.value as "PLAN" | "IST")}
              className="input-field"
            >
              <option value="PLAN">PLAN (Planwert)</option>
              <option value="IST">IST (Istwert)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1">
              Standardkategorie
            </label>
            <select
              value={defaultCategory.name}
              onChange={(e) => {
                const cat = DEFAULT_CATEGORIES.find((c) => c.name === e.target.value);
                if (cat) setDefaultCategory(cat);
              }}
              className="input-field"
            >
              {DEFAULT_CATEGORIES.map((cat) => (
                <option key={cat.name} value={cat.name}>
                  {cat.name} ({cat.flowType} / {cat.estateType})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Field Mappings */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="font-medium text-[var(--foreground)]">Spaltenzuordnung</h3>
            <p className="text-sm text-[var(--secondary)] mt-1">
              Ordnen Sie Quellspalten den Zielfeldern zu
            </p>
          </div>
          <button onClick={addFieldMapping} className="btn-secondary text-sm">
            + Zuordnung hinzufügen
          </button>
        </div>
        <div className="p-4 space-y-4">
          {fieldMappings.length === 0 ? (
            <div className="text-center text-[var(--secondary)] py-8">
              Noch keine Zuordnungen definiert. Klicken Sie auf &quot;Zuordnung hinzufügen&quot;.
            </div>
          ) : (
            fieldMappings.map((mapping) => (
              <div
                key={mapping.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    Quellspalte
                  </label>
                  <select
                    value={mapping.sourceField}
                    onChange={(e) =>
                      updateFieldMapping(mapping.id, "sourceField", e.target.value)
                    }
                    className="input-field"
                  >
                    {sourceColumns.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <svg
                    className="w-6 h-6 text-[var(--muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    Zielfeld
                  </label>
                  <select
                    value={mapping.targetField}
                    onChange={(e) =>
                      updateFieldMapping(mapping.id, "targetField", e.target.value)
                    }
                    className="input-field"
                  >
                    {Object.entries(TARGET_FIELD_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}{" "}
                        {TARGET_FIELD_REQUIREMENTS[key as TargetField].required
                          ? "*"
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    Transformation
                  </label>
                  <select
                    value={mapping.transformationType}
                    onChange={(e) =>
                      updateFieldMapping(
                        mapping.id,
                        "transformationType",
                        e.target.value
                      )
                    }
                    className="input-field"
                  >
                    {Object.entries(TRANSFORMATION_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="pt-5">
                  <button
                    onClick={() => removeFieldMapping(mapping.id)}
                    className="text-[var(--danger)] hover:bg-red-50 p-2 rounded"
                    title="Entfernen"
                  >
                    <svg
                      className="w-5 h-5"
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
            ))
          )}
        </div>
      </div>

      {/* Category Mappings */}
      <div className="admin-card">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div>
            <h3 className="font-medium text-[var(--foreground)]">
              Kategoriezuordnung (optional)
            </h3>
            <p className="text-sm text-[var(--secondary)] mt-1">
              Ordnen Sie Werte bestimmten Kategorien zu
            </p>
          </div>
          <button onClick={addCategoryMapping} className="btn-secondary text-sm">
            + Regel hinzufügen
          </button>
        </div>
        <div className="p-4 space-y-4">
          {categoryMappings.length === 0 ? (
            <div className="text-center text-[var(--secondary)] py-8">
              Keine Kategorieregeln definiert. Die Standardkategorie wird verwendet.
            </div>
          ) : (
            categoryMappings.map((mapping) => (
              <div
                key={mapping.id}
                className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    Wenn Wert enthält
                  </label>
                  <input
                    type="text"
                    value={mapping.sourceValue}
                    onChange={(e) =>
                      updateCategoryMapping(mapping.id, "sourceValue", e.target.value)
                    }
                    placeholder="z.B. LOHN, MIETE"
                    className="input-field"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <svg
                    className="w-6 h-6 text-[var(--muted)]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 5l7 7m0 0l-7 7m7-7H3"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    Kategorie
                  </label>
                  <select
                    value={mapping.categoryName}
                    onChange={(e) => {
                      const cat = DEFAULT_CATEGORIES.find(
                        (c) => c.name === e.target.value
                      );
                      if (cat) {
                        updateCategoryMapping(mapping.id, "categoryName", cat.name);
                        updateCategoryMapping(mapping.id, "flowType", cat.flowType);
                        updateCategoryMapping(mapping.id, "estateType", cat.estateType);
                      }
                    }}
                    className="input-field"
                  >
                    {DEFAULT_CATEGORIES.map((cat) => (
                      <option key={cat.name} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-24">
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    Typ
                  </label>
                  <span className="text-sm font-medium">
                    {mapping.flowType}
                  </span>
                </div>
                <div className="w-24">
                  <label className="block text-xs text-[var(--muted)] mb-1">
                    Masse
                  </label>
                  <span className="text-sm font-medium">
                    {mapping.estateType}
                  </span>
                </div>
                <div className="pt-5">
                  <button
                    onClick={() => removeCategoryMapping(mapping.id)}
                    className="text-[var(--danger)] hover:bg-red-50 p-2 rounded"
                    title="Entfernen"
                  >
                    <svg
                      className="w-5 h-5"
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
            ))
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-4">
        <Link
          href={`/admin/ingestion/${resolvedParams.jobId}`}
          className="btn-secondary"
        >
          Abbrechen
        </Link>
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="btn-primary disabled:opacity-50"
        >
          {submitting ? "Verarbeite..." : "Zuordnung anwenden"}
        </button>
      </div>

      {/* Save Template Modal */}
      {showSaveTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Vorlage speichern</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="z.B. Sparkasse Kontoauszug"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optionale Beschreibung..."
                  rows={3}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowSaveTemplate(false)}
                className="btn-secondary"
              >
                Abbrechen
              </button>
              <button onClick={handleSaveTemplate} className="btn-primary">
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
