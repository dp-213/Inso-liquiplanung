# Inso-Liquiplanung - Anleitung

## Was ist das hier?

Eine Web-Anwendung fuer Insolvenzverwalter zur Liquiditaetsplanung.
Du (als Betreiber) verwaltest Kunden (Insolvenzverwalter), die wiederum ihre Faelle (Insolvenzverfahren) einsehen koennen.

---

## Struktur der Anwendung

```
Deine Rolle (Admin)
       |
       v
+------------------+
|   Admin-Bereich  |  <-- Hier verwaltest du alles
|   /admin         |
+------------------+
       |
       | Du erstellst:
       v
+------------------+     +------------------+
|     Kunden       |     |      Faelle      |
| (Verwalter)      |---->| (Insolvenz-      |
+------------------+     |  verfahren)      |
       |                 +------------------+
       |
       | Kunden loggen sich ein unter:
       v
+------------------+
|  Kundenportal    |  <-- Kunden sehen ihre Faelle
|  /portal         |
+------------------+
```

---

## Die zwei Bereiche

### 1. Admin-Bereich (`/admin`)

**Fuer dich** - hier verwaltest du alles.

| Seite | Was du dort machst |
|-------|-------------------|
| Uebersicht | Dashboard mit Statistiken |
| Faelle | Alle Insolvenzfaelle verwalten |
| Kunden | Insolvenzverwalter anlegen/bearbeiten |
| Daten-Import | Liquiditaetsdaten hochladen |
| KI-Aufbereitung | Daten automatisch kategorisieren |

### 2. Kundenportal (`/portal`)

**Fuer deine Kunden** (Insolvenzverwalter) - sie sehen nur ihre eigenen Faelle.

---

## So funktioniert es

### Schritt 1: Kunde anlegen
1. Gehe zu `/admin`
2. Klicke auf "Kunden"
3. Klicke auf "Neuer Kunde"
4. Fulle Name, E-Mail, Firma aus
5. System generiert automatisch ein Passwort
6. **Wichtig:** Notiere das Passwort - es wird nur einmal angezeigt!

### Schritt 2: Fall erstellen
1. Gehe zu "Faelle"
2. Klicke auf "Neuer Fall"
3. Waehle den "Besitzer" (den Kunden, dem der Fall gehoert)
4. Fulle Fallname, Aktenzeichen etc. aus

### Schritt 3: Kunde testet
1. Kunde geht zu `/portal/login`
2. Loggt sich mit E-Mail + generiertem Passwort ein
3. Sieht seine Faelle

---

## Wo finde ich was?

### Im Browser

| URL | Was ist da |
|-----|-----------|
| `localhost:3000/admin` | Admin-Bereich (lokal) |
| `localhost:3000/portal` | Kundenportal (lokal) |


### Im Code

```
/app
├── src/
│   ├── app/
│   │   ├── admin/          # <-- Admin-Seiten
│   │   ├── portal/         # <-- Kundenportal-Seiten
│   │   └── api/            # <-- Backend-Logik
│   │
│   ├── components/         # <-- Wiederverwendbare Bausteine
│   │   └── admin/          # <-- Admin-spezifische Komponenten
│   │
│   └── lib/                # <-- Hilfsfunktionen
│       ├── db.ts           # <-- Datenbank-Verbindung
│       └── customer-auth.ts # <-- Login-Logik fuer Kunden
│
├── prisma/
│   └── schema.prisma       # <-- Datenbank-Struktur (Tabellen)
│


---

## Wichtige Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Case/Fall** | Ein Insolvenzverfahren mit Liquiditaetsdaten |
| **CustomerUser/Kunde** | Ein Insolvenzverwalter (nutzt das Portal) |
| **Owner/Besitzer** | Der Kunde, dem ein Fall "gehoert" |
| **SharedAccess** | Wenn ein Fall mit anderen Kunden geteilt wird |
| **Plan** | Eine Version der Liquiditaetsplanung |

---

## Befehle zum Starten

### Lokal entwickeln
```bash
cd app
npm run dev
```
Dann im Browser: `http://localhost:3000`

```

### Datenbank zuruecksetzen (lokal)
```bash
cd app
npx prisma db push --force-reset
```

