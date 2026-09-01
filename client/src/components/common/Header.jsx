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
    { name: 'Live Matches', path: '/', icon: 'cricket' },
    { name: 'Fantasy Arena', path: '/dashboard', authRequired: true, icon: 'trophy' },
    { name: 'Leaderboard', path: '/leaderboard', authRequired: true, icon: 'award' },
  ];

  const handleConfirmLogout = () => {
    setIsLogoutOpen(false);
    if (onLogout) onLogout();
  };

  return (
    <>
      <nav className="cricscore-nav">
        {/* Brand Logo */}
        <Link to="/" className="nav-logo-link">
          <div className="nav-logo-icon">
            <Icon name="cricket" size={20} color="white" />
          </div>
          <span className="nav-logo-text">Cric<span>Score</span></span>
        </Link>

        {/* Center Nav Links */}
        <div className="nav-center">
          {navLinks.map((item) => {
            if (item.authRequired && !user) return null;
            const isActive = location.pathname === item.path ||
              (item.path === '/leaderboard' && location.pathname.startsWith('/leaderboard'));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-link-item ${isActive ? 'active' : ''}`}
              >
                <Icon name={item.icon} size={15} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </div>

        {/* Right Actions */}
        <div className="nav-right">
          {/* Live Count Pill */}
          <div className="live-pill" title="Active live matches being tracked">
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
            title="Ask CricSense cricket AI assistant"
          >
            <Icon name="sparkles" size={15} color="var(--color-primary)" />
            <span>Ask CricSense</span>
          </button>

          {/* User Auth Profile */}
          {user ? (
            <div className="nav-user-container">
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
                <Icon name="logout" size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <Link to="/login" className="nav-login-btn">
              <Icon name="login" size={14} />
              <span>Log In</span>
            </Link>
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
