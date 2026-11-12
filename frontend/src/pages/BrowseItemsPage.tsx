import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { useAuth } from '../lib/AuthContext';
import {
  getClaims,
  getItems,
  getMessages,
  getSavedItems,
  saveClaims,
  saveMessages,
  saveSavedItems,
  type DemoClaim,
  type DemoItem,
  type DemoMessage,
} from './demoData';
import './BrowseItemsPage.css';

const categories = ['All categories', 'Bags & wallets', 'Keys', 'Electronics', 'Everyday items', 'Accessories', 'Other'];

export const BrowseItemsPage = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items] = useState(getItems);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All items' | 'Lost' | 'Found'>('All items');
  const [category, setCategory] = useState('All categories');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const selectedItem = items.find((item) => item.id === itemId);

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return items
      .filter((item) => status === 'All items' || item.status === status)
      .filter((item) => category === 'All categories' || item.category === category)
      .filter((item) => `${item.title} ${item.category} ${item.location} ${item.description}`.toLowerCase().includes(normalizedQuery))
      .sort((first, second) => sortOrder === 'newest' ? first.daysAgo - second.daysAgo : second.daysAgo - first.daysAgo);
  }, [category, items, query, sortOrder, status]);

  useEffect(() => {
    if (!selectedItem) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') navigate('/items');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [navigate, selectedItem]);

  return (
    <div className="browse-page">
      <PublicHeader />
      <main className="browse-main">
        <section className="browse-hero" aria-labelledby="browse-hero-title">
          <div className="browse-hero__intro">
            <p className="browse-eyebrow">YOUR QCU COMMUNITY LOST &amp; FOUND</p>
            <h1 id="browse-hero-title">Lost something?<br />Let’s bring it home.</h1>
            <p>From everyday essentials to irreplaceable favorites.<br className="browse-desktop-break" /> Find what’s missing, or help someone find theirs.</p>
          </div>
          <div className="browse-hero__actions">
            <Link to="/report-item?type=lost" className="browse-hero-card browse-hero-card--light">
              <span className="browse-hero-card__icon" aria-hidden="true">⌕</span>
              <span><strong>I lost something</strong><small>Report it and let your community help.</small></span>
              <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/report-item?type=found" className="browse-hero-card browse-hero-card--green">
              <span className="browse-hero-card__icon" aria-hidden="true">✓</span>
              <span><strong>I found something</strong><small>Let’s find its owner. Make someone’s day.</small></span>
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <form className="browse-search" role="search" onSubmit={(event) => event.preventDefault()}>
            <label className="browse-search__input">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder='What are you looking for? Try "keys" or "backpack"'
                aria-label="Search lost and found items"
              />
            </label>
            <span className="browse-search__location"><span aria-hidden="true">⌖</span> Quezon City University</span>
            <button type="submit" className="browse-search__button">⌕ Search items</button>
          </form>
        </section>

        <section className="browse-listings" aria-labelledby="browse-listings-title">
          <div className="browse-listings__heading">
            <div>
              <h2 id="browse-listings-title">Around your campus</h2>
              <p>A small clue could be the start of a happy reunion.</p>
            </div>
            <label className="browse-sort">
              <span>Sort by:</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as 'newest' | 'oldest')}>
                <option value="newest">Most recent</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
          </div>
          <div className="browse-controls">
            <div className="browse-tabs" role="group" aria-label="Filter by item status">
              {(['All items', 'Lost', 'Found'] as const).map((filter) => (
                <button key={filter} type="button" className={status === filter ? 'browse-tab browse-tab--active' : 'browse-tab'} aria-pressed={status === filter} onClick={() => setStatus(filter)}>
                  {filter} <span>{filter === 'All items' ? items.length : items.filter((item) => item.status === filter).length}</span>
                </button>
              ))}
            </div>
            <label className="browse-category">
              <span aria-hidden="true">▦</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Filter by category">
                {categories.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>

          {filteredItems.length ? (
            <div className="browse-grid">
              {filteredItems.map((item) => (
                <Link className="item-card" to={`/items/${item.id}`} key={item.id}>
                  <div className={`item-card__visual item-card__visual--${item.color}`} aria-hidden="true">
                    <span className={`item-card__status item-card__status--${item.status.toLowerCase()}`}>{item.status === 'Found' ? '✓' : '⌕'} {item.status}</span>
                    {item.imageUrl ? <img className="item-card__photo" src={item.imageUrl} alt="" /> : <span className="item-card__emoji">{item.icon}</span>}
                    <span className="item-card__open">↗</span>
                  </div>
                  <div className="item-card__body">
                    <div className="item-card__meta"><span>{item.category}</span><time>{item.date}</time></div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="item-card__location"><span>⌖ {item.location}</span><span className="item-card__views">View details →</span></div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="browse-empty">
              <span aria-hidden="true">⌕</span><h3>No matching items yet</h3>
              <p>Try a different search or category, or check back later.</p>
              <button type="button" onClick={() => { setQuery(''); setStatus('All items'); setCategory('All categories'); }}>Clear filters</button>
            </div>
          )}
          <div className="browse-results">
            <span>Showing {filteredItems.length} of {items.length} community items</span>
            <Link to="/report-item?type=lost">Report an item →</Link>
          </div>
        </section>

        <section className="browse-safety">
          <span className="browse-safety__icon" aria-hidden="true">✓</span>
          <div><strong>Good neighbors. Safe reunions.</strong><p>Keep identifying details private, verify ownership, and choose a public place to meet.</p></div>
          <Link to="/safety-help">Read our safety tips →</Link>
        </section>
      </main>
      <PublicFooter />
      {itemId && (
        selectedItem
          ? <ItemDetails item={selectedItem} userName={user?.fullName ?? 'Guest'} isAuthenticated={Boolean(user)} onClose={() => navigate('/items')} />
          : <div className="item-modal-backdrop" role="presentation" onMouseDown={() => navigate('/items')}><section className="item-modal item-modal--not-found" role="dialog" aria-modal="true" aria-labelledby="item-not-found"><button type="button" className="item-modal__close" onClick={() => navigate('/items')} aria-label="Close item details">×</button><h2 id="item-not-found">Item not found</h2><p>This demo listing may have been removed.</p></section></div>
      )}
    </div>
  );
};

const ItemDetails = ({ item, userName, isAuthenticated, onClose }: { item: DemoItem; userName: string; isAuthenticated: boolean; onClose: () => void }) => {
  const [saved, setSaved] = useState(() => getSavedItems().includes(item.id));
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimAnswer, setClaimAnswer] = useState('');
  const [claimEvidence, setClaimEvidence] = useState('');
  const [evidenceFileName, setEvidenceFileName] = useState('');
  const [feedback, setFeedback] = useState('');

  const toggleSaved = () => {
    const current = getSavedItems();
    const updated = saved ? current.filter((id) => id !== item.id) : [...current, item.id];
    saveSavedItems(updated);
    setSaved(!saved);
  };

  const submitClaim = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const claim: DemoClaim = {
      id: crypto.randomUUID(),
      itemId: item.id,
      itemTitle: item.title,
      submittedAt: new Date().toLocaleDateString(),
      status: 'Pending',
      ownershipDetails: claimAnswer.trim(),
      lastSeen: claimEvidence.trim(),
      evidenceFileName: evidenceFileName || undefined,
    };
    saveClaims([...getClaims(), claim]);
    setClaimOpen(false);
    setClaimAnswer('');
    setClaimEvidence('');
    setEvidenceFileName('');
    setFeedback('Your demo claim was saved as Pending. An administrator must review it before any handover.');
  };

  const sendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const content = formData.get('message');
    if (typeof content !== 'string' || !content.trim()) return;
    const message: DemoMessage = {
      id: crypto.randomUUID(),
      itemId: item.id,
      recipient: item.reporter ?? 'the reporter',
      content: content.trim(),
      sentAt: new Date().toISOString(),
    };
    saveMessages([...getMessages(), message]);
    setFeedback('Your message was saved for this demo session.');
    event.currentTarget.reset();
  };

  return (
    <div className="item-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
        <div className="item-modal__topline"><span>Lost &amp; found / Item details</span><button type="button" className="item-modal__close" onClick={onClose} aria-label="Close item details">×</button></div>
        <div className="item-modal__overview">
          <div className={`item-modal__visual item-card__visual--${item.color}`}>{item.imageUrl ? <img src={item.imageUrl} alt={item.title} /> : <span aria-hidden="true">{item.icon}</span>}</div>
          <div className="item-modal__summary">
            <div className="item-modal__meta"><span className={`item-card__status item-card__status--${item.status.toLowerCase()}`}>{item.status}</span><span>{item.category} · Posted {item.date}</span></div>
            <h2 id="item-modal-title">{item.title}</h2>
            <p>{item.description}</p>
            <div className="item-modal__facts">
              <div><span>Last seen / found</span><strong>{item.location}</strong></div>
              <div><span>Reported</span><strong>{item.date}</strong></div>
            </div>
            <div className="item-modal__byline">Posted by {item.reporter ?? userName} <button type="button" onClick={toggleSaved}>{saved ? 'Saved ✓' : 'Save item'}</button></div>
          </div>
        </div>

        {item.status === 'Found' && (
          <section className="item-modal__claim">
            <div><strong>Think this belongs to you?</strong><p>Share multiple identifying details. Private found-item details are not shown here.</p></div>
            {isAuthenticated
              ? <button type="button" className="demo-button" onClick={() => { setClaimOpen(!claimOpen); setFeedback(''); }}>{claimOpen ? 'Cancel claim' : 'Claim this item'}</button>
              : <Link className="demo-button" to="/login" state={{ from: `/items/${item.id}` }}>Log in to claim</Link>}
          </section>
        )}
        {claimOpen && (
          <form className="demo-form item-claim-form" onSubmit={submitClaim}>
            <label>Describe unique characteristics, brand/model, accessories, or contents.<textarea required minLength={8} value={claimAnswer} onChange={(event) => setClaimAnswer(event.target.value)} placeholder="Share multiple details that are not in the public listing." /></label>
            <label>When and where did you last have it?<input required value={claimEvidence} onChange={(event) => setClaimEvidence(event.target.value)} placeholder="Approximate date and campus location" /></label>
            <label>Additional evidence (receipt, original photo, or other proof)<input type="file" accept="image/*,.pdf" onChange={(event) => setEvidenceFileName(event.currentTarget.files?.[0]?.name ?? '')} /></label>
            <p>Demo only: claim details are stored in this browser. Claims remain Pending; real ownership decisions require independent admin review and must never rely on one answer alone.</p>
            <button type="submit" className="demo-button">Submit claim for review</button>
          </form>
        )}

        {isAuthenticated ? (
          <form className="item-modal__message" onSubmit={sendMessage}>
            <label htmlFor="item-message">Have a lead? Message {item.reporter ?? 'the reporter'}.</label>
            <textarea id="item-message" name="message" required placeholder="Share where you saw it or how you can help." />
            <div><span>Keep personal details out of public threads.</span><button type="submit" className="demo-button">Send message →</button></div>
          </form>
        ) : <p className="item-modal__login-prompt"><Link to="/login" state={{ from: `/items/${item.id}` }}>Log in</Link> to message the reporter.</p>}
        {feedback && <p className="item-modal__feedback" role="status">{feedback}</p>}
        <div className="item-modal__safety"><strong>A safe reunion starts with a little care.</strong><span>Verify ownership and meet in a public place.</span><Link to="/threads">View community threads ↗</Link></div>
      </section>
    </div>
  );
};
