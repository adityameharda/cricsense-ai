import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Icon from './common/Icons';

const PARTICIPANT_PRESETS = [2, 4, 6, 8, 10, 15, 20];

const ContestCreation = ({ user }) => {
  const [matches, setMatches] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    matchId: '',
    entryFee: 0,
    maxParticipants: 10
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdContest, setCreatedContest] = useState(null);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/matches');
      const availableMatches = (response.data || []).filter(m => !m.matchEnded);
      setMatches(availableMatches.length > 0 ? availableMatches : response.data || []);
      if (availableMatches.length > 0 && !formData.matchId) {
        setFormData(prev => ({ ...prev, matchId: availableMatches[0].matchId || availableMatches[0]._id }));
      }
    } catch (err) {
      console.error('Failed to fetch matches:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: name === 'maxParticipants' ? Number(value) : value
    });
    if (error) setError('');
  };

  const setPresetParticipants = (count) => {
    setFormData(prev => ({ ...prev, maxParticipants: count }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter a contest name.');
      return;
    }
    if (!formData.matchId) {
      setError('Please select an active cricket fixture.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/contests/create', {
        ...formData,
        entryFee: 0 // Free skill-based contests
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const contest = response.data?.contest;
      if (contest) {
        setCreatedContest(contest);
      } else {
        navigate(`/leaderboard/${formData.matchId}`);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create contest. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (createdContest?.contestId) {
      navigator.clipboard.writeText(createdContest.contestId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="contest-creation-page animate-fade-up">
      {/* Top Bar Navigation */}
      <div className="page-top-bar">
        <Link to="/dashboard" className="top-back-btn" id="contest-back-btn">
          <span className="back-arrow">←</span>
          <span>Back to Dashboard</span>
        </Link>
        <Link to="/" className="top-back-btn-sub">
          Home
        </Link>
      </div>

      <div className="contest-card-wrapper">
        {/* Header Hero Banner */}
        <div className="contest-hero-banner">
          <div className="contest-hero-icon-box">
            <Icon name="trophy" size={28} />
          </div>
          <div>
            <h2 className="contest-hero-title">Create Private Fantasy League</h2>
            <p className="contest-hero-sub">
              Host a private room, invite friends with your unique code, and compete on the live leaderboard!
            </p>
          </div>
        </div>

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="contest-form-body">
          {error && (
            <div className="auth-error-banner">
              <span className="auth-error-icon">⚠️</span>
              <div className="auth-error-text">{error}</div>
            </div>
          )}

          {/* Contest Name */}
          <div className="contest-form-group">
            <label className="contest-field-label" htmlFor="contest-name">
              <span>League / Room Title</span>
              <span className="contest-field-hint">Visible to all participants</span>
            </label>
            <div className="contest-input-box">
              <span className="contest-input-icon">🏆</span>
              <input
                id="contest-name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="e.g. Champions Super League 2026"
                className="contest-text-field"
              />
            </div>
          </div>

          {/* Select Match */}
          <div className="contest-form-group">
            <label className="contest-field-label" htmlFor="contest-match">
              <span>Select Match Fixture</span>
              <span className="contest-field-hint">{matches.length} active fixtures available</span>
            </label>
            <div className="contest-input-box">
              <span className="contest-input-icon">🏏</span>
              <select
                id="contest-match"
                name="matchId"
                value={formData.matchId}
                onChange={handleChange}
                required
                className="contest-select-field"
              >
                <option value="">-- Choose a Match Fixture --</option>
                {matches.map((m) => (
                  <option key={m.matchId || m._id} value={m.matchId || m._id}>
                    {m.teamA} vs {m.teamB} ({m.status || m.date || 'Active'})
                  </option>
                ))}
              </select>
            </div>
            {formData.matchId && (
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  to={`/build-team/${formData.matchId}`}
                  className="top-back-btn"
                  style={{ fontSize: 12, color: 'var(--color-primary)', background: '#eff6ff', borderColor: '#bfdbfe' }}
                >
                  ⚡ Or Draft 11 Players for this match right now →
                </Link>
              </div>
            )}
          </div>

          {/* Max Participants Section */}
          <div className="contest-form-group">
            <label className="contest-field-label">
              <span>Maximum League Capacity</span>
              <span className="contest-badge-players">{formData.maxParticipants} Player Slots</span>
            </label>

            <div className="contest-presets-row">
              {PARTICIPANT_PRESETS.map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setPresetParticipants(count)}
                  className={`contest-preset-chip${formData.maxParticipants === count ? ' active' : ''}`}
                >
                  {count} Players
                </button>
              ))}
            </div>
          </div>

          {/* Multipliers Rule Highlight Card */}
          <div className="contest-summary-card">
            <div className="contest-summary-item">
              <div className="contest-summary-lbl">Captain Multiplier</div>
              <div className="contest-summary-val" style={{ color: '#2563eb' }}>2.0× Points ⚡</div>
            </div>
            <div className="contest-summary-divider" />
            <div className="contest-summary-item">
              <div className="contest-summary-lbl">Vice-Captain Multiplier</div>
              <div className="contest-summary-val" style={{ color: '#059669' }}>1.5× Points 🌟</div>
            </div>
            <div className="contest-summary-divider" />
            <div className="contest-summary-item">
              <div className="contest-summary-lbl">Scoring Format</div>
              <div className="contest-summary-val">Live Ball-by-Ball 📊</div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="contest-actions-row">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="contest-btn-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="contest-btn-submit"
            >
              {loading ? (
                <>
                  <div className="auth-btn-spinner" />
                  <span>Creating League…</span>
                </>
              ) : (
                <>
                  <span>Create Private League</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Informational Guide */}
        <div className="contest-guide-section">
          <h3 className="contest-guide-title">How Private Leagues Work</h3>
          <div className="contest-steps-grid">
            {[
              { step: '01', title: 'Create Room', desc: 'Choose the match and slot capacity for your league.' },
              { step: '02', title: 'Share Code', desc: 'Send the secret invite code to your friends.' },
              { step: '03', title: 'Draft 11 & (C/VC)', desc: 'Pick 11 players with 2× Captain and 1.5× Vice-Captain.' },
              { step: '04', title: 'Live HLD Board', desc: 'Track real-time points and rank positions on the live board.' }
            ].map((s) => (
              <div key={s.step} className="contest-step-card">
                <div className="contest-step-num">{s.step}</div>
                <div className="contest-step-heading">{s.title}</div>
                <div className="contest-step-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Success Modal with Shareable Code */}
      {createdContest && (
        <div className="logout-modal-overlay">
          <div className="logout-modal-card animate-pop" style={{ maxWidth: 480 }}>
            <div className="logout-modal-icon-wrap" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#bbf7d0' }}>
              <Icon name="check" size={28} />
            </div>

            <h3 className="logout-modal-title">League Created! 🎉</h3>
            <p className="logout-modal-desc">
              Your private league <strong>"{createdContest.name}"</strong> is live! Share this invite code with your friends:
            </p>

            <div className="contest-code-display-box">
              <span className="contest-code-text">{createdContest.contestId}</span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="contest-code-copy-btn"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>

            <div className="logout-modal-actions" style={{ marginTop: 20, flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                className="logout-modal-confirm-btn"
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', width: '100%' }}
                onClick={() => navigate(`/build-team/${formData.matchId}?contestId=${createdContest.contestId}`)}
              >
                🏏 Draft My 11 Players Now →
              </button>
              <button
                type="button"
                className="logout-modal-cancel-btn"
                style={{ width: '100%' }}
                onClick={() => navigate(`/leaderboard/${formData.matchId}?contestId=${createdContest.contestId}`)}
              >
                Go to Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContestCreation;
