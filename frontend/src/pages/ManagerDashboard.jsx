
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/shows.css';
import '../styles/manager-schedule.css';

function ManagerDashboard() {
  const [shows, setShows] = useState([]);
  const [occupancy, setOccupancy] = useState([]);
  const [revenue, setRevenue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [showsRes, occupancyRes, revenueRes] = await Promise.all([
          api.get('/manager/shows'),
          api.get('/manager/occupancy'),
          api.get('/manager/revenue'),
        ]);

        setShows(showsRes.data.shows || []);
        setOccupancy(occupancyRes.data.occupancy || []);
        setRevenue(revenueRes.data.revenue || []);
      } catch (err) {
        if (err.response?.status === 403) {
          setError('You are not authorized to access the manager dashboard.');
        } else if (err.response?.status === 401) {
          setError('Please log in with a manager account.');
        } else {
          setError(err.response?.data?.message || 'Unable to load dashboard.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const totalRevenue = revenue.reduce(
    (total, item) => total + Number(item.total_revenue || 0),
    0
  );

  const averageOccupancy = occupancy.length
    ? occupancy.reduce(
        (total, item) => total + Number(item.occupancy_percentage || 0),
        0
      ) / occupancy.length
    : 0;

  const formatCurrency = (amount) =>
    `₹${Number(amount || 0).toLocaleString('en-IN', {
      maximumFractionDigits: 2,
    })}`;

  if (loading) {
    return (
      <main className="cinema-manager-page">
        <div className="manager-loading">
          <div className="checkout-loader"></div>
          <p>Loading venue analytics...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="cinema-manager-page">
        <div className="manager-error-panel">
          <span className="manager-error-icon">!</span>
          <h2>Dashboard unavailable</h2>
          <p>{error}</p>
          <Link to="/login" className="manager-primary-link">
            Go to Login
          </Link>
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
        <Link to="/shows" className="manager-customer-link">
          Customer View →
        </Link>
      </nav>

      <main className="manager-content">
        <header className="manager-header">
          <div>
            <span className="manager-eyebrow">VENUE OPERATIONS</span>
            <h1>Manager Dashboard<span>.</span></h1>
            <p>Monitor your venue's performance and scheduled shows.</p>
            <Link to="/manager/schedule" className="manager-schedule-link">
              + Schedule a Show
            </Link>
          </div>
          <div className="manager-live-indicator">
            <span></span>
            Venue overview
          </div>
        </header>

        <section className="manager-stats-grid">
          <article className="manager-stat-card">
            <div className="manager-stat-top">
              <span className="manager-stat-icon">▣</span>
              <span className="manager-stat-caption">SHOWS</span>
            </div>
            <p>Total Shows</p>
            <h2>{shows.length}</h2>
            <span className="manager-stat-footnote">Scheduled at your venue</span>
          </article>

          <article className="manager-stat-card manager-revenue-stat">
            <div className="manager-stat-top">
              <span className="manager-stat-icon">₹</span>
              <span className="manager-stat-caption">REVENUE</span>
            </div>
            <p>Total Revenue</p>
            <h2>{formatCurrency(totalRevenue)}</h2>
            <span className="manager-stat-footnote">Across reported venues</span>
          </article>

          <article className="manager-stat-card manager-occupancy-stat">
            <div className="manager-stat-top">
              <span className="manager-stat-icon">◉</span>
              <span className="manager-stat-caption">OCCUPANCY</span>
            </div>
            <p>Average Occupancy</p>
            <h2>{averageOccupancy.toFixed(2)}%</h2>
            <div className="manager-stat-progress">
              <span style={{ width: `${Math.min(100, Math.max(0, averageOccupancy))}%` }}></span>
            </div>
            <span className="manager-stat-footnote">Average across occupancy records</span>
          </article>
        </section>

        <section className="manager-section">
          <div className="manager-section-heading">
            <div>
              <span className="manager-section-eyebrow">WHAT'S ON</span>
              <h2>Scheduled Shows</h2>
            </div>
            <span className="manager-section-count">{shows.length} shows</span>
          </div>

          {shows.length === 0 ? (
            <div className="manager-empty-panel">
              <span>▣</span>
              <p>No shows scheduled.</p>
            </div>
          ) : (
            <div className="manager-table-wrap">
              <table className="manager-table">
                <thead>
                  <tr>
                    <th>Movie</th>
                    <th>Venue / Screen</th>
                    <th>Showtime</th>
                    <th>Booked Seats</th>
                  </tr>
                </thead>
                <tbody>
                  {shows.map((show) => (
                    <tr key={show.show_id}>
                      <td>
                        <strong className="manager-movie-title">
                          {show.movie_title}
                        </strong>
                      </td>
                      <td>
                        <span>{show.venue_name}</span>
                        <small>{show.screen_name}</small>
                      </td>
                      <td>
                        {show.start_time
                          ? new Date(show.start_time).toLocaleString()
                          : 'N/A'}
                      </td>
                      <td>
                        <strong>
                          {show.booked_seats} / {show.total_seats}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="manager-reports-grid">
          <section className="manager-section manager-report-panel">
            <div className="manager-section-heading">
              <div>
                <span className="manager-section-eyebrow">SEAT PERFORMANCE</span>
                <h2>Occupancy Report</h2>
              </div>
            </div>

            {occupancy.length === 0 ? (
              <div className="manager-empty-panel">
                <p>No occupancy data available.</p>
              </div>
            ) : (
              <div className="manager-report-list">
                {occupancy.map((item) => {
                  const percentage = Number(item.occupancy_percentage || 0);
                  const safePercentage = Math.min(100, Math.max(0, percentage));

                  return (
                    <div className="manager-report-item" key={item.show_id}>
                      <div className="manager-report-item-heading">
                        <div>
                          <strong>{item.movie_title}</strong>
                          <small>{item.screen_name}</small>
                        </div>
                        <strong className="manager-report-value">
                          {percentage.toFixed(2)}%
                        </strong>
                      </div>
                      <div className="manager-progress-track">
                        <span style={{ width: `${safePercentage}%` }}></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="manager-section manager-report-panel">
            <div className="manager-section-heading">
              <div>
                <span className="manager-section-eyebrow">EARNINGS</span>
                <h2>Revenue Report</h2>
              </div>
            </div>

            {revenue.length === 0 ? (
              <div className="manager-empty-panel">
                <p>No revenue data available.</p>
              </div>
            ) : (
              <div className="manager-report-list">
                {revenue.map((item) => (
                  <div className="manager-revenue-item" key={item.venue_id}>
                    <div className="manager-venue-symbol">⌂</div>
                    <div className="manager-venue-details">
                      <strong>{item.venue_name}</strong>
                      <small>Venue revenue</small>
                    </div>
                    <strong className="manager-report-value">
                      {formatCurrency(item.total_revenue)}
                    </strong>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default ManagerDashboard;
