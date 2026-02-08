# Deployment Checklist: Standort-basierte Opening Balance

**Feature:** Standort-basierte Opening Balance & Bankkonto-Transparenz
**Datum:** 2026-02-08
**Branch:** main

---

## PRE-DEPLOYMENT (KRITISCH!)

### 1. Turso Database Migration (VOR Code-Deployment!)

**WICHTIG:** Migration MUSS vor Code-Push ausgeführt werden, sonst crasht Production!

```bash
# 1. Authentifizierung
turso auth login

# 2. Aktuellen DB-Namen prüfen
turso db list

# 3. Migration ausführen
turso db shell inso-liquiplanung-v2 < scripts/migration-bank-account-location.sql

# 4. Verifikation: Prüfe ob locationId Spalte existiert
turso db shell inso-liquiplanung-v2 "PRAGMA table_info(bank_accounts);" | grep locationId
```

**Erwartete Ausgabe:**
```
14|locationId|TEXT|0||0
```

### 2. Datenverifikation

**Prüfe Opening Balances in Turso:**

```bash
turso db shell inso-liquiplanung-v2 << 'EOF'
SELECT
  COALESCE(l.name, 'ZENTRAL') as location,
  SUM(ba.openingBalanceCents) as totalCents,
  CAST(SUM(ba.openingBalanceCents) AS REAL) / 100.0 as totalEUR
FROM bank_accounts ba
LEFT JOIN locations l ON ba.locationId = l.id
WHERE ba.caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'
GROUP BY ba.locationId, l.name
ORDER BY location;
EOF
```

**Erwartete Werte:**
- Velbert: +24.970,61 EUR
- Uckerath: +23.514,27 EUR
- ZENTRAL: -287.372,10 EUR

---

## CODE DEPLOYMENT

### 3. Git Commit & Push

```bash
cd app

# Status prüfen
git status

# Alle Änderungen stagen
git add .

# Commit mit Beschreibung
git commit -m "feat: Standort-basierte Opening Balance & Bankkonto-Tab

- BankAccount.locationId Schema-Erweiterung
- calculateOpeningBalanceByScope() für scope-aware Opening Balance
- Dashboard API angepasst für GLOBAL/VELBERT/UCKERATH Scopes
- Neuer BankAccountsTab mit Location-Gruppierung und aktuellen Salden
- bank-accounts API Route für detaillierte Konto-Übersicht
- Datenmigration für HVPlus Case

Fixes:
- Opening Balance war nicht standort-aware
- Dashboard zeigte falsche Startwerte für Location-Scopes
- Keine Bankkonto-Transparenz für IV

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"

# Push zu Remote (triggert Vercel Auto-Deploy)
git push origin main
```

---

## POST-DEPLOYMENT

### 4. Vercel Deployment überwachen

**Option A: Vercel Dashboard**
- URL: https://vercel.com/davids-projects-86967062/app/deployments
- Warte auf "Ready" Status (ca. 2-3 Minuten)

**Option B: CLI**
```bash
vercel logs --follow
```

### 5. Production Verifikation

**5.1 Dashboard öffnen:**
```
https://app-beige-kappa-43.vercel.app/admin/cases/2982ff26-081a-4811-8e1e-46b39e1ff757/results
```

**5.2 Scope-Toggle testen:**
- [ ] GLOBAL: Opening Balance = -239K EUR (ca.)
- [ ] VELBERT: Opening Balance = +25K EUR (ca.)
- [ ] UCKERATH: Opening Balance = +24K EUR (ca.)

**5.3 Neuer Bankkonten-Tab:**
- [ ] Tab "Banken" öffnen
- [ ] Bankkonto-Übersicht wird angezeigt
- [ ] 5 Konten sichtbar (gruppiert nach Location)
- [ ] Opening Balance + IST-Bewegungen + Aktueller Saldo korrekt

**5.4 Rolling Forecast Chart:**
- [ ] Chart lädt ohne Fehler
- [ ] Location-Toggle funktioniert
- [ ] Startwert passt zu Scope

**5.5 Browser Console:**
- [ ] Keine Fehler in DevTools Console
- [ ] Keine 401/403/404 Errors im Network-Tab

---

## ROLLBACK (Falls nötig)

### Option 1: Vercel Dashboard
```
Vercel Dashboard → Deployments → Previous Deployment → "Promote to Production"
```

### Option 2: Git Revert
```bash
git revert HEAD --no-edit
git push origin main
```

**Achtung:** Rollback des Codes ohne DB-Rollback führt zu Fehlern!

Falls DB-Rollback nötig (nur im Notfall):
```bash
turso db shell inso-liquiplanung-v2 << 'EOF'
-- Entferne locationId Werte (Schema bleibt bestehen)
UPDATE bank_accounts SET locationId = NULL;
EOF
```

---

## SUCCESS CRITERIA

✅ **Funktional:**
- [ ] Dashboard zeigt korrekte Opening Balances pro Scope
- [ ] Location-Toggle funktioniert ohne Fehler
- [ ] Bankkonten-Tab zeigt alle 5 Konten mit korrekten Werten
- [ ] Keine NULL-Werte in Liquiditätstabelle "Zahlungsmittelbestand am Anfang"

✅ **Performance:**
- [ ] Dashboard lädt in < 5 Sekunden
- [ ] Scope-Wechsel re-fetcht Daten korrekt
- [ ] Keine Timeout-Fehler

✅ **Datenintegrität:**
- [ ] Summe(VELBERT + UCKERATH) + ZENTRAL = GLOBAL
- [ ] BankAccount.locationId korrekt gesetzt
- [ ] Keine Daten verloren

---

## KONTAKTE BEI PROBLEMEN

**Insolvenzverwalter:**
- Sarah Wolf (Anchor Rechtsanwälte)
- Hannes Rieger (operativ)

**Beraterin:**
- Sonja Prinz

**Bei technischen Problemen:**
- Vercel Support: https://vercel.com/support
- Turso Support: https://docs.turso.tech/support
