const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-min-32-chars';
const projectId = "4d605221-fb53-4bad-ac0d-951435561387";

const token = jwt.sign(
  { id: "7731d280-d445-4b36-b710-f6e3e3f7c1bb", email: "sham8056071949@gmail.com", role: "ADMIN" },
  JWT_SECRET
);

async function fetchPhases() {
  console.log("Calling Render API `/projects/:projectId/phases` with token...");
  try {
    const res = await axios.get(
      `https://double-entry-backend.onrender.com/api/projects/${projectId}/phases`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log("Production Response Data:", JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error("Error fetching phases:", err.response?.data || err.message);
  }
}

fetchPhases();
