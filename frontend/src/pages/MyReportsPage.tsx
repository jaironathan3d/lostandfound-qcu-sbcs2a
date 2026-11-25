import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest, resolveApiUrl } from '../lib/apiClient';
import './MyReportsPage.css';

type UserReport = {
  id: string;
  title: string;
  type: 'Lost' | 'Found';
  category: string;
  description: string;
  location: string;
  occurredAt: string;
  reviewStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  status: string;
  lostItemStatus?: 'OPEN' | 'MATCH_PENDING' | 'FOUND' | 'RETURNED';
  matchedFoundItemTitle?: string | null;
  resolutionLocation?: string | null;
  imageUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO';
};

const reviewLabel: Record<UserReport['reviewStatus'], string> = {
  PENDING: 'Pending approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const MyReportsPage = () => {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState('');
  const [error, setError] = useState('');

  const loadReports = async () => {
    setIsLoading(true);
    setError('');
    try {
      setReports(await apiRequest<UserReport[]>('/items/mine'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Your reports could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, []);

  const deleteReport = async (report: UserReport) => {
    if (!window.confirm(`Delete your pending report for “${report.title}”? This cannot be undone.`)) return;
    setBusyReportId(report.id);
    setError('');
    try {
      await apiRequest<void>(`/items/${report.id}`, { method: 'DELETE' });
      setReports((current) => current.filter((entry) => entry.id !== report.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The report could not be deleted.');
    } finally {
      setBusyReportId('');
    }
  };

  return (
    <div className="my-reports-page">
      <PublicHeader />
      <main className="my-reports-main">
        <header className="my-reports-heading">
          <div>
            <p className="my-reports-eyebrow">YOUR ACCOUNT</p>
            <h1>My item reports</h1>
            <p>Reports only appear in public listings after an administrator approves them.</p>
          </div>
          <Link to="/report-item">Report another item</Link>
        </header>
        {error && <p className="my-reports-error" role="alert">{error}</p>}
        {isLoading ? <p className="my-reports-empty" role="status">Loading your reports…</p>
          : reports.length === 0 ? <section className="my-reports-empty"><h2>No reports yet</h2><p>Your submitted lost and found reports will appear here.</p><Link to="/report-item">Create a report</Link></section>
            : <div className="my-reports-list">
              {reports.map((report) => (
                <article className="my-report-card" key={report.id}>
                  {report.imageUrl && (report.mediaType === 'VIDEO'
                    ? <video src={resolveApiUrl(report.imageUrl)} controls preload="metadata" />
                    : <img src={resolveApiUrl(report.imageUrl)} alt="" />)}
                  <div className="my-report-card__content">
                    <div className="my-report-card__meta">
                      <span className={`my-report-status my-report-status--${report.reviewStatus.toLowerCase()}`}>{reviewLabel[report.reviewStatus]}</span>
                      <span>{report.type} · {report.category}</span>
                    </div>
                    <h2>{report.title}</h2>
                    <p>{report.description}</p>
                    <small>{report.location} · {new Date(report.occurredAt).toLocaleDateString()}</small>
                    {report.type === 'Lost' && report.lostItemStatus === 'MATCH_PENDING' && <p>A suggested match is being reviewed by an administrator.</p>}
                    {report.type === 'Lost' && (report.lostItemStatus === 'FOUND' || report.lostItemStatus === 'RETURNED') && (
                      <p>{report.lostItemStatus === 'RETURNED' ? 'Returned to you.' : 'Marked found.'} {report.matchedFoundItemTitle ? `Matched report: ${report.matchedFoundItemTitle}. ` : ''}{report.resolutionLocation ? `Collection location: ${report.resolutionLocation}.` : ''}</p>
                    )}
                  </div>
                  {report.reviewStatus === 'PENDING' && (
                    <>
                      <Link to={`/report-item?edit=${report.id}&type=${report.type.toLowerCase()}`}>Edit pending report</Link>
                      <button type="button" disabled={busyReportId === report.id} onClick={() => void deleteReport(report)}>
                        {busyReportId === report.id ? 'Deleting…' : 'Delete pending report'}
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>}
      </main>
      <PublicFooter />
    </div>
  );
};
