#!/usr/bin/env npx tsx
/**
 * Sync V4.0 Planning to Database (Local + Turso)
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Syncing V4.0 Planning to Database...\n');

  // Read V4.0 JSON
  const planningPath = path.join(
    '/Users/david/Projekte/AI Terminal/Inso-Liquiplanung',
    'Cases/Hausärztliche Versorgung PLUS eG/06-review',
    'PLANUNG-V4.0-IV-TAUGLICH.json'
  );

  const planningData = JSON.parse(fs.readFileSync(planningPath, 'utf-8'));

  console.log(`📄 Geladene Planung:`);
  console.log(`   Version: ${planningData.version}`);
  console.log(`   Datum: ${planningData.datum}`);
  console.log(`   Status: ${planningData.status}\n`);

  // Find case
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'; // HVPlus

  const existingCase = await prisma.case.findUnique({
    where: { id: caseId },
  });

  if (!existingCase) {
    throw new Error(`Case ${caseId} not found`);
  }

  console.log(`✅ Case gefunden: ${existingCase.name}\n`);

  // Check if planning exists
  const existing = await prisma.casePlanning.findFirst({
    where: { caseId },
  });

  if (existing) {
    console.log('🔄 Updating existing planning...');
    await prisma.casePlanning.update({
      where: { id: existing.id },
      data: {
        version: 'Version 4.0 - IV-Präsentation (09.02.2026)',
        planningData: JSON.stringify(planningData),
        updatedAt: new Date(),
      },
    });
    console.log('✅ Planning updated!\n');
  } else {
    console.log('➕ Creating new planning...');
    await prisma.casePlanning.create({
      data: {
        caseId,
        version: 'Version 4.0 - IV-Präsentation (09.02.2026)',
        planningData: JSON.stringify(planningData),
      },
    });
    console.log('✅ Planning created!\n');
  }

  // Verify
  const verified = await prisma.casePlanning.findFirst({
    where: { caseId },
  });

  if (verified) {
    const data = JSON.parse(verified.planningData);
    console.log(`🎯 Verifizierung:`);
    console.log(`   Version in DB: ${data.version}`);
    console.log(`   Monate: ${data.monate?.length || 0}`);
    console.log(`   Annahmen: ${data.annahmen?.length || 0}`);
    console.log(`   Nettosaldo: ${data.zusammenfassung?.nettosaldo?.toLocaleString('de-DE') || '?'} EUR`);
  }
}

main()
  .catch((e) => {
    console.error('❌ Fehler:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
