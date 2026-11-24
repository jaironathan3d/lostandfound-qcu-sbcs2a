import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { ReportType, UserRole } from '../src/generated/prisma/enums';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL must be configured before seeding.');
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

const categories = ['tumblers', 'cellphones', 'IDs', 'wallets', 'bags', 'keys', 'others'];

const TEST_PASSWORD = 'QcuTest!2026';

const usersByRole: Array<{ role: UserRole; email: string; fullName: string }> = [
  { role: UserRole.STUDENT, email: 'test-student-1@qcu.test', fullName: 'Test Student 1' },
  { role: UserRole.ADMIN, email: 'test-admin@qcu.test', fullName: 'Test Administrator' },
  { role: UserRole.SUPER_ADMIN, email: 'test-superadmin@qcu.test', fullName: 'Test Super Administrator' },
];

const run = async (): Promise<void> => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Fictional test data cannot be seeded in NODE_ENV=production.');
  }

  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  for (const user of usersByRole) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { passwordHash, fullName: user.fullName, role: user.role },
      create: {
        ...user,
        passwordHash,
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

  for (let i = 1; i <= 5; i += 1) {
    const studentNumber = `26-${String(i).padStart(4, '0')}`;
    const email = `test-student-${i}@qcu.test`;
    const conflictingRecord = await prisma.studentRecord.findUnique({ where: { universityEmail: email } });
    if (conflictingRecord && conflictingRecord.studentNumber !== studentNumber) {
      await prisma.studentRecord.update({
        where: { id: conflictingRecord.id },
        data: { universityEmail: null },
      });
    }
    await prisma.studentRecord.upsert({
      where: { studentNumber },
      update: {
        fullName: `Test Student ${i}`,
        course: i % 2 === 0 ? 'BSIT' : 'BSCS',
        yearLevel: `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Year`,
        universityEmail: `test-student-${i}@qcu.test`,
        isActive: true,
        classSchedule: i % 2 === 0 ? 'TTH 13:00-15:00' : 'MWF 08:00-10:00',
      },
      create: {
        studentNumber,
        fullName: `Test Student ${i}`,
        course: i % 2 === 0 ? 'BSIT' : 'BSCS',
        yearLevel: `${i}${i === 1 ? 'st' : i === 2 ? 'nd' : i === 3 ? 'rd' : 'th'} Year`,
        universityEmail: `test-student-${i}@qcu.test`,
        isActive: true,
        classSchedule: i % 2 === 0 ? 'TTH 13:00-15:00' : 'MWF 08:00-10:00',
      },
    });
  }

  const sampleStudent = await prisma.user.findUnique({ where: { email: 'test-student-1@qcu.test' } });
  const firstTestRecord = await prisma.studentRecord.findUnique({ where: { studentNumber: '26-0001' } });
  const existingStudentLink = sampleStudent
    ? await prisma.studentRecord.findUnique({ where: { userId: sampleStudent.id } })
    : null;
  if (sampleStudent && firstTestRecord && !firstTestRecord.userId && !existingStudentLink) {
    await prisma.studentRecord.update({
      where: { id: firstTestRecord.id },
      data: { userId: sampleStudent.id },
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
