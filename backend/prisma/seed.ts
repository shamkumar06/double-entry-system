import { PrismaClient, AccountType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  // Assets
  { code: 1001, name: 'Cash', type: AccountType.ASSET, isSystem: true },
  { code: 1002, name: 'Bank Account', type: AccountType.ASSET, isSystem: true },
  { code: 1003, name: 'Accounts Receivable', type: AccountType.ASSET, isSystem: true },
  { code: 1004, name: 'Prepaid Expenses', type: AccountType.ASSET, isSystem: true },

  // Liabilities
  { code: 2001, name: 'Accounts Payable', type: AccountType.LIABILITY, isSystem: true },
  { code: 2002, name: 'Loans Payable', type: AccountType.LIABILITY, isSystem: true },

  // Equity
  { code: 3001, name: 'Project Fund', type: AccountType.EQUITY, isSystem: true },

  // Revenue
  { code: 4001, name: 'Grant Income', type: AccountType.REVENUE, isSystem: true },
  { code: 4002, name: 'Contract Revenue', type: AccountType.REVENUE, isSystem: true },

  // Expenses
  { code: 5001, name: 'Materials & Supplies', type: AccountType.EXPENSE, isSystem: false },
  { code: 5002, name: 'Labour & Wages', type: AccountType.EXPENSE, isSystem: false },
  { code: 5003, name: 'Equipment Rental', type: AccountType.EXPENSE, isSystem: false },
  { code: 5004, name: 'Professional Services', type: AccountType.EXPENSE, isSystem: false },
  { code: 5005, name: 'Travel & Transport', type: AccountType.EXPENSE, isSystem: false },
  { code: 5006, name: 'Software & Licenses', type: AccountType.EXPENSE, isSystem: false },
  { code: 5007, name: 'Office Expenses', type: AccountType.EXPENSE, isSystem: false },
  { code: 5008, name: 'Miscellaneous', type: AccountType.EXPENSE, isSystem: false },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Seed default Chart of Accounts
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.accountCategory.upsert({
      where: { code: cat.code },
      update: { name: cat.name, type: cat.type },
      create: cat,
    });
  }
  console.log(`✅ Seeded ${DEFAULT_CATEGORIES.length} account categories`);

  // Create default Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@doublentry.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@12345';
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash,
      name: 'System Admin',
      role: 'ADMIN',
    },
  });
  console.log(`✅ Admin user ready: ${admin.email}`);

  // Default system settings
  const existing = await prisma.systemSettings.findFirst();
  if (!existing) {
    await prisma.systemSettings.create({
      data: {
        baseCurrency: 'INR',
        exchangeRateApiKey: process.env.EXCHANGE_RATE_API_KEY || '',
      },
    });
    console.log('✅ System settings initialized');
  }

  console.log('🎉 Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
