
import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import '../styles/shows.css';
import '../styles/manager-schedule.css';

function SeatSelection() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bookingLoading, setBookingLoading] = useState(false);
  const [seats, setSeats] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSeats = async () => {
      try {
        const response = await api.get(`/shows/${id}/seats`);
        setSeats(response.data.seats || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load seats.');
      } finally {
        setLoading(false);
      }
    };

    fetchSeats();
  }, [id]);

  const toggleSeat = (seat) => {
    if (seat.status !== 'AVAILABLE') return;

    setSelectedSeats((current) => {
      if (current.includes(seat.seat_no)) {
        return current.filter((number) => number !== seat.seat_no);
      }

      if (current.length >= 6) {
        alert('You can select a maximum of 6 seats.');
        return current;
      }

      return [...current, seat.seat_no];
    });
  };

  const totalPrice = seats
    .filter((seat) => selectedSeats.includes(seat.seat_no))
    .reduce((total, seat) => total + Number(seat.price), 0);

  const handleContinue = async () => {
    if (!localStorage.getItem('token')) {
      alert('Please log in before booking seats.');
      navigate('/login');
      return;
    }

    try {
      setBookingLoading(true);
      setError('');

      const response = await api.post('/bookings', {
        showId: id,
        seatNumbers: selectedSeats,
        ...(couponCode.trim() ? { couponCode: couponCode.trim().toUpperCase() } : {}),
      });

      const bookingId =
        response.data.bookingId || response.data.booking?.booking_id;

      if (!bookingId) {
        throw new Error('Booking was created, but no booking ID was returned.');
      }

      navigate(`/checkout/${bookingId}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to hold seats.');
    } finally {
      setBookingLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="cinema-seats-page">
        <p className="shows-message">Preparing your cinema hall...</p>
      </div>
    );
  }

  if (error && seats.length === 0) {
    return (
      <div className="cinema-seats-page">
        <p className="shows-error">{error}</p>
        <Link to={`/shows/${id}`}>Back to Show</Link>
      </div>
    );
  }

  return (
    <div className="cinema-seats-page">
      <nav className="cinema-shows-nav">
        <Link to="/" className="shows-brand">
          Cine<span>Book</span>
        </Link>

        <div className="shows-nav-links">
          <Link to="/shows">Movies</Link>
          <Link to="/my-bookings">My Bookings</Link>
        </div>
      </nav>

      <main className="cinema-seats-content">
        <Link to={`/shows/${id}`} className="details-back-link">
          ← Back to Show
        </Link>

        <div className="seats-heading">
          <p className="details-eyebrow">YOUR CINEMA EXPERIENCE</p>
          <h1>Select Your Seats</h1>
          <p>Choose your favourite seats. You can select up to 6.</p>
        </div>

        <div className="cinema-seats-layout">
          <section className="cinema-seat-section">
            <div className="cinema-screen">
              <div className="screen-glow"></div>
              <span>SCREEN</span>
            </div>

            <p className="screen-caption">All eyes this way</p>

            <div className="seat-legend-modern">
              <div>
                <span className="legend-seat available"></span>
                Available
              </div>
              <div>
                <span className="legend-seat selected"></span>
                Selected
              </div>
              <div>
                <span className="legend-seat unavailable"></span>
                Booked / Held
              </div>
            </div>

            <div className="cinema-seat-grid">
              {seats.map((seat) => {
                const selected = selectedSeats.includes(seat.seat_no);
                const unavailable = seat.status !== 'AVAILABLE';

                return (
                  <button
                    key={seat.seat_no}
                    type="button"
                    className={`cinema-seat ${
                      selected ? 'seat-is-selected' : ''
                    } ${unavailable ? 'seat-is-unavailable' : ''}`}
                    onClick={() => toggleSeat(seat)}
                    disabled={unavailable || bookingLoading}
                    aria-pressed={selected}
                    title={`${seat.seat_no} - ${seat.category} - ₹${seat.price} - ${seat.status}`}
                  >
                    {seat.seat_no}
                  </button>
                );
              })}
            </div>

            {seats.length === 0 && (
              <p className="shows-message">No seats found for this show.</p>
            )}

            <p className="seat-selection-hint">
              Maximum 6 seats per booking
            </p>
          </section>

          <aside className="cinema-booking-summary">
            <p className="details-section-label">YOUR SELECTION</p>
            <h2>Booking Summary</h2>

            <div className="summary-count">
              <span>Selected seats</span>
              <strong>{selectedSeats.length} / 6</strong>
            </div>

            <div className="summary-selected-seats">
              {selectedSeats.length > 0 ? (
                selectedSeats.map((seat) => (
                  <span key={seat}>{seat}</span>
                ))
              ) : (
                <p>No seats selected yet</p>
              )}
            </div>

            <div className="summary-divider"></div>

            <div className="coupon-box">
              <label htmlFor="coupon-code">COUPON CODE (OPTIONAL)</label>
              <input
                id="coupon-code"
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                placeholder="e.g. WELCOME10"
                maxLength={30}
                disabled={bookingLoading}
              />
              <small>The discount is applied at checkout.</small>
            </div>

            <div className="summary-total">
              <span>Total amount</span>
              <strong>₹{totalPrice}</strong>
            </div>

            <button
              type="button"
              className="details-book-button summary-hold-button"
              disabled={selectedSeats.length === 0 || bookingLoading}
              onClick={handleContinue}
            >
              {bookingLoading ? 'Holding Seats...' : 'Hold Seats'}
              {!bookingLoading && <span>→</span>}
            </button>

            {error && <p className="shows-error">{error}</p>}

            <p className="summary-note">
              Your selected seats will be temporarily held before checkout.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default SeatSelection;
