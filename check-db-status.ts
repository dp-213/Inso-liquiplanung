import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const caseId = '2982ff26-081a-4811-8e1e-46b39e1ff757';

async function checkStatus() {
  const planCount = await prisma.ledgerEntry.count({ where: { caseId, valueType: 'PLAN' } });
  const istCount = await prisma.ledgerEntry.count({ where: { caseId, valueType: 'IST' } });

  console.log(`PLAN: ${planCount}`);
  console.log(`IST: ${istCount}`);

  await prisma.$disconnect();
}

checkStatus();
