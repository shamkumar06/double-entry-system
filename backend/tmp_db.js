const { Client } = require('pg');

async function test() {
  const connectionString = "postgresql://postgres:sham8056071949@db.tzmhbmsltzxiuycdgjcr.supabase.co:5432/postgres";
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false } // Allows self-signed certs
  });
  
  try {
    await client.connect();
    const res = await client.query('SELECT id, description, "projectId", "phaseId", "isDeleted" FROM "Transaction"');
    console.log("TRANSACTIONS:", res.rows);
    
    const phases = await client.query('SELECT id, name, "projectId", "estimatedBudget" FROM "Phase"');
    console.log("PHASES:", phases.rows);
    
    const lines = await client.query('SELECT id, "transactionId", type, amount, "accountId" FROM "TransactionLine"');
    console.log("LINES:", lines.rows);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await client.end();
  }
}
test().catch(console.error);
