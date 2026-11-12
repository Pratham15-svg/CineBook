
import { BrowserRouter, Routes, Route, Link, useNavigate } from 'react-router-dom';
import CinemaBackdrop from './components/CinemaBackdrop';
import Register from './pages/Register';
import Login from './pages/Login';
import './styles/theme.css';
import './styles/auth.css';
import Shows from './pages/Shows';
import './styles/shows.css';
import ShowDetails from './pages/ShowDetails';
import SeatSelection from './pages/SeatSelection';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import ManagerDashboard from './pages/ManagerDashboard';
import ManagerSchedule from './pages/ManagerSchedule';
import AdminDashboard from './pages/AdminDashboard';
import AdminCities from './pages/AdminCities';
import AdminVenues from './pages/AdminVenues';
import AdminScreens from './pages/AdminScreens';
import AdminMovies from './pages/AdminMovies';
import './styles/home.css';

function Home() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const role = user?.role?.toUpperCase();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  };

  return (
    <div className="cinema-home">

      {/* Navigation */}
      <nav className="cinema-nav">
        <Link to="/" className="cinema-logo">
          Cine<span>Book</span>
        </Link>

        <div className="cinema-nav-links">
          <Link to="/shows">Movies</Link>

          {role === 'CUSTOMER' && (
            <Link to="/my-bookings">My Bookings</Link>
          )}

          {role === 'MANAGER' && (
            <>
              <Link to="/manager/dashboard">Manager Dashboard</Link>
              <Link to="/manager/schedule">Schedule Show</Link>
            </>
          )}

          {role === 'ADMIN' && (
            <Link to="/admin/dashboard">Admin Dashboard</Link>
          )}

          {user ? (
            <button className="nav-login" onClick={handleLogout}>
              Logout
            </button>
          ) : (
            <Link to="/login" className="nav-login">
              Login
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="cinema-hero">
        <div className="hero-content">

          <p className="hero-eyebrow">
            YOUR NEXT MOVIE EXPERIENCE STARTS HERE
          </p>

          <h1>
            Movies worth
            <br />
            <span>watching.</span>
          </h1>

          <p className="hero-description">
            Discover movies. Choose your seats.
            <br />
            Book your experience.
          </p>

          <Link to="/shows" className="hero-button">
            Explore Movies <span>→</span>
          </Link>

          <div className="hero-bottom-text">
            YOUR SEAT. YOUR MOVIE. YOUR EXPERIENCE.
          </div>

        </div>
      </main>

    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <CinemaBackdrop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/shows" element={<Shows />} />
        <Route path="/shows/:id" element={<ShowDetails />} />
        <Route path="/shows/:id/seats" element={<SeatSelection />} />
        <Route path="/checkout/:bookingId" element={<Checkout />} />
        <Route path="/my-bookings" element={<MyBookings />} />
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="/manager/schedule" element={<ManagerSchedule />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/cities" element={<AdminCities />} />
        <Route path="/admin/venues" element={<AdminVenues />} />
        <Route path="/admin/screens" element={<AdminScreens />} />
        <Route path="/admin/movies" element={<AdminMovies />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
