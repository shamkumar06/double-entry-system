const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getProcurementItems() {
  try {
    const items = await prisma.procurementItem.findMany({
      include: {
        project: true
      }
    });
    console.log('--- PROCUREMENT ITEMS ---');
    console.log(items.map(item => ({
      id: item.id,
      materialName: item.materialName,
      projectId: item.projectId,
      projectName: item.project.name
    })));
  } catch (err) {
    console.error('Error fetching procurement items:', err);
  } finally {
    await prisma.$disconnect();
  }
}

getProcurementItems();
