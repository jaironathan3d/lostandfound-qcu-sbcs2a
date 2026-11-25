import { prisma } from '../../lib/prisma';

export type StudentRecordData = {
  studentNumber: string;
  fullName: string;
  course: string;
  yearLevel: string;
  universityEmail: string | null;
  isActive: boolean;
  classSchedule: string | null;
};

export interface StudentRecordsProvider {
  findByStudentNumber(studentNumber: string): Promise<StudentRecordData | null>;
}

export class MockStudentRecordsProvider implements StudentRecordsProvider {
  async findByStudentNumber(studentNumber: string): Promise<StudentRecordData | null> {
    const record = await prisma.studentRecord.findUnique({
      where: { studentNumber: studentNumber.trim() },
    });
    if (!record) return null;
    return {
      studentNumber: record.studentNumber,
      fullName: record.fullName,
      course: record.course,
      yearLevel: record.yearLevel,
      universityEmail: record.universityEmail,
      isActive: record.isActive,
      classSchedule: record.classSchedule,
    };
  }
}
