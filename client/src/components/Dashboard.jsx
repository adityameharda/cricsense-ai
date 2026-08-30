import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import LogoutModal from './common/LogoutModal';

const ACCENT_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626'];

const Dashboard = ({ user, onLogout }) => {
  const [contests, setContests] = useState([]);
  const [stats, setStats] = useState({
    totalMatches: 0,
    totalWins: 0,
    bestRank: 0,
    virtualCoins: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
    } else {
      setLoadingData(false);
    }
  }, [user]);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      const [contestsRes, profileRes] = await Promise.all([
        axios.get('http://localhost:5000/api/contests/user/contests', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get('http://localhost:5000/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setContests(contestsRes.data.contests || []);
      const u = profileRes.data.user;
      setStats({
        totalMatches: u.totalMatches || 0,
        totalWins: u.totalWins || 0,
        bestRank: u.bestRank || 0,
        virtualCoins: u.virtualCoins || 0,
      });
    } catch (err) {
      console.error('Failed to fetch user data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleConfirmLogout = () => {
    setIsLogoutOpen(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    if (onLogout) onLogout();
  };

  const statCards = [
    { label: 'Fantasy Points', value: (stats.virtualCoins || 0).toLocaleString(), sub: 'Career Total', accent: ACCENT_COLORS[0] },
    { label: 'Total Matches', value: stats.totalMatches, sub: 'Participated', accent: ACCENT_COLORS[1] },
    { label: 'Matches Won', value: stats.totalWins, sub: 'Victory Count', accent: ACCENT_COLORS[2] },
    { label: 'Best Rank', value: stats.bestRank ? `#${stats.bestRank}` : 'N/A', sub: 'All-Time High', accent: ACCENT_COLORS[3] },
  ];

  return (
    <div className="dashboard-page animate-fade-up">
      {/* Welcome Header */}
      <div className="dashboard-welcome-header">
        <div>
          <div className="dashboard-greeting">
            👋 Welcome back, {user?.username}!
          </div>
          <div className="dashboard-greeting-sub">
            Here's your fantasy performance overview
          </div>
        </div>
        <button onClick={() => setIsLogoutOpen(true)} className="dashboard-logout-btn">
          Sign Out
        </button>
      </div>

      <LogoutModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* Stats Grid */}
      {loadingData ? (
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="stat-card">
              <div className="skeleton-line" style={{ height: 14, width: '60%', marginBottom: 12 }} />
              <div className="skeleton-line" style={{ height: 42, width: '40%', marginBottom: 8 }} />
              <div className="skeleton-line" style={{ height: 12, width: '50%' }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="stats-grid">
          {statCards.map((card) => (
            <div key={card.label} className="stat-card">
              <div className="stat-card-accent" style={{ background: card.accent }} />
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-value">{card.value}</div>
              <div className="stat-card-sub">{card.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <Link to="/" className="dashboard-action-btn primary">
          🏏 View Live Matches
        </Link>
        <Link to="/create-contest" className="dashboard-action-btn secondary">
          🏆 Create Contest
        </Link>
        <Link to="/profile" className="dashboard-action-btn secondary">
          📊 My Profile
        </Link>
      </div>

      {/* Contests */}
      <div>
        <div className="contests-section-header">Your Contests</div>
        {loadingData ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : contests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🏟️</div>
            <div className="empty-state-title">No contests yet</div>
            <div className="empty-state-desc">
              Join a match and create or join a fantasy contest to get started.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {contests.map((contest) => (
              <div key={contest._id} className="contest-card">
                <div>
                  <div className="contest-card-name">{contest.name}</div>
                  <div className="contest-card-meta">
                    <span>Code: <span className="contest-card-code">{contest.contestId}</span></span>
                    <span>{contest.participants.length}/{contest.maxParticipants} players</span>
                    <span>{contest.entryFee} coins entry</span>
                  </div>
                </div>
                <Link
                  to={`/leaderboard/${contest.matchId}?contestId=${contest.contestId}`}
                  className="contest-view-btn"
                >
                  View Leaderboard →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;