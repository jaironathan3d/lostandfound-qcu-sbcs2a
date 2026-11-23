import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { PublicFooter, PublicHeader } from '../components/PublicNavigation';
import { apiRequest } from '../lib/apiClient';
import './AdminDashboardPage.css';

type Category = { id: string; name: string; itemCount: number };

export const AdminCategoriesPage = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError('');
    try {
      setCategories(await apiRequest<Category[]>('/admin/categories'));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Categories could not be loaded.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingId) {
        await apiRequest(`/admin/categories/${editingId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
        setNotice('Category updated.');
      } else {
        await apiRequest('/admin/categories', { method: 'POST', body: JSON.stringify({ name }) });
        setNotice('Category created.');
      }
      setEditingId('');
      setName('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The category could not be saved.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: Category) => {
    if (!window.confirm(`Delete category “${category.name}”?`)) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiRequest(`/admin/categories/${category.id}`, { method: 'DELETE' });
      setNotice('Category deleted.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The category could not be deleted.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page">
      <PublicHeader />
      <main className="admin-main">
        <header className="admin-heading">
          <div><p className="admin-eyebrow">QCU LOST &amp; FOUND · ADMIN</p><h1>Categories</h1><p>Manage categories shown in item reports and browsing filters.</p></div>
          <Link to="/admin-dashboard">Back to administration ↗</Link>
        </header>
        <nav className="admin-view-links" aria-label="Administrator sections">
          <Link className="admin-view-link" to="/admin-dashboard">Claim review</Link>
          <Link className="admin-view-link" to="/admin-dashboard/reports">Item report moderation</Link>
          <Link className="admin-view-link" to="/admin-dashboard/matches">Lost-item matches</Link>
          <Link className="admin-view-link" to="/admin-dashboard/students">Student records</Link>
          <Link className="admin-view-link admin-view-link--active" to="/admin-dashboard/categories">Categories</Link>
        </nav>
        {notice && <p className="admin-notice" role="status">{notice}</p>}
        {error && <p className="admin-error" role="alert">{error}</p>}
        <section className="admin-claim">
          <header className="admin-claim__header"><div><span className="admin-status admin-status--pending">{editingId ? 'Editing' : 'New category'}</span><h3>{editingId ? 'Update category' : 'Add category'}</h3></div></header>
          <form className="messages-compose" onSubmit={submit}>
            <label htmlFor="category-name">Category name</label>
            <input id="category-name" required minLength={1} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Clothing" />
            <button type="submit" className="admin-approve" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes' : 'Create category'}</button>
          </form>
        </section>
        <div className="admin-claims-heading"><h2>Existing categories</h2><button type="button" onClick={() => void load()}>Refresh</button></div>
        <div className="admin-claim-list">
          {categories.map((category) => (
            <article className="admin-claim" key={category.id}>
              <header className="admin-claim__header"><div><span className="admin-status admin-status--pending">{category.itemCount} items</span><h3>{category.name}</h3></div></header>
              <footer className="admin-claim__actions"><p>{category.itemCount === 0 ? 'Unused and safe to remove.' : 'Used by item reports.'}</p><div>
                <button type="button" className="admin-reject" disabled={busy} onClick={() => void remove(category)}>Delete</button>
                <button type="button" className="admin-approve" disabled={busy} onClick={() => { setEditingId(category.id); setName(category.name); }}>Edit</button>
              </div></footer>
            </article>
          ))}
        </div>
      </main>
      <PublicFooter />
    </div>
  );
};
