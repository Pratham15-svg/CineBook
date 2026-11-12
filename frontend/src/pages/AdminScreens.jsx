
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/admin.css';

function AdminScreens() {
  const [screens, setScreens] = useState([]);
  const [venues, setVenues] = useState([]);
  const [screenName, setScreenName] = useState('');
  const [venueId, setVenueId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const [screenRes, venueRes] = await Promise.all([
        api.get('/admin/screens'),
        api.get('/admin/venues'),
      ]);

      setScreens(screenRes.data.screens || []);
      setVenues(venueRes.data.venues || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load screens');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setScreenName('');
    setVenueId('');
    setEditingId(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const screenData = {
        venueId: Number(venueId),
        screenName,
      };

      if (editingId) {
        await api.put(`/admin/screens/${editingId}`, screenData);
      } else {
        await api.post('/admin/screens', screenData);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(screen) {
    setEditingId(screen.screen_id);
    setScreenName(screen.screen_name);
    setVenueId(String(screen.venue_id));
    setError('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this screen?')) {
      return;
    }

    try {
      await api.delete(`/admin/screens/${id}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete screen');
    }
  }

  return (
    <div className="admin-page admin-screens-page">
      <nav className="admin-nav">
        <Link to="/admin/dashboard" className="admin-brand">
          Cine<span>Book</span>
        </Link>

        <div className="admin-nav-links">
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/cities">Cities</Link>
          <Link to="/admin/venues">Venues</Link>
          <Link to="/admin/screens" className="active">Screens</Link>
          <Link to="/admin/movies">Movies</Link>
        </div>
      </nav>

      <main className="admin-content">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">THEATRE MANAGEMENT</span>
            <h1>Cinema Screens<span>.</span></h1>
            <p className="admin-subtitle">
              Configure and manage screens across your cinema venues.
            </p>
          </div>

          <div className="admin-movie-count">
            <span>▣</span>
            {screens.length} screens
          </div>
        </header>

        <section className="admin-panel admin-screen-form-panel">
          <div className="admin-movie-form-heading">
            <div>
              <span className="admin-panel-icon">▣</span>
              <div>
                <h2>{editingId ? 'Edit Screen' : 'Add New Screen'}</h2>
                <p>
                  {editingId
                    ? 'Update the screen details below.'
                    : 'Register a new screen at one of your venues.'}
                </p>
              </div>
            </div>

            {editingId && (
              <span className="admin-editing-label">EDITING SCREEN</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="admin-screen-form">
            <div className="admin-movie-field">
              <label htmlFor="screen-name">Screen Name</label>
              <input
                id="screen-name"
                type="text"
                placeholder="e.g. Screen 1"
                value={screenName}
                onChange={(e) => setScreenName(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="screen-venue">Cinema Venue</label>
              <select
                id="screen-venue"
                value={venueId}
                onChange={(e) => setVenueId(e.target.value)}
                required
              >
                <option value="">Select a venue</option>
                {venues.map((venue) => (
                  <option key={venue.venue_id} value={venue.venue_id}>
                    {venue.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-movie-form-actions">
              <button
                className="admin-movie-submit"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editingId
                    ? 'Update Screen →'
                    : 'Add Screen →'}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="admin-movie-cancel"
                  onClick={resetForm}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        {error && (
          <div className="admin-movie-error">
            <span>!</span>
            {error}
          </div>
        )}

        <section className="admin-panel admin-screen-list-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-panel-icon">▣</span>
              <div>
                <h2>Existing Screens</h2>
                <p>All registered screens and their assigned venues.</p>
              </div>
            </div>

            <span className="admin-record-count">
              {screens.length} records
            </span>
          </div>

          {loading ? (
            <div className="admin-movie-empty">Loading screens...</div>
          ) : screens.length === 0 ? (
            <div className="admin-movie-empty">
              <span>▣</span>
              <p>No screens have been added yet.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-screens-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Screen Name</th>
                    <th>Venue</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {screens.map((screen) => (
                    <tr key={screen.screen_id}>
                      <td>
                        <span className="admin-movie-id">
                          #{screen.screen_id}
                        </span>
                      </td>
                      <td>
                        <div className="admin-screen-name-cell">
                          <span className="admin-screen-icon">▣</span>
                          <strong className="admin-movie-name">
                            {screen.screen_name}
                          </strong>
                        </div>
                      </td>
                      <td>
                        <span className="admin-movie-genre">
                          {screen.venue_name}
                        </span>
                      </td>
                      <td>
                        <div className="admin-movie-actions">
                          <button
                            className="admin-movie-edit"
                            onClick={() => handleEdit(screen)}
                          >
                            Edit
                          </button>

                          <button
                            className="admin-movie-delete"
                            onClick={() => handleDelete(screen.screen_id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default AdminScreens;
