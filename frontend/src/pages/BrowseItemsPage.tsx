import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { useAuth } from '../lib/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { readImageAsDataUrl } from '../lib/readImageAsDataUrl';
import { getSavedItems, saveSavedItems, type ItemListing } from '../lib/itemData';
import './BrowseItemsPage.css';

type ApiItem = {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'Lost' | 'Found';
  location: string;
  occurredAt: string;
  createdAt: string;
  imageUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO';
  lostItemStatus?: 'OPEN' | 'MATCH_PENDING' | 'FOUND' | 'RETURNED';
};

const toDisplayItem = (item: ApiItem): ItemListing => ({
  id: item.id,
  title: item.title,
  description: item.description,
  category: item.category,
  status: item.type,
  location: item.location,
  date: new Date(item.occurredAt).toLocaleDateString(),
  daysAgo: Math.max(0, Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86_400_000)),
  icon: item.category === 'Keys' ? '🔑' : item.category === 'Electronics' ? '🎧' : item.category === 'Accessories' ? '👓' : item.category === 'Bags & wallets' ? '🎒' : '📦',
  color: item.type === 'Found' ? 'mint' : 'sage',
  reporter: 'QCU community member',
  imageUrl: item.imageUrl,
  mediaType: item.mediaType,
  lostItemStatus: item.lostItemStatus,
});

export const BrowseItemsPage = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [items, setItems] = useState<ItemListing[]>([]);
  const [isLoadingItems, setIsLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All items' | 'Lost' | 'Found'>('All items');
  const [category, setCategory] = useState('All categories');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [categories, setCategories] = useState(['All categories']);
  const [location, setLocation] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const selectedItem = items.find((item) => item.id === itemId);

  useEffect(() => {
    let active = true;
    apiRequest<string[]>('/items/categories')
      .then((records) => {
        if (active) setCategories(['All categories', ...records]);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (status !== 'All items') params.set('type', status);
    if (category !== 'All categories') params.set('category', category);
    if (location.trim()) params.set('location', location.trim());
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    params.set('sort', sortOrder);
    params.set('page', String(page));
    params.set('pageSize', '12');
    apiRequest<{ items: ApiItem[]; total: number; totalPages: number }>(`/items?${params.toString()}`)
      .then((result) => {
        if (active) {
          setItems(result.items.map(toDisplayItem));
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
      })
      .catch((reason: unknown) => {
        if (active) setItemsError(reason instanceof Error ? reason.message : 'Items could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoadingItems(false);
      });
    return () => {
      active = false;
    };
  }, [category, dateFrom, dateTo, location, page, query, sortOrder, status]);

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
          <form className="browse-search" role="search" onSubmit={(event) => { event.preventDefault(); setPage(1); }}>
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
            <label className="browse-search__location"><span aria-hidden="true">⌖</span><input type="search" value={location} onChange={(event) => { setLocation(event.target.value); setPage(1); }} placeholder="Location" aria-label="Location" /></label>
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
              <select value={sortOrder} onChange={(event) => { setSortOrder(event.target.value as 'newest' | 'oldest'); setPage(1); }}>
                <option value="newest">Most recent</option>
                <option value="oldest">Oldest</option>
              </select>
            </label>
          </div>
          <div className="browse-controls">
            <div className="browse-tabs" role="group" aria-label="Filter by item status">
              {(['All items', 'Lost', 'Found'] as const).map((filter) => (
                <button key={filter} type="button" className={status === filter ? 'browse-tab browse-tab--active' : 'browse-tab'} aria-pressed={status === filter} onClick={() => { setStatus(filter); setPage(1); }}>
                  {filter}
                </button>
              ))}
            </div>
            <label className="browse-category">
              <span>From</span>
              <input type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
            </label>
            <label className="browse-category">
              <span>To</span>
              <input type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
            </label>
            <label className="browse-category">
              <span aria-hidden="true">▦</span>
              <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} aria-label="Filter by category">
                {categories.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
          </div>

          {isLoadingItems ? (
            <p className="browse-empty" role="status">Loading community items…</p>
          ) : itemsError ? (
            <div className="browse-empty" role="alert"><h3>Items could not be loaded</h3><p>{itemsError}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></div>
          ) : items.length ? (
            <div className="browse-grid">
              {items.map((item) => (
                <Link className="item-card" to={`/items/${item.id}`} key={item.id}>
                  <div className={`item-card__visual item-card__visual--${item.color}`} aria-hidden="true">
                    <span className={`item-card__status item-card__status--${item.status.toLowerCase()}`}>{item.status === 'Found' ? '✓' : '⌕'} {item.status}</span>
                    {item.imageUrl
                      ? item.mediaType === 'VIDEO'
                        ? <video className="item-card__photo" src={item.imageUrl} muted preload="metadata" />
                        : <img className="item-card__photo" src={item.imageUrl} alt="" />
                      : <span className="item-card__emoji">{item.icon}</span>}
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
              <button type="button" onClick={() => { setQuery(''); setStatus('All items'); setCategory('All categories'); setLocation(''); setDateFrom(''); setDateTo(''); setPage(1); }}>Clear filters</button>
            </div>
          )}
          <div className="browse-results">
            <span>Showing {items.length} of {total} community items</span>
            <button type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Next</button>
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
          ? <ItemDetails item={selectedItem} foundItems={items.filter((entry) => entry.status === 'Found')} userName={user?.fullName ?? 'Guest'} isAuthenticated={Boolean(user)} onClose={() => navigate('/items')} />
          : !isLoadingItems && !itemsError ? <div className="item-modal-backdrop" role="presentation" onMouseDown={() => navigate('/items')}><section className="item-modal item-modal--not-found" role="dialog" aria-modal="true" aria-labelledby="item-not-found"><button type="button" className="item-modal__close" onClick={() => navigate('/items')} aria-label="Close item details">×</button><h2 id="item-not-found">Item not found</h2><p>This listing may have been removed or returned.</p></section></div>
            : null
      )}
    </div>
  );
};

const ItemDetails = ({ item, foundItems, userName, isAuthenticated, onClose }: { item: ItemListing; foundItems: ItemListing[]; userName: string; isAuthenticated: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => getSavedItems().includes(item.id));
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimAnswer, setClaimAnswer] = useState('');
  const [claimEvidence, setClaimEvidence] = useState('');
  const [proofImage, setProofImage] = useState<File | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [matchDetails, setMatchDetails] = useState('');
  const [matchedFoundItemId, setMatchedFoundItemId] = useState('');
  const [feedback, setFeedback] = useState('');
  const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
  const [isSubmittingMatch, setIsSubmittingMatch] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const toggleSaved = () => {
    const current = getSavedItems();
    const updated = saved ? current.filter((id) => id !== item.id) : [...current, item.id];
    saveSavedItems(updated);
    setSaved(!saved);
  };

  const submitClaim = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback('');
    setIsSubmittingClaim(true);
    try {
      const proofImageDataUrl = proofImage ? await readImageAsDataUrl(proofImage) : undefined;
      await apiRequest('/claims', {
        method: 'POST',
        body: JSON.stringify({
          itemId: item.id,
          hiddenDetailAnswer: claimAnswer.trim(),
          lastSeen: claimEvidence.trim(),
          proofImageDataUrl,
        }),
      });
      setClaimOpen(false);
      setClaimAnswer('');
      setClaimEvidence('');
      setProofImage(null);
      setFeedback('Your claim was submitted for administrator review.');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'The claim could not be submitted.');
    } finally {
      setIsSubmittingClaim(false);
    }
  };

  const selectProofImage = (file?: File) => {
    setFeedback('');
    if (!file) {
      setProofImage(null);
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setProofImage(null);
      setFeedback('Choose a JPG, PNG, or WebP image for your evidence.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setProofImage(null);
      setFeedback('Choose an evidence image smaller than 1 MB.');
      return;
    }
    setProofImage(file);
  };

  const submitMatchSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback('');
    setIsSubmittingMatch(true);
    try {
      await apiRequest(`/items/${item.id}/matches`, {
        method: 'POST',
        body: JSON.stringify({
          note: matchDetails.trim(),
          foundItemId: matchedFoundItemId || undefined,
        }),
      });
      setMatchOpen(false);
      setMatchDetails('');
      setMatchedFoundItemId('');
      setFeedback('Your found-item match was sent to an administrator for review.');
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'The match suggestion could not be submitted.');
    } finally {
      setIsSubmittingMatch(false);
    }
  };

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content) return;
    setFeedback('');
    setIsSendingMessage(true);
    try {
      const conversation = await apiRequest<{ id: string }>('/conversations', {
        method: 'POST',
        body: JSON.stringify({ itemId: item.id, content }),
      });
      navigate(`/messages?conversation=${conversation.id}`);
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : 'Your message could not be sent.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="item-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="item-modal" role="dialog" aria-modal="true" aria-labelledby="item-modal-title">
        <div className="item-modal__topline"><span>Lost &amp; found / Item details</span><button type="button" className="item-modal__close" onClick={onClose} aria-label="Close item details">×</button></div>
        <div className="item-modal__overview">
          <div className={`item-modal__visual item-card__visual--${item.color}`}>{item.imageUrl
            ? item.mediaType === 'VIDEO'
              ? <video src={item.imageUrl} controls preload="metadata" />
              : <img src={item.imageUrl} alt={item.title} />
            : <span aria-hidden="true">{item.icon}</span>}</div>
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
        {item.status === 'Lost' && (
          <section className="item-modal__claim">
            <div>
              <strong>Have you found this item?</strong>
              <p>Suggest a match to the administrator. The report owner is notified only after review.</p>
            </div>
            {item.lostItemStatus === 'MATCH_PENDING'
              ? <span>Match under review</span>
              : isAuthenticated
                ? <button type="button" className="demo-button" onClick={() => { setMatchOpen(!matchOpen); setFeedback(''); }}>{matchOpen ? 'Cancel' : 'Suggest a match'}</button>
                : <Link className="demo-button" to="/login" state={{ from: `/items/${item.id}` }}>Log in to suggest a match</Link>}
          </section>
        )}
        {matchOpen && item.status === 'Lost' && (
          <form className="demo-form item-claim-form" onSubmit={(event) => void submitMatchSuggestion(event)}>
            <label>Where and when did you find it? Add details for the administrator to compare.<textarea required minLength={8} maxLength={1000} value={matchDetails} onChange={(event) => setMatchDetails(event.target.value)} placeholder="Describe the circumstances, location, and distinguishing details." /></label>
            <label>Link an approved found-item report (optional)
              <select value={matchedFoundItemId} onChange={(event) => setMatchedFoundItemId(event.target.value)}>
                <option value="">I have not posted a found-item report</option>
                {foundItems.map((foundItem) => <option value={foundItem.id} key={foundItem.id}>{foundItem.title} · {foundItem.location}</option>)}
              </select>
            </label>
            <p>If you have not posted a found report, an administrator can still review your suggestion and record where the owner can collect the item.</p>
            <button type="submit" className="demo-button" disabled={isSubmittingMatch}>{isSubmittingMatch ? 'Sending…' : 'Send match for review'}</button>
          </form>
        )}
        {claimOpen && (
          <form className="demo-form item-claim-form" onSubmit={(event) => void submitClaim(event)}>
            <label>Describe unique characteristics, brand/model, accessories, or contents.<textarea required minLength={8} value={claimAnswer} onChange={(event) => setClaimAnswer(event.target.value)} placeholder="Share multiple details that are not in the public listing." /></label>
            <label>When and where did you last have it?<input required value={claimEvidence} onChange={(event) => setClaimEvidence(event.target.value)} placeholder="Approximate date and campus location" /></label>
            <label>Additional evidence image (optional)<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => selectProofImage(event.currentTarget.files?.[0])} /></label>
            {proofImage && <p>{proofImage.name}</p>}
            <p>Claims are reviewed by an administrator. Approval verifies the claim but does not confirm that the item has been physically handed over.</p>
            <button type="submit" className="demo-button" disabled={isSubmittingClaim}>{isSubmittingClaim ? 'Submitting…' : 'Submit claim for review'}</button>
          </form>
        )}

        {isAuthenticated ? (
          <form className="item-modal__message" onSubmit={(event) => void sendMessage(event)}>
            <label htmlFor="item-message">Have a lead? Send the poster a private message.</label>
            <textarea id="item-message" required maxLength={2000} value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder="Share where you saw it or how you can help." />
            <div><span>This message is private to you and the poster.</span><button type="submit" className="demo-button" disabled={isSendingMessage}>{isSendingMessage ? 'Sending…' : 'Send message →'}</button></div>
          </form>
        ) : <p className="item-modal__login-prompt"><Link to="/login" state={{ from: `/items/${item.id}` }}>Log in</Link> to message the reporter.</p>}
        {feedback && <p className="item-modal__feedback" role="status">{feedback}</p>}
        <div className="item-modal__safety"><strong>A safe reunion starts with a little care.</strong><span>Verify ownership and meet in a public place.</span><Link to="/threads">View community threads ↗</Link></div>
      </section>
    </div>
  );
};
