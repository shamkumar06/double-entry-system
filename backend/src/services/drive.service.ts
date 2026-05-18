import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';
import fs from 'fs';

// Initialize Google Auth
let auth: any;

if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
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
  const KEY_PATH = path.join(__dirname, '../../google-service-account.json');
  const ROOT_KEY_PATH = path.join(__dirname, '../../../google-service-account.json');
  
  let selectedPath = '';
  if (fs.existsSync(KEY_PATH)) {
    selectedPath = KEY_PATH;
  } else if (fs.existsSync(ROOT_KEY_PATH)) {
    selectedPath = ROOT_KEY_PATH;
  }

  if (selectedPath) {
    auth = new google.auth.GoogleAuth({
      keyFile: selectedPath,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    console.log(`Google Auth initialized using keyFile at: ${selectedPath}`);
  } else {
    console.warn('Google Service Account key file not found in backend or project root.');
  }
}


const drive = auth ? google.drive({ version: 'v3', auth }) : null;


// Optional parent folder ID - can fall back to root of service account if not configured
// The user can configure this in Render env or .env, or we can upload directly
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || '';

/**
 * Uploads a buffer file to Google Drive under a shared folder
 * makes it public-readable so it can be previewed in the React application.
 */
export async function uploadToDrive(
  file: Express.Multer.File,
  customName?: string
): Promise<{ fileId: string; viewUrl: string }> {
  try {
    if (!drive) {
      throw new Error(
        "Google Drive credentials are not configured on Render. To fix this, please configure the 'GOOGLE_SERVICE_ACCOUNT_JSON' Environment Variable on Render (with the JSON content), or add 'backend/google-service-account.json' as a 'Secret File' in the Render Dashboard."
      );
    }

    const fileMetadata: any = {
      name: customName || `${Date.now()}-${file.originalname}`,
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

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error('No File ID returned from Google Drive API');
    }

    // Grant read permission to "anyone" so the direct link resolves in the browser
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });
    } catch (permErr: any) {
      console.warn('Could not set public permission on Google Drive file. Previews might fail:', permErr.message);
    }

    // Create a webContentLink or webViewLink. For direct image rendering in img src,
    // Google Drive direct export links are formatted as: https://drive.google.com/uc?export=view&id={fileId}
    const viewUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

    return {
      fileId,
      viewUrl,
    };
  } catch (error: any) {
    console.error('Google Drive Upload Service Error:', error);
    throw new Error(`Google Drive upload failed: ${error.message}`);
  }
}

/**
 * Deletes a file from Google Drive by its File ID
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  try {
    if (!drive) {
      console.warn("Google Drive credentials not configured, skipping file deletion for ID:", fileId);
      return;
    }
    await drive.files.delete({
      fileId: fileId,
    });
    console.log(`Successfully deleted file ${fileId} from Google Drive.`);
  } catch (error: any) {
    console.error(`Google Drive Service Delete Error for ${fileId}:`, error.message);
    // Soft fail so that DB row deletions don't get blocked if the file was manually removed in Drive
  }
}

