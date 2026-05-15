/**
 * Create owner user: davidtraversmailbox@gmail.com
 * 
 * Run with: npx tsx packages/database/prisma/create-owner.ts
 */
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'davidtraversmailbox@gmail.com';
  const password = 'admin123';
  
  console.log(`Creating owner user: ${email}`);
  
  // Hash the password
  const passwordHash = await hash(password, 10);
  
  // Check if user already exists
  const existing = await prisma.customer.findUnique({
    where: { email }
  });
  
  if (existing) {
    console.log('User already exists. Updating to owner role...');
    await prisma.customer.update({
      where: { email },
      data: { 
        role: 'owner',
        passwordHash,
        firstName: 'David',
        lastName: 'Admin'
      }
    });
    console.log('✅ Updated user to owner role');
  } else {
    // Create new owner user
    const user = await prisma.customer.create({
      data: {
        email,
        passwordHash,
        role: 'owner',
        firstName: 'David',
        lastName: 'Admin'
      }
    });
    console.log('✅ Created owner user:', user.email);
  }
  
  console.log('\nLogin credentials:');
  console.log('  Email:', email);
  console.log('  Password: admin123');
  console.log('  Role: owner');
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
