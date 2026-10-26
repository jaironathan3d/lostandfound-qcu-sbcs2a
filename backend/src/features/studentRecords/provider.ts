export type StudentRecordData = {
  studentNumber: string;
  fullName: string;
  course: string;
  classSchedule: string;
};

export interface StudentRecordsProvider {
  findByStudentNumber(studentNumber: string): Promise<StudentRecordData | null>;
}

export class MockStudentRecordsProvider implements StudentRecordsProvider {
  async findByStudentNumber(studentNumber: string): Promise<StudentRecordData | null> {
    void studentNumber;

    // TODO: Replace mock provider with university data source integration.
    return null;
  }
}
