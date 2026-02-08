import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'info@cervak.com';
  const adminUsername = process.env.ADMIN_USERNAME || 'info@cervak.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'cervak';

  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.administrator.upsert({
    where: { emailAddress: adminEmail },
    update: {},
    create: {
      username: adminUsername,
      emailAddress: adminEmail,
      password: hashedPassword,
      enabled: true,
    },
  });

  console.log('✅ Administrator created/updated:', {
    id: admin.id,
    username: admin.username,
    emailAddress: admin.emailAddress,
  });
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
