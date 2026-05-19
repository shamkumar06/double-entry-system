import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

// Initialize Google Auth
let auth: any;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/oauth2callback'
    );
    oauth2Client.setCredentials({
      refresh_token: GOOGLE_REFRESH_TOKEN,
    });
    auth = oauth2Client;
    console.log('Google Auth initialized successfully using OAuth 2.0 User Refresh Token.');
  } catch (err: any) {
    console.error('Failed to initialize OAuth 2.0 client:', err.message);
  }
}

if (!auth && process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    console.log('Google Auth initialized successfully using GOOGLE_SERVICE_ACCOUNT_JSON environment variable.');
  } catch (err: any) {
    console.error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON env variable, falling back to keyFile:', err.message);
  }
}


if (!auth) {
  const pathsToCheck = [
    path.join(__dirname, '../../google-service-account.json'),
    path.join(__dirname, '../../../google-service-account.json'),
    path.join(process.cwd(), 'google-service-account.json'),
    path.join(process.cwd(), '../google-service-account.json'),
    path.join(process.cwd(), 'backend/google-service-account.json'),
    '/opt/render/project/src/google-service-account.json',
    '/opt/render/project/src/backend/google-service-account.json'
  ];

  let selectedPath = '';
  for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
      selectedPath = p;
      break;
    }
  }

  if (selectedPath) {
    auth = new google.auth.GoogleAuth({
      keyFile: selectedPath,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    console.log(`Google Auth initialized using keyFile at: ${selectedPath}`);
  } else {
    console.warn('Google Service Account key file not found in any checked paths:', pathsToCheck);
  }
}



const drive = auth ? google.drive({ version: 'v3', auth }) : null;


// Optional parent folder ID - can fall back to root of service account if not configured
// The user can configure this in Render env or .env, or we can upload directly
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

/**
 * Uploads a buffer file to Google Drive under a shared folder
 * makes it public-readable so it can be previewed in the React application.
 * Falls back automatically to Supabase Storage if Google Drive fails or hits quota limits.
 */
export async function uploadToDrive(
  file: Express.Multer.File,
  customName?: string
): Promise<{ fileId: string; viewUrl: string }> {
  const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '.png';
  const uniqueFilename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  // Helper function to handle Supabase Storage fallback
  const handleSupabaseFallback = async (reason: string) => {
    console.warn(`Redirecting upload to Supabase Storage due to: ${reason}`);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(`Upload failed. Google Drive failed (${reason}) and Supabase Storage credentials are not configured.`);
    }

    const folder = 'procurement';
    const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/${folder}/${uniqueFilename}`;

    const axios = require('axios');
    await axios.post(uploadUrl, file.buffer, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': file.mimetype,
      },
    });

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/attachments/${folder}/${uniqueFilename}`;
    return {
      fileId: `supabase:${folder}/${uniqueFilename}`,
      viewUrl: publicUrl
    };
  };

  // If Google Drive is not configured, fall back immediately to Supabase
  if (!drive) {
    return handleSupabaseFallback("Google Drive credentials not configured");
  }

  try {
    const fileMetadata: any = {
      name: customName || uniqueFilename,
    };

    // If folder ID exists, store inside that folder
    if (FOLDER_ID) {
      fileMetadata.parents = [FOLDER_ID];
    }

    // Convert file buffer to readable stream
    const bufferStream = new Readable();
    bufferStream.push(file.buffer);
    bufferStream.push(null);

    const media = {
      mimeType: file.mimetype,
      body: bufferStream,
    };

    let response;
    try {
      response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id, webViewLink, webContentLink',
        supportsAllDrives: true, // Enable Shared Drive support
      } as any);
    } catch (createErr: any) {
      // Catch Google quota/auth failure and redirect gracefully to Supabase Storage!
      console.warn("Google Drive upload API call failed. Bypassing to Supabase Storage...");
      return handleSupabaseFallback(createErr.message);
    }

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error('No File ID returned from Google Drive API');
    }

    // Optional: Transfer ownership of the file to a real user Gmail if provided
    const ownerEmail = process.env.GOOGLE_DRIVE_OWNER_EMAIL;
    if (ownerEmail) {
      try {
        await drive.permissions.create({
          fileId: fileId,
          transferOwnership: true,
          requestBody: {
            role: 'owner',
            type: 'user',
            emailAddress: ownerEmail,
          },
          supportsAllDrives: true,
        } as any);
        console.log(`Successfully transferred ownership of file ${fileId} to: ${ownerEmail}`);
      } catch (ownErr: any) {
        console.warn(`Could not transfer ownership of file to ${ownerEmail}. Continuing as viewer permission... Error:`, ownErr.message);
      }
    }

    // Grant read permission to "anyone" so the direct link resolves in the browser
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true, // Enable Shared Drive support
      } as any);
    } catch (permErr: any) {
      console.warn('Could not set public permission on Google Drive file. Previews might fail:', permErr.message);
    }

    const viewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return {
      fileId,
      viewUrl,
    };
  } catch (error: any) {
    console.error('Google Drive Upload Service Error, attempting final Supabase fallback:', error.message);
    try {
      return await handleSupabaseFallback(error.message);
    } catch (fallbackErr: any) {
      throw new Error(`Both Google Drive and Supabase Storage failed. Final error: ${fallbackErr.message}`);
    }
  }
}

/**
 * Deletes a file from Google Drive or Supabase Storage by its File ID
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  try {
    if (fileId && fileId.startsWith('supabase:')) {
      const path = fileId.replace('supabase:', '');
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseKey) return;

      const axios = require('axios');
      const deleteUrl = `${supabaseUrl}/storage/v1/object/attachments/${path}`;
      await axios.delete(deleteUrl, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      console.log(`Successfully deleted file ${path} from Supabase Storage.`);
      return;
    }

    if (!drive) {
      console.warn("Google Drive credentials not configured, skipping file deletion for ID:", fileId);
      return;
    }
    await drive.files.delete({
      fileId: fileId,
      supportsAllDrives: true,
    } as any);

    console.log(`Successfully deleted file ${fileId} from Google Drive.`);
  } catch (error: any) {
    console.error(`Google Drive Service Delete Error for ${fileId}:`, error.message);
    // Soft fail so that DB row deletions don't get blocked if the file was manually removed in Drive
  }
}

/**
 * Creates a subfolder in Google Drive named after the materialName,
 * uploads multiple files inside it renamed as image-1, image-2, etc.,
 * and returns the folder's ID and web view link.
 * Falls back automatically to Supabase Storage if Google Drive fails.
 */
export async function createFolderAndUploadToDrive(
  materialName: string,
  files: Express.Multer.File[]
): Promise<{ fileId: string; viewUrl: string }> {
  const handleSupabaseFallback = async (reason: string) => {
    console.warn(`createFolderAndUploadToDrive: Falling back to Supabase Storage due to: ${reason}`);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(`Upload failed. Google Drive failed (${reason}) and Supabase Storage credentials are not configured.`);
    }

    const folderSlug = `${Date.now()}-${materialName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    let firstFileUrl = '';

    const axios = require('axios');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '.png';
      const fileName = `image-${i + 1}${ext}`;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/procurement/${folderSlug}/${fileName}`;

      await axios.post(uploadUrl, file.buffer, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': file.mimetype,
        },
      });

      if (i === 0) {
        firstFileUrl = `${supabaseUrl}/storage/v1/object/public/attachments/procurement/${folderSlug}/${fileName}`;
      }
    }

    return {
      fileId: `supabase:procurement/${folderSlug}`,
      viewUrl: firstFileUrl || `https://supabase.com`,
    };
  };

  if (!drive) {
    return handleSupabaseFallback("Google Drive credentials not configured");
  }

  try {
    // 1. Create the subfolder under GOOGLE_DRIVE_FOLDER_ID
    const folderMetadata: any = {
      name: materialName,
      mimeType: 'application/vnd.google-apps.folder',
    };

    if (FOLDER_ID) {
      folderMetadata.parents = [FOLDER_ID];
    }

    const folderResponse = await drive.files.create({
      requestBody: folderMetadata,
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    } as any);

    const folderId = folderResponse.data.id;
    const folderViewUrl = folderResponse.data.webViewLink;

    if (!folderId) {
      throw new Error('Failed to create folder in Google Drive');
    }

    // Grant read permission to the folder so anyone can view its contents
    try {
      await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
        supportsAllDrives: true,
      } as any);
    } catch (permErr: any) {
      console.warn('Could not set public permission on Google Drive folder:', permErr.message);
    }

    // 2. Upload each file into the newly created folder
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '.png';
      const fileName = `image-${i + 1}${ext}`;

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const media = {
        mimeType: file.mimetype,
        body: bufferStream,
      };

      const fileResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
        supportsAllDrives: true,
      } as any);

      const fileId = fileResponse.data.id;

      // Make the individual file public-readable too
      if (fileId) {
        try {
          await drive.permissions.create({
            fileId: fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
            supportsAllDrives: true,
          } as any);
        } catch (permErr: any) {
          console.warn(`Could not set public permission on file ${fileName}:`, permErr.message);
        }
      }
    }

    return {
      fileId: folderId,
      viewUrl: folderViewUrl || `https://drive.google.com/drive/folders/${folderId}`,
    };
  } catch (error: any) {
    console.error('Google Drive Folder & Files Upload Error, falling back to Supabase:', error.message);
    return handleSupabaseFallback(error.message);
  }
}

/**
 * Uploads multiple files into an existing Google Drive folder.
 * Falls back to Supabase Storage if Google Drive fails or if the folder is in Supabase.
 */
export async function uploadToExistingFolder(
  folderId: string,
  files: Express.Multer.File[],
  materialNameFallback?: string
): Promise<{ fileId: string; viewUrl: string } | void> {
  const handleSupabaseFallback = async (reason: string) => {
    console.warn(`uploadToExistingFolder: Falling back to Supabase Storage due to: ${reason}`);
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error(`Upload failed. Google Drive failed (${reason}) and Supabase Storage credentials are not configured.`);
    }

    const folderSlug = `${Date.now()}-${(materialNameFallback || 'material').replace(/[^a-zA-Z0-9]/g, '_')}`;
    let firstFileUrl = '';

    const axios = require('axios');
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '.png';
      const fileName = `image-${i + 1}${ext}`;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/procurement/${folderSlug}/${fileName}`;

      await axios.post(uploadUrl, file.buffer, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': file.mimetype,
        },
      });

      if (i === 0) {
        firstFileUrl = `${supabaseUrl}/storage/v1/object/public/attachments/procurement/${folderSlug}/${fileName}`;
      }
    }

    return {
      fileId: `supabase:procurement/${folderSlug}`,
      viewUrl: firstFileUrl || `https://supabase.com`,
    };
  };

  // If already stored in Supabase Storage
  if (folderId && folderId.startsWith('supabase:')) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Supabase Storage credentials not configured");
    }

    const folderSlug = folderId.replace('supabase:procurement/', '');
    const axios = require('axios');

    let nextIndex = 1;
    try {
      const listUrl = `${supabaseUrl}/storage/v1/object/list/attachments`;
      const listRes = await axios.post(listUrl, {
        prefix: `procurement/${folderSlug}`
      }, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      });
      const existingNames = listRes.data?.map((f: any) => f.name || '') || [];
      existingNames.forEach((name: string) => {
        const match = name.match(/image-(\d+)/);
        if (match) {
          const num = parseInt(match[1]);
          if (num >= nextIndex) {
            nextIndex = num + 1;
          }
        }
      });
    } catch (listErr: any) {
      console.warn("Failed to list existing Supabase files, defaulting to index fallback:", listErr.message);
      nextIndex = Date.now();
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '.png';
      const fileName = `image-${nextIndex + i}${ext}`;
      const uploadUrl = `${supabaseUrl}/storage/v1/object/attachments/procurement/${folderSlug}/${fileName}`;

      await axios.post(uploadUrl, file.buffer, {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': file.mimetype,
        },
      });
    }
    return;
  }

  if (!drive) {
    return handleSupabaseFallback("Google Drive credentials not configured");
  }

  try {
    // Get existing files in the folder to determine next index (e.g. image-3, image-4)
    const listResponse = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(name)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    } as any);

    const existingNames = listResponse.data.files?.map(f => f.name || '') || [];
    let startIndex = 0;
    
    // Find the highest image number to continue from
    existingNames.forEach(name => {
      const match = name.match(/image-(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > startIndex) {
          startIndex = num;
        }
      }
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.originalname ? file.originalname.substring(file.originalname.lastIndexOf('.')) : '.png';
      const fileName = `image-${startIndex + i + 1}${ext}`;

      const fileMetadata = {
        name: fileName,
        parents: [folderId],
      };

      const bufferStream = new Readable();
      bufferStream.push(file.buffer);
      bufferStream.push(null);

      const media = {
        mimeType: file.mimetype,
        body: bufferStream,
      };

      const fileResponse = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
        supportsAllDrives: true,
      } as any);

      const fileId = fileResponse.data.id;

      if (fileId) {
        try {
          await drive.permissions.create({
            fileId: fileId,
            requestBody: {
              role: 'reader',
              type: 'anyone',
            },
            supportsAllDrives: true,
          } as any);
        } catch (permErr: any) {
          console.warn(`Could not set public permission on file ${fileName}:`, permErr.message);
        }
      }
    }
  } catch (error: any) {
    console.error('Google Drive upload to existing folder error, migrating/falling back to Supabase:', error.message);
    return handleSupabaseFallback(error.message);
  }
}



