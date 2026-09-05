import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import Icon from './common/Icons';

const PARTICIPANT_PRESETS = [2, 4, 6, 8, 10, 15, 20];

export const ContestCreation = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get('tab') === 'join' ? 'join' : 'create';
  const initialCode = searchParams.get('code') || '';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [matches, setMatches] = useState([]);

  // Create Form State
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

  // Join Form State
  const [joinCode, setJoinCode] = useState(initialCode.toUpperCase());
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [joiningContest, setJoiningContest] = useState(false);
  const [previewContest, setPreviewContest] = useState(null);
  const [previewMatch, setPreviewMatch] = useState(null);
  const [joinError, setJoinError] = useState('');
  const [joinSuccess, setJoinSuccess] = useState('');

  useEffect(() => {
    fetchMatches();
    if (initialCode) {
      handleLookupCode(initialCode);
    }
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/matches`);
      const all = response.data || [];
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

  const handleCreateSubmit = async (e) => {
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
      const response = await axios.post(`${API_BASE_URL}/api/contests/create`, {
        ...formData,
        entryFee: 0
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
      setError(err.response?.data?.error || 'Contest creation failed. Please choose an upcoming fixture.');
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

  // Join Code Lookup
  const handleLookupCode = async (codeToLookup) => {
    const code = (codeToLookup || joinCode).trim().toUpperCase();
    if (!code) {
      setJoinError('Please enter a 6-character contest code.');
      return;
    }

    setVerifyingCode(true);
    setJoinError('');
    setJoinSuccess('');
    setPreviewContest(null);
    setPreviewMatch(null);

    try {
      const res = await axios.get(`${API_BASE_URL}/api/contests/${code}`);
      setPreviewContest(res.data.contest);
      setPreviewMatch(res.data.match);
    } catch (err) {
      setJoinError(err.response?.data?.error || `No active contest found with code "${code}".`);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleJoinContest = async () => {
    if (!previewContest?.contestId) return;
    setJoiningContest(true);
    setJoinError('');

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_BASE_URL}/api/contests/join/${previewContest.contestId}`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const mId = previewContest.matchId || res.data.matchId;
      setJoinSuccess(`Joined "${previewContest.name}" successfully! Redirecting to build your squad…`);

      setTimeout(() => {
        navigate(`/build-team/${mId}?contestId=${previewContest.contestId}`);
      }, 1000);
    } catch (err) {
      // If match has already started or concluded, offer to navigate straight to leaderboard
      const errMsg = err.response?.data?.error || 'Failed to join contest room.';
      setJoinError(errMsg);
    } finally {
      setJoiningContest(false);
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

      {/* Tabs Header */}
      <div className="contest-tabs-bar" style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => { setActiveTab('create'); setError(''); }}
          className={`segment-btn ${activeTab === 'create' ? 'active' : ''}`}
          style={{ flex: 1, padding: '12px 18px', fontSize: 14, fontWeight: 800 }}
        >
          <Icon name="trophy" size={16} />
          <span>Create Contest Room</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('join'); setJoinError(''); }}
          className={`segment-btn ${activeTab === 'join' ? 'active' : ''}`}
          style={{ flex: 1, padding: '12px 18px', fontSize: 14, fontWeight: 800 }}
        >
          <Icon name="key" size={16} />
          <span>Join Contest with Code</span>
        </button>
      </div>

      {activeTab === 'join' ? (
        /* ── JOIN CONTEST TAB ── */
        <div className="contest-form-card">
          <div className="contest-hero-banner" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}>
            <div className="contest-hero-title">
              <Icon name="key" size={24} color="white" />
              <span>Join a Friend's Contest</span>
            </div>
            <div className="contest-hero-desc">
              Have a 6-character private league code (e.g., <strong>0BIHNG</strong>)? Paste it below to join your friend's leaderboard and lock your squad!
            </div>
          </div>

          <div className="contest-form-body">
            {joinError && (
              <div className="auth-error animate-fade-up">
                <Icon name="shield" size={16} color="#dc2626" />
                <span>{joinError}</span>
              </div>
            )}

            {joinSuccess && (
              <div className="toast-success animate-fade-up" style={{ marginBottom: 16 }}>
                <Icon name="check-circle" size={18} color="white" />
                <span>{joinSuccess}</span>
              </div>
            )}

            {/* Code Input Box */}
            <div className="form-group">
              <label className="form-label" htmlFor="contest-code-input">
                Enter 6-Character Contest Code
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="input-wrap" style={{ flex: 1 }}>
                  <span className="input-icon"><Icon name="key" size={16} /></span>
                  <input
                    type="text"
                    id="contest-code-input"
                    maxLength={10}
                    placeholder="e.g. 0BIHNG"
                    value={joinCode}
                    onChange={(e) => {
                      const val = e.target.value.toUpperCase();
                      setJoinCode(val);
                      if (val.length >= 6) {
                        handleLookupCode(val);
                      }
                    }}
                    className="form-input"
                    style={{ textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, fontSize: 16 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleLookupCode(joinCode)}
                  disabled={verifyingCode || !joinCode.trim()}
                  className="contest-btn-submit"
                  style={{ padding: '0 24px', width: 'auto' }}
                >
                  <Icon name="search" size={15} />
                  <span>{verifyingCode ? 'Searching…' : 'Find Room'}</span>
                </button>
              </div>
            </div>

            {/* Preview Card If Contest Found */}
            {previewContest && (
              <div className="preview-contest-card animate-fade-up" style={{
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: 16,
                padding: '20px',
                marginTop: 20,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="medal-pill gold" style={{ fontSize: 11, marginBottom: 8, display: 'inline-flex' }}>
                      <Icon name="trophy" size={12} /> Private League
                    </span>
                    <h3 style={{ margin: '4px 0', fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                      {previewContest.name}
                    </h3>
                    <div style={{ fontSize: 12.5, color: '#64748b' }}>
                      Created by <strong>{previewContest.createdBy?.username || 'Host'}</strong> • Room Code: <strong style={{ color: '#2563eb' }}>{previewContest.contestId}</strong>
                    </div>
                  </div>
                  <div style={{
                    background: '#eff6ff',
                    border: '1.5px solid #bfdbfe',
                    borderRadius: 12,
                    padding: '8px 14px',
                    textAlign: 'center'
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#1d4ed8' }}>CAPACITY</div>
                    <div style={{ fontSize: 15, fontWeight: 900, color: '#1e3a8a' }}>
                      {previewContest.participants?.length || 1} / {previewContest.maxParticipants || 20}
                    </div>
                  </div>
                </div>

                {/* Match Fixture details */}
                {previewMatch && (
                  <div style={{
                    marginTop: 16,
                    padding: '12px 16px',
                    background: 'white',
                    borderRadius: 12,
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#0f172a' }}>
                      🏏 {previewMatch.teamA} <span style={{ color: '#94a3b8', margin: '0 4px' }}>vs</span> {previewMatch.teamB}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: previewMatch.matchEnded ? '#059669' : previewMatch.matchStarted ? '#dc2626' : '#2563eb' }}>
                      {previewMatch.matchEnded ? 'Concluded' : previewMatch.matchStarted ? 'Live Now' : 'Upcoming Fixture'}
                    </div>
                  </div>
                )}

                {/* Join Action Buttons */}
                <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                  <button
                    type="button"
                    onClick={handleJoinContest}
                    disabled={joiningContest}
                    className="contest-btn-submit"
                    style={{ flex: 1 }}
                  >
                    <Icon name="check" size={15} />
                    <span>{joiningContest ? 'Joining…' : 'Join Room & Build Squad'}</span>
                  </button>

                  <Link
                    to={`/leaderboard/${previewContest.matchId}?contestId=${previewContest.contestId}`}
                    className="contest-btn-cancel"
                    style={{ flex: 1, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="award" size={15} />
                    <span>View Standings</span>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : createdContest ? (
        /* Contest Created Success Card */
        <div className="contest-success-card">
          <div className="contest-success-icon-wrap">
            <Icon name="trophy" size={32} color="#2563eb" />
          </div>

          <h2 className="contest-success-title">Contest Room Created!</h2>
          <p className="contest-success-sub">
            Share this unique room code with friends so they can join your private leaderboard:
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
              Set up a custom league for upcoming fixtures and get a 6-character room code to invite friends! Note: Contests can only be created before the match begins.
            </div>
          </div>

          <form onSubmit={handleCreateSubmit} className="contest-form-body">
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