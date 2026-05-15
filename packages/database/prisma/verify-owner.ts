import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  const user = await prisma.customer.findUnique({
    where: { email: 'davidtraversmailbox@gmail.com' },
    select: {
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      createdAt: true
    }
  });
  
  console.log('User Details:');
  console.log(JSON.stringify(user, null, 2));
  
  await prisma.$disconnect();
}

verify();
