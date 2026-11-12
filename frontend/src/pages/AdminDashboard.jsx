
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import '../styles/admin.css';

function DataTable({ title, subtitle, rows, icon }) {
  if (!rows || rows.length === 0) {
    return (
      <section className="admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="admin-panel-icon">{icon}</span>
            <div>
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>
          </div>
          <span className="admin-record-count">0 records</span>
        </div>
        <div className="admin-empty">
          <span>▤</span>
          <p>No data available yet.</p>
        </div>
      </section>
    );
  }

  const columns = Object.keys(rows[0]);

  const formatCell = (value) => {
    if (value === null || value === undefined) return '-';

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  };

  return (
    <section className="admin-panel">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-panel-icon">{icon}</span>
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </div>
        <span className="admin-record-count">
          {rows.length} {rows.length === 1 ? 'record' : 'records'}
        </span>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>
                  {column.replaceAll('_', ' ')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column}>{formatCell(row[column])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminDashboard() {
  const [data, setData] = useState({
    revenue: [],
    occupancy: [],
    topMovies: [],
    peakHours: [],
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [revenue, occupancy, topMovies, peakHours] =
          await Promise.all([
            api.get('/admin/dashboard/revenue'),
            api.get('/admin/dashboard/occupancy'),
            api.get('/admin/dashboard/top-movies'),
            api.get('/admin/dashboard/peak-hours'),
          ]);

        setData({
          revenue: revenue.data.revenue || [],
          occupancy: occupancy.data.occupancy || [],
          topMovies: topMovies.data.topMovies || [],
          peakHours: peakHours.data.peakHours || [],
        });
      } catch (err) {
        if (err.response?.status === 403) {
          setError('You are not authorized to access the admin dashboard.');
        } else if (err.response?.status === 401) {
          setError('Please log in with an administrator account.');
        } else {
          setError(
            err.response?.data?.message || 'Unable to load admin dashboard.'
          );
        }
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <main className="admin-page">
        <div className="admin-loading">
          <div className="checkout-loader"></div>
          <p>Loading platform analytics...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="admin-page">
        <div className="admin-error-panel">
          <span>!</span>
          <h2>Dashboard unavailable</h2>
          <p>{error}</p>
          <Link to="/login">Go to Login</Link>
        </div>
      </main>
    );
  }

  return (
    <div className="admin-page">
      <nav className="admin-nav">
        <Link to="/admin/dashboard" className="admin-brand">
          Cine<span>Book</span>
        </Link>

        <div className="admin-nav-links">
          <Link to="/admin/dashboard" className="active">Dashboard</Link>
          <Link to="/admin/cities">Cities</Link>
          <Link to="/admin/venues">Venues</Link>
          <Link to="/admin/screens">Screens</Link>
          <Link to="/admin/movies">Movies</Link>
        </div>

        <Link to="/shows" className="admin-customer-link">
          Customer View →
        </Link>
      </nav>

      <main className="admin-content">
        <header className="admin-header">
          <div>
            <span className="admin-eyebrow">PLATFORM CONTROL CENTER</span>
            <h1>Admin Dashboard<span>.</span></h1>
            <p className="admin-subtitle">
              Overview of CineBook platform performance and analytics.
            </p>
          </div>

          <div className="admin-status">
            <span></span>
            Platform overview
          </div>
        </header>

        <section className="admin-stats">
          <article className="admin-stat">
            <div className="admin-stat-top">
              <span className="admin-stat-icon">₹</span>
              <span>REVENUE</span>
            </div>
            <p>Revenue Records</p>
            <h2>{data.revenue.length}</h2>
            <small>Analytics entries</small>
          </article>

          <article className="admin-stat">
            <div className="admin-stat-top">
              <span className="admin-stat-icon">◉</span>
              <span>OCCUPANCY</span>
            </div>
            <p>Shows Tracked</p>
            <h2>{data.occupancy.length}</h2>
            <small>Occupancy entries</small>
          </article>

          <article className="admin-stat">
            <div className="admin-stat-top">
              <span className="admin-stat-icon">★</span>
              <span>MOVIES</span>
            </div>
            <p>Top Movie Records</p>
            <h2>{data.topMovies.length}</h2>
            <small>City-wise movie entries</small>
          </article>

          <article className="admin-stat">
            <div className="admin-stat-top">
              <span className="admin-stat-icon">◷</span>
              <span>BOOKING HOURS</span>
            </div>
            <p>Peak Hour Records</p>
            <h2>{data.peakHours.length}</h2>
            <small>Peak-time entries</small>
          </article>
        </section>

        <div className="admin-section-label">
          <span>PLATFORM INSIGHTS</span>
          <div></div>
        </div>

        <div className="admin-analytics-grid">
          <DataTable
            title="Revenue Analytics"
            subtitle="Revenue overview"
            rows={data.revenue}
            icon="₹"
          />

          <DataTable
            title="Occupancy Analytics"
            subtitle="Show seat occupancy"
            rows={data.occupancy}
            icon="◉"
          />

          <DataTable
            title="Top Movies by City"
            subtitle="Movie performance across cities"
            rows={data.topMovies}
            icon="★"
          />

          <DataTable
            title="Peak Booking Hours"
            subtitle="Booking activity by time"
            rows={data.peakHours}
            icon="◷"
          />
        </div>
      </main>
    </div>
  );
}

export default AdminDashboard;
