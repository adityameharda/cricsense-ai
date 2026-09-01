import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import LogoutModal from './common/LogoutModal';
import Icon from './common/Icons';

const UserProfile = () => {
  const [user, setUser] = useState(null);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setUser({ username: 'deepak_verma', virtualCoins: 1000, totalWins: 0, totalMatches: 0, bestRank: 0 });
          return;
        }
        const res = await axios.get('http://localhost:5000/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(res.data.user || { username: 'deepak_verma', virtualCoins: 1000, totalWins: 0, totalMatches: 0, bestRank: 0 });
      } catch (err) {
        console.error('Error fetching profile', err);
        setUser({ username: 'deepak_verma', virtualCoins: 1000, totalWins: 0, totalMatches: 0, bestRank: 0 });
      }
    };
    fetchProfile();
  }, []);

  const handleConfirmLogout = () => {
    setIsLogoutOpen(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (!user) {
    return (
      <div className="app-loading">
        <div className="spinner" />
        <span>Loading profile…</span>
      </div>
    );
  }

  const winRate = user.totalMatches > 0 ? Math.round((user.totalWins / user.totalMatches) * 100) : 0;

  const statCards = [
    { label: 'Fantasy Points', value: (user.virtualCoins || 1000).toLocaleString(), sub: 'Career Balance', accent: '#2563eb', icon: 'coins' },
    { label: 'Total Wins', value: user.totalWins || 0, sub: 'Contests Won', accent: '#059669', icon: 'trophy' },
    { label: 'Matches Played', value: user.totalMatches || 0, sub: 'Career Fixtures', accent: '#d97706', icon: 'cricket' },
    { label: 'Best Rank', value: user.bestRank ? `#${user.bestRank}` : 'N/A', sub: 'All-Time High', accent: '#7c3aed', icon: 'crown' },
  ];

  const recentMatchesMock = [
    { match: 'Eng vs Pak', pts: 420, rank: '#1', date: 'Yesterday', result: 'win' },
    { match: 'Ind vs Aus', pts: 380, rank: '#3', date: '2 days ago', result: 'top' },
    { match: 'SA vs NZ', pts: 290, rank: '#8', date: '3 days ago', result: 'normal' },
    { match: 'WI vs SL', pts: 310, rank: '#5', date: '5 days ago', result: 'normal' },
  ];

  return (
    <div className="profile-page animate-fade-up">
      {/* Top Bar Navigation */}
      <div className="page-top-bar">
        <Link to="/" className="top-back-btn" id="profile-back-btn">
          <Icon name="arrow-left" size={14} />
          <span>Back to Matches</span>
        </Link>
        <button
          onClick={() => setIsLogoutOpen(true)}
          className="top-back-btn"
          style={{ borderColor: '#fca5a5', color: '#dc2626', background: '#fef2f2' }}
        >
          <Icon name="logout" size={13} color="#dc2626" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Profile Hero Section */}
      <div className="profile-hero">
        <div className="profile-avatar-circle-large">
          {user.username ? user.username.slice(0, 2).toUpperCase() : 'DE'}
        </div>

        <div className="profile-info" style={{ flex: 1 }}>
          <div className="profile-badge-chip">
            <Icon name="award" size={13} />
            <span>FANTASY PRO LEAGUE</span>
          </div>
          <div className="profile-username">{user.username || 'deepak_verma'}</div>
          <div className="profile-meta">
            <span className="profile-meta-item">
              <Icon name="shield" size={14} color="#67e8f9" />
              <span>Elite Tier (Active)</span>
            </span>
            <span className="profile-meta-item">
              <Icon name="calendar" size={14} color="rgba(255,255,255,0.7)" />
              <span>Win Rate: {winRate}%</span>
            </span>
          </div>
        </div>

        <div>
          <button
            onClick={() => setIsLogoutOpen(true)}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,255,255,0.2)',
              border: '1.5px solid rgba(255,255,255,0.4)',
              borderRadius: 10,
              color: 'white',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: 13,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {statCards.map((card) => (
          <div key={card.label} className="stat-card">
            <div className="stat-card-accent" style={{ background: card.accent }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-icon-wrap" style={{ color: card.accent }}>
                <Icon name={card.icon} size={18} />
              </div>
            </div>
            <div className="stat-card-value">{card.value}</div>
            <div className="stat-card-sub">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Performance & Win Rate Analytics Card */}
      <div className="profile-analytics-card">
        <div className="analytics-card-header">
          <div className="analytics-title">
            <Icon name="activity" size={18} color="#2563eb" />
            <span>Recent Performance & Matchup Index</span>
          </div>
          <span className="win-rate-pill">
            <Icon name="award" size={13} color="#059669" /> {winRate}% Win Rate
          </span>
        </div>

        <div className="win-rate-bar-track">
          <div className="win-rate-bar-fill" style={{ width: `${Math.max(12, winRate)}%` }} />
        </div>

        {/* Recent Performance Log Cards */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#64748b', marginBottom: 12 }}>
            Recent Contest Performance (Last 4 Fixtures)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            {recentMatchesMock.map((m, idx) => (
              <div key={idx} style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: 12,
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s',
              }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>{m.match}</div>
                  <div style={{ fontSize: 11.5, color: '#64748b', marginTop: 2 }}>{m.date} · Rank {m.rank}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 900, fontSize: 15, color: '#2563eb' }}>
                    {m.pts}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#64748b' }}>PTS</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="profile-features-grid">
          <div className="profile-feature-box">
            <Icon name="zap" size={20} color="#2563eb" />
            <div>
              <div className="feature-box-title">Live Scoring Telemetry</div>
              <div className="feature-box-desc">Sub-second fantasy rank recalculation with real-time captaincy multipliers.</div>
            </div>
          </div>
          <div className="profile-feature-box">
            <Icon name="shield" size={20} color="#059669" />
            <div>
              <div className="feature-box-title">Verified Fair Play</div>
              <div className="feature-box-desc">Official CricAPI match telemetry and transparent point breakdown.</div>
            </div>
          </div>
          <div className="profile-feature-box">
            <Icon name="sparkles" size={20} color="#d97706" />
            <div>
              <div className="feature-box-title">CricSense AI Pro</div>
              <div className="feature-box-desc">Deep tactical intelligence, venue ground metrics, and captaincy tips.</div>
            </div>
          </div>
        </div>
      </div>

      <LogoutModal
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleConfirmLogout}
      />
    </div>
  );
};

export default UserProfile;
