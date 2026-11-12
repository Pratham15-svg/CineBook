
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/shows.css';

function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await api.get('/bookings/me');
      setBookings(response.data.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async (bookingId) => {
    const confirmed = window.confirm(
      'Are you sure you want to cancel this booking?'
    );

    if (!confirmed) return;

    try {
      setCancelling(bookingId);

      await api.post(`/bookings/${bookingId}/cancel`);

      alert('Booking cancelled successfully!');
      await fetchBookings();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to cancel booking.');
    } finally {
      setCancelling(null);
    }
  };

  if (loading) {
    return (
      <main className="cinema-bookings-page">
        <div className="bookings-loading">
          <div className="checkout-loader"></div>
          <p>Gathering your tickets...</p>
        </div>
      </main>
    );
  }

  return (
    <div className="cinema-bookings-page">
      <nav className="bookings-nav">
        <Link to="/" className="brand">
          Cine<span>Book</span>
        </Link>

        <Link to="/shows" className="bookings-browse-link">
          ← Browse Movies
        </Link>
      </nav>

      <main className="bookings-content">
        <header className="bookings-heading">
          <span className="bookings-eyebrow">YOUR CINEMA JOURNEY</span>
          <h1>My Bookings<span>.</span></h1>
          <p>Your cinema experiences, all in one place.</p>
        </header>

        {error && (
          <div className="bookings-error">
            <span>!</span>
            {error}
          </div>
        )}

        {!error && bookings.length === 0 && (
          <section className="bookings-empty">
            <div className="empty-ticket-icon">▤</div>
            <h2>No bookings yet</h2>
            <p>Your next great movie experience starts here.</p>
            <Link to="/shows" className="bookings-primary-button">
              Explore Movies <span>→</span>
            </Link>
          </section>
        )}

        {bookings.length > 0 && (
          <>
            <div className="bookings-list-heading">
              <h2>Your tickets</h2>
              <span>
                {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
              </span>
            </div>

            <div className="cinema-booking-list">
              {bookings.map((booking, index) => {
                const isCancelled = booking.status === 'CANCELLED';
                const isConfirmed = booking.status === 'CONFIRMED';

                return (
                  <article
                    className="cinema-booking-card"
                    key={booking.booking_id}
                    style={{ animationDelay: `${index * 0.08}s` }}
                  >
                    <div className="booking-card-main">
                      <div className="booking-ticket-symbol">▣</div>

                      <div className="booking-ticket-details">
                        <span className="booking-reference">
                          CINEBOOK TICKET
                        </span>
                        <h2>Booking #{booking.booking_id}</h2>

                        <div className="booking-status-row">
                          <span
                            className={`booking-status ${
                              isConfirmed
                                ? 'status-confirmed'
                                : isCancelled
                                ? 'status-cancelled'
                                : 'status-other'
                            }`}
                          >
                            <span className="status-dot"></span>
                            {booking.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="booking-ticket-divider">
                      <span></span>
                    </div>

                    <div className="booking-information-grid">
                      <div className="booking-information-item">
                        <span>SEATS</span>
                        <strong>
                          {booking.seats?.map((seat) => seat.seat_no).join(', ') || 'N/A'}
                        </strong>
                      </div>

                      <div className="booking-information-item">
                        <span>TOTAL AMOUNT</span>
                        <strong className="booking-amount">
                          ₹{booking.total_amount}
                        </strong>
                      </div>

                      <div className="booking-information-item">
                        <span>BOOKED ON</span>
                        <strong>
                          {booking.booked_at
                            ? new Date(booking.booked_at).toLocaleString()
                            : 'N/A'}
                        </strong>
                      </div>
                    </div>

                    {isConfirmed && (
                      <div className="booking-card-actions">
                        <button
                          className="booking-cancel-button"
                          disabled={cancelling === booking.booking_id}
                          onClick={() => handleCancel(booking.booking_id)}
                        >
                          {cancelling === booking.booking_id ? (
                            <>
                              <span className="checkout-button-spinner"></span>
                              Cancelling...
                            </>
                          ) : (
                            'Cancel Booking'
                          )}
                        </button>
                      </div>
                    )}

                    {isCancelled && (
                      <p className="booking-cancelled-note">
                        This booking has been cancelled.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default MyBookings;
