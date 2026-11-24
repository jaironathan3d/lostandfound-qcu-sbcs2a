import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest } from '../lib/apiClient';
import './AdminDashboardPage.css';
import './AdminConversationReportsPage.css';

type ReportStatus = 'PENDING' | 'REVIEWED' | 'DISMISSED';
type ConversationReport = {
  id: string;
  reason: 'HARASSMENT' | 'SCAM_OR_FRAUD' | 'SHARED_PERSONAL_INFORMATION' | 'OTHER';
  details: string;
  status: ReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  reviewedByName: string | null;
  reporter: { fullName: string; email: string };
  conversation: {
    id: string;
    item: { id: string; title: string };
    participants: Array<{ id: string; fullName: string }>;
    messages: Array<{
      id: string;
      sender: { id: string; fullName: string };
      content: string;
      createdAt: string;
    }>;
  };
};
type ReportResponse = {
  counts: Record<ReportStatus, number>;
  reports: ConversationReport[];
};

const filters: Array<{ value: ReportStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending review' },
  { value: 'REVIEWED', label: 'Reviewed' },
  { value: 'DISMISSED', label: 'Dismissed' },
];

const reasonLabels: Record<ConversationReport['reason'], string> = {
  HARASSMENT: 'Harassment or abusive messages',
  SCAM_OR_FRAUD: 'Scam or fraud',
  SHARED_PERSONAL_INFORMATION: 'Shared personal information',
  OTHER: 'Other safety concern',
};

export const AdminConversationReportsPage = () => {
  const [filter, setFilter] = useState<ReportStatus>('PENDING');
  const [reports, setReports] = useState<ConversationReport[]>([]);
  const [counts, setCounts] = useState<Record<ReportStatus, number>>({
    PENDING: 0,
    REVIEWED: 0,
    DISMISSED: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiRequest<ReportResponse>(`/admin/conversation-reports?status=${filter}`);
      setReports(response.reports);
      setCounts(response.counts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Conversation reports could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const reviewReport = async (report: ConversationReport, decision: 'reviewed' | 'dismiss') => {
    if (decision === 'dismiss' && !window.confirm('Dismiss this conversation report after review?')) return;
    setBusyReportId(report.id);
    setNotice('');
    setError('');
    try {
      await apiRequest(`/admin/conversation-reports/${report.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      setNotice(decision === 'reviewed' ? 'Conversation report marked reviewed.' : 'Conversation report dismissed.');
      await loadReports();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The conversation report could not be updated.');
    } finally {
      setBusyReportId('');
    }
  };

  return (
    <div className="admin-page">
      <PublicHeader />
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">QCU LOST &amp; FOUND · ADMIN</p>
            <h1>Conversation safety reports</h1>
            <p>Investigate reports privately. Conversation transcripts on this page are visible only to administrators.</p>
          </div>
          <Link to="/messages">Open messages ↗</Link>
        </header>
        <nav className="admin-view-links" aria-label="Administrator sections">
          <Link className="admin-view-link" to="/admin-dashboard">Claim review</Link>
          <Link className="admin-view-link" to="/admin-dashboard/reports">Item report moderation</Link>
          <Link className="admin-view-link" to="/admin-dashboard/matches">Lost-item matches</Link>
          <Link className="admin-view-link admin-view-link--active" to="/admin-dashboard/conversations">Conversation safety</Link>
          <Link className="admin-view-link" to="/admin-dashboard/vault">Vault &amp; handover</Link>
          <Link className="admin-view-link" to="/admin-dashboard/students">Student records</Link>
        </nav>
        <section className="admin-summary" aria-label="Conversation report counts">
          {filters.map((entry) => (
            <div className="admin-summary__card" key={entry.value}>
              <span>{entry.label}</span>
              <strong>{counts[entry.value]}</strong>
            </div>
          ))}
        </section>
        <div className="admin-claims-heading">
          <h2>Reported conversations</h2>
          <button type="button" onClick={() => void loadReports()} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Filter conversation reports">
          {filters.map((entry) => (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={filter === entry.value}
              className={filter === entry.value ? 'admin-tab admin-tab--active' : 'admin-tab'}
              onClick={() => setFilter(entry.value)}
            >
              {entry.label} <span>{counts[entry.value]}</span>
            </button>
          ))}
        </div>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        {isLoading ? <p className="admin-empty" role="status">Loading conversation reports…</p>
          : reports.length === 0 ? <p className="admin-empty">No {filter === 'PENDING' ? 'pending' : filter.toLowerCase()} conversation reports.</p>
            : <div className="conversation-report-list">
              {reports.map((report) => (
                <article className="conversation-report" key={report.id}>
                  <header className="conversation-report__header">
                    <div>
                      <span className={`admin-status admin-status--${report.status.toLowerCase()}`}>{filters.find((entry) => entry.value === report.status)?.label}</span>
                      <h3>{report.conversation.item.title}</h3>
                      <p>{reasonLabels[report.reason]} · Reported by {report.reporter.fullName}</p>
                    </div>
                    <time dateTime={report.createdAt}>Submitted {new Date(report.createdAt).toLocaleString()}</time>
                  </header>
                  {report.details && <p className="conversation-report__details">{report.details}</p>}
                  <section className="conversation-report__transcript" aria-label="Conversation transcript">
                    <h4>Conversation participants</h4>
                    <p>{report.conversation.participants.map((participant) => participant.fullName).join(' · ')}</p>
                    <h4>Recent messages</h4>
                    {report.conversation.messages.length === 0
                      ? <p>No messages in this conversation.</p>
                      : report.conversation.messages.map((message) => (
                        <article key={message.id}>
                          <strong>{message.sender.fullName}</strong>
                          <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
                          <p>{message.content}</p>
                        </article>
                      ))}
                  </section>
                  {report.reviewedByName && report.reviewedAt && (
                    <p className="conversation-report__reviewed">
                      Reviewed by {report.reviewedByName} on {new Date(report.reviewedAt).toLocaleString()}.
                    </p>
                  )}
                  {report.status === 'PENDING' && (
                    <footer className="conversation-report__actions">
                      <button type="button" disabled={busyReportId === report.id} onClick={() => void reviewReport(report, 'reviewed')}>
                        {busyReportId === report.id ? 'Saving…' : 'Mark reviewed'}
                      </button>
                      <button type="button" className="conversation-report__dismiss" disabled={busyReportId === report.id} onClick={() => void reviewReport(report, 'dismiss')}>
                        Dismiss
                      </button>
                    </footer>
                  )}
                </article>
              ))}
            </div>}
      </main>
      <PublicFooter />
    </div>
  );
};
