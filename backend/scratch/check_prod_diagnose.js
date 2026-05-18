const axios = require('axios');

async function checkDiagnose() {
  try {
    const res = await axios.get('https://double-entry-backend.onrender.com/api/diagnose');
    console.log('DIAGNOSE RESPONSE:', res.status);
    console.log(res.data);
  } catch (err) {
    if (err.response) {
      console.log('DIAGNOSE FAILED with status:', err.response.status);
      console.log('Response body:', err.response.data);
    } else {
      console.log('DIAGNOSE FAILED with error:', err.message);
    }
  }
}

checkDiagnose();
