import prisma from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';

export const listProjects = async () => {
  const projects = await prisma.project.findMany({
    where: { isActive: true },
    include: {
      phases: {
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  return projects;
};

export const getProject = async (id: string) => {
  const project = await prisma.project.findUnique({
    where: { id },
    include: { phases: { orderBy: { createdAt: 'asc' } } },
  });
  if (!project) throw new AppError('Project not found.', 404);
  return project;
};

export const createProject = async (data: {
  name: string;
  description?: string;
  totalFunds?: number;
  logoUrl?: string;
}) => {
  return prisma.project.create({ data, include: { phases: true } });
};

export const updateProject = async (
  id: string,
  data: { name?: string; description?: string; totalFunds?: number; logoUrl?: string }
) => {
  return prisma.project.update({
    where: { id },
    data,
    include: { phases: true },
  });
};

export const deleteProject = async (id: string) => {
  await prisma.project.update({ where: { id }, data: { isActive: false } });
};

// --- Phases ---

export const listPhases = async (projectId: string) => {
  return prisma.phase.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });
};

export const createPhase = async (
  projectId: string,
  data: { name: string; description?: string; estimatedBudget?: number; receivedAmount?: number }
) => {
  return prisma.phase.create({ data: { ...data, projectId } });
};

export const updatePhase = async (
  projectId: string,
  phaseId: string,
  data: {
    name?: string;
    description?: string;
    estimatedBudget?: number;
    receivedAmount?: number;
    isSettled?: boolean;
  }
) => {
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, projectId } });
  if (!phase) throw new AppError('Phase not found.', 404);
  return prisma.phase.update({ where: { id: phaseId }, data });
};

export const deletePhase = async (projectId: string, phaseId: string) => {
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, projectId } });
  if (!phase) throw new AppError('Phase not found.', 404);
  await prisma.phase.delete({ where: { id: phaseId } });
};

// --- Phase Financials (aggregated) ---

export const getPhaseFinancials = async (projectId: string) => {
  const phases = await prisma.phase.findMany({
    where: { projectId },
    include: {
      transactions: {
        where: { isDeleted: false },
        include: { lines: true },
      },
    },
  });

  return phases.map((phase) => {
    let totalExpense = 0;
    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.type === 'DEBIT') {
          totalExpense += Number(line.amount);
        }
      });
    });
    return {
      id: phase.id,
      name: phase.name,
      estimatedBudget: Number(phase.estimatedBudget),
      receivedAmount: Number(phase.receivedAmount),
      totalExpense,
      balance: Number(phase.receivedAmount) - totalExpense,
      isSettled: phase.isSettled,
    };
  });
};
