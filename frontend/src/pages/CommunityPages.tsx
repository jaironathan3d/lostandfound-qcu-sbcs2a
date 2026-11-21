import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { useAuth } from '../lib/AuthContext';
import { apiRequest } from '../lib/apiClient';
import { readImageAsDataUrl } from '../lib/readImageAsDataUrl';
import type { ItemStatus } from '../lib/itemData';
import './CommunityPages.css';

const categories = ['Bags & wallets', 'Keys', 'Electronics', 'Everyday items', 'Accessories', 'Other'];

export const ReportItemPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const initialType: ItemStatus = searchParams.get('type') === 'found' ? 'Found' : 'Lost';
  const defaultContact = user?.email.includes('@') ? user.email : '';
  const [type, setType] = useState<ItemStatus>(initialType);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [description, setDescription] = useState('');
  const [privateDetails, setPrivateDetails] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [contact, setContact] = useState(defaultContact);
  const [custodyLocation, setCustodyLocation] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const changeType = (nextType: ItemStatus) => {
    setType(nextType);
    setSearchParams({ type: nextType.toLowerCase() });
    setSuccess(false);
  };

  const onPhotoChange = (file?: File) => {
    setError('');
    if (!file) {
      setPhoto(null);
      setPhotoPreview('');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Choose a JPG, PNG, or WebP image to attach.');
      return;
    }
    if (file.size > 1024 * 1024) {
      setError('Choose a photo smaller than 1 MB.');
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const imageDataUrl = photo ? await readImageAsDataUrl(photo) : undefined;
      await apiRequest('/items', {
        method: 'POST',
        body: JSON.stringify({
          type,
          title: title.trim(),
          category,
          location: location.trim(),
          occurredAt: date,
          description: description.trim(),
          privateDetails: privateDetails.trim(),
          contactEmail: contact.trim(),
          custodyLocation: type === 'Found' ? custodyLocation.trim() : undefined,
          imageDataUrl,
        }),
      });
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The report could not be saved.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="community-page">
      <PublicHeader />
      <section className="community-banner">
        <div><Link to="/items">← Back to lost &amp; found</Link><h1>{type === 'Lost' ? 'Let’s help bring it home.' : 'Thank you for looking out.'}</h1><p>Tell your neighbors what you {type.toLowerCase()} and where it happened.</p></div>
      </section>
      <main className="report-layout">
        {success ? (
          <section className="report-success" role="status">
            <span aria-hidden="true">✓</span><h2>Your {type.toLowerCase()} item report is saved.</h2>
            <p>Your report is saved and waiting for administrator approval. It will appear in public listings after approval.</p>
            <Link className="community-button" to="/my-reports">Track or delete your pending report</Link>
          </section>
        ) : (
          <>
            <form className="report-form" onSubmit={(event) => void submitReport(event)}>
              <div className="report-form__heading"><div><h2>Report an item</h2><p>Fields marked with * are required.</p></div><span>QCU LOST &amp; FOUND</span></div>
              <div className="report-type-switch" role="group" aria-label="Report type">
                {(['Lost', 'Found'] as const).map((option) => <button key={option} type="button" className={type === option ? 'report-type-switch__active' : ''} aria-pressed={type === option} onClick={() => changeType(option)}>I {option.toLowerCase()} something</button>)}
              </div>
              <fieldset>
                <legend>1. About your item</legend>
                <p className="report-help">Share enough detail to help identify the item. Keep one or two distinctive details private.</p>
                <label>Item name *<input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Olive green backpack" /></label>
                <div className="report-form__row">
                  <label>Category *<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((option) => <option key={option}>{option}</option>)}</select></label>
                  <label>Date {type === 'Lost' ? 'lost' : 'found'} *<input type="date" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
                </div>
                <label>Public description *<textarea required minLength={8} maxLength={600} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Color, general appearance, and other non-sensitive details." /></label>
                <label>Private identifying details{type === 'Found' ? ' *' : ' (optional)'}<textarea required={type === 'Found'} minLength={type === 'Found' ? 5 : undefined} maxLength={1000} value={privateDetails} onChange={(event) => setPrivateDetails(event.target.value)} placeholder="A unique mark, contents, brand/model, or accessory. Never shown on the public listing." /></label>
              </fieldset>
              <fieldset>
                <legend>2. When and where</legend>
                <label>Approximate campus location *<input required maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Building, floor, or nearby landmark" /></label>
                {type === 'Found' && <label>Current custody or storage location *<input required maxLength={120} value={custodyLocation} onChange={(event) => setCustodyLocation(event.target.value)} placeholder="e.g. Handed in at the campus security office" /></label>}
              </fieldset>
              <fieldset>
                <legend>3. How neighbors can reach you</legend>
                <label>Contact email<input type="email" maxLength={254} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Your campus email (optional)" /></label>
                <p className="report-help">Your contact email is stored privately and is not shown on the public listing.</p>
              </fieldset>
              {error && <p className="community-error" role="alert">{error}</p>}
              <div className="report-form__actions"><button type="submit" className="community-button" disabled={isSubmitting}>{isSubmitting ? 'Saving report…' : `Post ${type.toLowerCase()} item →`}</button></div>
            </form>

            <aside className="report-aside">
              <section className="report-photo">
                <h2>Add a photo</h2><p>Optional. A clear photo can help make all the difference.</p>
                {photoPreview ? <img className="report-photo__preview" src={photoPreview} alt="Selected item preview" /> : <div className="report-photo__empty" aria-hidden="true">⌑</div>}
                <label className="community-button community-button--secondary report-photo__picker">＋ Add a photo<input type="file" accept="image/*" onChange={(event) => onPhotoChange(event.currentTarget.files?.[0])} /></label>
                {photo && <button type="button" className="report-photo__remove" onClick={() => onPhotoChange()}>Remove {photo.name}</button>}
                <small>JPG, PNG, or WebP · Up to 1 MB</small>
              </section>
              <section className="report-guidance"><h2>A good report goes a long way.</h2><strong>Be specific</strong><p>Mention the color, brand, and any visible features.</p><strong>Keep a detail just for you</strong><p>Save a unique mark or the contents to help prove ownership.</p><strong>Stay safe</strong><p>Meet in a public place and never send money to recover an item.</p></section>
              <section className="report-guidance report-guidance--plain"><h2>What happens next?</h2><p>An administrator reviews your report before it appears in the lost &amp; found listings. Private identifying details and contact information are never shown publicly.</p></section>
            </aside>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
};

type CommunityThread = {
  id: string;
  title: string;
  excerpt: string;
  authorId: string;
  author: string;
  createdAt: string;
  replies: Array<{ id: string; author: string; content: string; createdAt: string }>;
  replyCount: number;
  followerCount: number;
};

const formatThreadTime = (date: string): string => new Date(date).toLocaleString();

export const ThreadsPage = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState<CommunityThread[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'All threads' | 'Following' | 'My threads'>('All threads');
  const [query, setQuery] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [records, follows] = await Promise.all([
        apiRequest<CommunityThread[]>('/threads'),
        user ? apiRequest<string[]>('/threads/following') : Promise.resolve([]),
      ]);
      setThreads(records);
      setFollowing(follows);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Community threads could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const visibleThreads = useMemo(() => {
    const search = query.trim().toLowerCase();
    return threads.filter((thread) => {
      const matchesFilter = filter === 'All threads'
        || (filter === 'Following' ? following.includes(thread.id) : thread.authorId === user?.id);
      return matchesFilter && `${thread.title} ${thread.excerpt}`.toLowerCase().includes(search);
    });
  }, [filter, following, query, threads, user?.id]);

  const toggleFollow = async (id: string) => {
    const isFollowing = following.includes(id);
    setError('');
    try {
      await apiRequest<void>(`/threads/${id}/follow`, { method: isFollowing ? 'DELETE' : 'POST' });
      setFollowing(isFollowing ? following.filter((threadId) => threadId !== id) : [...following, id]);
      setThreads((current) => current.map((thread) => thread.id === id
        ? { ...thread, followerCount: thread.followerCount + (isFollowing ? -1 : 1) }
        : thread));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The follow status could not be updated.');
    }
  };

  const addReply = async (event: FormEvent<HTMLFormElement>, thread: CommunityThread) => {
    event.preventDefault();
    const text = replyDrafts[thread.id]?.trim();
    if (!text) return;
    setError('');
    try {
      await apiRequest(`/threads/${thread.id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setReplyDrafts({ ...replyDrafts, [thread.id]: '' });
      setStatus('Reply posted.');
      await loadThreads();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The reply could not be posted.');
    }
  };

  const startThread = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    try {
      await apiRequest('/threads', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim() }),
      });
      setNewTitle('');
      setNewBody('');
      setIsStarting(false);
      setStatus('Your thread is now visible to the community.');
      await loadThreads();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The thread could not be posted.');
    }
  };

  return (
    <div className="community-page">
      <PublicHeader />
      <section className="community-banner community-banner--threads"><div><p className="community-eyebrow">YOUR NEIGHBORHOOD, CONNECTED</p><h1>Community threads</h1><p>A sighting, a question, a happy reunion. Every little update helps.</p></div>{user ? <button type="button" className="community-button" onClick={() => setIsStarting(!isStarting)}>{isStarting ? 'Cancel' : '+ Start a thread'}</button> : <Link className="community-button" to="/login" state={{ from: '/threads' }}>Log in to start a thread</Link>}</section>
      <main className="threads-layout">
        <section className="threads-main">
          <div className="thread-controls">
            <label className="thread-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search threads, items or neighborhoods" /></label>
            <div className="thread-filters">{(['All threads', 'Following', 'My threads'] as const).map((option) => <button key={option} type="button" className={filter === option ? 'thread-filter--active' : ''} onClick={() => setFilter(option)} disabled={option !== 'All threads' && !user}>{option}</button>)}</div>
            <span className="thread-location">QCU campus community</span>
          </div>
          {status && <p className="thread-status" role="status">{status}</p>}
          {error && <p className="community-error" role="alert">{error}</p>}
          {isStarting && <form className="thread-compose" onSubmit={(event) => void startThread(event)}><h2>Start a community thread</h2><label>Thread title<input required maxLength={100} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What would you like neighbors to know?" /></label><label>Message<textarea required minLength={4} maxLength={1000} value={newBody} onChange={(event) => setNewBody(event.target.value)} placeholder="Keep personal and identifying details private." /></label><button className="community-button" type="submit">Post thread</button></form>}
          {isLoading ? <div className="browse-empty" role="status">Loading community threads…</div> : visibleThreads.length ? visibleThreads.map((thread) => (
            <article className="thread-card" key={thread.id}>
              <div className="thread-card__content">
                <div className="thread-card__meta"><span>COMMUNITY</span><span>{thread.author} · {formatThreadTime(thread.createdAt)}</span></div>
                <h2>{thread.title}</h2><p>{thread.excerpt}</p>
                {thread.replies.length > 0 && <div className="thread-card__reply"><strong>{thread.replies[thread.replies.length - 1].author}</strong><p>{thread.replies[thread.replies.length - 1].content}</p></div>}
                <div className="thread-card__actions"><span>{thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'} · {thread.followerCount} following</span>{user ? <button type="button" onClick={() => void toggleFollow(thread.id)}>{following.includes(thread.id) ? 'Following ✓' : 'Follow thread'}</button> : <Link to="/login" state={{ from: '/threads' }}>Log in to follow</Link>}</div>
                {user
                  ? <form className="thread-reply-form" onSubmit={(event) => void addReply(event, thread)}><input aria-label={`Reply to ${thread.title}`} maxLength={500} value={replyDrafts[thread.id] ?? ''} onChange={(event) => setReplyDrafts({ ...replyDrafts, [thread.id]: event.target.value })} placeholder="Add a helpful reply…" /><button type="submit">Reply →</button></form>
                  : <p className="thread-login-prompt"><Link to="/login" state={{ from: '/threads' }}>Log in</Link> to reply to this thread.</p>}
              </div>
            </article>
          )) : <div className="browse-empty"><h3>No threads here yet</h3><p>Try a different filter, or start a conversation with your neighbors.</p>{user ? <button type="button" onClick={() => setIsStarting(true)}>Start a thread</button> : <Link to="/login" state={{ from: '/threads' }}>Log in to start a thread</Link>}</div>}
        </section>
        <aside className="threads-aside">
          <section><h2>Small updates. Big help.</h2><p>Share a sighting or ask your neighbors. Keep the conversation kind, local and useful.</p><Link className="community-button" to="/report-item?type=lost">Report a lost item ↗</Link></section>
          <section><h2>QCU community</h2><strong>{threads.length} active {threads.length === 1 ? 'thread' : 'threads'}</strong><p>Conversations posted by members of the campus community.</p></section>
          <section><h2>A friendly reminder</h2><p>Keep phone numbers, addresses and identifying details out of public posts. Use a private message to arrange a safe reunion.</p><Link to="/safety-help">Read our safety tips ↗</Link></section>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
};

type MyClaimsResponse = {
  claims: Array<{
    id: string;
    itemId: string;
    itemTitle: string;
    status: 'PENDING' | 'VERIFIED' | 'REJECTED';
    submittedAt: string;
  }>;
  foundLostItems: Array<{
    id: string;
    title: string;
    status: 'FOUND' | 'RETURNED';
    foundItemTitle: string | null;
    resolutionLocation: string | null;
    updatedAt: string;
  }>;
};

export const MyClaimsPage = () => {
  const [history, setHistory] = useState<MyClaimsResponse>({ claims: [], foundLostItems: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<MyClaimsResponse>('/claims/mine')
      .then((records) => {
        if (active) setHistory(records);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Your claims could not be loaded.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="community-page">
      <PublicHeader />
      <section className="community-banner"><div><p className="community-eyebrow">YOUR ACCOUNT</p><h1>My claims</h1><p>Track ownership claims you’ve submitted.</p></div></section>
      <main className="claims-list">
        {isLoading
          ? <p role="status">Loading your claims…</p>
          : error
            ? <p className="community-error" role="alert">{error}</p>
            : <>
              <section className="claims-history-section">
                <h2>Items you successfully claimed</h2>
                {history.claims.some((claim) => claim.status === 'VERIFIED')
                  ? history.claims.filter((claim) => claim.status === 'VERIFIED').map((claim) => (
                    <article className="claim-card" key={claim.id}>
                      <div><span className="claim-status">Ownership approved</span><h3>{claim.itemTitle}</h3><p>Approved {new Date(claim.submittedAt).toLocaleDateString()}</p></div>
                      <p>Your ownership claim was approved. Contact the poster or campus office to arrange collection; approval alone does not confirm a handover.</p>
                    </article>
                  ))
                  : <p>No approved ownership claims yet.</p>}
              </section>
              <section className="claims-history-section">
                <h2>Your lost items found</h2>
                {history.foundLostItems.length
                  ? history.foundLostItems.map((item) => (
                    <article className="claim-card" key={item.id}>
                      <div><span className="claim-status">{item.status === 'RETURNED' ? 'Returned to you' : 'Found — ready to claim'}</span><h3>{item.title}</h3><p>Updated {new Date(item.updatedAt).toLocaleDateString()}</p></div>
                      <p>{item.foundItemTitle ? `Matched found-item report: ${item.foundItemTitle}. ` : ''}{item.resolutionLocation ? `Collection location: ${item.resolutionLocation}.` : 'Please contact campus staff to arrange collection.'}</p>
                    </article>
                  ))
                  : <p>Lost reports confirmed as found will appear here.</p>}
              </section>
              <section className="claims-history-section">
                <h2>Other claim requests</h2>
                {history.claims.filter((claim) => claim.status !== 'VERIFIED').length
                  ? history.claims.filter((claim) => claim.status !== 'VERIFIED').map((claim) => (
                    <article className="claim-card" key={claim.id}>
                      <div><span className="claim-status">{claim.status === 'REJECTED' ? 'Rejected' : 'Pending review'}</span><h3>{claim.itemTitle}</h3><p>Submitted {new Date(claim.submittedAt).toLocaleDateString()}</p></div>
                      <p>{claim.status === 'PENDING' ? 'An administrator is reviewing your claim.' : 'Your claim was not approved. Contact campus support if you need more information.'}</p>
                    </article>
                  ))
                  : <p>No other claim requests.</p>}
              </section>
              {!history.claims.length && !history.foundLostItems.length && <div className="browse-empty"><h2>No claims or found lost items yet</h2><p>Your ownership claims and lost reports confirmed as found will appear here.</p><Link className="community-button" to="/items">Browse items</Link></div>}
            </>}
      </main>
      <PublicFooter />
    </div>
  );
};
