#!/bin/bash
# Pre-Flight-Check für Inso-Liquiplanung
# Prüft häufige Fehlerquellen vor Deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")/app"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Pre-Flight-Check für Inso-Liquiplanung"
echo "=========================================="

ERRORS=0
WARNINGS=0

# 1. Build-Check
echo -e "\n📦 1. Build-Check..."
cd "$APP_DIR"
if npm run build > /tmp/build-output.txt 2>&1; then
    echo -e "${GREEN}✓ Build erfolgreich${NC}"
else
    echo -e "${RED}✗ Build fehlgeschlagen!${NC}"
    tail -20 /tmp/build-output.txt
    ERRORS=$((ERRORS + 1))
fi

# 2. Unbenutzte Imports prüfen (TypeScript Fehler würden im Build auffallen)
echo -e "\n🔗 2. TypeScript-Fehler..."
if grep -q "error TS" /tmp/build-output.txt 2>/dev/null; then
    echo -e "${RED}✗ TypeScript-Fehler gefunden!${NC}"
    grep "error TS" /tmp/build-output.txt | head -10
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Keine TypeScript-Fehler${NC}"
fi

# 3. Deutsche Umlaute prüfen (häufige Ersatzschreibweisen)
echo -e "\n🇩🇪 3. Deutsche Umlaute prüfen..."
UMLAUT_ISSUES=$(grep -rn "Loeschen\|Uebersicht\|Aenderung\|fuer\|zurueck\|Faelle\|groesser\|aehnlich" "$APP_DIR/src" --include="*.tsx" --include="*.ts" 2>/dev/null | grep -v node_modules | head -5 || true)
if [ -n "$UMLAUT_ISSUES" ]; then
    echo -e "${YELLOW}⚠ Mögliche Umlaut-Ersatzschreibweisen gefunden:${NC}"
    echo "$UMLAUT_ISSUES"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Keine offensichtlichen Umlaut-Probleme${NC}"
fi

# 4. Dashboard-Links Konsistenz
echo -e "\n🔗 4. Dashboard-Links prüfen..."
DASHBOARD_LINKS=$(grep -rn "dashboard" "$APP_DIR/src" --include="*.tsx" | grep -E "href=|Link.*to=" | grep -v "/results" | grep -v "rules" | grep -v "node_modules" | head -5 || true)
if [ -n "$DASHBOARD_LINKS" ]; then
    echo -e "${YELLOW}⚠ Prüfe diese Dashboard-Links (sollten zu /results gehen):${NC}"
    echo "$DASHBOARD_LINKS"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Dashboard-Links scheinen konsistent${NC}"
fi

# 5. Fetch ohne credentials prüfen
echo -e "\n🔐 5. Fetch-Credentials prüfen..."
# Suche nach fetch() ohne credentials in admin-Seiten (außer in Kommentaren)
FETCH_ISSUES=$(grep -rn "fetch(\`/api" "$APP_DIR/src/app/admin" --include="*.tsx" | grep -v "credentials" | grep -v "//" | head -5 || true)
if [ -n "$FETCH_ISSUES" ]; then
    echo -e "${YELLOW}⚠ Fetch-Aufrufe ohne credentials: 'include' gefunden:${NC}"
    echo "$FETCH_ISSUES"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Alle fetch-Aufrufe haben credentials${NC}"
fi

# 6. Uncommitted Changes
echo -e "\n📝 6. Git-Status..."
cd "$(dirname "$APP_DIR")"
UNCOMMITTED=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$UNCOMMITTED" -gt 0 ]; then
    echo -e "${YELLOW}⚠ $UNCOMMITTED uncommitted Änderungen${NC}"
    git status --short | head -10
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓ Working directory clean${NC}"
fi

# Zusammenfassung
echo -e "\n=========================================="
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ $ERRORS Fehler gefunden - NICHT deployen!${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️ $WARNINGS Warnungen - Bitte prüfen${NC}"
    exit 0
else
    echo -e "${GREEN}✅ Alle Checks bestanden - Ready for deployment${NC}"
    exit 0
fi
