import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import LogoutModal from './common/LogoutModal';
import Icon from './common/Icons';

const ACCENT_COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed'];

const Dashboard = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [contests, setContests] = useState([]);
  const [stats, setStats] = useState({
    totalMatches: 0,
    totalWins: 0,
    bestRank: 0,
    virtualCoins: 0,
  });
  const [loadingData, setLoadingData] = useState(true);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const [quickCode, setQuickCode] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);
  const [quickCodeError, setQuickCodeError] = useState('');

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
        axios.get(`${API_BASE_URL}/api/contests/user/contests`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/api/auth/profile`, {
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

  const handleQuickJoin = async (e) => {
    e.preventDefault();
    const code = quickCode.trim().toUpperCase();
    if (!code) {
      setQuickCodeError('Please enter a contest code.');
      return;
    }

    setJoiningCode(true);
    setQuickCodeError('');

    try {
      // 1. Fetch contest info to know which match it belongs to
      const res = await axios.get(`${API_BASE_URL}/api/contests/${code}`);
      const contest = res.data.contest;
      const match = res.data.match;

      if (!contest) {
        setQuickCodeError(`No contest found with code "${code}".`);
        return;
      }

      // 2. Redirect to Contest Hub Join Tab with this code
      navigate(`/create-contest?tab=join&code=${code}`);
    } catch (err) {
      setQuickCodeError(err.response?.data?.error || `Contest room "${code}" not found.`);
    } finally {
      setJoiningCode(false);
    }
  };

  const statCards = [
    { label: 'Fantasy Points', value: (stats.virtualCoins || 0).toLocaleString(), sub: 'Career Points Balance', accent: ACCENT_COLORS[0], icon: 'coins' },
    { label: 'Total Matches', value: stats.totalMatches, sub: 'Fixtures Participated', accent: ACCENT_COLORS[1], icon: 'cricket' },
    { label: 'Matches Won', value: stats.totalWins, sub: 'Victory Tally', accent: ACCENT_COLORS[2], icon: 'trophy' },
    { label: 'Best Rank', value: stats.bestRank ? `#${stats.bestRank}` : 'N/A', sub: 'All-Time High', accent: ACCENT_COLORS[3], icon: 'crown' },
  ];

  return (
    <div className="dashboard-page animate-fade-up">
      {/* Welcome Header */}
      <div className="dashboard-welcome-header">
        <div>
          <div className="dashboard-greeting">
            <span>Welcome back, {user?.username}!</span>
          </div>
          <div className="dashboard-greeting-sub">
            Track your fantasy rankings, active contests, and live cricket performance
          </div>
        </div>
        <button onClick={() => setIsLogoutOpen(true)} className="dashboard-logout-btn">
          <Icon name="logout" size={14} color="white" />
          <span>Sign Out</span>
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
              <div className="skeleton-line" style={{ height: 38, width: '40%', marginBottom: 8 }} />
              <div className="skeleton-line" style={{ height: 12, width: '50%' }} />
            </div>
          ))}
        </div>
      ) : (
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
      )}

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <Link to="/" className="dashboard-action-btn primary">
          <Icon name="cricket" size={16} />
          <span>View Live Matches</span>
        </Link>
        <Link to="/create-contest" className="dashboard-action-btn secondary">
          <Icon name="plus" size={16} />
          <span>Create Contest</span>
        </Link>
        <Link to="/create-contest?tab=join" className="dashboard-action-btn secondary" style={{ background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}>
          <Icon name="key" size={16} color="#15803d" />
          <span>Join with Code</span>
        </Link>
        <Link to="/profile" className="dashboard-action-btn secondary">
          <Icon name="user" size={16} />
          <span>My Profile</span>
        </Link>
      </div>

      {/* Quick Join Contest Card */}
      <div className="quick-join-card" style={{
        background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
        borderRadius: 16,
        padding: '20px 24px',
        color: 'white',
        marginBottom: 28,
        border: '1.5px solid #334155'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <Icon name="key" size={14} color="#38bdf8" />
              <span>Have a Private League Code?</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
              Join a Friend's Contest Room Instantly
            </div>
            <div style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 2 }}>
              Enter the 6-character code (e.g. 0BIHNG) to challenge friends and see your leaderboard rank.
            </div>
          </div>

          <form onSubmit={handleQuickJoin} style={{ flex: '1 1 300px', display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="text"
                maxLength={10}
                placeholder="Enter Code (e.g. 0BIHNG)"
                value={quickCode}
                onChange={(e) => {
                  setQuickCode(e.target.value.toUpperCase());
                  if (quickCodeError) setQuickCodeError('');
                }}
                className="form-input"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderColor: quickCodeError ? '#f87171' : 'rgba(255,255,255,0.2)',
                  color: 'white',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontWeight: 800,
                  height: 44
                }}
              />
            </div>
            <button
              type="submit"
              disabled={joiningCode || !quickCode.trim()}
              className="contest-btn-submit"
              style={{
                background: '#38bdf8',
                color: '#0f172a',
                padding: '0 20px',
                height: 44,
                whiteSpace: 'nowrap'
              }}
            >
              <span>{joiningCode ? 'Joining…' : 'Join Room'}</span>
              <Icon name="arrow-right" size={14} />
            </button>
          </form>
        </div>
        {quickCodeError && (
          <div style={{ marginTop: 10, fontSize: 12, fontWeight: 700, color: '#f87171' }}>
            ⚠️ {quickCodeError}
          </div>
        )}
      </div>

      {/* Contests Section */}
      <div>
        <div className="contests-section-header">
          <Icon name="trophy" size={20} color="var(--color-primary)" />
          <span>Your Active Contests</span>
        </div>
        {loadingData ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : contests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icon name="award" size={36} color="var(--color-primary)" />
            </div>
            <div className="empty-state-title">No contests created yet</div>
            <div className="empty-state-desc">
              Select any live or upcoming match to build your squad and challenge friends in private contests.
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <Link to="/create-contest" className="top-back-btn">
                <Icon name="plus" size={14} />
                <span>Create Contest</span>
              </Link>
              <Link to="/create-contest?tab=join" className="top-back-btn-sub">
                <Icon name="key" size={14} />
                <span>Join with Code</span>
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {contests.map((contest) => (
              <div key={contest._id} className="contest-card">
                <div>
                  <div className="contest-card-name">{contest.name}</div>
                  <div className="contest-card-meta">
                    <span>Code: <span className="contest-card-code">{contest.contestId}</span></span>
                    <span><Icon name="users" size={12} /> {contest.participants.length}/{contest.maxParticipants} players</span>
                    <span><Icon name="coins" size={12} /> {contest.entryFee} coins entry</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Link
                    to={`/leaderboard/${contest.matchId}?contestId=${contest.contestId}`}
                    className="contest-view-btn"
                  >
                    <span>View Leaderboard</span>
                    <Icon name="arrow-right" size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;