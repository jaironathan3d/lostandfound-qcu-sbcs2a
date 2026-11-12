import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { useAuth } from '../lib/AuthContext';
import {
  getClaims,
  getFollowingThreads,
  getThreads,
  saveFollowingThreads,
  saveItems,
  saveThreads,
  getItems,
  type DemoItem,
  type DemoThread,
  type ItemStatus,
} from './demoData';
import './CommunityPages.css';

const categories = ['Bags & wallets', 'Keys', 'Electronics', 'Everyday items', 'Accessories', 'Other'];

const readImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === 'string') resolve(reader.result);
    else reject(new Error('The selected photo could not be read.'));
  };
  reader.onerror = () => reject(new Error('The selected photo could not be read.'));
  reader.readAsDataURL(file);
});

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
  const [draftMessage, setDraftMessage] = useState('');

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
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file to attach.');
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
    try {
      const imageUrl = photo ? await readImage(photo) : undefined;
      const item: DemoItem = {
        id: crypto.randomUUID(),
        title: title.trim(),
        category,
        status: type,
        location: location.trim(),
        date: date ? new Date(`${date}T12:00:00`).toLocaleDateString() : 'Today',
        daysAgo: 0,
        icon: category === 'Keys' ? '🔑' : category === 'Electronics' ? '🎧' : category === 'Accessories' ? '👓' : category === 'Bags & wallets' ? '🎒' : '📦',
        color: type === 'Found' ? 'mint' : 'sage',
        description: description.trim(),
        privateDetails: privateDetails.trim() || undefined,
        reporter: user?.fullName ?? 'Demo user',
        imageUrl,
        contact: contact.trim() || undefined,
        custodyLocation: type === 'Found' ? custodyLocation.trim() : undefined,
      };
      saveItems([item, ...getItems()]);
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The report could not be saved.');
    }
  };

  const saveDraft = () => {
    window.localStorage.setItem('qcu-demo-report-draft', JSON.stringify({
      type, title, category, description, privateDetails, location, date, contact, custodyLocation,
    }));
    setError('');
    setSuccess(false);
    setDraftMessage('Draft saved in this browser.');
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
            <p>This browser-only demo listing is now available in the community browse page. Private details are kept off the public card.</p>
            <Link className="community-button" to="/items">View lost &amp; found</Link>
          </section>
        ) : (
          <>
            <form className="report-form" onSubmit={(event) => void submitReport(event)}>
              <div className="report-form__heading"><div><h2>Report an item</h2><p>Fields marked with * are required.</p></div><span>DEMO FORM</span></div>
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
                <label>Private identifying details{type === 'Found' ? ' *' : ' (optional)'}<textarea required={type === 'Found'} minLength={type === 'Found' ? 5 : undefined} value={privateDetails} onChange={(event) => setPrivateDetails(event.target.value)} placeholder="A unique mark, contents, brand/model, or accessory. Never shown on the public listing." /></label>
              </fieldset>
              <fieldset>
                <legend>2. When and where</legend>
                <label>Approximate campus location *<input required maxLength={120} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Building, floor, or nearby landmark" /></label>
                {type === 'Found' && <label>Current custody or storage location *<input required maxLength={120} value={custodyLocation} onChange={(event) => setCustodyLocation(event.target.value)} placeholder="e.g. Handed in at the campus security office" /></label>}
              </fieldset>
              <fieldset>
                <legend>3. How neighbors can reach you</legend>
                <label>Contact email<input type="email" maxLength={254} value={contact} onChange={(event) => setContact(event.target.value)} placeholder="Your campus email (optional)" /></label>
                <p className="report-help">Contact information is only for coordinating a safe reunion in this demo.</p>
              </fieldset>
              {error && <p className="community-error" role="alert">{error}</p>}
              {draftMessage && <p className="thread-status" role="status">{draftMessage}</p>}
              <div className="report-form__actions"><button type="button" className="community-button community-button--secondary" onClick={saveDraft}>Save draft</button><button type="submit" className="community-button">Post {type.toLowerCase()} item →</button></div>
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
              <section className="report-guidance report-guidance--plain"><h2>What happens next?</h2><p>Your demo report appears in the lost &amp; found listings. Found-item details stay private on this public screen.</p></section>
            </aside>
          </>
        )}
      </main>
      <PublicFooter />
    </div>
  );
};

export const ThreadsPage = () => {
  const { user } = useAuth();
  const [threads, setThreads] = useState(getThreads);
  const [following, setFollowing] = useState(getFollowingThreads);
  const [filter, setFilter] = useState<'All threads' | 'Following' | 'My threads'>('All threads');
  const [query, setQuery] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');

  const visibleThreads = useMemo(() => {
    const search = query.trim().toLowerCase();
    return threads.filter((thread) => {
      const matchesFilter = filter === 'All threads' || (filter === 'Following' ? following.includes(thread.id) : thread.author === user?.fullName);
      return matchesFilter && `${thread.title} ${thread.excerpt}`.toLowerCase().includes(search);
    });
  }, [filter, following, query, threads, user?.fullName]);

  const toggleFollow = (id: string) => {
    const updated = following.includes(id) ? following.filter((threadId) => threadId !== id) : [...following, id];
    setFollowing(updated);
    saveFollowingThreads(updated);
  };

  const addReply = (event: FormEvent<HTMLFormElement>, thread: DemoThread) => {
    event.preventDefault();
    const text = replyDrafts[thread.id]?.trim();
    if (!text) return;
    const updated = threads.map((item) => item.id === thread.id ? { ...item, replies: [...item.replies, text] } : item);
    setThreads(updated);
    saveThreads(updated);
    setReplyDrafts({ ...replyDrafts, [thread.id]: '' });
    setStatus('Reply added to this demo thread.');
  };

  const startThread = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const thread: DemoThread = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      label: 'COMMUNITY',
      author: user?.fullName ?? 'Demo user',
      time: 'Just now',
      excerpt: newBody.trim(),
      replies: [],
    };
    const updated = [thread, ...threads];
    setThreads(updated);
    saveThreads(updated);
    setNewTitle('');
    setNewBody('');
    setIsStarting(false);
    setStatus('Your thread is now visible in this demo.');
  };

  return (
    <div className="community-page">
      <PublicHeader />
      <section className="community-banner community-banner--threads"><div><p className="community-eyebrow">YOUR NEIGHBORHOOD, CONNECTED</p><h1>Community threads</h1><p>A sighting, a question, a happy reunion. Every little update helps.</p></div>{user ? <button type="button" className="community-button" onClick={() => setIsStarting(!isStarting)}>{isStarting ? 'Cancel' : '+ Start a thread'}</button> : <Link className="community-button" to="/login" state={{ from: '/threads' }}>Log in to start a thread</Link>}</section>
      <main className="threads-layout">
        <section className="threads-main">
          <div className="thread-controls">
            <label className="thread-search"><span aria-hidden="true">⌕</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search threads, items or neighborhoods" /></label>
            <div className="thread-filters">{(['All threads', 'Following', 'My threads'] as const).map((option) => <button key={option} type="button" className={filter === option ? 'thread-filter--active' : ''} onClick={() => setFilter(option)}>{option}</button>)}</div>
            <span className="thread-location">Portland, OR</span>
          </div>
          {status && <p className="thread-status" role="status">{status}</p>}
          {isStarting && <form className="thread-compose" onSubmit={startThread}><h2>Start a community thread</h2><label>Thread title<input required maxLength={100} value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="What would you like neighbors to know?" /></label><label>Message<textarea required minLength={4} maxLength={500} value={newBody} onChange={(event) => setNewBody(event.target.value)} placeholder="Keep personal and identifying details private." /></label><button className="community-button" type="submit">Post thread</button></form>}
          {visibleThreads.length ? visibleThreads.map((thread) => (
            <article className="thread-card" key={thread.id}>
              <div className="thread-card__content">
                <div className="thread-card__meta"><span>{thread.label}</span><span>{thread.author} · {thread.time}</span></div>
                <h2>{thread.title}</h2><p>{thread.excerpt}</p>
                {thread.replies.length > 0 && <div className="thread-card__reply"><strong>{thread.author}</strong><p>{thread.replies[thread.replies.length - 1]}</p></div>}
                <div className="thread-card__actions"><span>{thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}</span><button type="button" onClick={() => toggleFollow(thread.id)}>{following.includes(thread.id) ? 'Following ✓' : 'Follow thread'}</button></div>
                {user
                  ? <form className="thread-reply-form" onSubmit={(event) => addReply(event, thread)}><input aria-label={`Reply to ${thread.title}`} value={replyDrafts[thread.id] ?? ''} onChange={(event) => setReplyDrafts({ ...replyDrafts, [thread.id]: event.target.value })} placeholder="Add a helpful reply…" /><button type="submit">Reply →</button></form>
                  : <p className="thread-login-prompt"><Link to="/login" state={{ from: '/threads' }}>Log in</Link> to reply to this thread.</p>}
              </div>
            </article>
          )) : <div className="browse-empty"><h3>No threads here yet</h3><p>Try a different filter, or start a conversation with your neighbors.</p><button type="button" onClick={() => setIsStarting(true)}>Start a thread</button></div>}
        </section>
        <aside className="threads-aside">
          <section><h2>Small updates. Big help.</h2><p>Share a sighting or ask your neighbors. Keep the conversation kind, local and useful.</p><Link className="community-button" to="/report-item?type=lost">Report a lost item ↗</Link></section>
          <section><h2>Around the neighborhood</h2><strong>New Academic Bldg.</strong><p>12 active threads</p><strong>Belmont Bldg.</strong><p>8 active threads</p><strong>Admin Bldg.</strong><p>6 active threads</p></section>
          <section><h2>A friendly reminder</h2><p>Keep phone numbers, addresses and identifying details out of public posts. Use a private message to arrange a safe reunion.</p><Link to="/safety-help">Read our safety tips ↗</Link></section>
        </aside>
      </main>
      <PublicFooter />
    </div>
  );
};

export const MyClaimsPage = () => {
  const claims = getClaims();
  return (
    <div className="community-page">
      <PublicHeader />
      <section className="community-banner"><div><p className="community-eyebrow">YOUR ACCOUNT</p><h1>My claims</h1><p>Track ownership claims you’ve submitted.</p></div></section>
      <main className="claims-list">
        {claims.length ? claims.map((claim) => <article className="claim-card" key={claim.id}><div><span className="claim-status">{claim.status}</span><h2>{claim.itemTitle}</h2><p>Submitted {claim.submittedAt}</p></div><p>Demo claim · Administrator review is required. Approval does not mean the item has been released.</p></article>) : <div className="browse-empty"><h2>No claims yet</h2><p>When you submit an ownership claim, it will appear here.</p><Link className="community-button" to="/items">Browse items</Link></div>}
      </main>
      <PublicFooter />
    </div>
  );
};
