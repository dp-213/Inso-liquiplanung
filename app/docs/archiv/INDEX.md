# Docs Archiv

Archivierte One-Off-Dokumentationen. Diese Dateien dokumentieren einmalige Vorgänge (Incidents, Analysen, Migrationen) und werden nicht mehr aktiv gepflegt.

**Archiviert am:** 2026-02-09

---

## Datenqualitäts-Incident ISK Uckerath (2026-02-08)

Duplikate in ISK Uckerath durch doppelten Import aus unterschiedlich benannten JSON-Dateien. Vollständig bereinigt via Clean Slate Re-Import.

| Datei | Inhalt |
|-------|--------|
| `DATA_QUALITY_INCIDENT_2026-02-08.md` | Root Cause Analysis: 658 Entries, 329 Duplikate |
| `IMPORT_PIPELINE_ANALYSIS_2026-02-08.md` | Analyse des Import-Scripts und seiner Schwächen |
| `CLEANUP_PLAN_ISK_UCKERATH_2026-02-08.md` | Erster Bereinigungsplan |
| `CLEANUP_PLAN_V2_ISK_UCKERATH_2026-02-08.md` | Überarbeiteter Plan (V1 war zu aggressiv) |
| `CLEANUP_COMPLETED_ISK_UCKERATH_2026-02-08.md` | Erster Cleanup-Versuch |
| `CLEANUP_COMPLETED_ISK_UCKERATH_FINAL_2026-02-08.md` | Finaler Clean Slate Re-Import |
| `CLEANUP_RECOMMENDATION_DEZ_JAN_2026-02-08.md` | Empfehlung Dezember/Januar |
| `CLEANUP_COMPLETED_ISK_VELBERT_2026-02-08.md` | ISK Velbert hatte 1 Duplikat |

## Verifikation aller Konten (2026-02-08)

Nach dem Incident wurden alle 5 Konten systematisch geprüft und Opening Balances korrigiert.

| Datei | Inhalt |
|-------|--------|
| `ALL_ACCOUNTS_VERIFICATION_2026-02-08.md` | Verifikation aller 5 Bankkonten |
| `DATA_VERIFICATION_OPENING_BALANCES_2026-02-08.md` | Opening Balance Fehler entdeckt |
| `DATA_VERIFICATION_FINAL_2026-02-08.md` | Finale Verifikation nach Korrektur |
| `OPENING_BALANCE_CORRECTION_2026-02-08.md` | Korrektur der Opening Balances |

## Virtuelles Konto Pre-ISK (2026-02-09)

Pre-Implementation-Analyse für "Insolvenzmasse (Pre-ISK)" virtuelles Konto. Feature noch nicht implementiert.

| Datei | Inhalt |
|-------|--------|
| `ARCHITECTURE_BANK_ACCOUNTS.md` | Architektur-Snapshot der Bank-Account-Logik |
| `IMPACT_VIRTUAL_ACCOUNT.md` | Impact-Analyse: Schema, Business Logic, API, UI |
| `PLAN_VIRTUAL_ACCOUNT.md` | Implementierungsplan (6 Phasen, A-F) |

## DB-Reset Incident (2026-02-07)

Katastrophaler DB-Reset löschte alle 1.248 IST-Einträge. Vollständig rekonstruiert aus JSON-Quellen.

| Datei | Inhalt |
|-------|--------|
| `CRITICAL_INCIDENT_2026-02-07.md` | Incident Report: DB-Reset ohne Backup, Root Cause |
| `RECOVERY_COMPLETE_2026-02-07.md` | Daten-Rekonstruktion: 965 Entries aus 19 JSON-Dateien |

## Liqui-Matrix Verbesserungspläne (2026-02-09)

Analyse und Verbesserungsvorschläge für die Liquiditätsmatrix nach IV-Meeting-Feedback.

| Datei | Inhalt |
|-------|--------|
| `KORREKTUR-VORSCHLAG.md` | UI-Korrekturen: Ledger-Details, Fehlklassifikationen |
| `PLAN-LIQUI-MATRIX-VERBESSERUNGEN.md` | Inhaltliche + UX-Verbesserungen für Matrix |
| `TODO-LIQUI-MATRIX-NACH-MEETING.md` | Offene Aufgaben nach IV-Meeting (Service-Date, Personal/Sozial) |

## Sonstiges

| Datei | Inhalt |
|-------|--------|
| `AUTO_DEPLOY_TEST.md` | Einmaliger Test ob Vercel Auto-Deploy funktioniert (2026-02-07) |
| `DEPLOYMENT_CHECKLIST_OPENING_BALANCE_2026-02-08.md` | Deployment-Checklist für Standort-basierte Opening Balance |

---

**Wichtig:** Diese Dateien enthalten wertvolles Wissen über Datenprobleme und deren Lösung. Vor einem erneuten Datenimport lohnt es sich, die Incident-Dokumentation zu lesen.
