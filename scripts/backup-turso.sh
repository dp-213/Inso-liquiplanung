#!/bin/bash
# Turso Production Backup Script
# Erstellt einen SQLite-Export der Turso Production-Datenbank
#
# Verwendung:
#   ./scripts/backup-turso.sh              # Standard-Backup
#   ./scripts/backup-turso.sh pre-deploy   # Backup mit Label (z.B. vor Deployment)
#
# Voraussetzungen:
#   - turso CLI installiert (brew install tursodatabase/tap/turso)
#   - turso auth login ausgeführt

set -euo pipefail

# Konfiguration
DB_NAME="inso-liquiplanung-v2"
BACKUP_DIR="$(cd "$(dirname "$0")/.." && pwd)/Backups/turso"
MAX_BACKUPS=30  # Maximale Anzahl Backups bevor alte gelöscht werden

# Label (optional)
LABEL="${1:-auto}"
TIMESTAMP=$(date +%Y-%m-%d_%H-%M)
FILENAME="turso-backup_${TIMESTAMP}_${LABEL}.db"

# Backup-Verzeichnis erstellen
mkdir -p "$BACKUP_DIR"

# Prüfe ob Turso CLI verfügbar
if ! command -v turso &> /dev/null; then
    echo "FEHLER: turso CLI nicht gefunden. Installation: brew install tursodatabase/tap/turso"
    exit 1
fi

# Backup erstellen
echo "Erstelle Backup: ${FILENAME}..."
echo "  Datenbank: ${DB_NAME}"
echo "  Ziel: ${BACKUP_DIR}/${FILENAME}"

# turso db export erstellt einen lokalen SQLite-Export
if turso db shell "$DB_NAME" .dump > "${BACKUP_DIR}/${FILENAME}.sql" 2>/dev/null; then
    # SQL-Dump in SQLite konvertieren
    sqlite3 "${BACKUP_DIR}/${FILENAME}" < "${BACKUP_DIR}/${FILENAME}.sql"
    rm "${BACKUP_DIR}/${FILENAME}.sql"

    SIZE=$(ls -lh "${BACKUP_DIR}/${FILENAME}" | awk '{print $5}')
    echo "Backup erfolgreich: ${SIZE}"

    # Entry-Count als Verifikation
    COUNT=$(sqlite3 "${BACKUP_DIR}/${FILENAME}" "SELECT COUNT(*) FROM ledger_entries;" 2>/dev/null || echo "?")
    echo "  LedgerEntries: ${COUNT}"
else
    echo "FEHLER: Backup fehlgeschlagen!"
    rm -f "${BACKUP_DIR}/${FILENAME}.sql"
    exit 1
fi

# Alte Backups aufräumen (behalte die neuesten MAX_BACKUPS)
BACKUP_COUNT=$(ls -1 "${BACKUP_DIR}"/turso-backup_*.db 2>/dev/null | wc -l | tr -d ' ')
if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    DELETE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    echo "Lösche ${DELETE_COUNT} alte Backups (behalte ${MAX_BACKUPS})..."
    ls -1t "${BACKUP_DIR}"/turso-backup_*.db | tail -n "$DELETE_COUNT" | xargs rm -f
fi

echo ""
echo "Aktuelle Backups:"
ls -lh "${BACKUP_DIR}"/turso-backup_*.db 2>/dev/null | tail -5
echo ""
echo "Gesamt: ${BACKUP_COUNT} Backups in ${BACKUP_DIR}"
