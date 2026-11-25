import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest } from '../lib/apiClient';
import './AdminDashboardPage.css';
import './AdminVaultPage.css';

type ReviewStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ItemReport = {
  id: string;
  title: string;
  type: 'Lost' | 'Found';
  status: string;
  reviewStatus: ReviewStatus;
  lostItemStatus: 'OPEN' | 'MATCH_PENDING' | 'FOUND' | 'RETURNED';
  custodyLocation: string | null;
};
type VaultRecipient = {
  id: string;
  fullName: string;
  email: string;
  reason: string;
};
type VaultEntry = {
  id: string;
  itemId: string;
  itemTitle: string;
  reportType: 'LOST' | 'FOUND';
  itemStatus: string;
  lostItemStatus: 'OPEN' | 'MATCH_PENDING' | 'FOUND' | 'RETURNED';
  storageLocation: string | null;
  receivedAt: string;
  releasedAt: string | null;
  receivedByName: string;
  reporter: { id: string; fullName: string; email: string };
  eligibleRecipients: VaultRecipient[];
  handovers: Array<{
    id: string;
    releasedAt: string;
    guardName: string;
    recipient: { id: string; fullName: string; email: string };
  }>;
};
type VaultResponse = {
  counts: { ACTIVE: number; RELEASED: number };
  entries: VaultEntry[];
};
type ReportResponse = { items: ItemReport[] };
type VaultFilter = 'ACTIVE' | 'RELEASED' | 'ALL';

const filters: Array<{ value: VaultFilter; label: string }> = [
  { value: 'ACTIVE', label: 'In vault' },
  { value: 'RELEASED', label: 'Handed over' },
  { value: 'ALL', label: 'All records' },
];

export const AdminVaultPage = () => {
  const [filter, setFilter] = useState<VaultFilter>('ACTIVE');
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [counts, setCounts] = useState<VaultResponse['counts']>({ ACTIVE: 0, RELEASED: 0 });
  const [approvedReports, setApprovedReports] = useState<ItemReport[]>([]);
  const [storageLocations, setStorageLocations] = useState<Record<string, string>>({});
  const [recipientSelections, setRecipientSelections] = useState<Record<string, string>>({});
  const [handoverCodes, setHandoverCodes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadVault = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [vault, reports] = await Promise.all([
        apiRequest<VaultResponse>('/vault?status=ALL'),
        apiRequest<ReportResponse>('/admin/items?status=APPROVED'),
      ]);
      setEntries(vault.entries);
      setCounts(vault.counts);
      setApprovedReports(reports.items);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Vault records could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVault();
  }, [loadVault]);

  const storedItemIds = useMemo(() => new Set(entries.map((entry) => entry.itemId)), [entries]);
  const intakeCandidates = approvedReports.filter((report) => {
    if (storedItemIds.has(report.id)) return false;
    if (report.type === 'Found') {
      return ['REPORTED', 'IN_VAULT', 'CLAIM_PENDING', 'VERIFIED'].includes(report.status);
    }
    return report.lostItemStatus === 'FOUND' && ['REPORTED', 'IN_VAULT'].includes(report.status);
  });
  const visibleEntries = entries.filter((entry) => (
    filter === 'ALL'
    || (filter === 'ACTIVE' ? entry.releasedAt === null : entry.releasedAt !== null)
  ));

  const receiveItem = async (event: FormEvent<HTMLFormElement>, report: ItemReport) => {
    event.preventDefault();
    const storageLocation = storageLocations[report.id]?.trim();
    if (!storageLocation || storageLocation.length < 2) {
      setError('Enter the secure storage location before receiving this item.');
      return;
    }
    setBusyId(report.id);
    setError('');
    setNotice('');
    try {
      await apiRequest('/vault', {
        method: 'POST',
        body: JSON.stringify({ itemId: report.id, storageLocation }),
      });
      setNotice(`"${report.title}" was received into the vault.`);
      await loadVault();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The item could not be received into the vault.');
    } finally {
      setBusyId('');
    }
  };

  const recordHandover = async (event: FormEvent<HTMLFormElement>, entry: VaultEntry) => {
    event.preventDefault();
    const recipientId = recipientSelections[entry.id] || entry.eligibleRecipients[0]?.id;
    const referenceCode = handoverCodes[entry.id]?.trim();
    if (!recipientId || !referenceCode) {
      setError('Select the verified recipient and enter the handover code they present.');
      return;
    }
    const recipient = entry.eligibleRecipients.find((candidate) => candidate.id === recipientId);
    if (!recipient || !window.confirm(`Confirm that "${entry.itemTitle}" was physically handed to ${recipient.fullName}?`)) return;

    setBusyId(entry.id);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/vault/${entry.id}/handovers`, {
        method: 'POST',
        body: JSON.stringify({ recipientId, referenceCode }),
      });
      setNotice(`Handover of "${entry.itemTitle}" recorded.`);
      setHandoverCodes((current) => ({ ...current, [entry.id]: '' }));
      await loadVault();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The physical handover could not be recorded.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="admin-page">
      <PublicHeader />
      <main className="admin-main">
        <header className="admin-heading">
          <div>
            <p className="admin-eyebrow">QCU LOST &amp; FOUND · ADMIN</p>
            <h1>Vault &amp; physical handover</h1>
            <p>Record secure item intake and release only to someone with an approved ownership record and the matching handover code.</p>
          </div>
          <Link to="/admin-dashboard">Back to administration ↗</Link>
        </header>
        <nav className="admin-view-links" aria-label="Administrator sections">
          <Link className="admin-view-link" to="/admin-dashboard">Claim review</Link>
          <Link className="admin-view-link" to="/admin-dashboard/reports">Item report moderation</Link>
          <Link className="admin-view-link" to="/admin-dashboard/matches">Lost-item matches</Link>
          <Link className="admin-view-link" to="/admin-dashboard/conversations">Conversation safety</Link>
          <Link className="admin-view-link admin-view-link--active" to="/admin-dashboard/vault">Vault &amp; handover</Link>
          <Link className="admin-view-link" to="/admin-dashboard/students">Student records</Link>
        </nav>
        <section className="admin-summary" aria-label="Vault counts">
          <div className="admin-summary__card"><span>In vault</span><strong>{counts.ACTIVE}</strong></div>
          <div className="admin-summary__card"><span>Handed over</span><strong>{counts.RELEASED}</strong></div>
        </section>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}

        <section className="vault-section">
          <div className="admin-claims-heading">
            <div><h2>Receive an item into secure storage</h2><p>Only approved reports that are physically in QCU custody should be received.</p></div>
            <button type="button" onClick={() => void loadVault()} disabled={isLoading}>{isLoading ? 'Refreshing…' : 'Refresh'}</button>
          </div>
          {isLoading ? <p className="admin-empty" role="status">Loading approved reports…</p>
            : intakeCandidates.length === 0 ? <p className="admin-empty">No approved items are ready for vault intake.</p>
              : <div className="vault-candidate-list">
                {intakeCandidates.map((report) => (
                  <form className="vault-candidate" key={report.id} onSubmit={(event) => void receiveItem(event, report)}>
                    <div>
                      <span className="admin-status admin-status--pending">{report.type} · {report.status.replaceAll('_', ' ')}</span>
                      <h3>{report.title}</h3>
                      <p>{report.type === 'Lost' ? 'Confirmed found lost-item report' : 'Approved found-item report'}</p>
                    </div>
                    <label>
                      Secure storage location
                      <input
                        required
                        minLength={2}
                        maxLength={120}
                        value={storageLocations[report.id] ?? report.custodyLocation ?? ''}
                        onChange={(event) => setStorageLocations((current) => ({ ...current, [report.id]: event.target.value }))}
                        placeholder="Office, room, cabinet, or locker"
                      />
                    </label>
                    <button type="submit" className="admin-approve" disabled={busyId === report.id}>
                      {busyId === report.id ? 'Saving…' : 'Receive into vault'}
                    </button>
                  </form>
                ))}
              </div>}
        </section>

        <section className="vault-section">
          <div className="admin-claims-heading">
            <h2>Vault records</h2>
            <span>{counts.ACTIVE} active · {counts.RELEASED} handed over</span>
          </div>
          <div className="admin-tabs" role="tablist" aria-label="Filter vault entries">
            {filters.map((entry) => (
              <button
                key={entry.value}
                type="button"
                role="tab"
                aria-selected={filter === entry.value}
                className={filter === entry.value ? 'admin-tab admin-tab--active' : 'admin-tab'}
                onClick={() => setFilter(entry.value)}
              >
                {entry.label} <span>{entry.value === 'ALL' ? counts.ACTIVE + counts.RELEASED : counts[entry.value]}</span>
              </button>
            ))}
          </div>
          {isLoading ? <p className="admin-empty" role="status">Loading vault records…</p>
            : visibleEntries.length === 0 ? <p className="admin-empty">No {filter === 'ACTIVE' ? 'items in the vault' : filter === 'RELEASED' ? 'completed handovers' : 'vault records'} yet.</p>
              : <div className="vault-entry-list">
                {visibleEntries.map((entry) => (
                  <article className="vault-entry" key={entry.id}>
                    <header>
                      <div>
                        <span className={`admin-status ${entry.releasedAt ? 'admin-status--approved' : 'admin-status--pending'}`}>
                          {entry.releasedAt ? 'Handed over' : 'In vault'}
                        </span>
                        <h3>{entry.itemTitle}</h3>
                        <p>{entry.reportType === 'FOUND' ? 'Found-item report' : 'Lost-item report'} · {entry.storageLocation || 'Storage location not recorded'}</p>
                      </div>
                      <time dateTime={entry.receivedAt}>Received {new Date(entry.receivedAt).toLocaleString()}</time>
                    </header>
                    <p className="vault-entry__custody">Received by {entry.receivedByName}. Reported by {entry.reporter.fullName}.</p>
                    {entry.releasedAt ? (
                      <section className="vault-entry__handover">
                        {entry.handovers.map((handover) => (
                          <p key={handover.id}>
                            Released to <strong>{handover.recipient.fullName}</strong> by {handover.guardName} on {new Date(handover.releasedAt).toLocaleString()}.
                          </p>
                        ))}
                      </section>
                    ) : entry.eligibleRecipients.length === 0 ? (
                      <p className="vault-entry__waiting">Waiting for an approved claim or confirmed lost-report owner before release.</p>
                    ) : (
                      <form className="vault-handover-form" onSubmit={(event) => void recordHandover(event, entry)}>
                        <label>
                          Verified recipient
                          <select
                            value={recipientSelections[entry.id] || entry.eligibleRecipients[0].id}
                            onChange={(event) => setRecipientSelections((current) => ({ ...current, [entry.id]: event.target.value }))}
                          >
                            {entry.eligibleRecipients.map((recipient) => (
                              <option key={recipient.id} value={recipient.id}>
                                {recipient.fullName} · {recipient.reason}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Handover code presented by recipient
                          <input
                            required
                            maxLength={50}
                            autoComplete="off"
                            value={handoverCodes[entry.id] ?? ''}
                            onChange={(event) => setHandoverCodes((current) => ({ ...current, [entry.id]: event.target.value }))}
                            placeholder="QCU-…"
                          />
                        </label>
                        <button type="submit" className="admin-approve" disabled={busyId === entry.id}>
                          {busyId === entry.id ? 'Saving…' : 'Record physical handover'}
                        </button>
                      </form>
                    )}
                  </article>
                ))}
              </div>}
        </section>
      </main>
      <PublicFooter />
    </div>
  );
};
