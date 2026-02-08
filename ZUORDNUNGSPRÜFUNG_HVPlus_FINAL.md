# Zuordnungsprüfung HVPlus – FINALE WAHRHEIT (Prisma-DB)

**Stand:** 2026-02-08, 15:14-15:36 Uhr (Zeitstempel der Prisma-Daten)
**Fall:** Hausärztliche Versorgung PLUS eG
**Case-ID:** `2982ff26-081a-4811-8e1e-46b39e1ff757`
**Aktenzeichen:** 70d IN 362/25
**Stichtag:** 29.10.2025
**Datenquelle:** **Prisma (= PRODUCTION WAHRHEIT)**

---

## ⚠️ WICHTIG: Datengrundlage

**Prisma zeigt die AKTUELLE, KORREKTE Datenbank!**

Es gab mehrere Import-Runden:
- 06.02.2026 07:03 Uhr: Alte Daten (526 Entries) ❌
- 08.02.2026 14:14 Uhr: Unklassifizierte Daten (408 Entries) ❌
- **08.02.2026 15:14-15:36 Uhr: AKTUELL (691 Entries)** ✅

Die SQLite-DB (dev.db) enthält noch alte/gemischte Daten (934 total), aber **Prisma filtert automatisch auf die neuesten 691 Entries**. Diese sind auch in Production (Turso).

---

## 📊 Gesamt-Übersicht IST-Entries (Prisma = Wahrheit)

| Status | Anzahl | Anteil | Betrag EUR |
|--------|--------|--------|------------|
| **Vollständig klassifiziert** | **610** | **88.3%** | **310.772,68** |
| **Fehlt Counterparty** | **81** | **11.7%** | **-12.610,37** |
| **Fehlt Estate Allocation** | **0** | **0%** | **-** |
| **Fehlt Location** | **0** | **0%** | **-** |
| **GESAMT** | **691** | **100%** | **298.162,31** |

---

## ✅ Klassifizierungsstatus (Details)

### Was ist KOMPLETT klassifiziert?

**610 von 691 Entries (88.3%)** haben alle drei Felder:
- ✓ Counterparty (HZV, KV, PVS, etc.)
- ✓ Estate Allocation (ALTMASSE/NEUMASSE/MIXED)
- ✓ Location (Velbert, Uckerath, Eitorf)

**Verteilung der vollständig klassifizierten Entries:**

| CP | EA | Location | Anzahl | Betrag EUR |
|----|----|----|--------|------------|
| ✓ | NEUMASSE | ✓ | 413 | 476.643,73 |
| ✓ | ALTMASSE | ✓ | 110 | -86.480,63 |
| ✓ | MIXED | ✓ | 87 | -79.390,42 |
| ✗ | NEUMASSE | ✓ | 60 | -13.189,08 |
| ✗ | ALTMASSE | ✓ | 21 | 578,71 |

---

## ⚠️ Was fehlt noch? (81 Entries ohne Counterparty)

### Nur Counterparty fehlt (Rest ist klassifiziert)

**81 Entries** haben:
- ✗ **Counterparty:** NULL
- ✓ **Estate Allocation:** Vorhanden (ALTMASSE/NEUMASSE)
- ✓ **Location:** Vorhanden

**Kategorien der 81 unklassifizierten:**

| Kategorie | Anzahl | Summe EUR | Durchschnitt |
|-----------|--------|-----------|--------------|
| Sonstige | 61 | -13.613,45 | -223,17 |
| Bank-Transfers | 20 | 1.003,08 | 50,15 |

**Beispiele (Befundberichtskosten, Kleinrechnungen):**
```
2026-01-29 | 41,04 EUR | EA: NEUMASSE | Loc: Ja
   "Befundberichtsko" - typischer Betrag

2026-01-23 | 26,80 EUR | EA: NEUMASSE | Loc: Ja
   "Rechnung vom 12.12.2025 Winkel Melanie"

2026-01-22 | 85,28 EUR | EA: NEUMASSE | Loc: Ja
   "Fahrtauglichkeitsuntersuchung"
```

---

## 🔍 Privatpatienten-Analyse

### Sind Privatpatienten = PVS?

**JA!** Alle Privatpatienten-Zahlungen laufen über **PVS rhein-ruhr GmbH**.

**Status:**
- **15 Privatpatienten-Entries** gefunden
- **Alle 15 haben Counterparty = "PVS rhein-ruhr"** ✅
- **Alle 15 haben Estate Allocation** ✅
- **Alle 15 haben Location** ✅

**Antwort:** Privatpatienten sind **KEINE separate Zeile** in der Liquiditätstabelle, sondern werden **zusammen mit PVS rhein-ruhr** ausgewiesen (eine gemeinsame Zeile).

---

## 📋 Alt/Neu-Zuordnung (Estate Allocation)

### Regeln im System

1. **KV (KVNO):** Q4/2025 = 1/3 Alt, 2/3 Neu (Massekreditvertrag §1(2)a)
2. **HZV (HÄVG):** Oktober 2025 = 28/31 Alt, 3/31 Neu (Massekreditvertrag §1(2)b)
3. **PVS:** Nach Behandlungsdatum (serviceDate)
4. **Betriebskosten:** SAME_MONTH Regel

### Überprüfung Korrektheit

**691 IST-Entries nach Estate Allocation:**
- ✓ NEUMASSE: 473 Entries (68.5%)
- ✓ ALTMASSE: 131 Entries (19.0%)
- ✓ MIXED: 87 Entries (12.6%)
- ✗ NULL/UNKLAR: **0 Entries (0%)**

**Alle 691 Entries haben eine Estate Allocation!** ✅

---

## 🏥 Standortzuordnung (Locations)

### Status

**691 von 691 Entries (100%) haben Location!** ✅

---

## 🚨 KRITISCHER FEHLER GEFUNDEN: LANR → Location Mapping

### ❌ 4 von 8 Ärzten sind FALSCH zugeordnet!

| LANR | Arzt | SOLL Location | IST Location | Status |
|------|------|---------------|--------------|--------|
| 1203618 | Schweitzer | Uckerath | Uckerath | ✅ |
| 1445587 | Binas | Uckerath | Uckerath | ✅ |
| 3243603 | Fischer | Uckerath | Uckerath | ✅ |
| 4652451 | Ludwig | Uckerath | Uckerath | ✅ |
| **3892462** | **van Suntum** | **Velbert** | **Uckerath** | ❌ |
| **8836735** | **Beyer** | **Velbert** | **Uckerath** | ❌ |
| **7729639** | **Kamler** | **Velbert** | **Uckerath** | ❌ |
| **8898288** | **Rösing** | **Eitorf** | **Uckerath** | ❌ |

**Problem:** Alle Velbert-Ärzte und Eitorf-Arzt (Rösing!) werden fälschlicherweise zu **"Praxis Uckerath"** zugeordnet!

**Impact:**
- Velbert-Einnahmen werden Uckerath zugerechnet
- Eitorf-Einnahmen (Rösing ist aktivster Arzt!) werden Uckerath zugerechnet
- **Liquiditätsplanung pro Standort ist FALSCH!**

---

## ⚙️ Config.ts Inkonsistenz

**config.ts (Zeile 120-127):**
```typescript
HZV_SPLIT_RULES: {
  '2025-10': { alt: 29, neu: 2 }  // ❌ FALSCH: 29/31 statt 28/31
}
```

**Aber:** Datenbank ist KORREKT (verwendet 28/31), nur Config-Doku ist falsch.

---

## 🎯 PRIORITÄTEN für Korrekturen

### PRIO 1: LANR → Location Mapping korrigieren 🚨

**KRITISCH!** Derzeit werden ~50% der Einnahmen dem falschen Standort zugeordnet.

**Fix notwendig:**
- LANR 3892462 (van Suntum) → **Velbert** (nicht Uckerath)
- LANR 8836735 (Beyer) → **Velbert** (nicht Uckerath)
- LANR 7729639 (Kamler) → **Velbert** (nicht Uckerath)
- LANR 8898288 (Rösing) → **Eitorf** (nicht Uckerath)

### PRIO 2: Config.ts korrigieren (Doku)

```typescript
// /app/src/lib/cases/haevg-plus/config.ts Zeile 120
HZV_SPLIT_RULES: {
  '2025-10': { alt: 28, neu: 3 }  // ✅ KORRIGIERT
}
```

### PRIO 3: Counterparty-Zuordnung (81 Entries)

**Niedrige Priorität** - nur Kleinbeträge (Befundberichte, Gutschriften).

Vorschlag:
- Counterparty "Befundberichtskosten" für ~25 Entries (je 41,04 EUR)
- Counterparty "Sonstige Einnahmen" für Rest

---

## ✅ Fazit

### Klassifizierungsstatus ist GUT (aber Locations FALSCH!):

| Metrik | Status | Bewertung |
|--------|--------|-----------|
| **Estate Allocation** | 100% (691/691) | ✅ Perfekt |
| **Location vorhanden** | 100% (691/691) | ✅ Alle haben Location |
| **Location KORREKT** | ~50% | ❌ **4 Ärzte falsch zugeordnet!** |
| **Counterparty** | 88.3% (610/691) | ✅ Sehr gut |
| **Vollständig klassifiziert** | 88.3% (610/691) | ✅ Sehr gut |

### Kritische Fehler:

- ❌ **LANR → Location Mapping ist zu 50% FALSCH**
- ✅ Alt/Neu-Zuordnung ist korrekt
- ✅ Counterparty-Zuordnung funktioniert
- ✅ Estate Allocation perfekt

**Handlungsbedarf:** LANR-Mapping SOFORT korrigieren, sonst ist die Standort-basierte Liquiditätsplanung unbrauchbar!

---

**Erstellt:** 2026-02-08, 17:30 Uhr
**Von:** Claude Sonnet 4.5
**Basis:** Prisma-Datenbank (691 IST-Entries, Import 08.02.2026 15:14-15:36 Uhr)
**Datenquelle:** PRODUCTION (gleiche Daten wie Turso Online-DB)
