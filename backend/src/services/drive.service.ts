import { google } from 'googleapis';
import { Readable } from 'stream';
import path from 'path';

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
  auth = new google.auth.GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  console.log('Google Auth initialized using local keyFile.');
}

const drive = google.drive({ version: 'v3', auth });


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
    await drive.files.delete({
      fileId: fileId,
    });
    console.log(`Successfully deleted file ${fileId} from Google Drive.`);
  } catch (error: any) {
    console.error(`Google Drive Service Delete Error for ${fileId}:`, error.message);
    // Soft fail so that DB row deletions don't get blocked if the file was manually removed in Drive
  }
}
