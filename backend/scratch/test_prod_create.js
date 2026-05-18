const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-min-32-chars';
const projectId = "4d605221-fb53-4bad-ac0d-951435561387";

const token = jwt.sign(
  { id: "7731d280-d445-4b36-b710-f6e3e3f7c1bb", email: "sham8056071949@gmail.com", role: "ADMIN" },
  JWT_SECRET
);

async function testCreate() {
  console.log("Calling Render API `/projects/:projectId/phases` POST...");
  try {
    const res = await axios.post(
      `https://double-entry-backend.onrender.com/api/projects/${projectId}/phases`,
      {
        name: "Test Phase Prod",
        description: "Testing from script",
        estimatedBudget: 5000,
        receivedAmount: 2000,
        receivedFrom: "Funder X",
        receivedTo: "Entity Y",
        paymentMode: "Bank Transfer",
        reference: "TXN_PROD_123",
        requestLetterUrl: ""
      },
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );
    console.log("SUCCESS! Phase created:", res.data);
  } catch (err) {
    console.log("FAILED! Status code:", err.response?.status);
    console.log("Response Body:", JSON.stringify(err.response?.data, null, 2));
  }
}

testCreate();
