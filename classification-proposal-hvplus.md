# Klassifizierungs-Empfehlung: HVPlus IST-Daten

**Fall:** Hausärztliche Versorgung PLUS eG
**Einträge:** 691 IST-Buchungen (Oktober 2025 - Januar 2026)
**Erstellt:** 2026-02-09
**Status:** Zur Genehmigung

---

## Übersicht

| Bucket | Anzahl | Summe | categoryTag | Audit-Trail |
|--------|--------|-------|-------------|-------------|
| **HZV_EINNAHME** | 320 | +453.024 EUR | `HZV` | AUTO: Pattern "TK/AOK/BARMER/HÄVG..." |
| **EINNAHME_SONSTIGE** | 165 | +199.329 EUR | `EINNAHME_SONSTIGE` | AUTO: Gutachten, Privatpatienten, Bescheinigungen |
| **SONSTIGE_AUSGABEN** | 63 | -177.151 EUR | *Manuell prüfen* | Heterogen: Steuerberater, Beiträge, Transfers |
| **EINNAHME_BEHOERDE** | 38 | +1.086 EUR | `EINNAHME_BEHOERDE` | AUTO: DRV/Bundesagentur/Landeshauptkasse |
| **SAMMELUEBERWEISUNG** | 28 | -179.364 EUR | `PERSONAL` | AUTO: Sammelzahlungen Lohn |
| **PVS_EINNAHME** | 11 | +51.025 EUR | `PVS` | AUTO: PVS rhein-ruhr |
| **BUERO_IT** | 11 | -1.735 EUR | `BUERO_IT` | AUTO: Software, Amazon, I-Motion |
| **INTERN_TRANSFER** | 8 | 0 EUR | `INTERN_TRANSFER` | AUTO: Übertrag zwischen MVZ/Konten |
| **DARLEHEN_TILGUNG** | 8 | -298.084 EUR | `DARLEHEN_TILGUNG` | AUTO: apoBank + SHP Darlehen |
| **MIETE** | 7 | -15.942 EUR | `MIETE` | AUTO: Pattern "Miete" |
| **VERSICHERUNG_BETRIEBLICH** | 6 | -1.002 EUR | `VERSICHERUNG_BETRIEBLICH` | AUTO: Pensionskasse, LV |
| **KV_EINNAHME** | 6 | +157.112 EUR | `KV` | AUTO: KVNO |
| **AUSKEHRUNG_ALTKONTEN** | 6 | +126.621 EUR | `AUSKEHRUNG_ALTKONTEN` | AUTO: Auskehrung Gutschrift |
| **PERSONAL** | 5 | -8.046 EUR | `PERSONAL` | AUTO: Lohn - Gehalt |
| **KOMMUNIKATION** | 3 | -480 EUR | `KOMMUNIKATION` | AUTO: Telekom |
| **LEASING** | 2 | -283 EUR | `LEASING` | AUTO: archimedes Leasing |
| **STROM** | 2 | -714 EUR | `STROM` | AUTO: E.ON Energie |
| **BANKGEBUEHREN** | 1 | -66 EUR | `BANKGEBUEHREN` | AUTO: Avalprovision |
| **RUNDFUNK** | 1 | -55 EUR | `RUNDFUNK` | AUTO: WDR |

**Gesamt:** 691 Einträge | Netto: +298.162 EUR

---

## Detailempfehlungen

### ✅ Bucket 1: HZV_EINNAHME (320 Einträge, +453.024 EUR)

**categoryTag:** `HZV`
**categoryTagSource:** `AUTO`
**categoryTagNote:** `Klassifiziert via Pattern: TK/AOK/BARMER/DAK/IKK/KNAPPSCHAFT/SPECTRUM/LKK/GWQ/BAHN-BKK/HÄVG`

**Pattern:**
- Techniker Krankenkasse (TK)
- AOK Nordost / AOK Rheinland
- BARMER, DAK-GESUNDHEIT
- IKK classic, Knappschaft
- BKK spectrum, LKK Nordrhein
- GWQ Hausarzt+, Bahn-BKK
- HÄVG (Hausärztliche Vertragsgemeinschaft)

**Beispiele:**
1. `Techniker Krankenkasse TK-Beleg 311025,AC108,560 Erstattung nach AAG` | +134.17 EUR
2. `HÄVG Hausärztliche Vertragsgemeinschaft HAEVGID 036131` | +2.668 EUR
3. `AOK Nordost KK091120 Vertragsnr 132064 Abschlag 12_2025` | +2.189 EUR

**Aktion:** ✅ Bulk-Accept empfohlen

---

### ✅ Bucket 2: EINNAHME_SONSTIGE (165 Einträge, +199.329 EUR)

**categoryTag:** `EINNAHME_SONSTIGE`
**categoryTagSource:** `AUTO`
**categoryTagNote:** `Klassifiziert: Gutachten, Privatpatienten-Einzelrechnungen, Bescheinigungen für Behörden`

**Pattern:**
- Kreiskasse / Landesoberkasse (Gutachten für Behörden)
- Einzelpatienten-Rechnungen (Privatpatienten, nicht PVS)
- ADAC Versicherung (Gutachten)
- Befundberichte (ohne DRV-Absender)
- Kleinteilige Einnahmen (15-400 EUR)

**Beispiele:**
1. `KREISKASSE RHEIN-SIEG-KREIS ALF KIESE ANWEISUNG` | +54.35 EUR
2. `Stefanie Yvonne Birenfeld Rechnungs - Nr. 61, Akupunktur` | +97.08 EUR
3. `ADAC Versicherung AG /105587194/` | +15.00 EUR

**Aktion:** ✅ Bulk-Accept empfohlen

---

### ⚠️ Bucket 3: SONSTIGE_AUSGABEN (63 Einträge, -177.151 EUR)

**categoryTag:** *Manuell aufschlüsseln*
**Problem:** Heterogene Gruppe mit 5 Subkategorien

#### **Subkategorie 3a: Steuerberatung (5 Einträge, -39.449 EUR)**

**categoryTag:** `STEUERBERATUNG`
**Pattern:** AWADO GmbH (Steuerberater + Rechtsanwalt)

**Beispiele:**
1. `AWADO GmbH WPG Steuerberatungsgesellschaft RE AW-25-007912` | -11.900 EUR
2. `AWADO Rechtsanwaltsgesellschaft mbH Aktenzeichen: 1403/25` | -4.165 EUR

**Aktion:** ✅ Accept

---

#### **Subkategorie 3b: Sozialabgaben (10 Einträge, -32.127 EUR)**

**categoryTag:** `SOZIALABGABEN`
**Pattern:** Krankenkassen-Beiträge (Arbeitgeber-Anteil)

**Beispiele:**
1. `Techniker Krankenkasse BNR: 23006424 Beitraege 10/25` | -8.421 EUR
2. `BARMER EUR 8010,87 BEITRAG 1025+1025` | -8.011 EUR
3. `AOK Rheinland/Hamburg 8005304232 BEITRAG 1025` | -3.904 EUR

**Aktion:** ✅ Accept

---

#### **Subkategorie 3c: Steuern (2 Einträge, -7.927 EUR)**

**categoryTag:** `STEUERN`
**Pattern:** Landeshauptkasse NRW (Lohnsteuer)

**Beispiele:**
1. `Landeshauptkasse des Landes Nordrhein-Westfalen Strn 139/5740/0912` | -7.927 EUR

**Aktion:** ✅ Accept

---

#### **Subkategorie 3d: Interne Umbuchungen (20 Einträge, -94.932 EUR)**

**categoryTag:** `INTERN_TRANSFER`
**Pattern:** Übertrag, Umbuchung, Kontoschließung

**Beispiele:**
1. `Hausärztliche Versorgung Plus eG Umbuchung wg Kontoschließung` | -32.466 EUR
2. `MVZ Uckerath der HV PLUS eG Übertrag von MVZ Velbert` | -25.000 EUR
3. `Sarah Wolf - Inso Auszahlung umgebuchtes Guthaben` | -32.466 EUR

**Aktion:** ✅ Accept

---

#### **Subkategorie 3e: Sonstige Betriebsausgaben (26 Einträge, -2.716 EUR)**

**categoryTag:** `BETRIEBSKOSTEN`
**Pattern:** Diverse kleine Ausgaben (GGEW, E-Plus, Versicherungen, etc.)

**Beispiele:**
1. `GGEW Gruppen-Gas- und Elektrizitätswerk` | -462 EUR
2. `E-Plus Service GmbH Aufladung` | -5 EUR

**Aktion:** ⚠️ Manuell prüfen (heterogen)

---

### ✅ Bucket 4: EINNAHME_BEHOERDE (38 Einträge, +1.086 EUR)

**categoryTag:** `EINNAHME_BEHOERDE`
**categoryTagSource:** `AUTO`
**categoryTagNote:** `Klassifiziert: DRV Bund/Rheinland, Bundesagentur für Arbeit, Landeshauptkasse`

**Pattern:**
- DRV BUND / DRV Rheinland (Befundberichte)
- Bundesagentur für Arbeit (Gutachten)
- Landeshauptkasse NRW (diverse Erstattungen)

**Beispiele:**
1. `DRV BUND Verguetung Befundbericht` | +41.04 EUR
2. `Bundesagentur für Arbeit-Service-Haus` | +41.30 EUR

**Aktion:** ✅ Bulk-Accept empfohlen

---

### ✅ Bucket 5: SAMMELUEBERWEISUNG (28 Einträge, -179.364 EUR)

**categoryTag:** `PERSONAL`
**categoryTagSource:** `AUTO`
**categoryTagNote:** `Klassifiziert: Sammelüberweisungen für Lohn/Gehalt (via Bankhaus Brauer)`

**Pattern:** SAMMELÜBERWEISUNG (Beschreibung)

**Beispiele:**
1. `SAMMELÜBERWEISUNG` | -4.993 EUR
2. `SAMMELÜBERWEISUNG ANZAHL 8` | -12.842 EUR

**Aktion:** ✅ Bulk-Accept empfohlen

---

### ✅ Bucket 6-19: Kleine Buckets (je 1-11 Einträge)

| Bucket | Anzahl | categoryTag | Aktion |
|--------|--------|-------------|--------|
| PVS_EINNAHME | 11 | `PVS` | ✅ Bulk-Accept |
| BUERO_IT | 11 | `BUERO_IT` | ✅ Bulk-Accept |
| INTERN_TRANSFER | 8 | `INTERN_TRANSFER` | ✅ Bulk-Accept |
| DARLEHEN_TILGUNG | 8 | `DARLEHEN_TILGUNG` | ✅ Bulk-Accept |
| MIETE | 7 | `MIETE` | ✅ Bulk-Accept |
| VERSICHERUNG_BETRIEBLICH | 6 | `VERSICHERUNG_BETRIEBLICH` | ✅ Bulk-Accept |
| KV_EINNAHME | 6 | `KV` | ✅ Bulk-Accept |
| AUSKEHRUNG_ALTKONTEN | 6 | `AUSKEHRUNG_ALTKONTEN` | ✅ Bulk-Accept |
| PERSONAL | 5 | `PERSONAL` | ✅ Bulk-Accept |
| KOMMUNIKATION | 3 | `KOMMUNIKATION` | ✅ Bulk-Accept |
| LEASING | 2 | `LEASING` | ✅ Bulk-Accept |
| STROM | 2 | `STROM` | ✅ Bulk-Accept |
| BANKGEBUEHREN | 1 | `BANKGEBUEHREN` | ✅ Accept |
| RUNDFUNK | 1 | `RUNDFUNK` | ✅ Accept |

---

## Zusammenfassung

**Empfohlene Aktion:**

1. ✅ **628 Einträge** → Bulk-Accept (91%)
2. ⚠️ **63 Einträge** → Manuell aufschlüsseln in 5 Subkategorien (9%)
   - 43 Einträge → Subkategorien 3a-3d (Steuerberatung, Sozialabgaben, Steuern, Intern)
   - 20 Einträge → Subkategorie 3e (Betriebskosten, manuell prüfen)

**Audit-Trail:**
- Alle Klassifizierungen erhalten `categoryTagSource = "AUTO"`
- Alle Klassifizierungen erhalten `categoryTagNote` mit Begründung
- Manuell geprüfte Einträge erhalten `categoryTagSource = "MANUAL"`

**Nächster Schritt:**
- SQL-Update-Script generieren für Bulk-Accept (628 Einträge)
- Subkategorien 3a-3d (43 Einträge) → SQL-Update
- Subkategorie 3e (20 Einträge) → Einzelprüfung

