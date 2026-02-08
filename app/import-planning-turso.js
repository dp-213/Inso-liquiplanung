const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function importToTurso() {
  const jsonPath = '../Cases/Hausärztliche Versorgung PLUS eG/03-classified/PLAN/Liquiditaetsplanung_Korrigiert_2026-02-08.json';
  const planningData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  
  const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';
  
  const result = await prisma.casePlanning.upsert({
    where: { caseId },
    create: {
      caseId,
      planningData: JSON.stringify(planningData),
      version: 'Korrigiert 08.02.2026'
    },
    update: {
      planningData: JSON.stringify(planningData),
      version: 'Korrigiert 08.02.2026'
    }
  });
  
  console.log(`✓ Planning in Turso: ${result.id}, version: ${result.version}`);
}

importToTurso()
  .then(() => prisma.$disconnect())
  .catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
