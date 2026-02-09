#!/usr/bin/env npx tsx
/**
 * Sync V4.0 Planning to Turso Production Database
 */

import { createClient } from '@libsql/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🚀 Syncing V4.0 Planning to Turso...\n');

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

  // Connect to Turso
  const tursoUrl = process.env.DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoUrl.startsWith('libsql://')) {
    throw new Error('DATABASE_URL not set or not Turso URL');
  }

  if (!tursoToken) {
    throw new Error('TURSO_AUTH_TOKEN not set');
  }

  console.log('🔗 Verbinde mit Turso...');
  console.log(`   URL: ${tursoUrl.substring(0, 50)}...\n`);

  const client = createClient({
    url: tursoUrl,
    authToken: tursoToken,
  });

  // Find case
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757'; // HVPlus

  const caseResult = await client.execute({
    sql: 'SELECT id, name FROM cases WHERE id = ?',
    args: [caseId],
  });

  if (caseResult.rows.length === 0) {
    throw new Error(`Case ${caseId} not found in Turso`);
  }

  console.log(`✅ Case gefunden: ${caseResult.rows[0].name}\n`);

  // Check if planning exists
  const existingResult = await client.execute({
    sql: 'SELECT id FROM casePlanning WHERE caseId = ?',
    args: [caseId],
  });

  const version = 'Version 4.0 - IV-Präsentation (09.02.2026)';
  const now = new Date().toISOString();

  if (existingResult.rows.length > 0) {
    console.log('🔄 Updating existing planning...');
    const planningId = existingResult.rows[0].id as string;

    await client.execute({
      sql: `UPDATE casePlanning
            SET version = ?, planningData = ?, updatedAt = ?
            WHERE id = ?`,
      args: [version, JSON.stringify(planningData), now, planningId],
    });

    console.log('✅ Planning updated in Turso!\n');
  } else {
    console.log('➕ Creating new planning...');
    const planningId = crypto.randomUUID();

    await client.execute({
      sql: `INSERT INTO casePlanning (id, caseId, version, planningData, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [planningId, caseId, version, JSON.stringify(planningData), now, now],
    });

    console.log('✅ Planning created in Turso!\n');
  }

  // Verify
  const verifyResult = await client.execute({
    sql: 'SELECT version, planningData, updatedAt FROM casePlanning WHERE caseId = ?',
    args: [caseId],
  });

  if (verifyResult.rows.length > 0) {
    const row = verifyResult.rows[0];
    const data = JSON.parse(row.planningData as string);

    console.log(`🎯 Verifizierung (Turso):`);
    console.log(`   Version: ${row.version}`);
    console.log(`   Updated: ${row.updatedAt}`);
    console.log(`   Monate: ${data.monate?.length || 0}`);
    console.log(`   Annahmen: ${data.annahmen?.length || 0}`);
    console.log(`   Nettosaldo: ${data.zusammenfassung?.nettosaldo?.toLocaleString('de-DE') || '?'} EUR`);
  }

  client.close();
}

main().catch((e) => {
  console.error('❌ Fehler:', e);
  process.exit(1);
});
