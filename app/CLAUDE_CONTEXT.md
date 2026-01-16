# Claude Context - Technische Dokumentation

Letzte Aktualisierung: 2026-01-16

## Projekt-Status

### Abgeschlossene Arbeiten

#### 1. Architektur-Vereinfachung: Projekte entfernt
- **Vorher:** CustomerUser → Project → Case (3-stufig)
- **Nachher:** CustomerUser → Case (2-stufig, direkte Beziehung)

**Geloeschte Dateien:**
- `/src/app/admin/projects/` (gesamtes Verzeichnis)
- `/src/app/api/projects/` (gesamtes Verzeichnis)

**Schema-Aenderungen in `prisma/schema.prisma`:**
```prisma
model Case {
  ownerId     String
  owner       CustomerUser @relation("OwnedCases", fields: [ownerId], references: [id])
  @@index([ownerId])
}

model CustomerUser {
  ownedCases  Case[] @relation("OwnedCases")
  caseAccess  CustomerCaseAccess[]  // Fuer geteilte Zugriffe
}
```

**Aktualisierte API-Routes:**
- `/api/cases/route.ts` - GET/POST mit ownerId statt projectId
- `/api/cases/[id]/route.ts` - Include owner statt project
- `/api/customers/[id]/route.ts` - Include owner statt project
- `/api/customer/cases/route.ts` - Portal-API mit owner
- `/api/customer/cases/[id]/route.ts` - Portal-Falldetails
- `/api/portal/cases/route.ts` - Owner-basierte Abfrage
- `/api/share/[token]/route.ts` - Include owner
- `/api/debug/db/route.ts` - Include owner

**Aktualisierte UI-Komponenten:**
- `/src/components/admin/AdminSidebar.tsx` - "Projekte" Menuepunkt entfernt
- `/src/app/admin/page.tsx` - Dashboard mit 3-Schritt-Workflow (Kunde → Fall → Zugriff)
- `/src/app/admin/cases/page.tsx` - Zeigt "Besitzer" statt "Projekt"
- `/src/app/admin/cases/new/page.tsx` - Dropdown fuer Besitzer-Auswahl
- `/src/app/admin/cases/[id]/page.tsx` - Zeigt Owner-Info
- `/src/app/portal/page.tsx` - Zeigt "Meine Faelle" und "Geteilte Faelle" separat

**Aktualisierte Auth-Logik (`/src/lib/customer-auth.ts`):**
- `getAccessibleCases()`: Kombiniert ownedCases + sharedCases mit isOwner-Flag
- `checkCaseAccess()`: Prueft erst Owner, dann CustomerCaseAccess

#### 2. Deployment-Vorbereitung
- `/Dockerfile` erstellt (Multi-Stage Build fuer Next.js Standalone)
- `/fly.toml` erstellt (App: mbo-financial-model, Region: fra, Port: 8000)
- `/.dockerignore` erstellt (node_modules, .next, .git ausgeschlossen)
- `/next.config.ts` aktualisiert mit `output: 'standalone'`

### Offene Probleme

#### Build-Fehler auf Alpine Linux - GELOEST
```
Error: Error relocating @libsql/linux-x64-musl/index.node: fcntl64: symbol not found
```
**Ursache:** @libsql/client native Binaries funktionieren nicht mit Alpine's musl libc
**Loesung:** Base-Image von `node:20-alpine` auf `node:20-slim` geaendert (2026-01-16)

### Datenbank-Status
- Lokale DB wurde mit `prisma db push --force-reset` zurueckgesetzt
- 0 Cases, 0 Customers (frischer Zustand)
- Turso-DB auf Fly.io hat noch alte Daten (Deployment ausstehend)

### Wichtige Dateipfade

| Zweck | Pfad |
|-------|------|
| Datenbank-Schema | `/prisma/schema.prisma` |
| DB-Verbindung | `/src/lib/db.ts` |
| Kunden-Auth | `/src/lib/customer-auth.ts` |
| Admin-Dashboard | `/src/app/admin/page.tsx` |
| Portal-Dashboard | `/src/app/portal/page.tsx` |
| Fall-API | `/src/app/api/cases/route.ts` |
| Kunden-API | `/src/app/api/customers/route.ts` |

### Zugangsdaten (Lokal)
- Admin: `admin` / `InsolvencyAdmin2026!`
- Kunden: Werden bei Erstellung generiert


