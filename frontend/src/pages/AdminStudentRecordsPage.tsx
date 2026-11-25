import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest } from '../lib/apiClient';
import './AdminDashboardPage.css';

type LinkedUser = { id: string; email: string; role: string } | null;
type StudentRecord = {
  id: string;
  studentNumber: string;
  fullName: string;
  course: string;
  yearLevel: string;
  universityEmail: string | null;
  isActive: boolean;
  classSchedule: string;
  linkedUser: LinkedUser;
};

const emptyForm = {
  studentNumber: '',
  fullName: '',
  course: '',
  yearLevel: '',
  universityEmail: '',
  isActive: true,
  classSchedule: '',
};

export const AdminStudentRecordsPage = () => {
  const [records, setRecords] = useState<StudentRecord[]>([]);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const loadRecords = useCallback(async (search = '') => {
    setIsLoading(true);
    setError('');
    try {
      const suffix = search.trim() ? `?q=${encodeURIComponent(search.trim())}` : '';
      setRecords(await apiRequest<StudentRecord[]>(`/student-records${suffix}`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Student records could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords]);

  const resetForm = () => {
    setEditingId('');
    setForm(emptyForm);
  };

  const submitRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusyId(editingId || 'new');
    setError('');
    setNotice('');
    try {
      if (editingId) {
        await apiRequest(`/student-records/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        setNotice('Student record updated.');
      } else {
        await apiRequest('/student-records', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        setNotice('Student record created.');
      }
      resetForm();
      await loadRecords(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The student record could not be saved.');
    } finally {
      setBusyId('');
    }
  };

  const editRecord = (record: StudentRecord) => {
    setEditingId(record.id);
    setForm({
      studentNumber: record.studentNumber,
      fullName: record.fullName,
      course: record.course,
      yearLevel: record.yearLevel,
      universityEmail: record.universityEmail ?? '',
      isActive: record.isActive,
      classSchedule: record.classSchedule,
    });
  };

  const deleteRecord = async (record: StudentRecord) => {
    if (!window.confirm(`Delete the record for ${record.fullName}?`)) return;
    setBusyId(record.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/student-records/${record.id}`, { method: 'DELETE' });
      setNotice('Student record deleted.');
      if (editingId === record.id) resetForm();
      await loadRecords(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The student record could not be deleted.');
    } finally {
      setBusyId('');
    }
  };

  const importCsv = async (file: File) => {
    setIsImporting(true);
    setError('');
    setNotice('');
    try {
      const csv = await file.text();
      const result = await apiRequest<{ created: number; skipped: number }>('/student-records/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setNotice(`CSV import complete: ${result.created} imported or updated, ${result.skipped} skipped.`);
      await loadRecords(query);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The CSV could not be imported.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="admin-page">
      <PublicHeader />
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">QCU LOST &amp; FOUND · ADMIN</p>
            <h1>Student records</h1>
            <p>Create and maintain the fictional CCS student database used for account validation.</p>
          </div>
          <Link to="/admin-dashboard">Back to administration ↗</Link>
        </header>
        <nav className="admin-view-links" aria-label="Administrator sections">
          <Link className="admin-view-link" to="/admin-dashboard">Claim review</Link>
          <Link className="admin-view-link" to="/admin-dashboard/reports">Item report moderation</Link>
          <Link className="admin-view-link" to="/admin-dashboard/matches">Lost-item matches</Link>
          <Link className="admin-view-link" to="/admin-dashboard/conversations">Conversation safety</Link>
          <Link className="admin-view-link" to="/admin-dashboard/vault">Vault &amp; handover</Link>
          <Link className="admin-view-link admin-view-link--active" to="/admin-dashboard/students">Student records</Link>
        </nav>

        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}

        <section className="admin-claim">
          <header className="admin-claim__header">
            <div>
              <span className="admin-status admin-status--pending">{editingId ? 'Editing' : 'New record'}</span>
              <h3>{editingId ? 'Update student record' : 'Add student record'}</h3>
            </div>
            {editingId && <button type="button" className="admin-reject" onClick={resetForm}>Cancel</button>}
          </header>
          <form className="messages-compose" onSubmit={submitRecord}>
            <label htmlFor="student-number">Student number</label>
            <input id="student-number" required minLength={7} maxLength={7} pattern="[0-9]{2}-[0-9]{4}" value={form.studentNumber} onChange={(event) => setForm({ ...form, studentNumber: event.target.value })} placeholder="24-1234" />
            <label htmlFor="student-name">Full name</label>
            <input id="student-name" required minLength={2} maxLength={100} value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} />
            <label htmlFor="student-course">Course</label>
            <input id="student-course" required minLength={2} maxLength={100} value={form.course} onChange={(event) => setForm({ ...form, course: event.target.value })} placeholder="BSCS" />
            <label htmlFor="student-year">Year level</label>
            <input id="student-year" required minLength={1} maxLength={30} value={form.yearLevel} onChange={(event) => setForm({ ...form, yearLevel: event.target.value })} placeholder="2nd Year" />
            <label htmlFor="student-email">University email</label>
            <input id="student-email" type="email" required maxLength={254} value={form.universityEmail} onChange={(event) => setForm({ ...form, universityEmail: event.target.value })} placeholder="student@qcu.edu.ph" />
            <label htmlFor="student-schedule">Class schedule</label>
            <input id="student-schedule" minLength={2} maxLength={200} value={form.classSchedule} onChange={(event) => setForm({ ...form, classSchedule: event.target.value })} placeholder="Optional or irregular schedule" />
            <label htmlFor="student-active"><input id="student-active" type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active for registration</label>
            <button type="submit" className="admin-approve" disabled={busyId !== ''}>
              {busyId === 'new' || busyId === editingId ? 'Saving…' : editingId ? 'Save changes' : 'Create record'}
            </button>
          </form>
        </section>

        <div className="admin-claims-heading">
          <h2>Student database</h2>
          <label className="admin-approve">
            {isImporting ? 'Importing…' : 'Import CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              disabled={isImporting}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importCsv(file);
                event.currentTarget.value = '';
              }}
              hidden
            />
          </label>
          <button type="button" onClick={() => void loadRecords(query)} disabled={isLoading}>{isLoading ? 'Searching…' : 'Refresh'}</button>
        </div>
        <form className="browse-search" onSubmit={(event) => { event.preventDefault(); void loadRecords(query); }}>
          <label className="browse-search__input">
            <span aria-hidden="true">⌕</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search number, name, course, or schedule" />
          </label>
          <button type="submit" className="browse-search__button">Search records</button>
        </form>
        {isLoading ? <p className="admin-empty">Loading student records…</p>
          : records.length === 0 ? <p className="admin-empty">No student records found.</p>
            : <div className="admin-claim-list">
              {records.map((record) => (
                <article className="admin-claim" key={record.id}>
                  <header className="admin-claim__header">
                    <div>
                      <span className={record.isActive ? 'admin-status admin-status--pending' : 'admin-status admin-status--rejected'}>
                        {record.isActive ? record.studentNumber : `${record.studentNumber} · inactive`}
                      </span>
                      <h3>{record.fullName}</h3>
                      <p>{record.course} · {record.yearLevel} · {record.classSchedule}</p>
                    </div>
                    <time>{record.linkedUser ? `Linked: ${record.linkedUser.email}` : 'Not linked'}</time>
                  </header>
                  <footer className="admin-claim__actions">
                    <p>{record.linkedUser ? `Account role: ${record.linkedUser.role}` : 'Available for student registration'}</p>
                    <div>
                      <button type="button" className="admin-reject" disabled={busyId === record.id} onClick={() => void deleteRecord(record)}>Delete</button>
                      <button type="button" className="admin-approve" disabled={busyId === record.id} onClick={() => editRecord(record)}>Edit</button>
                    </div>
                  </footer>
                </article>
              ))}
            </div>}
      </main>
      <PublicFooter />
    </div>
  );
};
