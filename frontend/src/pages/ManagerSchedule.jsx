import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/shows.css';
import '../styles/manager-schedule.css';

function ManagerSchedule() {
  const [screens, setScreens] = useState([]);
  const [movies, setMovies] = useState([]);
  const [screenId, setScreenId] = useState('');
  const [movieId, setMovieId] = useState('');
  const [startTime, setStartTime] = useState('');
  const [prices, setPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/manager/schedule-options');
        setScreens(response.data.screens || []);
        setMovies(response.data.movies || []);
      } catch (err) {
        setError(
          err.response?.status === 403 || err.response?.status === 401
            ? 'Please log in with a manager account.'
            : err.response?.data?.message || 'Unable to load the form.'
        );
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const selectedScreen = screens.find(
    (screen) => String(screen.screen_id) === String(screenId)
  );
  const categories = selectedScreen?.categories || [];

  const handleScreenChange = (value) => {
    setScreenId(value);
    setPrices({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      setSaving(true);
      const response = await api.post('/manager/shows', {
        movieId,
        screenId,
        // datetime-local has no timezone; convert to an exact instant
        startTime: new Date(startTime).toISOString(),
        prices,
      });
      setSuccess(
        `${response.data.message} (show #${response.data.show.show_id}).`
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to schedule show.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main className="cinema-manager-page">
        <div className="manager-loading">
          <div className="checkout-loader"></div>
          <p>Loading scheduling form...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="cinema-manager-page">
      <nav className="manager-nav">
        <Link to="/" className="brand">
          Cine<span>Book</span>
        </Link>
        <Link to="/manager/dashboard" className="manager-customer-link">
          ← Manager Dashboard
        </Link>
      </nav>

      <main className="manager-content">
        <header className="manager-header">
          <div>
            <span className="manager-eyebrow">VENUE OPERATIONS</span>
            <h1>Schedule a Show<span>.</span></h1>
            <p>
              Pick a screen, a movie and a start time, then set a price for
              each seat category. Overlapping shows are rejected by the
              database.
            </p>
          </div>
        </header>

        <section className="manager-section schedule-panel">
          <form onSubmit={handleSubmit} className="schedule-form">
            <label>
              Screen
              <select
                value={screenId}
                onChange={(e) => handleScreenChange(e.target.value)}
                required
              >
                <option value="">Select a screen</option>
                {screens.map((screen) => (
                  <option key={screen.screen_id} value={screen.screen_id}>
                    {screen.venue_name} - {screen.screen_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Movie
              <select
                value={movieId}
                onChange={(e) => setMovieId(e.target.value)}
                required
              >
                <option value="">Select a movie</option>
                {movies.map((movie) => (
                  <option key={movie.movie_id} value={movie.movie_id}>
                    {movie.title} ({movie.language}, {movie.duration_min} min)
                  </option>
                ))}
              </select>
            </label>

            <label>
              Start time
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>

            {categories.length > 0 && (
              <fieldset className="schedule-prices">
                <legend>Price per seat (₹)</legend>
                {categories.map((category) => (
                  <label key={category}>
                    {category}
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={prices[category] || ''}
                      onChange={(e) =>
                        setPrices({ ...prices, [category]: e.target.value })
                      }
                      required
                    />
                  </label>
                ))}
              </fieldset>
            )}

            {error && <p className="shows-error">{error}</p>}
            {success && <p className="schedule-success">{success}</p>}

            <button
              type="submit"
              className="manager-primary-link schedule-submit"
              disabled={saving || !screenId}
            >
              {saving ? 'Scheduling...' : 'Schedule Show'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default ManagerSchedule;
