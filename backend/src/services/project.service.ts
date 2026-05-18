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
  const phases = await prisma.phase.findMany({
    where: { projectId },
    include: {
      transactions: {
        where: { isDeleted: false },
        include: { lines: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return phases.map((phase) => {
    let spent_amount = 0;
    phase.transactions.forEach((tx) => {
      tx.lines.forEach((line) => {
        if (line.type === 'DEBIT') {
          spent_amount += Number(line.amount);
        }
      });
    });

    return {
      id: phase.id,
      projectId: phase.projectId,
      name: phase.name,
      description: phase.description,
      estimatedBudget: Number(phase.estimatedBudget),
      receivedAmount: Number(phase.receivedAmount),
      receivedFrom: phase.receivedFrom,
      receivedTo: phase.receivedTo,
      paymentMode: phase.paymentMode,
      reference: phase.reference,
      requestLetterUrl: phase.requestLetterUrl,
      isSettled: phase.isSettled,
      createdAt: phase.createdAt,
      updatedAt: phase.updatedAt,
      spent_amount,
    };
  });
};

export const createPhase = async (
  projectId: string,
  data: {
    name: string;
    description?: string;
    estimatedBudget?: number;
    receivedAmount?: number;
    receivedFrom?: string;
    receivedTo?: string;
    paymentMode?: string;
    reference?: string;
    requestLetterUrl?: string;
  }
) => {
  const phase = await prisma.phase.create({
    data: {
      projectId,
      name: data.name,
      description: data.description,
      estimatedBudget: data.estimatedBudget,
      receivedAmount: data.receivedAmount,
      receivedFrom: data.receivedFrom,
      receivedTo: data.receivedTo,
      paymentMode: data.paymentMode,
      reference: data.reference,
      requestLetterUrl: data.requestLetterUrl,
    }
  });

  return phase;
};

export const updatePhase = async (
  projectId: string,
  phaseId: string,
  data: {
    name?: string;
    description?: string;
    estimatedBudget?: number;
    receivedAmount?: number;
    receivedFrom?: string;
    receivedTo?: string;
    paymentMode?: string;
    reference?: string;
    requestLetterUrl?: string;
    isSettled?: boolean;
  }
) => {
  const phase = await prisma.phase.findFirst({ where: { id: phaseId, projectId } });
  if (!phase) throw new AppError('Phase not found.', 404);

  const updatedPhase = await prisma.phase.update({
    where: { id: phaseId },
    data: {
      name: data.name,
      description: data.description,
      estimatedBudget: data.estimatedBudget,
      receivedAmount: data.receivedAmount,
      receivedFrom: data.receivedFrom,
      receivedTo: data.receivedTo,
      paymentMode: data.paymentMode,
      reference: data.reference,
      requestLetterUrl: data.requestLetterUrl,
      isSettled: data.isSettled,
    }
  });

  return updatedPhase;
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
