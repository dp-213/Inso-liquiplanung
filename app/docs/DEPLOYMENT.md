# Deployment-Dokumentation

## Inso-Liquiplanung - Bereitstellung auf Vercel

Diese Dokumentation beschreibt, wie die Anwendung auf Vercel bereitgestellt wird und welche Schritte fuer Aktualisierungen und Problemloesungen noetig sind.

---

## Inhaltsverzeichnis

1. [Uebersicht](#1-uebersicht)
2. [Umgebungsvariablen](#2-umgebungsvariablen)
3. [Erstbereitstellung](#3-erstbereitstellung)
4. [Aktualisierungen durchfuehren](#4-aktualisierungen-durchfuehren)
5. [Zurueckrollen auf vorherige Version](#5-zurueckrollen-auf-vorherige-version)
6. [Ueberwachung und Logs](#6-ueberwachung-und-logs)
7. [Haeufige Probleme](#7-haeufige-probleme)

---

## 1. Uebersicht

### Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Framework | Next.js 16 |
| Hosting | Vercel |
| Datenbank | SQLite (lokal) / PostgreSQL (Produktion) |
| ORM | Prisma |
| Authentifizierung | iron-session |

### Deployment-Ablauf

```
Code-Aenderung → Git Push → Vercel erkennt Aenderung →
Build-Prozess → Prisma Generate → Next.js Build → Deployment
```

Bei jedem Push in den Hauptbranch wird automatisch eine neue Version bereitgestellt.

---

## 2. Umgebungsvariablen

Die folgenden Umgebungsvariablen muessen in Vercel konfiguriert sein.

### Erforderliche Variablen

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `DATABASE_URL` | Datenbankverbindung | `postgresql://user:pass@host/db` |
| `ADMIN_USERNAME` | Admin-Benutzername | `admin` |
| `ADMIN_PASSWORD` | Admin-Passwort | (sicheres Passwort) |
| `SESSION_SECRET` | Session-Verschluesselung (32 Zeichen) | (zufaellige Zeichenkette) |
| `NEXT_PUBLIC_APP_URL` | Oeffentliche URL der Anwendung | `https://inso-liqui.vercel.app` |

### Variablen in Vercel konfigurieren

1. Melden Sie sich bei Vercel an
2. Oeffnen Sie das Projekt "Inso-Liquiplanung"
3. Gehen Sie zu "Settings" → "Environment Variables"
4. Fuer jede Variable:
   - Klicken Sie auf "Add"
   - Geben Sie den Namen ein (z.B. `DATABASE_URL`)
   - Geben Sie den Wert ein
   - Waehlen Sie die Umgebungen (Production, Preview, Development)
   - Klicken Sie auf "Save"

### Sicherheitshinweise

- **Passwoerter niemals im Code speichern**
- Verwenden Sie starke, einzigartige Passwoerter
- Das `SESSION_SECRET` muss exakt 32 Zeichen lang sein
- Aendern Sie Passwoerter regelmaessig

### Beispiel .env.example

Die Datei `.env.example` im Repository zeigt das erwartete Format:

```
DATABASE_URL="file:./dev.db"
ADMIN_PASSWORD="IhrSicheresPasswort!"
ADMIN_USERNAME="admin"
SESSION_SECRET="ihr-32-zeichen-sicherer-schluessel"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 3. Erstbereitstellung

### Voraussetzungen

- Vercel-Konto
- Zugang zum Git-Repository
- Datenbankserver (fuer Produktion)

### Schritt-fuer-Schritt

1. **Repository mit Vercel verbinden**
   - Melden Sie sich bei vercel.com an
   - Klicken Sie auf "Add New Project"
   - Waehlen Sie das Git-Repository aus
   - Authorisieren Sie den Zugriff falls erforderlich

2. **Projekt konfigurieren**
   - Framework Preset: "Next.js" (wird automatisch erkannt)
   - Root Directory: `app` (wichtig!)
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Umgebungsvariablen setzen**
   - Tragen Sie alle erforderlichen Variablen ein (siehe oben)
   - Stellen Sie sicher, dass die Datenbankverbindung korrekt ist

4. **Deployment starten**
   - Klicken Sie auf "Deploy"
   - Warten Sie auf den Build-Prozess
   - Bei Erfolg: Gruene Meldung und URL

5. **Datenbank initialisieren**
   - Nach dem ersten Deployment muessen die Datenbanktabellen erstellt werden
   - Dies geschieht automatisch durch Prisma beim ersten Start
   - Alternativ: `npx prisma db push` in der Vercel-Konsole ausfuehren

### Verifikation

Nach dem Deployment:

1. Oeffnen Sie die bereitgestellte URL
2. Pruefen Sie, ob die Anmeldeseite erscheint
3. Melden Sie sich mit den konfigurierten Zugangsdaten an
4. Pruefen Sie, ob das Dashboard korrekt laedt

---

## 4. Aktualisierungen durchfuehren

### Automatisches Deployment

Bei aktivierter Git-Integration:

1. Fuehren Sie Code-Aenderungen lokal durch
2. Committen Sie die Aenderungen
3. Pushen Sie zum Hauptbranch

```bash
git add .
git commit -m "Beschreibung der Aenderung"
git push origin main
```

Vercel erkennt den Push und startet automatisch ein neues Deployment.

### Deployment-Status pruefen

1. Gehen Sie zu vercel.com
2. Oeffnen Sie das Projekt
3. Unter "Deployments" sehen Sie:
   - Laufende Builds (orange)
   - Erfolgreiche Deployments (gruen)
   - Fehlgeschlagene Builds (rot)

### Build-Logs einsehen

Bei Problemen:

1. Klicken Sie auf das betreffende Deployment
2. Oeffnen Sie "Build Logs"
3. Suchen Sie nach Fehlermeldungen

---

## 5. Zurueckrollen auf vorherige Version

Falls eine neue Version Probleme verursacht, koennen Sie schnell zur vorherigen Version zurueckkehren.

### Rollback durchfuehren

1. Melden Sie sich bei Vercel an
2. Oeffnen Sie das Projekt
3. Gehen Sie zu "Deployments"
4. Finden Sie das letzte funktionierende Deployment
5. Klicken Sie auf die drei Punkte (...)
6. Waehlen Sie "Promote to Production"
7. Bestaetigen Sie die Aktion

Das alte Deployment wird sofort wieder aktiv.

### Wann sollten Sie zurueckrollen?

- Kritische Fehler nach einem Update
- Anwendung ist nicht erreichbar
- Anmeldung funktioniert nicht mehr
- Daten werden nicht korrekt angezeigt

### Nach dem Rollback

1. Informieren Sie das Entwicklungsteam
2. Analysieren Sie den Fehler in den Build-Logs
3. Beheben Sie das Problem im Code
4. Testen Sie gruendlich vor dem naechsten Deployment

---

## 6. Ueberwachung und Logs

### Vercel Analytics

Vercel bietet integrierte Analyse-Tools:

1. Gehen Sie zum Projekt in Vercel
2. Klicken Sie auf "Analytics"
3. Sie sehen:
   - Besucherzahlen
   - Ladezeiten
   - Fehlerraten

### Runtime-Logs

Fuer laufende Anwendungslogs:

1. Oeffnen Sie das Projekt in Vercel
2. Gehen Sie zu "Logs"
3. Waehlen Sie den Zeitraum
4. Filtern Sie nach Severity (Error, Warning, Info)

### Wichtige Log-Eintraege

| Meldung | Bedeutung | Aktion |
|---------|-----------|--------|
| `500 Internal Server Error` | Serverfehler | Logs pruefen, ggf. Rollback |
| `Database connection failed` | DB nicht erreichbar | Datenbankstatus pruefen |
| `Unauthorized` | Authentifizierung fehlgeschlagen | Zugangsdaten pruefen |
| `ECONNREFUSED` | Verbindung verweigert | Netzwerk/Firewall pruefen |

### Benachrichtigungen einrichten

1. Gehen Sie zu "Settings" → "Integrations"
2. Verbinden Sie Slack oder E-Mail
3. Konfigurieren Sie Benachrichtigungen fuer:
   - Fehlgeschlagene Deployments
   - Erhoehte Fehlerraten
   - Lange Ladezeiten

---

## 7. Haeufige Probleme

### Build schlaegt fehl

**Symptom**: Deployment stoppt mit Fehlermeldung

**Moegliche Ursachen und Loesungen:**

1. **TypeScript-Fehler**
   - Pruefen Sie die Build-Logs auf Typfehler
   - Beheben Sie die gemeldeten Probleme lokal
   - Testen Sie mit `npm run build` vor dem Push

2. **Fehlende Abhaengigkeiten**
   - Pruefen Sie, ob alle npm-Pakete in package.json stehen
   - Fuehren Sie `npm install` aus und committen Sie package-lock.json

3. **Prisma-Fehler**
   - Stellen Sie sicher, dass `prisma generate` im Build-Command enthalten ist
   - Pruefen Sie die Prisma-Schema-Datei auf Fehler

### Anwendung startet nicht

**Symptom**: URL zeigt Fehlerseite

**Loesungen:**

1. Pruefen Sie die Runtime-Logs
2. Verifizieren Sie alle Umgebungsvariablen
3. Stellen Sie sicher, dass DATABASE_URL korrekt ist
4. Fuehren Sie ein Rollback durch wenn noetig

### Datenbankprobleme

**Symptom**: Fehler beim Laden von Daten

**Loesungen:**

1. Pruefen Sie die Datenbankverbindung
2. Stellen Sie sicher, dass die Tabellen existieren
3. Pruefen Sie Firewall-Einstellungen des DB-Servers
4. Verifizieren Sie die Zugangsdaten

### Langsame Ladezeiten

**Symptom**: Anwendung reagiert traege

**Loesungen:**

1. Pruefen Sie die Analytics auf Engpaesse
2. Optimieren Sie Datenbankabfragen
3. Aktivieren Sie Vercel Edge Caching
4. Pruefen Sie die Serverregion (naehe zu Nutzern)

### Session-Probleme

**Symptom**: Benutzer werden ungewollt abgemeldet

**Loesungen:**

1. Pruefen Sie, ob SESSION_SECRET gesetzt ist
2. Stellen Sie sicher, dass SESSION_SECRET exakt 32 Zeichen hat
3. Aendern Sie das Secret nicht zwischen Deployments

---

## Notfallkontakte

Bei kritischen Problemen ausserhalb der Geschaeftszeiten:

| Situation | Kontakt |
|-----------|---------|
| Anwendung nicht erreichbar | [IT-Notfall Nummer] |
| Datenverlust vermutet | [Technische Leitung] |
| Sicherheitsvorfall | [Sicherheitsbeauftragter] |

---

## Checkliste vor dem Deployment

Vor jedem Deployment in Produktion:

- [ ] Alle Tests bestanden (`npm test`)
- [ ] Build erfolgreich (`npm run build`)
- [ ] Aenderungen von zweiter Person geprueft
- [ ] Keine sensiblen Daten im Code
- [ ] Dokumentation aktualisiert falls noetig
- [ ] Rollback-Plan klar

---

*Deployment-Dokumentation Version 1.0 | Stand: Januar 2026*
