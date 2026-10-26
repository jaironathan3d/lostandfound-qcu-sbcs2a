import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const categories = ['tumblers', 'cellphones', 'IDs', 'wallets', 'bags', 'keys', 'others'];

const usersByRole: Array<{ role: UserRole; email: string; fullName: string }> = [
  { role: UserRole.STUDENT, email: 'student@example.com', fullName: 'Sample Student' },
  { role: UserRole.PROFESSOR, email: 'professor@example.com', fullName: 'Sample Professor' },
  { role: UserRole.STAFF, email: 'staff@example.com', fullName: 'Sample Staff' },
  {
    role: UserRole.SECURITY_GUARD,
    email: 'guard@example.com',
    fullName: 'Sample Security Guard',
  },
  { role: UserRole.ADMIN, email: 'admin@example.com', fullName: 'Sample Admin' },
  { role: UserRole.SUPERADMIN, email: 'superadmin@example.com', fullName: 'Sample Superadmin' },
];

const run = async (): Promise<void> => {
  for (const user of usersByRole) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        ...user,
        passwordHash: 'TODO_SET_HASH',
      },
    });
  }

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category },
      update: {},
      create: { name: category },
    });
  }

  for (let i = 1; i <= 20; i += 1) {
    const studentNumber = `2026-${String(i).padStart(4, '0')}`;
    await prisma.studentRecord.upsert({
      where: { studentNumber },
      update: {},
      create: {
        studentNumber,
        fullName: `Mock Student ${i}`,
        course: i % 2 === 0 ? 'BSCS' : 'BSIT',
        classSchedule: i % 2 === 0 ? 'MWF 08:00-10:00' : 'TTH 13:00-15:00',
      },
    });
  }
};

run()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
