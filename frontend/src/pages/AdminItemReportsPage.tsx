import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest, resolveApiUrl } from '../lib/apiClient';
import './AdminDashboardPage.css';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ItemReport = {
  id: string;
  title: string;
  type: 'Lost' | 'Found';
  status: string;
  reviewStatus: ReviewStatus;
  lostItemStatus: 'OPEN' | 'MATCH_PENDING' | 'FOUND' | 'RETURNED';
  matchedFoundItemTitle?: string;
  resolutionLocation: string | null;
  category: string;
  description: string;
  privateDetails: string;
  location: string;
  occurredAt: string;
  createdAt: string;
  contactEmail: string | null;
  custodyLocation: string | null;
  reporter: { fullName: string; email: string };
  imageUrl?: string;
};
type ItemReviewResponse = {
  counts: Record<ReviewStatus, number>;
  items: ItemReport[];
};

const reviewFilters: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const AdminItemReportsPage = () => {
  const [filter, setFilter] = useState<ReviewStatus>('PENDING');
  const [reports, setReports] = useState<ItemReport[]>([]);
  const [counts, setCounts] = useState<Record<ReviewStatus, number>>({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [busyReportId, setBusyReportId] = useState('');
  const [resolutionLocations, setResolutionLocations] = useState<Record<string, string>>({});
  const [foundItemSelections, setFoundItemSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiRequest<ItemReviewResponse>(`/admin/items?status=${filter}`);
      setReports(result.items);
      setCounts(result.counts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reports could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const reviewReport = async (report: ItemReport, decision: 'approve' | 'reject') => {
    const outcome = decision === 'approve' ? 'approved' : 'rejected';
    if (!window.confirm(`${outcome === 'approved' ? 'Approve' : 'Reject'} the ${report.type.toLowerCase()} report for “${report.title}”?`)) return;
    setBusyReportId(report.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/items/${report.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      setNotice(`Report ${outcome}.`);
      await loadReports();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `The report could not be ${outcome}.`);
    } finally {
      setBusyReportId('');
    }
  };

  const resolveLostReport = async (report: ItemReport, action: 'mark-found' | 'mark-returned') => {
    const location = resolutionLocations[report.id]?.trim();
    if (action === 'mark-found' && !location) {
      setError('Enter where the item can be collected before marking it found.');
      return;
    }
    setBusyReportId(report.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/items/${report.id}/resolution`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          resolutionLocation: action === 'mark-found' ? location : undefined,
          foundItemId: action === 'mark-found' ? foundItemSelections[report.id] || undefined : undefined,
        }),
      });
      setNotice(action === 'mark-found' ? 'Lost report marked found; the owner can see the collection location in My Claims.' : 'Lost report marked returned.');
      await loadReports();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The lost-item status could not be updated.');
    } finally {
      setBusyReportId('');
    }
  };

  const approvedFoundReports = reports.filter((report) =>
    report.type === 'Found' && ['REPORTED', 'IN_VAULT'].includes(report.status));

  return (
    <div className="admin-page">
      <PublicHeader />
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">QCU LOST &amp; FOUND · ADMIN</p>
            <h1>Item report moderation</h1>
            <p>Review reports before publishing. Approved items become visible to the community; rejected and pending reports remain private.</p>
          </div>
          <Link to="/items">View public listings ↗</Link>
        </header>
        <nav className="admin-view-links" aria-label="Administrator sections">
          <Link className="admin-view-link" to="/admin-dashboard">Claim review</Link>
          <Link className="admin-view-link admin-view-link--active" to="/admin-dashboard/reports">Item report moderation</Link>
          <Link className="admin-view-link" to="/admin-dashboard/matches">Lost-item matches</Link>
          <Link className="admin-view-link" to="/admin-dashboard/conversations">Conversation safety</Link>
          <Link className="admin-view-link" to="/admin-dashboard/vault">Vault &amp; handover</Link>
        </nav>
        <section className="admin-summary" aria-label="Report counts">
          {reviewFilters.map((entry) => <div className="admin-summary__card" key={entry.value}><span>{entry.label}</span><strong>{counts[entry.value]}</strong></div>)}
        </section>
        <div className="admin-claims-heading">
          <h2>Item reports</h2>
          <button type="button" onClick={() => void loadReports()} disabled={isLoading}>{isLoading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Filter reports by review status">
          {reviewFilters.map((entry) => (
            <button key={entry.value} type="button" role="tab" aria-selected={filter === entry.value} className={filter === entry.value ? 'admin-tab admin-tab--active' : 'admin-tab'} onClick={() => setFilter(entry.value)}>
              {entry.label} <span>{counts[entry.value]}</span>
            </button>
          ))}
        </div>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        {isLoading ? <p className="admin-empty" role="status">Loading reports…</p>
          : reports.length === 0 ? <p className="admin-empty">No {filter === 'PENDING' ? 'pending' : filter.toLowerCase()} reports.</p>
            : <div className="admin-claim-list">
              {reports.map((report) => (
                <article className="admin-claim" key={report.id}>
                  <header className="admin-claim__header">
                    <div>
                      <span className={`admin-status admin-status--${report.reviewStatus.toLowerCase()}`}>{reviewFilters.find((entry) => entry.value === report.reviewStatus)?.label}</span>
                      <h3>{report.type}: {report.title}</h3>
                      <p>{report.category} · {report.location} · Item date {new Date(report.occurredAt).toLocaleDateString()}</p>
                    </div>
                    <time dateTime={report.createdAt}>Submitted {new Date(report.createdAt).toLocaleString()}</time>
                  </header>
                  <div className="admin-claim__grid">
                    <section>
                      <h4>Public description</h4>
                      <p className="admin-private-copy">{report.description}</p>
                      <h4>Private identifying details</h4>
                      <p className="admin-private-copy">{report.privateDetails || 'No private details were supplied.'}</p>
                      {report.imageUrl && <div className="admin-evidence"><a href={resolveApiUrl(report.imageUrl)} target="_blank" rel="noreferrer"><img src={resolveApiUrl(report.imageUrl)} alt="Reported item" /><span>Item photo</span></a></div>}
                    </section>
                    <section>
                      <h4>Reporter</h4>
                      <p>{report.reporter.fullName}</p>
                      <a href={`mailto:${report.contactEmail || report.reporter.email}`}>{report.contactEmail || report.reporter.email}</a>
                      {report.custodyLocation && <><h4>Current custody or storage</h4><p>{report.custodyLocation}</p></>}
                    </section>
                  </div>
                  {report.reviewStatus === 'PENDING' && (
                    <footer className="admin-claim__actions">
                      <p>This report will not appear publicly until approved.</p>
                      <div>
                        <button type="button" className="admin-reject" disabled={busyReportId === report.id} onClick={() => void reviewReport(report, 'reject')}>Reject</button>
                        <button type="button" className="admin-approve" disabled={busyReportId === report.id} onClick={() => void reviewReport(report, 'approve')}>{busyReportId === report.id ? 'Saving…' : 'Approve and publish'}</button>
                      </div>
                    </footer>
                  )}
                  {report.type === 'Lost' && report.reviewStatus === 'APPROVED' && report.lostItemStatus === 'OPEN' && (
                    <footer className="admin-claim__actions">
                      <label>Where can the owner collect it?
                        <input maxLength={120} value={resolutionLocations[report.id] ?? ''} onChange={(event) => setResolutionLocations((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Campus office, building, or secure location" />
                      </label>
                      <label>Link an approved found report (optional)
                        <select value={foundItemSelections[report.id] ?? ''} onChange={(event) => {
                          const foundItemId = event.target.value;
                          setFoundItemSelections((current) => ({ ...current, [report.id]: foundItemId }));
                          const foundItem = approvedFoundReports.find((entry) => entry.id === foundItemId);
                          if (foundItem?.custodyLocation) setResolutionLocations((current) => ({ ...current, [report.id]: foundItem.custodyLocation || '' }));
                        }}>
                          <option value="">No linked found report</option>
                          {approvedFoundReports.map((foundReport) => <option value={foundReport.id} key={foundReport.id}>{foundReport.title} · {foundReport.location}</option>)}
                        </select>
                      </label>
                      <div><button type="button" className="admin-approve" disabled={busyReportId === report.id} onClick={() => void resolveLostReport(report, 'mark-found')}>{busyReportId === report.id ? 'Saving…' : 'Mark lost item found'}</button></div>
                    </footer>
                  )}
                  {report.type === 'Lost' && report.reviewStatus === 'APPROVED' && report.lostItemStatus === 'MATCH_PENDING' && (
                    <p className="admin-notice">A finder’s match suggestion is awaiting review. <Link to="/admin-dashboard/matches">Review suggestions ↗</Link></p>
                  )}
                  {report.type === 'Lost' && report.reviewStatus === 'APPROVED' && report.lostItemStatus === 'FOUND' && (
                    <footer className="admin-claim__actions">
                      <p>Found {report.matchedFoundItemTitle ? `and linked to “${report.matchedFoundItemTitle}”` : ''}. Collection: {report.resolutionLocation || 'not recorded'}.</p>
                      <Link className="admin-approve" to="/admin-dashboard/vault">Record physical handover in the vault</Link>
                    </footer>
                  )}
                  {report.type === 'Lost' && report.reviewStatus === 'APPROVED' && report.lostItemStatus === 'RETURNED' && (
                    <p className="admin-notice">Returned to the owner{report.resolutionLocation ? ` · ${report.resolutionLocation}` : ''}.</p>
                  )}
                </article>
              ))}
            </div>}
      </main>
      <PublicFooter />
    </div>
  );
};
