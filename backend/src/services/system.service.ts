import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export const listCategories = async () => {
  return prisma.accountCategory.findMany({ orderBy: { code: 'asc' } });
};

export const createCategory = async (data: {
  code: number;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  description?: string;
}) => {
  return prisma.accountCategory.create({ data });
};

export const renameCategory = async (id: string, name: string) => {
  const cat = await prisma.accountCategory.findUnique({ where: { id } });
  if (!cat) throw new AppError('Category not found.', 404);
  return prisma.accountCategory.update({ where: { id }, data: { name } });
};

export const deleteCategory = async (id: string) => {
  const cat = await prisma.accountCategory.findUnique({ where: { id } });
  if (!cat) throw new AppError('Category not found.', 404);
  if (cat.isSystem) throw new AppError('Cannot delete a system category.', 403);

  const usageCount = await prisma.transactionLine.count({ where: { accountId: id } });
  if (usageCount > 0) {
    throw new AppError(
      `Cannot delete category "${cat.name}" — it has ${usageCount} transaction(s) referencing it.`,
      409
    );
  }

  await prisma.accountCategory.delete({ where: { id } });
};

export const getSettings = async () => {
  let settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: {} });
  }
  return settings;
};

export const updateSettings = async (data: { baseCurrency?: string; exchangeRateApiKey?: string }) => {
  const settings = await prisma.systemSettings.findFirst();
  if (!settings) {
    return prisma.systemSettings.create({ data });
  }
  return prisma.systemSettings.update({ where: { id: settings.id }, data });
};
