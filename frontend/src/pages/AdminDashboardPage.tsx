import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest } from '../lib/apiClient';
import './AdminDashboardPage.css';

type ClaimStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';
type ClaimRecord = {
  id: string;
  status: ClaimStatus;
  submittedAt: string;
  ownershipDetails: string;
  lastSeen: string;
  proofImages: string[];
  claimant: { fullName: string; email: string };
  item: {
    id: string;
    title: string;
    type: 'Lost' | 'Found';
    status: string;
    category: string;
    description: string;
    privateDetails: string;
    location: string;
    contactEmail: string | null;
    custodyLocation: string | null;
    reporter: { fullName: string; email: string };
    imageUrl?: string;
  };
};
type ClaimResponse = {
  counts: Record<ClaimStatus, number>;
  claims: ClaimRecord[];
};

const claimFilters: Array<{ value: ClaimStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending review' },
  { value: 'VERIFIED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const AdminDashboardPage = () => {
  const [filter, setFilter] = useState<ClaimStatus>('PENDING');
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [counts, setCounts] = useState<Record<ClaimStatus, number>>({
    PENDING: 0,
    VERIFIED: 0,
    REJECTED: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [busyClaimId, setBusyClaimId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadClaims = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await apiRequest<ClaimResponse>(`/admin/claims?status=${filter}`);
      setClaims(result.claims);
      setCounts(result.counts);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Claims could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadClaims();
  }, [loadClaims]);

  const reviewClaim = async (claim: ClaimRecord, decision: 'approve' | 'reject') => {
    const actionLabel = decision === 'approve' ? 'approved' : 'rejected';
    const prompt = decision === 'approve'
      ? `Approve the claim for “${claim.item.title}”? This records verification but does not confirm a physical handover.`
      : `Reject the claim for “${claim.item.title}”?`;
    if (!window.confirm(prompt)) return;

    setBusyClaimId(claim.id);
    setNotice('');
    setError('');
    try {
      await apiRequest(`/admin/claims/${claim.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      setNotice(`Claim ${actionLabel}.`);
      await loadClaims();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `The claim could not be ${actionLabel}.`);
    } finally {
      setBusyClaimId('');
    }
  };

  return (
    <div className="admin-page">
      <PublicHeader />
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">QCU LOST &amp; FOUND · ADMIN</p>
            <h1>Claim review</h1>
            <p>Compare the claimant’s private details with the report. An approval verifies ownership; it does not record a handover.</p>
          </div>
          <Link to="/items">View public listings ↗</Link>
        </header>
        <nav className="admin-view-links" aria-label="Administrator sections">
          <Link className="admin-view-link admin-view-link--active" to="/admin-dashboard">Claim review</Link>
          <Link className="admin-view-link" to="/admin-dashboard/reports">Item report moderation</Link>
          <Link className="admin-view-link" to="/admin-dashboard/matches">Lost-item matches</Link>
        </nav>

        <section className="admin-summary" aria-label="Claim counts">
          {claimFilters.map((entry) => (
            <div className="admin-summary__card" key={entry.value}>
              <span>{entry.label}</span>
              <strong>{counts[entry.value]}</strong>
            </div>
          ))}
        </section>

        <div className="admin-claims-heading">
          <h2>Ownership claims</h2>
          <button type="button" onClick={() => void loadClaims()} disabled={isLoading}>
            {isLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Filter claims by status">
          {claimFilters.map((entry) => (
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
        {isLoading ? <p className="admin-empty" role="status">Loading claims…</p>
          : claims.length === 0 ? <p className="admin-empty">No {filter === 'PENDING' ? 'pending' : filter === 'VERIFIED' ? 'approved' : 'rejected'} claims.</p>
            : <div className="admin-claim-list">
              {claims.map((claim) => (
                <article className="admin-claim" key={claim.id}>
                  <header className="admin-claim__header">
                    <div>
                      <span className={`admin-status admin-status--${claim.status.toLowerCase()}`}>{claim.status === 'VERIFIED' ? 'Approved' : claim.status === 'REJECTED' ? 'Rejected' : 'Pending'}</span>
                      <h3>{claim.item.title}</h3>
                      <p>{claim.item.type} · {claim.item.category} · Reported at {claim.item.location}</p>
                    </div>
                    <time dateTime={claim.submittedAt}>Claim submitted {new Date(claim.submittedAt).toLocaleString()}</time>
                  </header>

                  <div className="admin-claim__grid">
                    <section>
                      <h4>Claimant</h4>
                      <p>{claim.claimant.fullName}</p>
                      <a href={`mailto:${claim.claimant.email}`}>{claim.claimant.email}</a>
                      <h4>Claimant’s identifying details</h4>
                      <p className="admin-private-copy">{claim.ownershipDetails}</p>
                      <h4>When and where they last had it</h4>
                      <p className="admin-private-copy">{claim.lastSeen}</p>
                    </section>
                    <section>
                      <h4>Report details</h4>
                      <p className="admin-private-copy">{claim.item.description}</p>
                      <h4>Private report details</h4>
                      <p className="admin-private-copy">{claim.item.privateDetails || 'No private identifying details were recorded.'}</p>
                      <h4>Reporter and custody</h4>
                      <p>{claim.item.reporter.fullName} · {claim.item.contactEmail || claim.item.reporter.email}</p>
                      {claim.item.custodyLocation && <p>Stored at: {claim.item.custodyLocation}</p>}
                    </section>
                  </div>

                  {(claim.item.imageUrl || claim.proofImages.length > 0) && (
                    <div className="admin-evidence">
                      {claim.item.imageUrl && <a href={claim.item.imageUrl} target="_blank" rel="noreferrer"><img src={claim.item.imageUrl} alt="Reported item" /><span>Reported item photo</span></a>}
                      {claim.proofImages.map((image, index) => <a href={image} target="_blank" rel="noreferrer" key={`${claim.id}-proof-${index}`}><img src={image} alt={`Claim evidence ${index + 1}`} /><span>Claim evidence {index + 1}</span></a>)}
                    </div>
                  )}

                  {claim.status === 'PENDING' && (
                    <footer className="admin-claim__actions">
                      <p>Review both the claim and the private report details before deciding.</p>
                      <div>
                        <button type="button" className="admin-reject" disabled={busyClaimId === claim.id} onClick={() => void reviewClaim(claim, 'reject')}>Reject</button>
                        <button type="button" className="admin-approve" disabled={busyClaimId === claim.id} onClick={() => void reviewClaim(claim, 'approve')}>{busyClaimId === claim.id ? 'Saving…' : 'Approve claim'}</button>
                      </div>
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
