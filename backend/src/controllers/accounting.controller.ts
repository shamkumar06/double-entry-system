import { Request, Response, NextFunction } from 'express';
import * as accountingService from '../services/accounting.service';
import * as reportService from '../services/report.service';
import fs from 'fs';
import axios from 'axios';

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

    const folder = (req.query.folder as string) || 'receipts';
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    // Generate unique filename since memoryStorage does not populate req.file.filename
    const ext = req.file.originalname ? req.file.originalname.substring(req.file.originalname.lastIndexOf('.')) : '.png';
    const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    if (supabaseUrl && supabaseKey) {
      try {
        const fileBuffer = req.file.buffer;
        
        // Upload to Supabase Storage REST API inside specific subfolder
        await axios.post(
          `${supabaseUrl}/storage/v1/object/attachments/${folder}/${uniqueFilename}`,
          fileBuffer,
          {
            headers: {
              'apikey': supabaseKey,
              'Authorization': `Bearer ${supabaseKey}`,
              'Content-Type': req.file.mimetype,
            },
          }
        );

        // Return the absolute public URL of the uploaded asset in Supabase bucket
        const url = `${supabaseUrl}/storage/v1/object/public/attachments/${folder}/${uniqueFilename}`;
        res.json({ success: true, data: { url } });
        return;
      } catch (err: any) {
        const errorDetail = err.response?.data ? JSON.stringify(err.response.data) : (err.message || err);
        console.error('Supabase upload error, falling back to local storage:', errorDetail);
      }
    }

    // Fallback: For local dev, serve from /uploads
    try {
      const localPath = `${__dirname}/../../uploads/${uniqueFilename}`;
      fs.writeFileSync(localPath, req.file.buffer);
    } catch (writeErr) {
      console.warn('Failed to write local fallback file (expected on Vercel):', writeErr);
    }

    const url = `/uploads/${uniqueFilename}`;
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
