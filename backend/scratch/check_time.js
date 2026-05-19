const axios = require('axios');

async function checkTime() {
  try {
    const res = await axios.get('https://www.google.com');
    const googleHeaderDate = res.headers.date;
    if (!googleHeaderDate) {
      console.log('No date header returned from Google.');
      return;
    }
    const internetTime = new Date(googleHeaderDate).getTime();
    const localTime = Date.now();
    const diffSeconds = Math.abs(localTime - internetTime) / 1000;
    
    console.log('--- Time Synchronization Status ---');
    console.log('Local Time:   ', new Date(localTime).toISOString());
    console.log('Google Time:  ', new Date(internetTime).toISOString());
    console.log('Difference:   ', diffSeconds, 'seconds');
    
    if (diffSeconds > 180) {
      console.log('\n❌ ALERT: Your system clock is out of sync by more than 3 minutes!');
      console.log('Google API calls will ALWAYS fail with "Invalid JWT Signature" or "invalid_grant" if your system clock is skewed.');
      console.log('👉 Please synchronize your Windows System Clock with an internet time server.');
    } else {
      console.log('\n✅ Your system clock is perfectly synchronized with Google!');
    }
  } catch (err) {
    console.error('Failed to query Google headers:', err.message);
  }
}

checkTime();
