import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';

const FLAG_MAP = {
  'india': 'in', 'australia': 'au', 'england': 'gb-eng', 'south africa': 'za',
  'new zealand': 'nz', 'pakistan': 'pk', 'bangladesh': 'bd', 'sri lanka': 'lk',
  'west indies': 'jm', 'afghanistan': 'af', 'ireland': 'ie', 'zimbabwe': 'zw',
  'netherlands': 'nl', 'scotland': 'gb-sct', 'uae': 'ae', 'usa': 'us',
  'namibia': 'na', 'oman': 'om', 'nepal': 'np', 'canada': 'ca',
};

const getFlagUrl = (teamName) => {
  if (!teamName) return null;
  const name = teamName.toLowerCase().replace(/ women| u19| a$/g, '').trim();
  const code = FLAG_MAP[name];
  return code ? `https://flagcdn.com/24x18/${code}.png` : null;
};

const ROLE_LABELS = { wk: 'WK', bat: 'BAT', ar: 'AR', bowl: 'BOWL' };

const getPlayerRole = (name = '') => {
  const n = String(name).toLowerCase();
  if (n.includes('(wk)') || n.includes('buttler') || n.includes('rizwan') || n.includes('pant') || n.includes('samson') || n.includes('carey') || n.includes('de kock') || n.includes('klaasen') || n.includes('bairstow') || n.includes('gurbaz') || n.includes('pooran') || n.includes('hope')) {
    return 'wk';
  }
  if (n.includes('kohli') || n.includes('sharma') || n.includes('babar') || n.includes('root') || n.includes('smith') || n.includes('head') || n.includes('warner') || n.includes('gill') || n.includes('williamson') || n.includes('surya') || n.includes('gaikwad') || n.includes('jaiswal')) {
    return 'bat';
  }
  if (n.includes('stokes') || n.includes('pandya') || n.includes('jadeja') || n.includes('maxwell') || n.includes('rashid') || n.includes('shadab') || n.includes('marsh') || n.includes('shakib') || n.includes('santner') || n.includes('russell') || n.includes('narine')) {
    return 'ar';
  }
  if (n.includes('bumrah') || n.includes('shami') || n.includes('starc') || n.includes('cummins') || n.includes('afridi') || n.includes('rabada') || n.includes('boult') || n.includes('chahal') || n.includes('kuldeep') || n.includes('siraj') || n.includes('wood') || n.includes('archer') || n.includes('nortje')) {
    return 'bowl';
  }
  return 'bat';
};

const TeamBuilder = ({ user }) => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [match, setMatch] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [captain, setCaptain] = useState('');
  const [viceCaptain, setViceCaptain] = useState('');
  const [contestId, setContestId] = useState('');
  const [showContestBar, setShowContestBar] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [isCreating, setIsCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const initialContestId = queryParams.get('contestId');
    if (initialContestId) setContestId(initialContestId.toUpperCase());

    const fetchMatch = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/matches/${matchId}`);
        setMatch(res.data);

        // Auto-fetch squads if empty
        if (!res.data?.squadA?.length || !res.data?.squadB?.length) {
          try {
            const squadRes = await axios.get(`http://localhost:5000/api/matches/${matchId}/squad`);
            if (squadRes.data) {
              setMatch(prev => ({
                ...prev,
                ...res.data,
                squadA: squadRes.data.squadA || prev?.squadA || [],
                squadB: squadRes.data.squadB || prev?.squadB || [],
              }));
            }
          } catch (squadErr) {
            console.warn('Squad sub-fetch error:', squadErr.message);
          }
        }
      } catch (err) {
        console.error('Match fetch failed:', err);
      }
    };
    fetchMatch();
  }, [matchId, location.search]);

  const togglePlayer = (player) => {
    if (selectedPlayers.includes(player)) {
      setSelectedPlayers(selectedPlayers.filter((p) => p !== player));
      if (captain === player) setCaptain('');
      if (viceCaptain === player) setViceCaptain('');
    } else {
      if (selectedPlayers.length < 11) {
        setSelectedPlayers([...selectedPlayers, player]);
      } else {
        alert('You can only select exactly 11 players.');
      }
    }
  };

  const generateAndCreateContest = async () => {
    if (maxParticipants < 2 || maxParticipants > 10) {
      alert('Contest size must be between 2 and 10 members.');
      return;
    }
    setIsCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://localhost:5000/api/contests/create',
        { name: 'Private Contest', matchId, entryFee: 0, maxParticipants },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data?.contest) {
        setContestId(response.data.contest.contestId);
        setShowContestBar(false);
        alert(`Contest created! Code: ${response.data.contest.contestId}`);
      }
    } catch (err) {
      alert('Failed to create contest: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsCreating(false);
    }
  };

  const [successContestCode, setSuccessContestCode] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const submitTeam = async (e) => {
    e.preventDefault();
    if (selectedPlayers.length !== 11) {
      alert(`Please select exactly 11 players (currently: ${selectedPlayers.length}).`);
      return;
    }
    if (!captain || !viceCaptain) {
      alert('Please select both a Captain (C) and Vice-Captain (VC).');
      return;
    }
    if (captain === viceCaptain) {
      alert('Captain and Vice-Captain must be different players.');
      return;
    }

    // Generate secret contest room code if not joining a specific one
    const generatedCode = contestId.trim() || 'CRIC-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const savedUserStr = localStorage.getItem('user');
      const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      const currentUserId = user?._id || user?.id || savedUser?._id || savedUser?.id;

      if (!token || !currentUserId) {
        alert('You must be logged in to submit a fantasy team.');
        navigate('/login');
        return;
      }

      const res = await axios.post(
        'http://localhost:5000/api/fantasy/team',
        {
          matchId,
          userId: currentUserId,
          players: selectedPlayers,
          captain,
          viceCaptain,
          contestId: generatedCode
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const assignedCode = res.data?.contestId || generatedCode;
      setSuccessContestCode(assignedCode);
    } catch (err) {
      alert('Error submitting team: ' + (err.response?.data?.error || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = () => {
    if (successContestCode) {
      navigator.clipboard.writeText(successContestCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCopyLink = () => {
    if (successContestCode) {
      const inviteUrl = `${window.location.origin}/build-team/${matchId}?contestId=${successContestCode}`;
      navigator.clipboard.writeText(inviteUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const retrySquad = async () => {
    try {
      const res = await axios.get(`http://localhost:5000/api/matches/${matchId}/squad`);
      if (res.data) {
        setMatch(prev => ({
          ...prev,
          squadA: res.data.squadA || [],
          squadB: res.data.squadB || [],
        }));
      }
    } catch (err) {
      alert('Could not fetch squad. Please try again in a moment.');
    }
  };

  if (!match) {
    return (
      <div className="empty-state">
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        <div className="empty-state-title">Loading match details…</div>
      </div>
    );
  }

  const progressPct = Math.round((selectedPlayers.length / 11) * 100);
  const canSubmit = selectedPlayers.length === 11 && captain && viceCaptain;

  return (
    <div className="builder-page animate-fade-up">
      {/* Top Bar with Prominent Back Buttons */}
      <div className="page-top-bar">
        <Link to={`/match-center/${matchId}`} className="top-back-btn" id="team-builder-back-btn">
          <span className="back-arrow">←</span>
          <span>Back to Match Details</span>
        </Link>
        <Link to="/" className="top-back-btn-sub">
          Home
        </Link>
      </div>

      {/* Header */}
      <div className="builder-header">
        <div className="builder-title">🏏 Build Your Dream Team</div>
        <div className="builder-subtitle">
          {match.teamA} vs {match.teamB} — Select 11 players, choose C & VC
        </div>
      </div>

      {/* Contest Bar */}
      <div className="builder-contest-bar">
        <input
          type="text"
          placeholder="Enter Contest Code to join…"
          value={contestId}
          onChange={(e) => setContestId(e.target.value.toUpperCase())}
          className="builder-contest-input"
          id="contest-code-input"
        />
        <button
          type="button"
          onClick={() => setShowContestBar(!showContestBar)}
          className="builder-btn-create"
        >
          + Create Contest
        </button>
      </div>

      {showContestBar && (
        <div className="builder-contest-bar" style={{ alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Max Players (2–10):
          </label>
          <input
            type="number"
            min="2"
            max="10"
            value={maxParticipants}
            onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 2)}
            className="builder-contest-input"
            style={{ maxWidth: 80 }}
          />
          <button
            type="button"
            onClick={generateAndCreateContest}
            disabled={isCreating}
            className="builder-btn-create"
            style={{ background: 'var(--color-live)', opacity: isCreating ? 0.6 : 1 }}
          >
            {isCreating ? 'Creating…' : 'Confirm & Create'}
          </button>
        </div>
      )}

      {/* Selection Status */}
      <div className="selection-status-bar">
        <div className="selection-status-top">
          <div className="selection-count">
            <span>{selectedPlayers.length}</span>/11 Players Selected
          </div>
          <div className="selection-badges">
            {captain && <span className="badge-c">© Captain: {captain}</span>}
            {viceCaptain && <span className="badge-vc">Ⓥ V-Captain: {viceCaptain}</span>}
          </div>
        </div>
        <div className="selection-progress-track">
          <div
            className={`selection-progress-fill${progressPct === 100 ? ' complete' : ''}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Squad Panels */}
      <div className="builder-squads-grid">
        {[match.teamA, match.teamB].map((team, tIdx) => {
          const squad = tIdx === 0 ? (match.squadA || []) : (match.squadB || []);
          const flagUrl = getFlagUrl(team);
          return (
            <div key={team} className="builder-squad-panel">
              <div className="builder-squad-title">
                {flagUrl && (
                  <img src={flagUrl} alt={team} style={{ width: 22, height: 16, borderRadius: 2, objectFit: 'cover' }} />
                )}
                {team}
                <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                  {squad.length} players
                </span>
              </div>
              {squad.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  <div style={{ marginBottom: 10 }}>🏏 Squad not announced yet</div>
                  {/* BUG 6 FIX: retry button to re-fetch squad */}
                  <button
                    onClick={retrySquad}
                    style={{
                      background: 'var(--color-primary)', color: '#fff',
                      border: 'none', borderRadius: 8, padding: '8px 18px',
                      fontSize: 12, fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    🔄 Refresh Squad
                  </button>
                </div>
              ) : (
                squad.map((player) => {
                  const isSelected = selectedPlayers.includes(player);
                  const isC = captain === player;
                  const isVC = viceCaptain === player;
                  const role = getPlayerRole(player);
                  return (
                    <div
                      key={player}
                      className={`player-row-builder${isSelected ? ' selected' : ''}`}
                    >
                      <div className="player-row-info">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePlayer(player)}
                          disabled={!isSelected && selectedPlayers.length === 11}
                          id={`player-${player.replace(/\s/g, '-')}`}
                          style={{ accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                        />
                        <label
                          htmlFor={`player-${player.replace(/\s/g, '-')}`}
                          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        >
                          <span style={{ fontWeight: isSelected ? 700 : 500 }}>{player}</span>
                          <span className={`role-chip ${role}`} style={{ fontSize: 10, padding: '1px 6px' }}>
                            {ROLE_LABELS[role]}
                          </span>
                        </label>
                      </div>
                      {isSelected && (
                        <div className="player-row-badges">
                          <button
                            type="button"
                            className={`player-badge-btn${isC ? ' active-c' : ''}`}
                            onClick={() => (isC ? setCaptain('') : setCaptain(player))}
                            title="Set as Captain (2.0x Points)"
                          >
                            {isC ? 'C (2×)' : 'C'}
                          </button>
                          <button
                            type="button"
                            className={`player-badge-btn${isVC ? ' active-vc' : ''}`}
                            onClick={() => (isVC ? setViceCaptain('') : setViceCaptain(player))}
                            title="Set as Vice-Captain (1.5x Points)"
                          >
                            {isVC ? 'VC (1.5×)' : 'VC'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <div>
        <button
          onClick={submitTeam}
          disabled={!canSubmit || submitting}
          className="builder-submit-btn"
          id="submit-team-btn"
        >
          {submitting
            ? 'Submitting…'
            : canSubmit
            ? '✅ Finalize Dream Team'
            : `Select ${11 - selectedPlayers.length} more player${11 - selectedPlayers.length !== 1 ? 's' : ''}`}
        </button>
        <p
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: 'var(--text-muted)',
            marginTop: 10,
          }}
        >
          Captain gets 2× points · Vice-Captain gets 1.5× points
        </p>
      </div>

      {/* Secret Contest Code Share Modal */}
      {successContestCode && (
        <div className="logout-modal-overlay">
          <div className="logout-modal-card animate-pop" style={{ maxWidth: 480 }}>
            <div className="logout-modal-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#bfdbfe' }}>
              <span style={{ fontSize: 26 }}>🎉</span>
            </div>

            <h3 className="logout-modal-title">Team Locked & Secret Code Ready!</h3>
            <p className="logout-modal-desc">
              Your 11-player squad is locked in! Share this secret contest code so your friends can join your room and compete on the live leaderboard.
            </p>

            {/* Secret Code Display */}
            <div className="contest-code-display-box" style={{ background: '#f8fafc', borderColor: '#2563eb' }}>
              <span className="contest-code-text" style={{ color: '#1e3a8a', letterSpacing: '0.12em' }}>
                {successContestCode}
              </span>
              <button
                type="button"
                onClick={handleCopyCode}
                className="contest-code-copy-btn"
                style={{ background: '#2563eb' }}
              >
                {copiedCode ? '✓ Copied!' : '📋 Copy Code'}
              </button>
            </div>

            {/* Quick Share Links */}
            <div style={{ width: '100%', marginTop: 12, display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={handleCopyLink}
                className="contest-preset-chip"
                style={{ flex: 1, padding: '10px 14px', textAlign: 'center', background: '#f1f5f9', border: '1px solid #cbd5e1' }}
              >
                {copiedLink ? '✓ Direct Link Copied!' : '🔗 Copy Direct Invite Link'}
              </button>
            </div>

            <div className="logout-modal-actions" style={{ marginTop: 20 }}>
              <button
                type="button"
                className="logout-modal-confirm-btn"
                style={{ background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', width: '100%' }}
                onClick={() => navigate(`/leaderboard/${matchId}?contestId=${successContestCode}`, {
                  state: { successMessage: `🎉 Joined contest ${successContestCode}!` }
                })}
              >
                🏆 Go to Live HLD Leaderboard →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamBuilder;
