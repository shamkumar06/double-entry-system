import { Request, Response, NextFunction } from 'express';
import * as projectService from '../services/project.service';

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
