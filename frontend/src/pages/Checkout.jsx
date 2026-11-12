
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/shows.css';

function Checkout() {
  const { bookingId } = useParams();

  const [booking, setBooking] = useState(null);
  const [method, setMethod] = useState('UPI');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchBooking = async () => {
      try {
        const response = await api.get(`/bookings/${bookingId}`);
        setBooking(response.data.booking);
      } catch (err) {
        setError(err.response?.data?.message || 'Unable to load booking.');
      } finally {
        setLoading(false);
      }
    };

    fetchBooking();
  }, [bookingId]);

  const handlePayment = async () => {
    try {
      setPaying(true);
      setError('');

      await api.post(`/bookings/${bookingId}/confirm`, { method });

      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Payment confirmation failed.');
    } finally {
      setPaying(false);
    }
  };

  const paymentMethods = [
    { id: 'UPI', icon: '◈', description: 'Google Pay, PhonePe, Paytm' },
    { id: 'CARD', icon: '▣', description: 'Credit or debit card' },
    { id: 'NETBANKING', icon: '⌂', description: 'Pay through your bank' },
    { id: 'WALLET', icon: '▤', description: 'Digital wallet payment' }
  ];

  if (loading) {
    return (
      <main className="cinema-checkout-page">
        <div className="checkout-loading">
          <div className="checkout-loader"></div>
          <p>Preparing your checkout...</p>
        </div>
      </main>
    );
  }

  if (error && !booking) {
    return (
      <main className="cinema-checkout-page">
        <div className="checkout-error">
          <h2>Unable to load booking</h2>
          <p>{error}</p>
          <Link to="/shows" className="checkout-back-button">
            Back to movies
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="cinema-checkout-page checkout-success-page">
        <div className="checkout-success-card">
          <div className="success-icon-wrap">
            <svg
              className="checkout-success-check"
              viewBox="0 0 100 100"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="50" cy="50" r="44" />
              <path d="M28 51 L43 66 L73 35" />
            </svg>
          </div>

          <span className="checkout-success-label">PAYMENT COMPLETE</span>
          <h1>You're going to the movies!</h1>
          <p>Your booking has been confirmed. Sit back, relax and enjoy the show.</p>

          <div className="checkout-confirmation-id">
            <span>BOOKING REFERENCE</span>
            <strong>{bookingId}</strong>
          </div>

          <div className="checkout-success-actions">
            <Link to="/my-bookings" className="checkout-primary-button">
              View My Bookings
            </Link>
            <Link to="/shows" className="checkout-secondary-button">
              Explore More Movies
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <div className="cinema-checkout-page">
      <nav className="checkout-nav">
        <Link to="/" className="brand">
          Cine<span>Book</span>
        </Link>
        <Link to="/shows" className="checkout-movies-link">
          ← Back to movies
        </Link>
      </nav>

      <main className="checkout-content">
        <div className="checkout-heading">
          <span className="checkout-eyebrow">ALMOST THERE</span>
          <h1>Complete your booking<span>.</span></h1>
          <p>One last step before the big screen.</p>
        </div>

        <div className="checkout-layout">
          <section className="checkout-payment-panel">
            <div className="checkout-section-heading">
              <div>
                <span className="checkout-step">01</span>
                <h2>Payment method</h2>
              </div>
              <span className="checkout-secure-label">⌑ Secure checkout</span>
            </div>

            <p className="checkout-section-description">
              Choose how you'd like to complete your payment.
            </p>

            <div className="checkout-methods">
              {paymentMethods.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={`checkout-method-card ${
                    method === option.id ? 'method-selected' : ''
                  }`}
                  onClick={() => setMethod(option.id)}
                  aria-pressed={method === option.id}
                >
                  <span className="method-icon">{option.icon}</span>
                  <span className="method-details">
                    <strong>{option.id === 'NETBANKING' ? 'Net Banking' : option.id}</strong>
                    <small>{option.description}</small>
                  </span>
                  <span className="method-radio">
                    {method === option.id && <span />}
                  </span>
                </button>
              ))}
            </div>

            {error && <p className="checkout-payment-error">{error}</p>}

            <button
              className="checkout-pay-button"
              onClick={handlePayment}
              disabled={paying}
            >
              {paying ? (
                <>
                  <span className="checkout-button-spinner"></span>
                  Processing payment...
                </>
              ) : (
                <>Confirm Payment <span>→</span></>
              )}
            </button>

            <p className="checkout-disclaimer">
              This is a simulated payment flow for the CineBook project.
            </p>
          </section>

          <aside className="checkout-summary-panel">
            <span className="checkout-summary-label">YOUR ORDER</span>
            <h2>Booking summary</h2>

            <div className="checkout-ticket-decoration">
              <div className="ticket-top">
                <span className="ticket-icon">▣</span>
                <span>CINEBOOK TICKET</span>
              </div>
              <div className="ticket-divider"></div>
              <div className="ticket-booking-info">
                <span>BOOKING ID</span>
                <strong>{bookingId}</strong>
              </div>
              <div className="ticket-booking-info">
                <span>BOOKING STATUS</span>
                <strong className="ticket-status">
                  {booking?.status || 'Held'}
                </strong>
              </div>
              <div className="ticket-bottom">
                <span>Enjoy the show!</span>
                <span>✦ ✦ ✦</span>
              </div>
            </div>

            <div className="checkout-summary-note">
              <span>✦</span>
              <p>Your seats are held for this booking. Complete payment to confirm your reservation.</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default Checkout;
