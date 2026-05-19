const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

async function testDrive() {
  const selectedPath = path.join(__dirname, '../google-service-account.json');
  if (!fs.existsSync(selectedPath)) {
    console.error('File google-service-account.json not found!');
    return;
  }

  console.log('Using service account file:', selectedPath);

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: selectedPath,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });

    const client = await auth.getClient();
    console.log('Client class:', client.constructor.name);
    
    console.log('Attempting to fetch an access token...');
    const tokenRes = await client.getAccessToken();
    console.log('✅ Access Token retrieved successfully!');
    console.log('Token starts with:', tokenRes.token ? tokenRes.token.substring(0, 15) : 'none');
  } catch (err) {
    console.error('❌ Failed to authenticate using Google Service Account!');
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', JSON.stringify(err.response.data, null, 2));
    }
  }
}

testDrive();
