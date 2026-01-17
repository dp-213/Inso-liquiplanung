# Dashboard Best Practices - Insolvenzspezifische Liquiditätsplanung

## Quelle

Analyse des W&P-Reports (Dr. Wieselhuber & Partner) für CompuMess Elektronik GmbH
**Datei:** `/UserTemplates/Examples/260109-BE-pse-CME-Entwurf-Liquiditätsplanung-AP_250501.pdf`
**Analysedatum:** Januar 2026

---

## 1. Dokumentstruktur (Berichtsaufbau)

### Professioneller Bericht enthält:

| Element | Beschreibung | Priorität |
|---------|--------------|-----------|
| Titelseite | Firmenlogo, Datum, "ENTWURF"-Kennzeichnung | Mittel |
| Auftragsinhalt | Datenquellen, Bearbeitungszeitraum | Hoch |
| Vorbemerkungen | Rechtliche Hinweise, Haftungsausschluss | Mittel |
| Inhaltsverzeichnis | Strukturierte Navigation | Niedrig |
| Vollständigkeitserklärung | Bestätigung der Datenrichtigkeit | Hoch |

### Beispiel Auftragsinhalt (W&P):
- Bankstand vom [Datum] (nach Buchungsschluss)
- OP-Kreditoren vom [Datum]
- OP-Debitoren vom [Datum]
- Unternehmensplanung sowie insolvenzspezifische Ertragsplanung
- Bearbeitungszeitraum (von-bis)
- Vollständigkeitserklärung mit Unterschrift

---

## 2. Visualisierungen

### 2.1 Hauptchart: Liquiditätsverlauf

**Typ:** Bar-Chart mit Wochenbalken (Bankguthaben Ende Woche)

**Features:**
- **Zwei Linien:** "vor Insolvenzeffekten" und "nach Insolvenzeffekten"
- **Annotationen:** Direkt im Chart (z.B. "Einzahlung Anfechtung +60 T€")
- **Phasen-Markierung:** "Eröffnetes Verfahren" | "Planerischer Aufsatz NewCo"
- **Aufsatzpunkt (AP):** Klar markiert mit vertikaler Linie

**Beispiel-Annotation aus W&P:**
```
"Zum Aufsatzpunkt weist die Planung ein Bankguthaben i.H.v. rd. 702 T€ aus."
"Einzahlungen aus Anfechtung der SV-Beiträge i.H.v. rd. 60 T€ in KW 5"
"Auszahlung für Verfahrenskosten i.H.v. rd. 194 T€ in KW 9"
```

### 2.2 Wasserfall-Darstellung (Monatssicht)

**Separate Balken für:**
- AP (Anfangsbestand) - grün
- Einzahlungen - blau
- Auszahlungen Material aus Vorkasse - rot
- Sonstige operative Auszahlungen - orange
- Insolvenzeffekte - grau

**Zusätzlich zeigen:**
- Nachlaufender Forderungs-/Auftragsbestand
- Indikativer planerischer Forderungsbestand
- Kombination: Wasserfall + kumulierte Endwerte

### 2.3 Cash Conversion Cycle (CCC)

**Prozessfluss-Diagramm:**
```
Kunde bestellt → Bestellung Ware gegen Vorkasse → Warenversand durch Lieferanten
→ Wareneingang → Weiterverarbeitung → Auslieferung + Rechnungsstellung → Zahlungseingang
```

**Kennzahlen:**
| Kennzahl | Beschreibung | Beispielwert |
|----------|--------------|--------------|
| DIO | Days Inventory Outstanding | rd. 7 Tage |
| DSO | Days Sales Outstanding | rd. 30 Tage |
| DPO | Days Payables Outstanding | rd. 14-21 Tage |
| **CCC** | **Kapitalbindung = DIO + DSO - DPO** | **rd. 51-65 Tage** |

---

## 3. Tabellenstruktur (Detaillierte Liquiditätstabelle)

### Gliederung nach W&P-Standard:

```
GUTHABEN AM ANFANG DER WOCHE

OPERATIVE ZAHLUNGSEINGÄNGE
├── Einzahlungen aus OP-Debitoren
├── Einzahlungen aus Offene Aufträge
└── Überleitung operative Planung (Auftragseingang)

OPERATIVE ZAHLUNGSAUSGÄNGE
├── Auszahlungen für OP-Kreditoren
├── Auszahlungen für Vorkasse aus Bestellungen
├── Überleitung operative Planung (Vorkasse)
├── sonstige betriebliche Zahlungsausgänge
├── Auszahlungen für Personal
├── Außerordentliche Ein-/Auszahlungen
└── Ein-/Auszahlungen für Umsatzsteuer

CASH-FLOW AUS OPERATIVER GESCHÄFTSTÄTIGKEIT

CASH-FLOW AUS INVESTITIONSTÄTIGKEIT
├── Einzahlungen aus Verkauf des Anlagevermögens
└── Auszahlungen aus Investitionen

CASH-FLOW AUS FINANZIERUNGSTÄTIGKEIT
├── Einzahlungen aus Finanzierungstätigkeiten
└── Auszahlungen aus Finanzierungstätigkeiten

SALDO EIN-/AUSZAHLUNGEN

═══════════════════════════════════════════════════
GUTHABEN AM ENDE DER WOCHE VOR INSOLVENZSPEZ. EFFEKTEN
═══════════════════════════════════════════════════

INSOLVENZSPEZIFISCHE EFFEKTE (SEPARAT!)
├── Allgemeine Besonderheiten Insolvenz
├── Anfechtung Insolvenzgeld SV-Beiträge
├── Umsatzsteuer vorläufiges Verfahren
├── Halteprämien
├── Abverkauf Vorratsbestand
├── Vorlageprovision auf Einfuhrabgaben
├── Unsicherheitsfaktor
└── KOSTEN DES INSOLVENZVERFAHRENS
    ├── (vorläufige) Sachverwaltung
    ├── Gerichtskosten
    ├── Gläubigerausschuss
    ├── Verfahrenskosten (u.a. Eigenverwaltung)
    ├── Sonstige Beratungskosten
    ├── Zinsen für Insolvenzgeldvorfinanzierung
    ├── Insolvenzrechtliche Buchhaltung
    └── Insolvenzspezifische Versicherungen

SUMME SONDERMASSNAHMEN JE WOCHE
KUMULIERTER EFFEKT SONDERMASSNAHMEN

═══════════════════════════════════════════════════
GUTHABEN AM ENDE DER WOCHE NACH INSOLVENZSPEZ. EFFEKTEN
═══════════════════════════════════════════════════
```

---

## 4. Planungsprämissen-Dokumentation

### Tabellenformat:

| Überschrift | Informationsquelle | Planungsprämisse | Risiko |
|-------------|-------------------|------------------|--------|
| Position | Datenherkunft | Detaillierte Beschreibung | Ampel |

### Beispiel (W&P):

| Überschrift | Informationsquelle | Planungsprämisse | Risiko |
|-------------|-------------------|------------------|--------|
| Einzahlungen aus OP-Debitoren | OP-Debitorenliste zum Stichtag | Die Einzahlungen ergeben sich aus der OP-Liste und den hinterlegten Zahlungszielen. Nach Auskunft der Geschäftsführung besteht kein Abwertungsrisiko. Aus konservativen Gründen wurden Einzahlungen im Aufsatzpunkt in gewissem Umfang um zwei bis drei Wochen verzögert liquiditätswirksam geplant. | ◐ |
| Einzahlungen aus offenen Aufträgen | Auftragsbestand zum Stichtag | Auf Basis des vorliegenden Auftragsbestands wurden die Einzahlungen gemäß den hinterlegten Zahlungszielen liquiditätswirksam unterstellt. | ◑ |
| Auszahlungen für Personal | GuV-Planung & Vorjahreswerte | Die Personalauszahlungen basieren auf den vom Unternehmen übermittelten Werten. Zudem wurden die ab November geplanten Personalreduktionen in der Planung berücksichtigt. | ◑ |

### Risiko-Ampel:

| Symbol | Bedeutung | Beschreibung |
|--------|-----------|--------------|
| ○ | Konservativ | Sehr vorsichtige Planung |
| ◐ | Gering | Plausibel mit geringem Risiko / erkennbaren Chancen |
| ◑ | Mittel | Plausibel mit üblichem Planungsrisiko |
| ● | Hoch | Ambitioniert / plausible Planung mit hohen Risiken |
| ●● | Aggressiv | Aggressive bzw. unrealistische Planung |

---

## 5. Bankenspiegel

### Kontenübersicht:

| Kreditinstitut | IBAN | Guthaben | Liquide Mittel |
|----------------|------|----------|----------------|
| Sparkasse | DE11701500001009210475 | 701.365,10 € | 701.365,10 € |
| Münchner Bank | DE13701900000002736772 | 658,91 € | 658,91 € |
| **Summe** | | **702.024,01 €** | **702.024,01 €** |

### Anmerkungen (Beispiel W&P):
- Die verfügbaren liquiden Mittel ergeben sich aus Guthabenkonten
- Das ausgewiesene Guthaben setzt sich aus [Auflistung] zusammen
- Auskunftsgemäß wurde [Sondersituation beschreiben]
- US-Konto wurde zum Ende [Datum] geschlossen

---

## 6. Implementierungs-Prioritäten für Gradify

### Priorität 1: SOLLTE übernommen werden

| Feature | Business Value | Aufwand |
|---------|---------------|---------|
| Insolvenzspezifische Effekte als separate Sektion | ⭐⭐⭐⭐⭐ | Mittel |
| Wasserfall-Chart für Monatssicht | ⭐⭐⭐⭐ | Mittel |
| Planungsprämissen-Tab | ⭐⭐⭐⭐⭐ | Hoch |
| Bankenspiegel | ⭐⭐⭐ | Niedrig |

### Priorität 2: KANN übernommen werden

| Feature | Business Value | Aufwand |
|---------|---------------|---------|
| Szenario-Vergleich im Chart | ⭐⭐⭐⭐ | Mittel |
| Annotationen im Chart | ⭐⭐⭐ | Niedrig |
| Cash Conversion Cycle | ⭐⭐ | Hoch |
| "ENTWURF"-Wasserzeichen | ⭐⭐⭐ | Niedrig |

### Priorität 3: Nice-to-have

| Feature | Business Value | Aufwand |
|---------|---------------|---------|
| Detailliertere Kategorienstruktur (~15 Zeilen) | ⭐⭐ | Hoch |
| PDF mit Vorbemerkungen/Disclaimer | ⭐⭐ | Mittel |

---

## 7. Vergleich: W&P vs. Gradify Dashboard

| Feature | W&P | Gradify | Gap | Priorität |
|---------|-----|---------|-----|-----------|
| Insolvenzeffekte separat | ✅ | ❌ | Hoch | P1 |
| Wasserfall-Chart | ✅ | ❌ | Hoch | P1 |
| Planungsprämissen | ✅ | ❌ | Hoch | P1 |
| Bankenspiegel | ✅ | Demo-Daten | Mittel | P1 |
| Szenario-Vergleich | ✅ | ❌ | Mittel | P2 |
| Chart-Annotationen | ✅ | Teilweise | Niedrig | P2 |
| CCC-Visualisierung | ✅ | ❌ | Niedrig | P3 |
| ENTWURF-Kennzeichnung | ✅ | ❌ | Niedrig | P2 |
| KPI-Cards | ❌ | ✅ | - | ✓ |
| Tab-Navigation | ❌ | ✅ | - | ✓ |
| PDF-Export | ✅ | ✅ | - | ✓ |

---

## 8. Insolvenzspezifische Positionen (Standard-Katalog)

Für die konfigurierbare Insolvenzeffekte-Tabelle:

### Einzahlungen (positive Effekte)
- Anfechtung Insolvenzgeld SV-Beiträge
- Anfechtung sonstige
- Abverkauf Vorratsbestand
- Rückzahlung Kautionen
- Verwertung Anlagevermögen

### Auszahlungen (negative Effekte)
- Umsatzsteuer vorläufiges Verfahren
- Halteprämien
- Vorlageprovision auf Einfuhrabgaben
- Unsicherheitsfaktor (Puffer)

### Verfahrenskosten
- (vorläufige) Sachverwaltung
- Gerichtskosten
- Gläubigerausschuss
- Verfahrenskosten Eigenverwaltung
- Sonstige Beratungskosten
- Zinsen für Insolvenzgeldvorfinanzierung
- Insolvenzrechtliche Buchhaltung
- Insolvenzspezifische Versicherungen

---

## 9. Fazit

Der W&P-Report zeigt den Industriestandard für professionelle Liquiditätsberichte im Insolvenzbereich. Die wichtigsten Erkenntnisse für Gradify:

1. **Trennung operativ vs. insolvenzspezifisch** ist essentiell für Transparenz
2. **Planungsprämissen-Dokumentation** erhöht Nachvollziehbarkeit und Vertrauen
3. **Visuelle Annotationen** im Chart machen kritische Punkte sofort sichtbar
4. **Wasserfall-Darstellung** zeigt Cashflow-Treiber auf einen Blick
5. **Bankenspiegel** mit IBAN und Status ist Standard bei Gerichten/Gläubigern

Diese Best Practices sollten schrittweise in das Gradify-Dashboard integriert werden.
