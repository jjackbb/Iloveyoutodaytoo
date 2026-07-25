import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { Home, Mail, User } from 'lucide-react';
import HomePage from './pages/HomePage';
import MailboxPage from './pages/MailboxPage';
import ProfilePage from './pages/ProfilePage';
import LoginPage from './pages/LoginPage';
import AlbumPage from './pages/AlbumPage';
import LandingPage from './pages/LandingPage';

function BottomNav() {
  const location = useLocation();
  const isAuthPage = location.pathname === '/login' || location.pathname === '/signup' || location.pathname === '/';
  
  if (isAuthPage) return null;

  return (
    <nav className="bottom-nav">
      <Link to="/home" className={`nav-item ${location.pathname === '/home' ? 'active' : ''}`}>
        <Home size={24} />
        <span>홈</span>
      </Link>
      <Link to="/mailbox" className={`nav-item ${location.pathname === '/mailbox' ? 'active' : ''}`}>
        <Mail size={24} />
        <span>사서함</span>
      </Link>
      <Link to="/profile" className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}>
        <User size={24} />
        <span>마이</span>
      </Link>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <div className="app-container">
        <div className="main-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/mailbox" element={<MailboxPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/album/:id" element={<AlbumPage />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
