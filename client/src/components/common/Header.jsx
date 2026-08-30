import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Icon from './Icons';
import CricSenseModal from './CricSenseModal';
import LogoutModal from './LogoutModal';

export const Header = ({ user, onLogout, liveCount = 0 }) => {
  const location = useLocation();
  const [isAiOpen, setIsAiOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  const navLinks = [
    { name: '🏏 Live Matches', path: '/' },
    { name: '🏆 Fantasy', path: '/dashboard', authRequired: true },
    { name: '📊 Leaderboard', path: '/leaderboard', authRequired: true },
  ];

  const handleConfirmLogout = () => {
    setIsLogoutOpen(false);
    if (onLogout) onLogout();
  };

  return (
    <>
      <nav className="cricscore-nav">
        {/* Logo */}
        <Link to="/" className="nav-logo-link">
          <div className="nav-logo-icon">🏏</div>
          <span className="nav-logo-text">Cric<span>Score</span></span>
        </Link>

        {/* Desktop Nav */}
        <div className="nav-center">
          {navLinks.map((item) => {
            if (item.authRequired && !user) return null;
            const isActive = location.pathname === item.path ||
              (item.path === '/leaderboard' && location.pathname.startsWith('/leaderboard'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link-item${isActive ? ' active' : ''}`}
              >
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="nav-right">
          {/* Live Count Pill */}
          <div className="live-pill">
            <span className="live-pulse-ring">
              <span className="live-pulse-ring-outer" />
              <span className="live-pulse-ring-inner" />
            </span>
            <span>{liveCount} LIVE</span>
          </div>

          {/* Ask CricSense AI */}
          <button
            id="cricsense-ai-btn"
            onClick={() => setIsAiOpen(true)}
            className="ai-trigger-btn"
          >
            <Icon name="sparkles" size={14} />
            <span>Ask CricSense</span>
          </button>

          {/* Auth / Profile */}
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link to="/profile" className="user-avatar-pill">
                <div className="user-avatar-circle">
                  {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                </div>
                <span className="user-name-text">{user.username}</span>
              </Link>
              <button
                onClick={() => setIsLogoutOpen(true)}
                className="nav-logout-btn"
                title="Sign out of your account"
              >
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" className="nav-login-btn">Log In</Link>
          )}
        </div>
      </nav>

      <CricSenseModal isOpen={isAiOpen} onClose={() => setIsAiOpen(false)} />
      <LogoutModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </>
  );
};

export default Header;

