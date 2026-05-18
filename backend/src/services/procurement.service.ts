import { PrismaClient, ProcurementStatus } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateProcurementInput {
  projectId: string;
  phaseId?: string | null;
  materialName: string;
  vendorName?: string | null;
  quantity: number;
  unit: string;
  estimatedRate: number;
  actualRate?: number | null;
  status?: ProcurementStatus;
  driveFileId?: string | null;
  driveViewUrl?: string | null;
  notes?: string | null;
}

export interface UpdateProcurementInput {
  phaseId?: string | null;
  materialName?: string;
  vendorName?: string | null;
  quantity?: number;
  unit?: string;
  estimatedRate?: number;
  actualRate?: number | null;
  status?: ProcurementStatus;
  driveFileId?: string | null;
  driveViewUrl?: string | null;
  notes?: string | null;
}

export async function getProcurements(projectId: string, phaseId?: string | null) {
  return prisma.procurementItem.findMany({
    where: {
      projectId,
      ...(phaseId ? { phaseId } : {}),
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getProcurementById(id: string) {
  return prisma.procurementItem.findUnique({
    where: { id },
  });
}

export async function createProcurement(data: CreateProcurementInput) {
  return prisma.procurementItem.create({
    data: {
      projectId: data.projectId,
      phaseId: data.phaseId || null,
      materialName: data.materialName,
      vendorName: data.vendorName || null,
      quantity: data.quantity,
      unit: data.unit,
      estimatedRate: data.estimatedRate,
      actualRate: data.actualRate || null,
      status: data.status || 'PLANNING',
      driveFileId: data.driveFileId || null,
      driveViewUrl: data.driveViewUrl || null,
      notes: data.notes || null,
    },
  });
}

export async function updateProcurement(id: string, data: UpdateProcurementInput) {
  return prisma.procurementItem.update({
    where: { id },
    data: {
      phaseId: data.phaseId !== undefined ? data.phaseId : undefined,
      materialName: data.materialName,
      vendorName: data.vendorName,
      quantity: data.quantity,
      unit: data.unit,
      estimatedRate: data.estimatedRate,
      actualRate: data.actualRate,
      status: data.status,
      driveFileId: data.driveFileId !== undefined ? data.driveFileId : undefined,
      driveViewUrl: data.driveViewUrl !== undefined ? data.driveViewUrl : undefined,
      notes: data.notes,
    },
  });
}

export async function deleteProcurement(id: string) {
  return prisma.procurementItem.delete({
    where: { id },
  });
}
