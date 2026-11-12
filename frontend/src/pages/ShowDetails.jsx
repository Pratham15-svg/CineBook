
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api/api';
import '../styles/shows.css';

function ShowDetails() {
  const { id } = useParams();
  const [show, setShow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchShow = async () => {
      try {
        const response = await api.get(`/shows/${id}`);
        setShow(response.data.show);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load show details.');
      } finally {
        setLoading(false);
      }
    };

    fetchShow();
  }, [id]);

  if (loading) {
    return (
      <div className="cinema-details-page">
        <p className="shows-message">Loading your cinema experience...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="cinema-details-page">
        <p className="shows-error">{error}</p>
        <Link to="/shows">Back to Movies</Link>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="cinema-details-page">
        <p className="shows-message">Show not found.</p>
        <Link to="/shows">Back to Movies</Link>
      </div>
    );
  }

  return (
    <div className="cinema-details-page">
      <nav className="cinema-shows-nav">
        <Link to="/" className="shows-brand">
          Cine<span>Book</span>
        </Link>

        <div className="shows-nav-links">
          <Link to="/">Home</Link>
          <Link to="/shows">Browse Movies</Link>
          <Link to="/my-bookings">My Bookings</Link>
        </div>
      </nav>

      <main className="cinema-details-content">
        <Link to="/shows" className="details-back-link">
          ← Back to Movies
        </Link>

        <div className="details-hero">
          <div className="details-hero-decoration">
            <div className="details-glow"></div>
            <div className="details-circle"></div>
          </div>

          <div className="details-hero-content">
            <p className="details-eyebrow">
              YOUR NEXT CINEMA EXPERIENCE
            </p>

            <h1>{show.title}</h1>

            <div className="details-tags">
              <span>{show.genre}</span>
              <span>{show.language}</span>
              <span>{show.duration_min} min</span>
            </div>
          </div>
        </div>

        <section className="details-layout">
          <div className="details-main-card">
            <p className="details-section-label">THE SHOW</p>
            <h2>Experience it on the big screen.</h2>

            <div className="details-information-grid">
              <div className="details-information-item">
                <span>VENUE</span>
                <strong>{show.venue_name}</strong>
              </div>

              <div className="details-information-item">
                <span>CITY</span>
                <strong>{show.city_name}</strong>
              </div>

              <div className="details-information-item">
                <span>SCREEN</span>
                <strong>{show.screen_name}</strong>
              </div>

              <div className="details-information-item">
                <span>START TIME</span>
                <strong>{new Date(show.start_time).toLocaleString()}</strong>
              </div>

              <div className="details-information-item">
                <span>END TIME</span>
                <strong>{new Date(show.end_time).toLocaleString()}</strong>
              </div>

              <div className="details-information-item">
                <span>AVAILABLE SEATS</span>
                <strong>{show.available_seats}</strong>
              </div>
            </div>
          </div>

          <aside className="details-booking-card">
            <p className="details-section-label">BOOK YOUR EXPERIENCE</p>

            <h3>Ticket pricing</h3>

            <div className="details-price">
              ₹{show.min_price} – ₹{show.max_price}
            </div>

            <p className="details-booking-note">
              Prices may vary depending on your selected seat category.
            </p>

            <Link
              to={`/shows/${id}/seats`}
              className="details-book-button"
            >
              Select Seats <span>→</span>
            </Link>

            <p className="details-secure-note">
              Select your seats to continue
            </p>
          </aside>
        </section>
      </main>
    </div>
  );
}

export default ShowDetails;
