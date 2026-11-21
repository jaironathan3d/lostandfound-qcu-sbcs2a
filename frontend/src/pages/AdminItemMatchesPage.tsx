import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest } from '../lib/apiClient';
import './AdminDashboardPage.css';

type MatchStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type MatchItem = {
  id: string;
  title: string;
  description: string;
  privateDetails: string;
  category: string;
  location: string;
  custodyLocation?: string | null;
  reporter: { fullName: string; email: string };
  imageUrl?: string;
};
type MatchSuggestion = {
  id: string;
  status: MatchStatus;
  note: string;
  submittedAt: string;
  suggestedBy: { fullName: string; email: string };
  resolutionLocation: string | null;
  lostItem: MatchItem;
  foundItem: MatchItem | null;
};
type MatchResponse = {
  counts: Record<MatchStatus, number>;
  matches: MatchSuggestion[];
};

const filters: Array<{ value: MatchStatus; label: string }> = [
  { value: 'PENDING', label: 'Pending review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export const AdminItemMatchesPage = () => {
  const [filter, setFilter] = useState<MatchStatus>('PENDING');
  const [matches, setMatches] = useState<MatchSuggestion[]>([]);
  const [counts, setCounts] = useState<Record<MatchStatus, number>>({ PENDING: 0, APPROVED: 0, REJECTED: 0 });
  const [locations, setLocations] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyMatchId, setBusyMatchId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadMatches = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await apiRequest<MatchResponse>(`/admin/matches?status=${filter}`);
      setMatches(response.matches);
      setCounts(response.counts);
      setLocations((current) => {
        const next = { ...current };
        response.matches.forEach((match) => {
          if (next[match.id] === undefined) {
            next[match.id] = match.resolutionLocation || match.foundItem?.custodyLocation || match.foundItem?.location || '';
          }
        });
        return next;
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Match suggestions could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const reviewMatch = async (match: MatchSuggestion, decision: 'approve' | 'reject') => {
    if (decision === 'approve' && !locations[match.id]?.trim()) {
      setError('Enter where the item can be collected before approving the match.');
      return;
    }
    setBusyMatchId(match.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/matches/${match.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          decision,
          resolutionLocation: decision === 'approve' ? locations[match.id]?.trim() : undefined,
        }),
      });
      setNotice(decision === 'approve' ? 'Match approved. The report owner can now see the collection details.' : 'Match suggestion rejected.');
      await loadMatches();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The match decision could not be saved.');
    } finally {
      setBusyMatchId('');
    }
  };

  return (
    <div className="admin-page">
      <PublicHeader />
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">QCU LOST &amp; FOUND · ADMIN</p>
            <h1>Lost-item match review</h1>
            <p>Compare finder suggestions with lost reports. Approval records where the owner can collect the item.</p>
          </div>
          <Link to="/items">View public listings ↗</Link>
        </header>
        <nav className="admin-view-links" aria-label="Administrator sections">
          <Link className="admin-view-link" to="/admin-dashboard">Claim review</Link>
          <Link className="admin-view-link" to="/admin-dashboard/reports">Item report moderation</Link>
          <Link className="admin-view-link admin-view-link--active" to="/admin-dashboard/matches">Lost-item matches</Link>
        </nav>
        <section className="admin-summary" aria-label="Match suggestion counts">
          {filters.map((entry) => <div className="admin-summary__card" key={entry.value}><span>{entry.label}</span><strong>{counts[entry.value]}</strong></div>)}
        </section>
        <div className="admin-claims-heading">
          <h2>Finder suggestions</h2>
          <button type="button" onClick={() => void loadMatches()} disabled={isLoading}>{isLoading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <div className="admin-tabs" role="tablist" aria-label="Filter match suggestions">
          {filters.map((entry) => (
            <button key={entry.value} type="button" role="tab" aria-selected={filter === entry.value} className={filter === entry.value ? 'admin-tab admin-tab--active' : 'admin-tab'} onClick={() => setFilter(entry.value)}>
              {entry.label} <span>{counts[entry.value]}</span>
            </button>
          ))}
        </div>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        {isLoading ? <p className="admin-empty" role="status">Loading match suggestions…</p>
          : matches.length === 0 ? <p className="admin-empty">No {filter === 'PENDING' ? 'pending' : filter.toLowerCase()} match suggestions.</p>
            : <div className="admin-claim-list">
              {matches.map((match) => (
                <article className="admin-claim" key={match.id}>
                  <header className="admin-claim__header">
                    <div>
                      <span className={`admin-status admin-status--${match.status.toLowerCase()}`}>{match.status === 'PENDING' ? 'Pending review' : match.status === 'APPROVED' ? 'Approved' : 'Rejected'}</span>
                      <h3>Suggested match: {match.lostItem.title}</h3>
                      <p>Suggested by {match.suggestedBy.fullName} · {match.suggestedBy.email}</p>
                    </div>
                    <time dateTime={match.submittedAt}>Submitted {new Date(match.submittedAt).toLocaleString()}</time>
                  </header>
                  <div className="admin-claim__grid">
                    <section>
                      <h4>Lost report</h4>
                      <p><strong>{match.lostItem.title}</strong> · {match.lostItem.category} · {match.lostItem.location}</p>
                      <p className="admin-private-copy">{match.lostItem.description}</p>
                      <h4>Owner’s private identifying details</h4>
                      <p className="admin-private-copy">{match.lostItem.privateDetails || 'No private details were supplied.'}</p>
                      <p>Reported by {match.lostItem.reporter.fullName} · {match.lostItem.reporter.email}</p>
                    </section>
                    <section>
                      <h4>Finder’s explanation</h4>
                      <p className="admin-private-copy">{match.note}</p>
                      {match.foundItem
                        ? <>
                          <h4>Linked found report</h4>
                          <p><strong>{match.foundItem.title}</strong> · {match.foundItem.category} · {match.foundItem.location}</p>
                          <p className="admin-private-copy">{match.foundItem.description}</p>
                          <p>Reported by {match.foundItem.reporter.fullName} · {match.foundItem.reporter.email}</p>
                          <p>Custody location: {match.foundItem.custodyLocation || 'Not specified'}</p>
                        </>
                        : <p>No found-item report was linked. If approving, enter the location where the item can be collected.</p>}
                    </section>
                  </div>
                  {(match.lostItem.imageUrl || match.foundItem?.imageUrl) && (
                    <div className="admin-evidence">
                      {match.lostItem.imageUrl && <a href={match.lostItem.imageUrl} target="_blank" rel="noreferrer"><img src={match.lostItem.imageUrl} alt="Lost item" /><span>Lost item photo</span></a>}
                      {match.foundItem?.imageUrl && <a href={match.foundItem.imageUrl} target="_blank" rel="noreferrer"><img src={match.foundItem.imageUrl} alt="Found item" /><span>Found item photo</span></a>}
                    </div>
                  )}
                  {match.status === 'PENDING' && (
                    <footer className="admin-claim__actions">
                      <label>Collection location
                        <input maxLength={120} value={locations[match.id] ?? ''} onChange={(event) => setLocations((current) => ({ ...current, [match.id]: event.target.value }))} placeholder="Where the owner can collect the item" />
                      </label>
                      <div>
                        <button type="button" className="admin-reject" disabled={busyMatchId === match.id} onClick={() => void reviewMatch(match, 'reject')}>Reject</button>
                        <button type="button" className="admin-approve" disabled={busyMatchId === match.id} onClick={() => void reviewMatch(match, 'approve')}>{busyMatchId === match.id ? 'Saving…' : 'Approve match'}</button>
                      </div>
                    </footer>
                  )}
                  {match.status === 'APPROVED' && <p className="admin-notice">Owner collection location: {match.resolutionLocation || 'Not recorded'}</p>}
                </article>
              ))}
            </div>}
      </main>
      <PublicFooter />
    </div>
  );
};
