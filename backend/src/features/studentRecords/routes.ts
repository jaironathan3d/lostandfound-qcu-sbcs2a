import { Router } from 'express';
import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { requireAuth } from '../../middlewares/requireAuth';
import { requireRoles } from '../../middlewares/requireRoles';

export const studentRecordsRouter = Router();

const requireStudentRecordAdmin = [
  requireAuth,
  requireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN),
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isText = (value: unknown, minLength: number, maxLength: number): value is string =>
  typeof value === 'string' && value.trim().length >= minLength && value.trim().length <= maxLength;

const normalizeQuery = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

studentRecordsRouter.get('/', ...requireStudentRecordAdmin, async (req, res) => {
  const query = normalizeQuery(req.query.q);
  const records = await prisma.studentRecord.findMany({
    where: query ? {
      OR: [
        { studentNumber: { contains: query, mode: 'insensitive' } },
        { fullName: { contains: query, mode: 'insensitive' } },
        { course: { contains: query, mode: 'insensitive' } },
        { yearLevel: { contains: query, mode: 'insensitive' } },
        { classSchedule: { contains: query, mode: 'insensitive' } },
        { universityEmail: { contains: query, mode: 'insensitive' } },
      ],
    } : undefined,
    include: { user: { select: { id: true, email: true, role: true } } },
    orderBy: { studentNumber: 'asc' },
  });
  res.json(records.map((record) => ({
    id: record.id,
    studentNumber: record.studentNumber,
    fullName: record.fullName,
    course: record.course,
    yearLevel: record.yearLevel,
    universityEmail: record.universityEmail,
    isActive: record.isActive,
    classSchedule: record.classSchedule,
    linkedUser: record.user,
  })));
});

studentRecordsRouter.post('/', ...requireStudentRecordAdmin, async (req, res) => {
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Please provide the student record details.' });
    return;
  }
  const { studentNumber, fullName, course, yearLevel, universityEmail, classSchedule, isActive } = req.body;
  if (
    typeof studentNumber !== 'string'
    || !/^\d{2}-\d{4}$/.test(studentNumber.trim())
    || !isText(fullName, 2, 100)
    || !isText(course, 2, 100)
    || !isText(yearLevel, 1, 30)
    || !isText(universityEmail, 3, 254)
    || (classSchedule !== undefined && classSchedule !== null && !isText(classSchedule, 2, 200))
    || (isActive !== undefined && typeof isActive !== 'boolean')
  ) {
    res.status(400).json({ message: 'Please provide valid student number, name, course, and schedule details.' });
    return;
  }
  try {
    const record = await prisma.studentRecord.create({
      data: {
        studentNumber: studentNumber.trim(),
        fullName: fullName.trim(),
        course: course.trim(),
        yearLevel: yearLevel.trim(),
        universityEmail: universityEmail.trim().toLowerCase(),
        isActive: typeof isActive === 'boolean' ? isActive : true,
        classSchedule: typeof classSchedule === 'string' ? classSchedule.trim() : null,
      },
    });
    res.status(201).json(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'A student record with that student number already exists.' });
      return;
    }
    throw error;
  }
});

studentRecordsRouter.post('/import', ...requireStudentRecordAdmin, async (req, res) => {
  if (!isRecord(req.body) || typeof req.body.csv !== 'string') {
    res.status(400).json({ message: 'Provide CSV text containing student records.' });
    return;
  }
  const lines = req.body.csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length < 2) {
    res.status(400).json({ message: 'The CSV must include a header and at least one student record.' });
    return;
  }
  const header = lines.shift()!.split(',').map((value) => value.trim().toLowerCase());
  const expected = ['studentnumber', 'fullname', 'course', 'yearlevel', 'universityemail', 'classschedule'];
  if (expected.some((name) => !header.includes(name))) {
    res.status(400).json({ message: 'CSV headers must include studentNumber, fullName, course, yearLevel, universityEmail, and classSchedule.' });
    return;
  }
  const index = (name: string) => header.indexOf(name);
  let created = 0;
  let skipped = 0;
  for (const line of lines) {
    const values = line.split(',').map((value) => value.trim());
    const record = {
      studentNumber: values[index('studentnumber')],
      fullName: values[index('fullname')],
      course: values[index('course')],
      yearLevel: values[index('yearlevel')],
      universityEmail: values[index('universityemail')],
      classSchedule: values[index('classschedule')],
    };
    if (!record.studentNumber || !record.fullName || !record.course || !record.yearLevel || !record.universityEmail || !record.classSchedule) {
      skipped += 1;
      continue;
    }
    try {
      await prisma.studentRecord.upsert({
        where: { studentNumber: record.studentNumber },
        update: {
          fullName: record.fullName,
          course: record.course,
          yearLevel: record.yearLevel,
          universityEmail: record.universityEmail.toLowerCase(),
          classSchedule: record.classSchedule,
        },
        create: {
          ...record,
          universityEmail: record.universityEmail.toLowerCase(),
          isActive: true,
        },
      });
      created += 1;
    } catch {
      skipped += 1;
    }
  }
  res.json({ created, skipped });
});

studentRecordsRouter.patch('/:recordId', ...requireStudentRecordAdmin, async (req, res) => {
  const recordId = typeof req.params.recordId === 'string' ? req.params.recordId : '';
  if (!recordId) {
    res.status(400).json({ message: 'A valid student record ID is required.' });
    return;
  }
  if (!isRecord(req.body)) {
    res.status(400).json({ message: 'Please provide the student record details.' });
    return;
  }
  const { studentNumber, fullName, course, yearLevel, universityEmail, classSchedule, isActive } = req.body;
  if (
    typeof studentNumber !== 'string'
    || !/^\d{2}-\d{4}$/.test(studentNumber.trim())
    || !isText(fullName, 2, 100)
    || !isText(course, 2, 100)
    || !isText(yearLevel, 1, 30)
    || !isText(universityEmail, 3, 254)
    || (classSchedule !== undefined && classSchedule !== null && !isText(classSchedule, 2, 200))
    || (isActive !== undefined && typeof isActive !== 'boolean')
  ) {
    res.status(400).json({ message: 'Please provide valid student number, name, course, and schedule details.' });
    return;
  }
  try {
    const record = await prisma.studentRecord.update({
      where: { id: recordId },
      data: {
        studentNumber: studentNumber.trim(),
        fullName: fullName.trim(),
        course: course.trim(),
        yearLevel: yearLevel.trim(),
        universityEmail: universityEmail.trim().toLowerCase(),
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
        classSchedule: typeof classSchedule === 'string' ? classSchedule.trim() : null,
      },
    });
    res.json(record);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      res.status(409).json({ message: 'A student record with that student number already exists.' });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      res.status(404).json({ message: 'Student record not found.' });
      return;
    }
    throw error;
  }
});

studentRecordsRouter.delete('/:recordId', ...requireStudentRecordAdmin, async (req, res) => {
  const recordId = typeof req.params.recordId === 'string' ? req.params.recordId : '';
  if (!recordId) {
    res.status(400).json({ message: 'A valid student record ID is required.' });
    return;
  }
  const record = await prisma.studentRecord.findUnique({
    where: { id: recordId },
    select: { userId: true },
  });
  if (!record) {
    res.status(404).json({ message: 'Student record not found.' });
    return;
  }
  if (record.userId) {
    res.status(409).json({ message: 'Unlink the student account before deleting this record.' });
    return;
  }
  await prisma.studentRecord.delete({ where: { id: recordId } });
  res.status(204).end();
});
