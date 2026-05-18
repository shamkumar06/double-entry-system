const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const categories = [
  // Assets
  { code: 1001, name: 'Cash', type: 'ASSET', isSystem: true, description: 'Cash in hand' },
  { code: 1002, name: 'Bank', type: 'ASSET', isSystem: true, description: 'Bank account funds' },
  { code: 1003, name: 'Equipment', type: 'ASSET', isSystem: true, description: 'Machinery and tools' },
  
  // Liabilities
  { code: 2001, name: 'Accounts Payable', type: 'LIABILITY', isSystem: true, description: 'Money owed to suppliers/creditors' },
  { code: 2002, name: 'Loans Payable', type: 'LIABILITY', isSystem: true, description: 'Borrowings and loans' },
  
  // Equity
  { code: 3001, name: 'Initial Funding', type: 'EQUITY', isSystem: true, description: 'Initial capital/funding injected' },
  { code: 3002, name: 'Retained Earnings', type: 'EQUITY', isSystem: true, description: 'Accumulated project balance' },
  
  // Revenue
  { code: 4001, name: 'Grants Received', type: 'REVENUE', isSystem: true, description: 'Funding or sponsorship grants' },
  { code: 4002, name: 'Project Income', type: 'REVENUE', isSystem: true, description: 'Revenue earned from project activities' },
  { code: 4003, name: 'Reallocated Fund', type: 'REVENUE', isSystem: true, description: 'Surplus funds reallocated from previous phases' },
  
  // Expenses
  { code: 5001, name: 'Transport Expense', type: 'EXPENSE', isSystem: true, description: 'Travel, freight and transport costs' },
  { code: 5002, name: 'Food Expense', type: 'EXPENSE', isSystem: true, description: 'Catering and food purchases' },
  { code: 5003, name: 'Materials Expense', type: 'EXPENSE', isSystem: true, description: 'Raw materials and component costs' },
  { code: 5004, name: 'Labour Expense', type: 'EXPENSE', isSystem: true, description: 'Wages and salaries' },
  { code: 5005, name: 'Utilities Expense', type: 'EXPENSE', isSystem: true, description: 'Rent, electricity and minor amenities' },
  { code: 5006, name: 'Settlement Amount', type: 'EXPENSE', isSystem: true, description: 'Unspent surplus returned to college management' }
];

async function main() {
  console.log("Seeding system account categories to Supabase...");
  for (const cat of categories) {
    try {
      const created = await prisma.accountCategory.upsert({
        where: { code: cat.code },
        update: {
          name: cat.name,
          type: cat.type,
          isSystem: cat.isSystem,
          description: cat.description
        },
        create: cat
      });
      console.log(`Upserted category: ${created.name} (${created.code}) [${created.type}]`);
    } catch (e) {
      console.error(`Failed to upsert ${cat.name}:`, e.message);
    }
  }
  console.log("Seeding complete! 🎉");
}

main().finally(() => prisma.$disconnect());
