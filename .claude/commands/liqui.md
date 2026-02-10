---
description: Inso-Liquiplanung Projektkontext laden
---

# Inso-Liquiplanung – Vollständiger Kontext

Du arbeitest am **Inso-Liquiplanung** Projekt – Liquiditätsplanung für Insolvenzverwalter.

## Projekt

- **Pfad**: /Users/david/Projekte/AI Terminal/Inso-Liquiplanung
- **App**: /Users/david/Projekte/AI Terminal/Inso-Liquiplanung/app
- **Framework**: Next.js 15, App Router, Prisma, Turso
- **Sprache**: Deutsch (alle UI-Texte, echte Umlaute!)

## Befehle

```bash
cd app && npm run dev       # Dev-Server
cd app && npm run build     # Build
cd app && npx prisma db push  # DB-Schema sync
```

## Aktiver Fall: HVPlus

**WICHTIG:** Lies jetzt diese Dateien, um den vollständigen Kontext zu haben:

1. **Case-Kontext (PFLICHT):**
   ```
   /Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/Hausärztliche Versorgung PLUS eG/case-context.json
   ```
   Enthält: Alle Kontakte, Bankverbindungen, Standorte, LANR-Zuordnungen, Abrechnungsregeln, offene Datenanforderungen.

2. **Traceability-Matrix (bei Planungsarbeit):**
   ```
   /Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/Hausärztliche Versorgung PLUS eG/06-review/plan-traceability-matrix.md
   ```
   Enthält: Herleitung jeder einzelnen Zahl der IV-Liquiditätsplanung mit Quelldatei-Referenzen.

3. **Aktuelle Planung (bei Planungsarbeit):**
   ```
   /Users/david/Projekte/AI Terminal/Inso-Liquiplanung/Cases/Hausärztliche Versorgung PLUS eG/03-classified/PLAN/Liquiditätsplanung_HVPlus_20260114_versendet.json
   ```

## Kurzreferenz HVPlus

| Feld | Wert |
|------|------|
| Aktenzeichen | 70d IN 362/25, AG Köln |
| Insolvenz-Eröffnung | 29.10.2025 |
| IV | Sarah Wolf (Anchor, operativ: Hannes Rieger) |
| Beraterin | Sonja Prinz (unser Team) |
| Standorte | Velbert, Uckerath, Eitorf |
| Massekredit | Sparkasse HRV, 137.000 EUR |
| Alt/Neu-Stichtag | 29.10.2025 |
| KV-Regel | Q4/2025: 1/3 Alt, 2/3 Neu |
| HZV-Regel | Zahlung M = Leistung M-1 |

## Spezial-Agenten

- `insolvency-liquidity-engineer` – Kernberechnungslogik
- `insolvency-admin-architect` – Admin-Dashboard, Daten-Import
- `case-intake-analyst` – Case-Daten verarbeiten

## Weitere Quelldateien im Case-Ordner

```
/Cases/Hausärztliche Versorgung PLUS eG/
    02-extracted/
        Annahme_Einnahmen_bis_Juni26.json                    # Einnahme-Prognosen
        Velbert_Annahme_Einnahmen_bis_31.03.2026.json        # Velbert-Detail
        AN Liste mit Gehalt.json                             # Personalliste (ACHTUNG: Leerzeichen im Namen!)
        HVPLUS_GuV- und Liquiplanung 10-2025 bis 12-2028... # GuV + Betriebskosten (langer Dateiname)
        HZV_Ausbezahlung_der_Abschlaege.json                # HZV-Zahlungstermine
        KVNO_Zahlungstermine_2025.json                       # KV-Zahlungstermine
        *_VERIFIED.json                                      # IST-Kontoauszüge (pro Bank/Monat)
    03-classified/
        IST/       # Kontoauszüge (reale Buchungen)
        PLAN/      # Liquiditätspläne
        ANNAHMEN/  # Planungsprämissen
    06-review/
        plan-traceability-matrix.md                          # Herleitung jeder Planungszahl
        FRAGEN_AN_IV.md                                      # Offene Fragen an Insolvenzverwalter
        OFFENE_FRAGEN_IV.md                                  # Aktuelle Fragenliste
```

$ARGUMENTS
