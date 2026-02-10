"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface IVNote {
  id: string;
  content: string;
  status: "OFFEN" | "WARTET" | "ERLEDIGT";
  priority: "NIEDRIG" | "MITTEL" | "HOCH" | "KRITISCH";
  createdAt: string;
  updatedAt: string;
  author: string;
}

export default function IVKommunikationPage() {
  const params = useParams();
  const caseId = params.id as string;

  const [notes, setNotes] = useState<IVNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit-Modus
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNotePriority, setNewNotePriority] = useState<IVNote["priority"]>("MITTEL");
  const [newNoteStatus, setNewNoteStatus] = useState<IVNote["status"]>("OFFEN");

  // Lade Notizen
  useEffect(() => {
    loadNotes();
  }, [caseId]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/cases/${caseId}/iv-notes`, {
        credentials: "include",
      });

      if (!res.ok) throw new Error("Fehler beim Laden der Notizen");

      const data = await res.json();
      setNotes(data.notes || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      setSaving(true);
      const res = await fetch(`/api/cases/${caseId}/iv-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          content: newNoteContent,
          priority: newNotePriority,
          status: newNoteStatus,
        }),
      });

      if (!res.ok) throw new Error("Fehler beim Speichern");

      const data = await res.json();
      setNotes([data.note, ...notes]);

      // Reset
      setNewNoteContent("");
      setNewNotePriority("MITTEL");
      setNewNoteStatus("OFFEN");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    } finally {
      setSaving(false);
    }
  };

  const updateNoteStatus = async (noteId: string, status: IVNote["status"]) => {
    try {
      const res = await fetch(`/api/cases/${caseId}/iv-notes`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ noteId, status }),
      });

      if (!res.ok) throw new Error("Fehler beim Update");

      const data = await res.json();
      setNotes(notes.map(n => n.id === noteId ? data.note : n));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Notiz wirklich löschen?")) return;

    try {
      const res = await fetch(`/api/cases/${caseId}/iv-notes?noteId=${noteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Fehler beim Löschen");

      setNotes(notes.filter(n => n.id !== noteId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
    }
  };

  const getPriorityColor = (priority: IVNote["priority"]) => {
    switch (priority) {
      case "KRITISCH": return "bg-red-100 text-red-800 border-red-300";
      case "HOCH": return "bg-orange-100 text-orange-800 border-orange-300";
      case "MITTEL": return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "NIEDRIG": return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  const getStatusColor = (status: IVNote["status"]) => {
    switch (status) {
      case "OFFEN": return "bg-blue-100 text-blue-800";
      case "WARTET": return "bg-purple-100 text-purple-800";
      case "ERLEDIGT": return "bg-green-100 text-green-800";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-500">Lade Notizen...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              IV-Kommunikation
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Notizen & Fragen an Insolvenzverwalter (Sonja ist einziges Interface)
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-300 text-red-800 px-4 py-3 rounded-md">
            ⚠️ {error}
          </div>
        )}

        {/* Neue Notiz */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            ✍️ Neue Notiz / Frage
          </h2>

          <div className="space-y-4">
            {/* Priorität & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priorität
                </label>
                <select
                  value={newNotePriority}
                  onChange={(e) => setNewNotePriority(e.target.value as IVNote["priority"])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NIEDRIG">🟢 Niedrig</option>
                  <option value="MITTEL">🟡 Mittel</option>
                  <option value="HOCH">🟠 Hoch</option>
                  <option value="KRITISCH">🔴 Kritisch</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={newNoteStatus}
                  onChange={(e) => setNewNoteStatus(e.target.value as IVNote["status"])}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="OFFEN">🔵 Offen</option>
                  <option value="WARTET">🟣 Wartet auf Antwort</option>
                  <option value="ERLEDIGT">🟢 Erledigt</option>
                </select>
              </div>
            </div>

            {/* Content */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notiz / Frage
              </label>
              <textarea
                value={newNoteContent}
                onChange={(e) => setNewNoteContent(e.target.value)}
                placeholder="z.B. 'Bei IV anfragen: Fehlende Zahlbelege für EBICS 52.683 EUR vom 27.01.2026...'"
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">
                Markdown-Formatierung unterstützt
              </p>
            </div>

            {/* Speichern */}
            <button
              onClick={saveNote}
              disabled={!newNoteContent.trim() || saving}
              className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition font-medium"
            >
              {saving ? "Speichert..." : "💾 Notiz speichern"}
            </button>
          </div>
        </div>

        {/* Notizen-Liste */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            📋 Alle Notizen ({notes.length})
          </h2>

          {notes.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
              <p className="text-gray-500">Noch keine Notizen vorhanden</p>
            </div>
          )}

          {notes.map((note) => (
            <div
              key={note.id}
              className={`bg-white rounded-lg shadow-sm border-2 p-6 ${getPriorityColor(note.priority)}`}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(note.status)}`}>
                    {note.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(note.createdAt).toLocaleString("de-DE")}
                  </span>
                  <span className="text-xs text-gray-500">
                    von {note.author}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {note.status !== "ERLEDIGT" && (
                    <button
                      onClick={() => updateNoteStatus(note.id, "ERLEDIGT")}
                      className="text-xs px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition"
                    >
                      ✓ Als erledigt markieren
                    </button>
                  )}
                  {note.status === "OFFEN" && (
                    <button
                      onClick={() => updateNoteStatus(note.id, "WARTET")}
                      className="text-xs px-3 py-1 bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition"
                    >
                      ⏳ Warte auf Antwort
                    </button>
                  )}
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
                  >
                    🗑️ Löschen
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800 bg-white/50 p-4 rounded">
{note.content}
                </pre>
              </div>

              {/* Footer */}
              {note.updatedAt !== note.createdAt && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Zuletzt aktualisiert: {new Date(note.updatedAt).toLocaleString("de-DE")}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
