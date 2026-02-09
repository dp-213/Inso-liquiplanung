#!/usr/bin/env npx tsx

/**
 * Synchronisiert CasePlanning von lokaler SQLite nach Turso
 * Verwendet direktes SQL um Schema-Unterschiede zu umgehen
 */

import { PrismaClient } from "@prisma/client";
import { createClient } from "@libsql/client";

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/app/prisma/dev.db"
    }
  }
});

async function main() {
  console.log("=== SYNC PLANNING: Local → Turso (Direct SQL) ===\n");

  // Hole lokale Planung
  const localPlanning = await localPrisma.casePlanning.findFirst({
    where: {
      case: {
        caseNumber: "70d IN 362/25"
      }
    }
  });

  if (!localPlanning) {
    console.log("❌ Keine lokale Planung gefunden!");
    return;
  }

  console.log("Lokale Planung gefunden:");
  console.log("  Version:", localPlanning.version);
  console.log("  Updated:", localPlanning.updatedAt);
  console.log("  Größe:", (localPlanning.planningData.length / 1024).toFixed(1), "KB");

  // Verbinde direkt mit Turso
  const dbUrl = process.env.DATABASE_URL!;
  const authToken = process.env.TURSO_AUTH_TOKEN!;

  console.log("\nVerbinde mit Turso...");
  console.log("  URL:", dbUrl?.substring(0, 50) + "...");
  console.log("  Auth Token:", authToken ? `${authToken.length} chars` : "MISSING");

  const turso = createClient({
    url: dbUrl,
    authToken: authToken
  });

  // Update direkt via SQL
  const result = await turso.execute({
    sql: `UPDATE case_planning
          SET planningData = ?,
              version = ?,
              updatedAt = datetime('now')
          WHERE id = 'planning-hvplus-001'`,
    args: [
      localPlanning.planningData,
      localPlanning.version
    ]
  });

  console.log("\nUpdate-Ergebnis:");
  console.log("  Betroffene Zeilen:", result.rowsAffected);

  if (result.rowsAffected > 0) {
    console.log("✅ Planung in Turso aktualisiert!");
  } else {
    console.log("⚠️  Keine Zeilen aktualisiert - ID existiert nicht?");
  }

  console.log("\n=== SYNC ABGESCHLOSSEN ===");

  await localPrisma.$disconnect();
  turso.close();
}

main().catch((error) => {
  console.error("❌ Fehler:", error);
  process.exit(1);
});
