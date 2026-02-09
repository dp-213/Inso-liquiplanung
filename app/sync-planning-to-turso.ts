#!/usr/bin/env npx tsx

/**
 * Synchronisiert CasePlanning von lokaler SQLite nach Turso
 */

import { PrismaClient } from "@prisma/client";

const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:/Users/david/Projekte/AI Terminal/Inso-Liquiplanung/app/prisma/dev.db"
    }
  }
});

const tursoPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL // Turso URL
    }
  }
});

async function main() {
  console.log("=== SYNC PLANNING: Local → Turso ===\n");

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

  // Hole Turso Case
  const tursoCase = await tursoPrisma.case.findFirst({
    where: {
      caseNumber: "70d IN 362/25"
    }
  });

  if (!tursoCase) {
    console.log("❌ Case nicht in Turso gefunden!");
    return;
  }

  console.log("\nTurso Case gefunden:", tursoCase.id);

  // Prüfe ob Planung existiert
  const existingPlanning = await tursoPrisma.casePlanning.findFirst({
    where: {
      caseId: tursoCase.id
    }
  });

  if (existingPlanning) {
    console.log("\nAktualisiere existierende Turso-Planung...");
    console.log("  Alt - Version:", existingPlanning.version);

    await tursoPrisma.casePlanning.update({
      where: {
        id: existingPlanning.id
      },
      data: {
        planningData: localPlanning.planningData,
        version: localPlanning.version,
        updatedAt: new Date()
      }
    });

    console.log("  Neu - Version:", localPlanning.version);
    console.log("✅ Planung in Turso aktualisiert!");
  } else {
    console.log("\nErstelle neue Turso-Planung...");

    await tursoPrisma.casePlanning.create({
      data: {
        caseId: tursoCase.id,
        planningData: localPlanning.planningData,
        version: localPlanning.version
      }
    });

    console.log("✅ Planung in Turso erstellt!");
  }

  console.log("\n=== SYNC ABGESCHLOSSEN ===");

  await localPrisma.$disconnect();
  await tursoPrisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Fehler:", error);
  process.exit(1);
});
