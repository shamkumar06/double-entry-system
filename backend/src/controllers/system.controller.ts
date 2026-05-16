import { Request, Response, NextFunction } from 'express';
import * as systemService from '../services/system.service';

export const listCategories = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.listCategories();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.createCategory(req.body);
    res.status(201).json({ success: true, data });
  } catch (err) { next(err); }
};

export const renameCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.renameCategory(req.params.id as string, req.body.name);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await systemService.deleteCategory(req.params.id as string);
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) { next(err); }
};

export const getSettings = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.getSettings();
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await systemService.updateSettings(req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};
