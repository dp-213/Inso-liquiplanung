# Auto-Deploy Test

Dieser Test-Commit prüft, ob Vercel Auto-Deploy funktioniert.

**Erstellt:** 2026-02-07 23:10
**Commit-ID:** Wird nach Auto-Deploy-Aktivierung ergänzt

## Erwartetes Verhalten

Nach `git push origin main` sollte automatisch ein Vercel-Deployment starten.

## Verifikation

1. Im Vercel Dashboard Auto-Deploy aktivieren
2. Diesen Commit pushen: `git add . && git commit -m "test: Auto-Deploy verification" && git push`
3. Warte 30 Sekunden
4. Prüfe: https://vercel.com/davids-projects-86967062/app/deployments
5. Neues Deployment sollte erscheinen mit Status "Building" → "Ready"

## Falls Auto-Deploy NICHT funktioniert

→ Zurück zu manuellen Deployments: `vercel --prod`
