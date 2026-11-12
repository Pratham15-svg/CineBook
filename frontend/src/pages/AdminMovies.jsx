
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/admin.css';

function AdminMovies() {
  const [movies, setMovies] = useState([]);
  const [title, setTitle] = useState('');
  const [durationMin, setDurationMin] = useState('');
  const [language, setLanguage] = useState('');
  const [genre, setGenre] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadMovies() {
    try {
      const response = await api.get('/admin/movies');
      setMovies(response.data.movies || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load movies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMovies();
  }, []);

  function resetForm() {
    setTitle('');
    setDurationMin('');
    setLanguage('');
    setGenre('');
    setReleaseDate('');
    setEditingId(null);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const movieData = {
      title,
      durationMin: Number(durationMin),
      language,
      genre,
      releaseDate,
    };

    try {
      if (editingId) {
        await api.put(`/admin/movies/${editingId}`, movieData);
      } else {
        await api.post('/admin/movies', movieData);
      }

      resetForm();
      await loadMovies();
    } catch (err) {
      setError(err.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(movie) {
    setEditingId(movie.movie_id);
    setTitle(movie.title);
    setDurationMin(String(movie.duration_min));
    setLanguage(movie.language);
    setGenre(movie.genre);
    setReleaseDate(
      movie.release_date ? String(movie.release_date).slice(0, 10) : ''
    );
    setError('');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleDelete(id) {
    if (!window.confirm('Are you sure you want to delete this movie?')) {
      return;
    }

    try {
      await api.delete(`/admin/movies/${id}`);
      await loadMovies();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete movie');
    }
  }

  return (
    <div className="admin-page admin-movies-page">
      <nav className="admin-nav">
        <Link to="/admin/dashboard" className="admin-brand">
          Cine<span>Book</span>
        </Link>

        <div className="admin-nav-links">
          <Link to="/admin/dashboard">Dashboard</Link>
          <Link to="/admin/cities">Cities</Link>
          <Link to="/admin/venues">Venues</Link>
          <Link to="/admin/screens">Screens</Link>
          <Link to="/admin/movies" className="active">Movies</Link>
        </div>
      </nav>

      <main className="admin-content">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">CONTENT MANAGEMENT</span>
            <h1>Movie Library<span>.</span></h1>
            <p className="admin-subtitle">
              Add, edit and manage movies available on CineBook.
            </p>
          </div>

          <div className="admin-movie-count">
            <span>▣</span>
            {movies.length} movies
          </div>
        </header>

        <section className="admin-panel admin-movie-form-panel">
          <div className="admin-movie-form-heading">
            <div>
              <span className="admin-panel-icon">✦</span>
              <div>
                <h2>{editingId ? 'Edit Movie' : 'Add New Movie'}</h2>
                <p>
                  {editingId
                    ? 'Update the selected movie details.'
                    : 'Enter the details of the movie you want to add.'}
                </p>
              </div>
            </div>

            {editingId && (
              <span className="admin-editing-label">EDITING MOVIE</span>
            )}
          </div>

          <form onSubmit={handleSubmit} className="admin-movie-form">
            <div className="admin-movie-field admin-movie-title-field">
              <label htmlFor="movie-title">Movie Title</label>
              <input
                id="movie-title"
                placeholder="Enter movie title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="movie-duration">Duration (minutes)</label>
              <input
                id="movie-duration"
                type="number"
                min="1"
                placeholder="e.g. 150"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="movie-language">Language</label>
              <input
                id="movie-language"
                placeholder="e.g. Telugu"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="movie-genre">Genre</label>
              <input
                id="movie-genre"
                placeholder="e.g. Action"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                required
              />
            </div>

            <div className="admin-movie-field">
              <label htmlFor="movie-release-date">Release Date</label>
              <input
                id="movie-release-date"
                type="date"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
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
                    ? 'Update Movie →'
                    : 'Add Movie →'}
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

        <section className="admin-panel admin-movie-list-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-panel-icon">▣</span>
              <div>
                <h2>Existing Movies</h2>
                <p>Manage movies in your platform database.</p>
              </div>
            </div>
            <span className="admin-record-count">
              {movies.length} records
            </span>
          </div>

          {loading ? (
            <div className="admin-movie-empty">Loading movies...</div>
          ) : movies.length === 0 ? (
            <div className="admin-movie-empty">
              <span>▣</span>
              <p>No movies have been added yet.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table admin-movies-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Movie</th>
                    <th>Duration</th>
                    <th>Language</th>
                    <th>Genre</th>
                    <th>Release Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {movies.map((movie) => (
                    <tr key={movie.movie_id}>
                      <td>
                        <span className="admin-movie-id">
                          #{movie.movie_id}
                        </span>
                      </td>
                      <td>
                        <strong className="admin-movie-name">
                          {movie.title}
                        </strong>
                      </td>
                      <td>{movie.duration_min} min</td>
                      <td>{movie.language}</td>
                      <td>
                        <span className="admin-movie-genre">
                          {movie.genre}
                        </span>
                      </td>
                      <td>
                        {movie.release_date
                          ? String(movie.release_date).slice(0, 10)
                          : '-'}
                      </td>
                      <td>
                        <div className="admin-movie-actions">
                          <button
                            className="admin-movie-edit"
                            onClick={() => handleEdit(movie)}
                          >
                            Edit
                          </button>
                          <button
                            className="admin-movie-delete"
                            onClick={() => handleDelete(movie.movie_id)}
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

export default AdminMovies;
