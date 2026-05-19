import { Request, Response } from 'express';
import * as procurementService from '../services/procurement.service';
import * as driveService from '../services/drive.service';

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
      phaseId: phaseId ? String(phaseId) : null,
      materialName: String(materialName),
      vendorName: vendorName ? String(vendorName) : null,
      quantity: parseFloat(quantity),
      unit: String(unit),
      estimatedRate: parseFloat(estimatedRate),
      actualRate: actualRate ? parseFloat(actualRate) : null,
      status: status || 'PLANNING',
      driveFileId,
      driveViewUrl,
      notes: notes ? String(notes) : null,
      cgst: cgst ? parseFloat(cgst) : null,
      sgst: sgst ? parseFloat(sgst) : null,
      igst: igst ? parseFloat(igst) : null,
      discount: discount ? parseFloat(discount) : null,
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
        await driveService.uploadToExistingFolder(existing.driveFileId, files);
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
      phaseId: phaseId !== undefined ? (phaseId ? String(phaseId) : null) : undefined,
      materialName: materialName ? String(materialName) : undefined,
      vendorName: vendorName !== undefined ? (vendorName ? String(vendorName) : null) : undefined,
      quantity: quantity !== undefined ? parseFloat(quantity) : undefined,
      unit: unit ? String(unit) : undefined,
      estimatedRate: estimatedRate !== undefined ? parseFloat(estimatedRate) : undefined,
      actualRate: actualRate !== undefined ? (actualRate ? parseFloat(actualRate) : null) : undefined,
      status,
      driveFileId,
      driveViewUrl,
      notes: notes !== undefined ? (notes ? String(notes) : null) : undefined,
      cgst: cgst !== undefined ? (cgst ? parseFloat(cgst) : null) : undefined,
      sgst: sgst !== undefined ? (sgst ? parseFloat(sgst) : null) : undefined,
      igst: igst !== undefined ? (igst ? parseFloat(igst) : null) : undefined,
      discount: discount !== undefined ? (discount ? parseFloat(discount) : null) : undefined,
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

