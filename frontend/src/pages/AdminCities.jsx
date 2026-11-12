
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/admin.css';

function AdminCities() {
  const [cities, setCities] = useState([]);
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadCities() {
    try {
      const response = await api.get('/admin/cities');
      setCities(response.data.cities || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load cities');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCities();
  }, []);

  function resetForm() {
    setName('');
    setState('');
    setEditingId(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      if (editingId) {
        await api.put(`/admin/cities/${editingId}`, { name, state });
      } else {
        await api.post('/admin/cities', { name, state });
      }

      resetForm();
      await loadCities();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(city) {
    setEditingId(city.city_id);
    setName(city.name);
    setState(city.state);
    setError('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this city?')) {
      return;
    }

    try {
      await api.delete(`/admin/cities/${id}`);
      await loadCities();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete city');
    }
  }

  return (
    <div className="admin-page admin-cities-page">
      <nav className="admin-nav">
        <Link to="/admin/dashboard" className="admin-brand">
          Cine<span>Book</span>
        </Link>

        <div className="admin-nav-links">
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/cities" className="active">Cities</Link>
          <Link to="/admin/venues">Venues</Link>
          <Link to="/admin/screens">Screens</Link>
          <Link to="/admin/movies">Movies</Link>
        </div>
      </nav>

      <main className="admin-content">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">LOCATION MANAGEMENT</span>
            <h1>CineBook Cities<span>.</span></h1>
            <p className="admin-subtitle">
              Manage the cities where audiences discover and book movies.
            </p>
          </div>

          <div className="admin-movie-count">
            <span>⌖</span>
            {cities.length} cities
          </div>
        </header>

        <section className="admin-panel admin-city-form-panel">
          <div className="admin-movie-form-heading">
            <div>
              <span className="admin-panel-icon">⌖</span>
              <div>
                <h2>{editingId ? 'Edit City' : 'Add New City'}</h2>
                <p>
                  {editingId
                    ? 'Update the selected city details.'
                    : 'Register a new city on the CineBook platform.'}
                </p>
              </div>
            </div>

            {editingId && (
              <span className="admin-editing-label">EDITING CITY</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="admin-city-form">
            <div className="admin-movie-field">
              <label htmlFor="city-name">City Name</label>
              <input
                id="city-name"
                type="text"
                placeholder="Enter city name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="city-state">State</label>
              <input
                id="city-state"
                type="text"
                placeholder="Enter state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
              />
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
                    ? 'Update City →'
                    : 'Add City →'}
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

        <section className="admin-panel admin-city-list-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-panel-icon">⌖</span>
              <div>
                <h2>Existing Cities</h2>
                <p>All cities currently registered on CineBook.</p>
              </div>
            </div>

            <span className="admin-record-count">
              {cities.length} records
            </span>
          </div>

          {loading ? (
            <div className="admin-movie-empty">Loading cities...</div>
          ) : cities.length === 0 ? (
            <div className="admin-movie-empty">
              <span>⌖</span>
              <p>No cities have been added yet.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-cities-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>City</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {cities.map((city) => (
                    <tr key={city.city_id}>
                      <td>
                        <span className="admin-movie-id">
                          #{city.city_id}
                        </span>
                      </td>
                      <td>
                        <div className="admin-city-name-cell">
                          <span className="admin-city-icon">⌖</span>
                          <strong className="admin-movie-name">
                            {city.name}
                          </strong>
                        </div>
                      </td>
                      <td>
                        <span className="admin-movie-genre">
                          {city.state}
                        </span>
                      </td>
                      <td>
                        <div className="admin-movie-actions">
                          <button
                            className="admin-movie-edit"
                            onClick={() => handleEdit(city)}
                          >
                            Edit
                          </button>

                          <button
                            className="admin-movie-delete"
                            onClick={() => handleDelete(city.city_id)}
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

export default AdminCities;
