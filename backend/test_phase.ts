import { prisma } from './src/lib/prisma';

async function main() {
  const projects = await prisma.project.findMany({ include: { phases: true, transactions: true } });
  console.log("PROJECTS:", JSON.stringify(projects, null, 2));
  
  const txs = await prisma.transaction.findMany({ include: { lines: true } });
  console.log("TXS:", JSON.stringify(txs, null, 2));

  const cats = await prisma.accountCategory.findMany();
  console.log("CATS:", cats.length);
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
