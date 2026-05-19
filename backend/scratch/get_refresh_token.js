const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const path = require('path');

// Automatically load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const PORT = 3000;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

async function getRefreshToken() {
  console.log('===================================================');
  console.log('🔑   Google Drive OAuth2 Refresh Token Generator   🔑');
  console.log('===================================================\n');
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';


  if (!clientId || !clientSecret) {
    console.error('\x1b[31mError: Missing Client ID or Client Secret.\x1b[0m');
    process.exit(1);
  }


  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // "offline" ensures we get a Refresh Token
    prompt: 'consent',     // "consent" forces consent screen so Google yields refresh token
    scope: ['https://www.googleapis.com/auth/drive'],
  });

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url.indexOf('/oauth2callback') > -1) {
        const qs = new url.URL(req.url, `http://localhost:${PORT}`).searchParams;
        const code = qs.get('code');
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px; background-color: #0f172a; color: #f8fafc;">
              <h1 style="color: #38bdf8;">🎉 Authentication Successful!</h1>
              <p style="font-size: 1.1rem; color: #94a3b8;">You can close this browser tab now and return to your VS Code terminal.</p>
            </body>
          </html>
        `);
        
        server.close();

        console.log('\nExchanging authorization code for tokens...');
        const { tokens } = await oauth2Client.getToken(code);
        
        console.log('\n==================================================');
        console.log('🔥 SUCCESS! CONFIGURE THESE RENDER ENVIRONMENT VARIABLES:');
        console.log('==================================================\n');
        console.log(`GOOGLE_CLIENT_ID=${clientId}`);
        console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('\n==================================================');
        process.exit(0);
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`<html><body><h1>Authentication Failed</h1><p>${e.message}</p></body></html>`);
      console.error('Error during code exchange:', e.message);
      process.exit(1);
    }
  }).listen(PORT, () => {
    console.log('1. Open this authorization URL in your browser:\n');
    console.log(`🔗 \x1b[36m${authUrl}\x1b[0m\n`);
    console.log('Waiting for authorization callback on port 3000...');
  });
}

getRefreshToken();
