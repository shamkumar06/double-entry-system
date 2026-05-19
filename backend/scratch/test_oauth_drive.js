const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function testOAuthDrive() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log('--- OAuth Credentials Loaded ---');
  console.log('Client ID:    ', clientId ? 'Loaded ✅' : 'Missing ❌');
  console.log('Client Secret:', clientSecret ? 'Loaded ✅' : 'Missing ❌');
  console.log('Refresh Token:', refreshToken ? 'Loaded ✅' : 'Missing ❌');
  console.log('Folder ID:    ', folderId ? 'Loaded ✅' : 'Missing ❌');

  if (!clientId || !clientSecret || !refreshToken) {
    console.error('Missing required OAuth credentials in .env!');
    return;
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      'http://localhost:3000/oauth2callback'
    );
    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    console.log('\nTesting OAuth connection to Google Drive...');
    const res = await drive.about.get({
      fields: 'user(displayName, emailAddress)',
    });
    
    console.log('✅ SUCCESS! Successfully authenticated to Google Drive!');
    console.log('Connected User:', res.data.user.displayName, `(${res.data.user.emailAddress})`);
    
    if (folderId) {
      console.log(`\nVerifying accessibility of target folder ID: ${folderId}...`);
      try {
        const folderRes = await drive.files.get({
          fileId: folderId,
          fields: 'id, name, mimeType',
          supportsAllDrives: true,
        });
        console.log(`✅ Target folder is fully accessible! Folder name: "${folderRes.data.name}"`);
      } catch (fErr) {
        console.warn(`⚠️ Target folder ID not accessible: ${fErr.message}`);
      }
    }
  } catch (err) {
    console.error('❌ Failed to authenticate to Google Drive using OAuth!');
    console.error('Error:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testOAuthDrive();
