import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Icon from './common/Icons';

const PARTICIPANT_PRESETS = [2, 4, 6, 8, 10, 15, 20];

export const ContestCreation = ({ user }) => {
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
      const all = response.data || [];
      // Prioritize upcoming matches where registration is open
      const upcoming = all.filter(m => !m.matchStarted && !m.matchEnded);
      const list = upcoming.length > 0 ? upcoming : all;
      setMatches(all);
      if (list.length > 0 && !formData.matchId) {
        setFormData(prev => ({ ...prev, matchId: list[0].matchId || list[0]._id }));
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

  const selectedMatch = matches.find(m => (m.matchId || m._id) === formData.matchId);
  const isMatchClosed = selectedMatch ? (selectedMatch.matchStarted || selectedMatch.matchEnded) : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('Please enter a contest name.');
      return;
    }
    if (!formData.matchId) {
      setError('Please select an active upcoming cricket fixture.');
      return;
    }

    if (isMatchClosed) {
      setError('Not applicable now. Contests can only be created before the match begins (locks 2 min before start).');
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
      setError(err.response?.data?.error || 'Not applicable now. Contest creation failed. Please choose an upcoming fixture.');
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
        <Link to="/" className="top-back-btn" id="contest-back-btn">
          <Icon name="arrow-left" size={14} />
          <span>Back to Matches</span>
        </Link>
        <span className="match-format-chip">
          <Icon name="award" size={13} /> Private League Hub
        </span>
      </div>

      {createdContest ? (
        /* Contest Created Success Card */
        <div className="contest-success-card">
          <div className="contest-success-icon-wrap">
            <Icon name="trophy" size={32} color="#2563eb" />
          </div>

          <h2 className="contest-success-title">Contest Room Created!</h2>
          <p className="contest-success-sub">
            Share this unique room code with friends to join your private leaderboard before the match starts:
          </p>

          {/* Code Box */}
          <div className="contest-code-display-box">
            <span className="contest-code-text">{createdContest.contestId}</span>
            <button
              onClick={handleCopyCode}
              className="contest-code-copy-btn"
              title="Copy room code"
            >
              <Icon name={copied ? 'check' : 'copy'} size={14} />
              <span>{copied ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>

          <div className="contest-success-actions">
            <Link
              to={`/build-team/${createdContest.matchId}?contestId=${createdContest.contestId}`}
              className="contest-btn-submit"
            >
              <Icon name="cricket" size={15} />
              <span>Select Squad for this Contest</span>
            </Link>
            <button
              onClick={() => { setCreatedContest(null); setFormData(p => ({ ...p, name: '' })); }}
              className="contest-btn-cancel"
            >
              Create Another
            </button>
          </div>
        </div>
      ) : (
        /* Creation Form Card */
        <div className="contest-form-card">
          <div className="contest-hero-banner">
            <div className="contest-hero-title">
              <Icon name="trophy" size={24} color="white" />
              <span>Create a Private Contest</span>
            </div>
            <div className="contest-hero-desc">
              Set up a custom league for upcoming fixtures. Note: Contests can only be created before the match begins (locks 2 minutes prior to start).
            </div>
          </div>

          <form onSubmit={handleSubmit} className="contest-form-body">
            {error && (
              <div className="auth-error animate-fade-up">
                <Icon name="shield" size={16} color="#dc2626" />
                <span>{error}</span>
              </div>
            )}

            {/* Contest Name */}
            <div className="form-group">
              <label className="form-label" htmlFor="contest-name">Contest Room Name</label>
              <div className="input-wrap">
                <span className="input-icon"><Icon name="trophy" size={16} /></span>
                <input
                  type="text"
                  id="contest-name"
                  name="name"
                  placeholder="e.g., Weekend Champions League"
                  value={formData.name}
                  onChange={handleChange}
                  className="form-input"
                  required
                />
              </div>
            </div>

            {/* Match Selection Dropdown */}
            <div className="form-group">
              <label className="form-label" htmlFor="contest-match">Cricket Fixture</label>
              <select
                id="contest-match"
                name="matchId"
                value={formData.matchId}
                onChange={handleChange}
                className="form-input"
                style={{ paddingLeft: 14 }}
                required
              >
                <optgroup label="Upcoming Matches (Registration Open)">
                  {matches.filter(m => !m.matchStarted && !m.matchEnded).map((m) => {
                    const mId = m.matchId || m._id;
                    return (
                      <option key={mId} value={mId}>
                        🟢 {m.teamA} vs {m.teamB} • {m.venue || 'Scheduled'} ({m.matchType || 'T20'})
                      </option>
                    );
                  })}
                </optgroup>
                <optgroup label="Closed Matches (Not Applicable Now)">
                  {matches.filter(m => m.matchStarted || m.matchEnded).slice(0, 5).map((m) => {
                    const mId = m.matchId || m._id;
                    return (
                      <option key={mId} value={mId} disabled>
                        🔒 {m.teamA} vs {m.teamB} (Closed: {m.matchEnded ? 'Concluded' : 'Live'})
                      </option>
                    );
                  })}
                </optgroup>
              </select>

              {isMatchClosed && (
                <div style={{ marginTop: 8, fontSize: 12, fontWeight: 700, color: '#dc2626' }}>
                  ⚠️ Not applicable now: Contests cannot be created for live or completed matches.
                </div>
              )}
            </div>

            {/* Max Participants */}
            <div className="form-group">
              <label className="form-label">Participant Capacity ({formData.maxParticipants} Players)</label>
              <div className="contest-presets-row">
                {PARTICIPANT_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    onClick={() => setPresetParticipants(preset)}
                    className={`preset-pill ${formData.maxParticipants === preset ? 'active' : ''}`}
                  >
                    {preset} Players
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="contest-actions-row">
              <Link to="/" className="contest-btn-cancel">
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading || isMatchClosed}
                className="contest-btn-submit"
                style={{ opacity: (loading || isMatchClosed) ? 0.5 : 1 }}
              >
                <Icon name="zap" size={15} />
                <span>{loading ? 'Generating Code…' : 'Create Room Code'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContestCreation;