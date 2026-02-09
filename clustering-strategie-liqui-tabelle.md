# Clustering-Strategie für Liqui-Tabelle

**Fall:** HVPlus
**Datum:** 2026-02-09
**Klassifizierte Einträge:** 691 IST-Buchungen

---

## Ebene 1: Detaillierte categoryTags (für Audit Trail)

| categoryTag | Anzahl | Summe | Verwendung |
|-------------|--------|-------|------------|
| HZV | 320 | +453.024 EUR | In DB gespeichert, vollständig nachvollziehbar |
| EINNAHME_SONSTIGE | 201 | +181.230 EUR | Enthält: Gutachten, Privatpatienten, DRV, Bundesagentur |
| BETRIEBSKOSTEN | 59 | -91.756 EUR | Enthält: Steuerberatung (AWADO), div. Betriebsausgaben |
| PERSONAL | 33 | -187.410 EUR | Enthält: Löhne (28 Sammel + 5 Einzeln) + 0 Sozialabgaben* |
| INTERN_TRANSFER | 13 | -65.395 EUR | Durchlaufende Posten (Umbuchungen, Überträge) |
| PVS | 11 | +51.025 EUR | PVS rhein-ruhr Privatabrechnung |
| BUERO_IT | 11 | -1.735 EUR | Software, Amazon, I-Motion |
| DARLEHEN_TILGUNG | 8 | -298.084 EUR | SHP + apoBank (Tilgungen, Zinsen) |
| MIETE | 7 | -15.942 EUR | Standort-Mieten |
| VERSICHERUNG_BETRIEBLICH | 6 | -1.002 EUR | Pensionskasse, LV Mitarbeiter |
| KV | 6 | +157.112 EUR | KVNO Abrechnungen |
| AUSKEHRUNG_ALTKONTEN | 6 | +126.621 EUR | Auskehrungen Sparkasse/apoBank → ISK |
| KOMMUNIKATION | 3 | -480 EUR | Telekom |
| STROM | 2 | -714 EUR | E.ON Energie |
| LEASING | 2 | -283 EUR | archimedes Leasing |
| STEUERN | 1 | -7.927 EUR | Landeshauptkasse (Lohnsteuer) |
| RUNDFUNK | 1 | -55 EUR | WDR |
| BANKGEBUEHREN | 1 | -66 EUR | Avalprovision |

**Gesamt:** 691 Einträge | **Netto:** +298.162 EUR

*Hinweis: Sozialabgaben wurden nicht als separate Einträge gefunden - vermutlich in Sammelüberweisungen enthalten oder als HZV klassifiziert (TK-Beiträge könnten mit HZV-Zahlungen gemischt sein)

---

## Ebene 2: Clustering für Liqui-Tabelle (Präsentation)

### **A. Einnahmen (842.982 EUR)**

| Cluster | Detail-Tags | Anzahl | Summe | Beschreibung |
|---------|-------------|--------|-------|--------------|
| **KV-Einnahmen** | `KV` | 6 | +157.112 EUR | KVNO Quartals-Abrechnungen |
| **HZV-Einnahmen** | `HZV` | 320 | +453.024 EUR | Monatliche Abschläge + Schlusszahlungen |
| **PVS-Einnahmen** | `PVS` | 11 | +51.025 EUR | Privatliquidation (PVS rhein-ruhr) |
| **Sonstige Einnahmen** | `EINNAHME_SONSTIGE` | 201 | +181.230 EUR | Gutachten (DRV, Bundesagentur, Kreiskasse), Privatpatienten-Einzelrechnungen |
| **Auskehrungen Altkonten** | `AUSKEHRUNG_ALTKONTEN` | 6 | +126.621 EUR | Guthaben-Transfers von Sparkasse/apoBank |

**Subtotal Einnahmen:** 544 Einträge | +969.012 EUR

---

### **B. Ausgaben (-970.850 EUR)**

#### **B1. Personalkosten (-187.410 EUR)**

| Cluster | Detail-Tags | Anzahl | Summe | Beschreibung |
|---------|-------------|--------|-------|--------------|
| **Personal** | `PERSONAL` | 33 | -187.410 EUR | Löhne/Gehälter (28 Sammel + 5 Einzeln) + evtl. Sozialabgaben |

#### **B2. Betriebskosten (-111.034 EUR)**

| Cluster | Detail-Tags | Anzahl | Summe | Beschreibung |
|---------|-------------|--------|-------|--------------|
| **Miete** | `MIETE` | 7 | -15.942 EUR | Standort-Mieten (Velbert, Uckerath, Eitorf) |
| **Kommunikation** | `KOMMUNIKATION` | 3 | -480 EUR | Telekom Festnetz |
| **Strom** | `STROM` | 2 | -714 EUR | E.ON Energie |
| **Büro & IT** | `BUERO_IT` | 11 | -1.735 EUR | Software (Pega, mediDOK), Amazon |
| **Leasing** | `LEASING` | 2 | -283 EUR | Praxisausstattung |
| **Versicherungen** | `VERSICHERUNG_BETRIEBLICH` | 6 | -1.002 EUR | Pensionskasse, LV Mitarbeiter |
| **Rundfunk** | `RUNDFUNK` | 1 | -55 EUR | WDR Rundfunkbeitrag |
| **Bankgebühren** | `BANKGEBUEHREN` | 1 | -66 EUR | Avalprovision |
| **Sonstige Betriebskosten** | `BETRIEBSKOSTEN` | 59 | -91.756 EUR | Steuerberatung (AWADO), diverse Ausgaben |

**Subtotal Betriebskosten:** 92 Einträge | -111.034 EUR

#### **B3. Finanzierung (-306.011 EUR)**

| Cluster | Detail-Tags | Anzahl | Summe | Beschreibung |
|---------|-------------|--------|-------|--------------|
| **Darlehens-Tilgung** | `DARLEHEN_TILGUNG` | 8 | -298.084 EUR | SHP Darlehen (4 Raten) + apoBank (Sondertilgungen, Zinsen) |
| **Steuern** | `STEUERN` | 1 | -7.927 EUR | Lohnsteuer/USt Landeshauptkasse NRW |

**Subtotal Finanzierung:** 9 Einträge | -306.011 EUR

---

### **C. Durchlaufende Posten (neutral für Cashflow-Analyse)**

| Cluster | Detail-Tags | Anzahl | Summe | Hinweis |
|---------|-------------|--------|-------|---------|
| **Interne Transfers** | `INTERN_TRANSFER` | 13 | -65.395 EUR | Umbuchungen zwischen MVZ/Konten (sollte netto 0 sein, Abweichung prüfen!) |

**⚠️ ACHTUNG:** INTERN_TRANSFER zeigt -65.395 EUR statt 0 EUR. Das deutet auf fehlende Gegenbuchungen hin oder falsch klassifizierte Einträge!

---

## Ebene 3: Aggregations-Vorschlag für Liqui-Matrix

### **Zeilen-Struktur (Hauptkategorien):**

```
EINNAHMEN
├── KV-Abrechnungen (KV)
├── HZV-Einnahmen (HZV)
├── PVS-Einnahmen (PVS)
└── Sonstige Einnahmen (EINNAHME_SONSTIGE + AUSKEHRUNG_ALTKONTEN)

AUSGABEN
├── Personalkosten (PERSONAL)
├── Betriebskosten
│   ├── Miete (MIETE)
│   ├── Strom & Kommunikation (STROM + KOMMUNIKATION)
│   ├── Büro, IT & Leasing (BUERO_IT + LEASING)
│   ├── Versicherungen (VERSICHERUNG_BETRIEBLICH)
│   └── Sonstige Betriebskosten (BETRIEBSKOSTEN + RUNDFUNK + BANKGEBUEHREN)
├── Darlehens-Tilgung (DARLEHEN_TILGUNG)
└── Steuern (STEUERN)

DURCHLAUFENDE POSTEN (nur Info, nicht in Cashflow)
└── Interne Transfers (INTERN_TRANSFER)
```

---

## Audit Trail & Nachvollziehbarkeit

**Jeder Eintrag hat:**
- `categoryTag` – Detaillierte Kategorie (siehe Ebene 1)
- `categoryTagSource` = `"AUTO"` – Automatisch klassifiziert
- `categoryTagNote` – Begründung mit Pattern-Beschreibung

**Beispiel:**
```json
{
  "id": "hvplus-okt-v2-10",
  "description": "Techniker Krankenkasse TK-Beleg 311025...",
  "categoryTag": "HZV",
  "categoryTagSource": "AUTO",
  "categoryTagNote": "Klassifiziert via Pattern: TK/AOK/BARMER/DAK/IKK/KNAPPSCHAFT/SPECTRUM/LKK/GWQ/BAHN-BKK/HÄVG"
}
```

**Jede Aggregation in der Liqui-Tabelle kann zurückverfolgt werden:**
- Spalte "KV-Abrechnungen" → Filter `categoryTag = 'KV'`
- Spalte "Sonstige Einnahmen" → Filter `categoryTag IN ('EINNAHME_SONSTIGE', 'AUSKEHRUNG_ALTKONTEN')`
- Spalte "Betriebskosten" → Filter `categoryTag IN ('BETRIEBSKOSTEN', 'MIETE', 'STROM', 'KOMMUNIKATION', ...)`

---

## Offene Punkte

1. **INTERN_TRANSFER Abweichung:** -65.395 EUR statt 0 EUR
   - Aktion: Prüfen, ob fehlende Gegenbuchungen oder falsch klassifiziert

2. **Sozialabgaben nicht gefunden:** 0 Einträge
   - Vermutung: In Sammelüberweisungen enthalten ODER als HZV klassifiziert (TK-Beiträge)
   - Aktion: Stichprobe von "HZV"-Einträgen prüfen auf Arbeitgeber-Beiträge

3. **AUSKEHRUNG_ALTKONTEN:** Durchlaufend oder echte Einnahme?
   - Kontext: Guthaben von alten Konten (Sparkasse/apoBank) → ISK
   - Für Insolvenz-Sicht: Echte Einnahme (Neueingang in Masse)
   - Für Bank-Sicht: Durchlaufend (nur Kontowechsel)
   - **Empfehlung:** Als Einnahme behandeln (sind tatsächlich verfügbare Liquidität)

---

## Nächste Schritte

1. ✅ Alle 691 Einträge klassifiziert
2. ⏭️ Liqui-Matrix-Komponente anpassen: Clustering implementieren
3. ⏭️ INTERN_TRANSFER Abweichung analysieren
4. ⏭️ Classification Rules aus Learnings generieren (für zukünftige Imports)

