import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import './BrowseItemsPage.css';

type BrowseItem = {
  id: string;
  title: string;
  category: string;
  status: 'Lost' | 'Found';
  location: string;
  date: string;
  daysAgo: number;
  icon: string;
  color: string;
  description: string;
};

const sampleItems: BrowseItem[] = [
  {
    id: 'green-backpack',
    title: 'Olive green backpack',
    category: 'Bags & wallets',
    status: 'Lost',
    location: 'Library',
    date: '2 hours ago',
    daysAgo: 0,
    icon: '🎒',
    color: 'sage',
    description: 'Canvas backpack with a small mountain patch.',
  },
  {
    id: 'leather-keys',
    title: 'Keys with a leather keyring',
    category: 'Keys',
    status: 'Found',
    location: 'Engineering Building',
    date: '3 hours ago',
    daysAgo: 0,
    icon: '🔑',
    color: 'sand',
    description: 'A few silver keys on a brown leather keyring.',
  },
  {
    id: 'wireless-headphones',
    title: 'Midnight blue headphones',
    category: 'Electronics',
    status: 'Lost',
    location: 'SBCS Building',
    date: 'Yesterday',
    daysAgo: 1,
    icon: '🎧',
    color: 'blue',
    description: 'Over-ear headphones in a dark blue case.',
  },
  {
    id: 'sage-bottle',
    title: 'Sage green water bottle',
    category: 'Everyday items',
    status: 'Found',
    location: 'Campus garden',
    date: 'Yesterday',
    daysAgo: 1,
    icon: '🧴',
    color: 'mint',
    description: 'Insulated bottle with a little daisy sticker.',
  },
  {
    id: 'brown-wallet',
    title: 'Brown leather cardholder',
    category: 'Bags & wallets',
    status: 'Found',
    location: 'Cafeteria',
    date: 'Yesterday',
    daysAgo: 1,
    icon: '👛',
    color: 'rose',
    description: 'Slim leather wallet. Identify what is inside.',
  },
  {
    id: 'tortoiseshell-glasses',
    title: 'Tortoiseshell reading glasses',
    category: 'Accessories',
    status: 'Lost',
    location: 'Library',
    date: '2 days ago',
    daysAgo: 2,
    icon: '👓',
    color: 'cream',
    description: 'Round frames, possibly in a soft beige case.',
  },
];

const categories = ['All categories', ...new Set(sampleItems.map((item) => item.category))];

export const BrowseItemsPage = () => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All items' | 'Lost' | 'Found'>('All items');
  const [category, setCategory] = useState('All categories');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return sampleItems
      .filter((item) => status === 'All items' || item.status === status)
      .filter((item) => category === 'All categories' || item.category === category)
      .filter((item) => {
        const searchableText = `${item.title} ${item.category} ${item.location} ${item.description}`.toLowerCase();
        return searchableText.includes(normalizedQuery);
      })
      .sort((first, second) =>
        sortOrder === 'newest'
          ? first.daysAgo - second.daysAgo
          : second.daysAgo - first.daysAgo,
      );
  }, [category, query, sortOrder, status]);

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
            <Link to="/items" className="browse-hero-card browse-hero-card--light">
              <span className="browse-hero-card__icon" aria-hidden="true">⌕</span>
              <span><strong>I lost something</strong><small>Report it and let your community help.</small></span>
              <span aria-hidden="true">↗</span>
            </Link>
            <Link to="/report-item" className="browse-hero-card browse-hero-card--green">
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
            <span className="browse-search__location" aria-label="Location: Quezon City University">
              <span aria-hidden="true">⌖</span> Quezon City University
            </span>
            <button type="submit" className="browse-search__button">
              <span aria-hidden="true">⌕</span> Search items
            </button>
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
                <button
                  key={filter}
                  type="button"
                  className={status === filter ? 'browse-tab browse-tab--active' : 'browse-tab'}
                  aria-pressed={status === filter}
                  onClick={() => setStatus(filter)}
                >
                  {filter}
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

          {filteredItems.length > 0 ? (
            <div className="browse-grid">
              {filteredItems.map((item) => (
                <Link className="item-card" to={`/items/${item.id}`} key={item.id}>
                  <div className={`item-card__visual item-card__visual--${item.color}`} aria-hidden="true">
                    <span className={`item-card__status item-card__status--${item.status.toLowerCase()}`}>
                      <span>{item.status === 'Found' ? '✓' : '⌕'}</span> {item.status}
                    </span>
                    <span className="item-card__emoji">{item.icon}</span>
                    <span className="item-card__open">↗</span>
                  </div>
                  <div className="item-card__body">
                    <div className="item-card__meta">
                      <span>{item.category}</span>
                      <time>{item.date}</time>
                    </div>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className="item-card__location">
                      <span aria-hidden="true">⌖</span> {item.location}
                      <span className="item-card__views">View details <span aria-hidden="true">→</span></span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="browse-empty">
              <span aria-hidden="true">⌕</span>
              <h3>No matching items yet</h3>
              <p>Try a different search or category, or check back later.</p>
              <button type="button" onClick={() => { setQuery(''); setStatus('All items'); setCategory('All categories'); }}>
                Clear filters
              </button>
            </div>
          )}

          <div className="browse-results">
            <span>Showing {filteredItems.length} of {sampleItems.length} sample items at QCU</span>
            <Link to="/report-item">Report an item <span aria-hidden="true">→</span></Link>
          </div>
        </section>

        <section className="browse-safety" id="safety">
          <span className="browse-safety__icon" aria-hidden="true">✓</span>
          <div>
            <strong>Good neighbors. Safe reunions.</strong>
            <p>Keep identifying details private, verify ownership, and choose a public place to meet.</p>
          </div>
          <Link to="/safety-help">Read our safety tips <span aria-hidden="true">→</span></Link>
        </section>

        <section className="browse-how" id="how-it-works">
          <h2>Small actions make reunions happen</h2>
          <p>Report what you lost or found, then connect with the QCU community to help it find its way home.</p>
          <Link className="browse-how__link" to="/how-it-works">See how it works <span aria-hidden="true">→</span></Link>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
};

export const ReportItemPage = () => <h1>Report Item (Placeholder)</h1>;

export const ItemDetailPage = () => <h1>Item Detail + Thread (Placeholder)</h1>;

export const MyClaimsPage = () => <h1>My Claims (Placeholder)</h1>;

export const GuardDashboardPage = () => <h1>Guard Dashboard (Placeholder)</h1>;

export const AdminDashboardPage = () => <h1>Admin Dashboard (Placeholder)</h1>;
