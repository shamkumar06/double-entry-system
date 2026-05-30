import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';
import prisma from '../lib/prisma';

export const listProjects = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await projectService.listProjects();
    res.json({ success: true, data: projects });
  } catch (err) { next(err); }
};

export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.getProject(req.params.id as string);
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.createProject(req.body);
    res.status(201).json({ success: true, data: project });
  } catch (err) { next(err); }
};

export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.updateProject(req.params.id as string, req.body);
    res.json({ success: true, data: project });
  } catch (err) { next(err); }
};

export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await projectService.deleteProject(req.params.id as string);
    res.json({ success: true, message: 'Project deleted.' });
  } catch (err) { next(err); }
};

export const listPhases = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phases = await projectService.listPhases(req.params.projectId as string);
    res.json({ success: true, data: phases });
  } catch (err) { next(err); }
};

export const createPhase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phase = await projectService.createPhase(req.params.projectId as string, req.body);
    res.status(201).json({ success: true, data: phase });
  } catch (err) { next(err); }
};

export const updatePhase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const phase = await projectService.updatePhase(
      req.params.projectId as string,
      req.params.phaseId as string,
      req.body
    );
    res.json({ success: true, data: phase });
  } catch (err) { next(err); }
};

export const deletePhase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await projectService.deletePhase(req.params.projectId as string, req.params.phaseId as string);
    res.json({ success: true, message: 'Phase deleted.' });
  } catch (err) { next(err); }
};

export const getPhaseFinancials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectService.getPhaseFinancials(req.params.projectId as string);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const settlePhase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectService.settlePhase(
      req.params.projectId as string,
      req.params.phaseId as string
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const unsettlePhase = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await projectService.unsettlePhase(
      req.params.projectId as string,
      req.params.phaseId as string
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const reallocateSurplus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourcePhaseId } = req.body;
    const data = await projectService.reallocateSurplus(
      req.params.projectId as string,
      req.params.phaseId as string, // targetPhaseId
      sourcePhaseId as string
    );
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getNotepad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;
    const phaseId = (req.query.phaseId as string | undefined) || null;

    const notepad = await (prisma as any).notepad.findFirst({
      where: {
        projectId,
        phaseId,
      },
    });

    res.json({ success: true, data: notepad ? notepad.content : '' });
  } catch (err) { next(err); }
};

export const saveNotepad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = req.params.projectId as string;
    const phaseId = (req.body.phaseId as string | undefined) || null;
    const content = (req.body.content as string | undefined) || '';

    const existing = await (prisma as any).notepad.findFirst({
      where: {
        projectId,
        phaseId,
      },
    });

    let notepad;
    if (existing) {
      notepad = await (prisma as any).notepad.update({
        where: { id: existing.id },
        data: { content },
      });
    } else {
      notepad = await (prisma as any).notepad.create({
        data: {
          projectId,
          phaseId,
          content,
        },
      });
    }

    res.json({ success: true, data: notepad.content });
  } catch (err) { next(err); }
};

export const listMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const members = await prisma.projectMember.findMany({
      where: { projectId: req.params.projectId as string },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: members });
  } catch (err) { next(err); }
};

export const addMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const member = await prisma.$transaction(async (tx) => {
      const newMember = await tx.projectMember.create({
        data: {
          projectId: req.params.projectId as string,
          name: req.body.name,
          role: req.body.role || 'STUDENT',
          phone: req.body.phone || null,
          parentMemberId: req.body.parentMemberId || null,
        },
      });

      // Automatically create a ledger ASSET account for the new cashier
      const maxCodeAcc = await tx.accountCategory.findFirst({
        where: { type: 'ASSET' },
        orderBy: { code: 'desc' }
      });
      const newCode = maxCodeAcc ? maxCodeAcc.code + 1 : 1000;

      await tx.accountCategory.create({
        data: {
          name: req.body.name,
          type: 'ASSET',
          code: newCode
        }
      });

      return newMember;
    });

    res.status(201).json({ success: true, data: member });
  } catch (err) { next(err); }
};

export const updateMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memberId = req.params.memberId as string;
    
    const member = await prisma.$transaction(async (tx) => {
      const existingMember = await tx.projectMember.findUnique({ where: { id: memberId } });
      if (!existingMember) throw new Error('Member not found');

      const updatedMember = await tx.projectMember.update({
        where: { id: memberId },
        data: {
          ...(req.body.name !== undefined && { name: req.body.name }),
          ...(req.body.role !== undefined && { role: req.body.role }),
          ...(req.body.phone !== undefined && { phone: req.body.phone }),
          ...(req.body.isActive !== undefined && { isActive: req.body.isActive }),
          ...(req.body.parentMemberId !== undefined && { parentMemberId: req.body.parentMemberId }),
        },
      });

      // Keep ledger Account in sync if name changes
      if (req.body.name && req.body.name !== existingMember.name) {
        const existingAcc = await tx.accountCategory.findFirst({
          where: { name: existingMember.name, type: 'ASSET' }
        });
        if (existingAcc) {
          await tx.accountCategory.update({
            where: { id: existingAcc.id },
            data: { name: req.body.name }
          });
        }
      }

      return updatedMember;
    });

    res.json({ success: true, data: member });
  } catch (err) { next(err); }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.projectMember.delete({ where: { id: req.params.memberId as string } });
    res.json({ success: true, message: 'Member removed.' });
  } catch (err) { next(err); }
};
