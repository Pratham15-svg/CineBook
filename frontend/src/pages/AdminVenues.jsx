
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/admin.css';

function AdminVenues() {
  const [venues, setVenues] = useState([]);
  const [cities, setCities] = useState([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [cityId, setCityId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      const [venueRes, cityRes] = await Promise.all([
        api.get('/admin/venues'),
        api.get('/admin/cities'),
      ]);

      setVenues(venueRes.data.venues || []);
      setCities(cityRes.data.cities || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load venues');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function resetForm() {
    setName('');
    setAddress('');
    setCityId('');
    setManagerId('');
    setEditingId(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const venueData = {
      name,
      address,
      cityId: Number(cityId),
      managerId: Number(managerId),
    };

    try {
      if (editingId) {
        await api.put(`/admin/venues/${editingId}`, venueData);
      } else {
        await api.post('/admin/venues', venueData);
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(venue) {
    setEditingId(venue.venue_id);
    setName(venue.name);
    setAddress(venue.address);
    setCityId(String(venue.city_id));
    setManagerId(String(venue.manager_id));
    setError('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this venue?')) return;

    try {
      await api.delete(`/admin/venues/${id}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete venue');
    }
  }

  return (
    <div className="admin-page admin-venues-page">
      <nav className="admin-nav">
        <Link to="/admin/dashboard" className="admin-brand">
          Cine<span>Book</span>
        </Link>

        <div className="admin-nav-links">
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/cities">Cities</Link>
          <Link to="/admin/venues" className="active">Venues</Link>
          <Link to="/admin/screens">Screens</Link>
          <Link to="/admin/movies">Movies</Link>
        </div>
      </nav>

      <main className="admin-content">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">LOCATION MANAGEMENT</span>
            <h1>Cinema Venues<span>.</span></h1>
            <p className="admin-subtitle">
              Add and manage cinema locations across CineBook.
            </p>
          </div>

          <div className="admin-movie-count">
            <span>⌂</span>
            {venues.length} venues
          </div>
        </header>

        <section className="admin-panel admin-venue-form-panel">
          <div className="admin-movie-form-heading">
            <div>
              <span className="admin-panel-icon">⌂</span>
              <div>
                <h2>{editingId ? 'Edit Venue' : 'Add New Venue'}</h2>
                <p>
                  {editingId
                    ? 'Update the selected cinema venue.'
                    : 'Enter the details of the cinema venue.'}
                </p>
              </div>
            </div>

            {editingId && (
              <span className="admin-editing-label">EDITING VENUE</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="admin-venue-form">
            <div className="admin-movie-field">
              <label htmlFor="venue-name">Venue Name</label>
              <input
                id="venue-name"
                placeholder="Enter venue name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="venue-address">Venue Address</label>
              <input
                id="venue-address"
                placeholder="Enter complete address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="venue-city">City</label>
              <select
                id="venue-city"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
                required
              >
                <option value="">Select a city</option>
                {cities.map((city) => (
                  <option key={city.city_id} value={city.city_id}>
                    {city.name}, {city.state}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-movie-field">
              <label htmlFor="venue-manager">Manager User ID</label>
              <input
                id="venue-manager"
                type="number"
                min="1"
                placeholder="Enter manager user ID"
                value={managerId}
                onChange={(e) => setManagerId(e.target.value)}
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
                    ? 'Update Venue →'
                    : 'Add Venue →'}
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

        <section className="admin-panel admin-venue-list-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-panel-icon">⌂</span>
              <div>
                <h2>Existing Venues</h2>
                <p>Manage your registered cinema locations.</p>
              </div>
            </div>

            <span className="admin-record-count">
              {venues.length} records
            </span>
          </div>

          {loading ? (
            <div className="admin-movie-empty">Loading venues...</div>
          ) : venues.length === 0 ? (
            <div className="admin-movie-empty">
              <span>⌂</span>
              <p>No venues have been added yet.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-venues-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Venue</th>
                    <th>Address</th>
                    <th>City</th>
                    <th>Manager ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {venues.map((venue) => (
                    <tr key={venue.venue_id}>
                      <td>
                        <span className="admin-movie-id">
                          #{venue.venue_id}
                        </span>
                      </td>
                      <td>
                        <strong className="admin-movie-name">
                          {venue.name}
                        </strong>
                      </td>
                      <td>{venue.address}</td>
                      <td>
                        <span className="admin-movie-genre">
                          {venue.city_name}
                        </span>
                      </td>
                      <td>{venue.manager_id}</td>
                      <td>
                        <div className="admin-movie-actions">
                          <button
                            className="admin-movie-edit"
                            onClick={() => handleEdit(venue)}
                          >
                            Edit
                          </button>
                          <button
                            className="admin-movie-delete"
                            onClick={() => handleDelete(venue.venue_id)}
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

export default AdminVenues;
