const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Connecting to Prisma...');
    // Create bucket via raw supabase postgres storage API
    await prisma.$executeRawUnsafe(`insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true) on conflict do nothing;`);
    console.log('Bucket "receipts" successfully created or already exists!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
