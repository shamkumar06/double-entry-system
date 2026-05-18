const axios = require('axios');

async function test() {
  console.log("Pinging Render backend...");
  try {
    const res = await axios.get("https://double-entry-backend.onrender.com/api/health");
    console.log("Response:", res.data);
  } catch (err) {
    console.error("Error pinging:", err.message);
  }
}

test();
