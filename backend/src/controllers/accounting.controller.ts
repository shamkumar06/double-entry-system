import { Request, Response, NextFunction } from 'express';
import * as accountingService from '../services/accounting.service';
import * as reportService from '../services/report.service';

const parsePhaseIds = (phases?: string): string[] | undefined => {
  if (!phases) return undefined;
  return phases.split(',').filter(Boolean);
};

export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await accountingService.createTransaction(req.body);
    res.status(201).json({ success: true, data: tx });
  } catch (err) { next(err); }
};

export const updateTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tx = await accountingService.updateTransaction(req.params.id as string, req.body);
    res.json({ success: true, data: tx });
  } catch (err) { next(err); }
};

export const deleteTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await accountingService.softDeleteTransaction(req.params.id as string);
    res.json({ success: true, message: 'Transaction moved to recycle bin.' });
  } catch (err) { next(err); }
};

export const restoreTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await accountingService.restoreTransaction(req.params.id as string);
    res.json({ success: true, message: 'Transaction restored.' });
  } catch (err) { next(err); }
};

export const getJournal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, phases } = req.query as { projectId: string; phases?: string };
    const data = await accountingService.getJournal(projectId, parsePhaseIds(phases));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getDeletedTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.query as { projectId: string };
    const data = await accountingService.getDeletedTransactions(projectId);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getTrialBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, phases } = req.query as { projectId: string; phases?: string };
    const data = await accountingService.getTrialBalance(projectId, parsePhaseIds(phases));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const getLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, accountId, phases } = req.query as {
      projectId: string;
      accountId: string;
      phases?: string;
    };
    const data = await accountingService.getLedger(projectId, accountId, parsePhaseIds(phases));
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const uploadFile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' });
      return;
    }
    // For local dev, serve from /uploads
    const url = `/uploads/${req.file.filename}`;
    res.json({ success: true, data: { url } });
  } catch (err) { next(err); }
};

export const generateReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, projectName, phaseIds, params } = req.body;
    if (!projectId) {
      res.status(400).json({ success: false, message: 'projectId is required.' });
      return;
    }

    const buffer = await reportService.generateReportBuffer({ projectId, projectName, phaseIds, params });

    const safeName = (projectName || 'Report').replace(/[^a-z0-9]/gi, '_');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Report.docx"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) { next(err); }
};
