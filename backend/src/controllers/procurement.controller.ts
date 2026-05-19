import { Request, Response } from 'express';
import * as procurementService from '../services/procurement.service';
import * as driveService from '../services/drive.service';

/**
 * Robustly sanitizes values that can be empty or the string "undefined"/"null" from React frontend FormData.
 */
function sanitizeStringOrNull(val: any): string | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '' || s === 'undefined' || s === 'null') return null;
  return s;
}

/**
 * Robustly parses decimals and filters out empty, "undefined", "null" or non-numeric strings, returning null instead of NaN.
 */
function sanitizeDecimalOrNull(val: any): number | null {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (s === '' || s === 'undefined' || s === 'null') return null;
  const parsed = parseFloat(s);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Lists all procurement items for a project
 */
export async function listProcurements(req: Request, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.projectId);
    const phaseId = req.query.phaseId ? String(req.query.phaseId) : null;

    const items = await procurementService.getProcurements(
      projectId,
      phaseId
    );
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to list procurement items' });
  }
}

/**
 * Creates a new procurement item with optional Google Drive photo upload
 */
export async function createProcurement(req: Request, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.projectId);
    const {
      phaseId,
      materialName,
      vendorName,
      quantity,
      unit,
      estimatedRate,
      actualRate,
      status,
      notes,
      cgst,
      sgst,
      igst,
      discount,
    } = req.body;

    if (!materialName || !quantity || !unit || !estimatedRate) {
      res.status(400).json({ message: 'Missing required procurement fields (materialName, quantity, unit, estimatedRate)' });
      return;
    }

    let driveFileId: string | null = null;
    let driveViewUrl: string | null = null;

    // Upload files to Google Drive folder if any were attached in the request
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const uploadRes = await driveService.createFolderAndUploadToDrive(
        String(materialName),
        req.files as Express.Multer.File[]
      );
      driveFileId = uploadRes.fileId;
      driveViewUrl = uploadRes.viewUrl;
    }

    const item = await procurementService.createProcurement({
      projectId,
      phaseId: sanitizeStringOrNull(phaseId),
      materialName: String(materialName),
      vendorName: sanitizeStringOrNull(vendorName),
      quantity: parseFloat(quantity),
      unit: String(unit),
      estimatedRate: parseFloat(estimatedRate),
      actualRate: sanitizeDecimalOrNull(actualRate),
      status: status || 'PLANNING',
      driveFileId,
      driveViewUrl,
      notes: sanitizeStringOrNull(notes),
      cgst: sanitizeDecimalOrNull(cgst),
      sgst: sanitizeDecimalOrNull(sgst),
      igst: sanitizeDecimalOrNull(igst),
      discount: sanitizeDecimalOrNull(discount),
    });

    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create procurement item' });
  }
}

/**
 * Updates an existing procurement item and updates its Google Drive photo if a new one is uploaded
 */
export async function updateProcurement(req: Request, res: Response): Promise<void> {
  try {
    const itemId = String(req.params.itemId);
    const {
      phaseId,
      materialName,
      vendorName,
      quantity,
      unit,
      estimatedRate,
      actualRate,
      status,
      notes,
      cgst,
      sgst,
      igst,
      discount,
    } = req.body;

    const existing = await procurementService.getProcurementById(itemId);
    if (!existing) {
      res.status(404).json({ message: 'Procurement item not found' });
      return;
    }

    let driveFileId = existing.driveFileId;
    let driveViewUrl = existing.driveViewUrl;

    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      const files = req.files as Express.Multer.File[];
      if (existing.driveFileId && !existing.driveFileId.startsWith('supabase:')) {
        // Folder already exists, append new files to it!
        const appendRes = await driveService.uploadToExistingFolder(
          existing.driveFileId,
          files,
          materialName ? String(materialName) : existing.materialName
        );
        if (appendRes && appendRes.fileId) {
          driveFileId = appendRes.fileId;
          driveViewUrl = appendRes.viewUrl;
        }
      } else {
        // Folder does not exist yet (or was previously empty), create a new one!
        const uploadRes = await driveService.createFolderAndUploadToDrive(
          materialName ? String(materialName) : existing.materialName,
          files
        );
        driveFileId = uploadRes.fileId;
        driveViewUrl = uploadRes.viewUrl;
      }
    }

    const updated = await procurementService.updateProcurement(itemId, {
      phaseId: phaseId !== undefined ? sanitizeStringOrNull(phaseId) : undefined,
      materialName: materialName ? String(materialName) : undefined,
      vendorName: vendorName !== undefined ? sanitizeStringOrNull(vendorName) : undefined,
      quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
      unit: unit ? String(unit) : undefined,
      estimatedRate: estimatedRate !== undefined ? parseFloat(estimatedRate) : undefined,
      actualRate: actualRate !== undefined ? sanitizeDecimalOrNull(actualRate) : undefined,
      status,
      driveFileId,
      driveViewUrl,
      notes: notes !== undefined ? sanitizeStringOrNull(notes) : undefined,
      cgst: cgst !== undefined ? sanitizeDecimalOrNull(cgst) : undefined,
      sgst: sgst !== undefined ? sanitizeDecimalOrNull(sgst) : undefined,
      igst: igst !== undefined ? sanitizeDecimalOrNull(igst) : undefined,
      discount: discount !== undefined ? sanitizeDecimalOrNull(discount) : undefined,
    });

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to update procurement item' });
  }
}

/**
 * Deletes a procurement item and deletes its associated photo from Google Drive
 */
export async function deleteProcurement(req: Request, res: Response): Promise<void> {
  try {
    const itemId = String(req.params.itemId);

    const existing = await procurementService.getProcurementById(itemId);
    if (!existing) {
      res.status(404).json({ message: 'Procurement item not found' });
      return;
    }

    // Delete photo from Google Drive
    if (existing.driveFileId) {
      await driveService.deleteFromDrive(existing.driveFileId);
    }

    await procurementService.deleteProcurement(itemId);
    res.json({ message: 'Procurement item and drive file deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to delete procurement item' });
  }
}

