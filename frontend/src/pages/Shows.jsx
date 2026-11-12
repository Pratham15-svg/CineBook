import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/shows.css';

function Shows() {
  const [shows, setShows] = useState([]);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchShows = async (searchText = '', cityFilter = '') => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (searchText) params.search = searchText;
      if (cityFilter) params.city = cityFilter;

      const response = await api.get('/shows', { params });

      setShows(response.data.shows || []);
    } catch (err) {
      setError(
        err.response?.data?.message || 'Could not load movies.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Build the list of cities for the dropdown once, from the full
  // unfiltered show list, so the options don't shrink as the user filters.
  const loadCities = async () => {
    try {
      const response = await api.get('/shows');
      const allShows = response.data.shows || [];
      const uniqueCities = [...new Set(allShows.map((s) => s.city_name).filter(Boolean))];
      uniqueCities.sort();
      setCities(uniqueCities);
    } catch {
      // City list is a nice-to-have; a failure here shouldn't block browsing.
    }
  };

  useEffect(() => {
    fetchShows();
    loadCities();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchShows(search, city);
  };

  const handleCityChange = (e) => {
    const nextCity = e.target.value;
    setCity(nextCity);
    fetchShows(search, nextCity);
  };

  const getPosterStyle = (genre = '') => {
    const value = genre.toLowerCase();

    if (value.includes('action')) return 'poster-action';
    if (value.includes('romance')) return 'poster-romance';
    if (value.includes('comedy')) return 'poster-comedy';
    if (value.includes('horror') || value.includes('thriller')) return 'poster-thriller';
    if (value.includes('sci')) return 'poster-scifi';
    if (value.includes('drama')) return 'poster-drama';

    return 'poster-default';
  };

  return (
    <div className="cinema-shows-page">
      <nav className="cinema-shows-nav">
        <Link to="/" className="shows-brand">
          Cine<span>Book</span>
        </Link>

        <div className="shows-nav-links">
          <Link to="/">Home</Link>
          <Link to="/my-bookings">My Bookings</Link>
        </div>
      </nav>

      <main className="cinema-shows-content">
        <div className="shows-heading">
          <p className="shows-eyebrow">THE BIG SCREEN EXPERIENCE</p>
          <h1>Now <span>Showing.</span></h1>
          <p>Discover your next favourite movie.</p>
        </div>

        <form className="cinema-search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search for a movie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="cinema-city-select"
            value={city}
            onChange={handleCityChange}
            aria-label="Filter by city"
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <button type="submit">Search</button>
        </form>

        {loading && (
          <div className="shows-message">Loading movies...</div>
        )}

        {error && (
          <div className="shows-message shows-error">{error}</div>
        )}

        {!loading && !error && shows.length === 0 && (
          <div className="shows-message">
            No upcoming shows found.
          </div>
        )}

        {!loading && !error && shows.length > 0 && (
          <div className="cinema-movie-grid">
            {shows.map((show, index) => (
              <article
                className="cinema-movie-card"
                key={show.show_id}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={`cinema-poster ${getPosterStyle(show.genre)}`}>
                  <div
                    className="poster-decoration"
                    style={{ '--shimmer-delay': `${(index % 5) * 0.8}s` }}
                  >
                    <span className="poster-orb"></span>
                    <span className="poster-ring"></span>
                    <span className="poster-line"></span>
                  </div>

                  <div className="poster-top">
                    <span>CINEBOOK ORIGINAL</span>
                    <span>NOW SHOWING</span>
                  </div>

                  <div className="poster-title">
                    <span>{show.genre || 'FEATURE FILM'}</span>
                    <h2>{show.title}</h2>
                  </div>

                  <div className="poster-bottom">
                    <span>{show.language || 'CINEMA'}</span>
                    <span>EXPERIENCE THE STORY</span>
                  </div>
                </div>

                <div className="cinema-movie-info">
                  <div className="movie-title-row">
                    <h2>{show.title}</h2>
                  </div>

                  <p className="movie-genre">
                    {show.genre} <span>·</span> {show.language}
                  </p>

                  <div className="movie-detail">
                    <span>LOCATION</span>
                    <p>{show.venue_name}, {show.city_name}</p>
                  </div>

                  <div className="movie-detail">
                    <span>SHOWTIME</span>
                    <p>{new Date(show.start_time).toLocaleString()}</p>
                  </div>

                  <div className="movie-card-footer">
                    <div>
                      <span className="movie-price-label">TICKET PRICE</span>
                      <p>₹{show.min_price} – ₹{show.max_price}</p>
                    </div>

                    <span className="available-seats">
                      {show.available_seats} seats left
                    </span>
                  </div>

                  <Link
                    to={`/shows/${show.show_id}`}
                    className="movie-view-button"
                  >
                    View Show <span>→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Shows;