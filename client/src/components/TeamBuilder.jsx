import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import Icon from './common/Icons';

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
  return code ? `https://flagcdn.com/32x24/${code}.png` : null;
};

const ROLE_CONFIG = {
  wk: { label: 'WK', name: 'Wicket Keeper', color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: 'shield' },
  bat: { label: 'BAT', name: 'Batter', color: '#475569', bg: '#f1f5f9', border: '#cbd5e1', icon: 'bat' },
  ar: { label: 'AR', name: 'All-Rounder', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', icon: 'zap' },
  bowl: { label: 'BOWL', name: 'Bowler', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', icon: 'ball' },
};

const getPlayerRole = (name = '') => {
  const n = String(name).toLowerCase();
  if (n.includes('(wk)') || n.includes('buttler') || n.includes('rizwan') || n.includes('pant') || n.includes('samson') || n.includes('carey') || n.includes('de kock') || n.includes('klaasen') || n.includes('bairstow') || n.includes('gurbaz') || n.includes('pooran') || n.includes('hope') || n.includes('hamilton') || n.includes('clarke') || n.includes('seifert')) {
    return 'wk';
  }
  if (n.includes('kohli') || n.includes('sharma') || n.includes('babar') || n.includes('root') || n.includes('smith') || n.includes('head') || n.includes('warner') || n.includes('gill') || n.includes('williamson') || n.includes('surya') || n.includes('gaikwad') || n.includes('jaiswal') || n.includes('lewis') || n.includes('king') || n.includes('rutherford') || n.includes('perera') || n.includes('kumar')) {
    return 'bat';
  }
  if (n.includes('stokes') || n.includes('pandya') || n.includes('jadeja') || n.includes('maxwell') || n.includes('rashid') || n.includes('shadab') || n.includes('marsh') || n.includes('shakib') || n.includes('santner') || n.includes('russell') || n.includes('narine') || n.includes('ali') || n.includes('cornwall') || n.includes('allen') || n.includes('sams') || n.includes('linde') || n.includes('green')) {
    return 'ar';
  }
  if (n.includes('bumrah') || n.includes('shami') || n.includes('starc') || n.includes('cummins') || n.includes('afridi') || n.includes('rabada') || n.includes('boult') || n.includes('chahal') || n.includes('kuldeep') || n.includes('siraj') || n.includes('wood') || n.includes('archer') || n.includes('nortje') || n.includes('joseph') || n.includes('seales') || n.includes('springer') || n.includes('mujeeb') || n.includes('motie') || n.includes('simmonds') || n.includes('moqim') || n.includes('gore') || n.includes('mahase') || n.includes('phillip')) {
    return 'bowl';
  }
  return 'bat';
};

export const TeamBuilder = ({ user }) => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [match, setMatch] = useState(null);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [captain, setCaptain] = useState('');
  const [viceCaptain, setViceCaptain] = useState('');
  const [contestId, setContestId] = useState('');
  const [activeRoleFilter, setActiveRoleFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const initialContestId = queryParams.get('contestId');
    if (initialContestId) setContestId(initialContestId.toUpperCase());

    const fetchMatch = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/matches/${matchId}`);
        setMatch(res.data);

        // Fetch fallback squad if not fully populated
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
            console.warn('Squad sub-fetch:', squadErr.message);
          }
        }
      } catch (err) {
        console.error('Match fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatch();
  }, [matchId, location.search]);

  const squadA = useMemo(() => match?.squadA || [], [match]);
  const squadB = useMemo(() => match?.squadB || [], [match]);

  const isMatchClosed = match ? (match.matchStarted || match.matchEnded) : false;

  const togglePlayer = (player) => {
    if (isMatchClosed) return;
    if (selectedPlayers.includes(player)) {
      setSelectedPlayers(prev => prev.filter((p) => p !== player));
      if (captain === player) setCaptain('');
      if (viceCaptain === player) setViceCaptain('');
    } else {
      if (selectedPlayers.length < 11) {
        setSelectedPlayers(prev => [...prev, player]);
      } else {
        alert('Your 11-player squad is full! Deselect a player first to add a new one.');
      }
    }
  };

  const handleCaptainSelect = (player) => {
    if (isMatchClosed) return;
    if (viceCaptain === player) setViceCaptain('');
    setCaptain(prev => (prev === player ? '' : player));
  };

  const handleViceCaptainSelect = (player) => {
    if (isMatchClosed) return;
    if (captain === player) setCaptain('');
    setViceCaptain(prev => (prev === player ? '' : player));
  };

  const handleSubmitTeam = async () => {
    if (isMatchClosed) {
      setSubmitError('Not applicable now. Contests and squad entries close before the match begins (locks 2 min before start).');
      return;
    }

    if (selectedPlayers.length !== 11) {
      alert('Please select exactly 11 players to complete your fantasy lineup.');
      return;
    }
    if (!captain || !viceCaptain) {
      alert('Please select both a Captain (2x Points) and a Vice-Captain (1.5x Points).');
      return;
    }
    if (captain === viceCaptain) {
      alert('Captain and Vice-Captain must be two distinct players.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'http://localhost:5000/api/fantasy/team',
        {
          matchId,
          players: selectedPlayers,
          captain,
          viceCaptain,
          contestId: contestId.trim() || 'general',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      navigate(`/leaderboard/${matchId}?contestId=${contestId.trim() || 'general'}`, {
        state: { successMessage: '🎉 Fantasy squad successfully locked and registered!' },
      });
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Failed to submit fantasy team. Please try again.';
      setSubmitError(errMsg);
      alert(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="app-loading" style={{ minHeight: 360 }}>
        <div className="spinner" />
        <span>Loading Match Squads & Lineups…</span>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="empty-state" style={{ maxWidth: 460, margin: '40px auto' }}>
        <div className="empty-state-icon">
          <Icon name="cricket" size={40} color="#2563eb" />
        </div>
        <div className="empty-state-title">Match Not Found</div>
        <div className="empty-state-desc">This fixture could not be loaded for fantasy team creation.</div>
        <Link to="/" className="top-back-btn" style={{ marginTop: 16 }}>
          <Icon name="arrow-left" size={14} />
          <span>Return to Matches</span>
        </Link>
      </div>
    );
  }

  const flagA = match.teamALogo || getFlagUrl(match.teamA);
  const flagB = match.teamBLogo || getFlagUrl(match.teamB);

  const getCleanName = (p) => {
    const raw = typeof p === 'object' ? (p.name || '') : String(p || '');
    return raw.replace(/\s*\([c|C|vc|VC|w|wk|WK|Wk]+\)\s*/g, '').trim() || raw;
  };

  const countTeamASelected = selectedPlayers.filter(p => squadA.some(sa => getCleanName(sa) === p)).length;
  const countTeamBSelected = selectedPlayers.filter(p => squadB.some(sb => getCleanName(sb) === p)).length;

  const filteredSquadA = squadA.filter(p => {
    const name = getCleanName(p);
    const role = getPlayerRole(name);
    return activeRoleFilter === 'all' || role === activeRoleFilter;
  });

  const filteredSquadB = squadB.filter(p => {
    const name = getCleanName(p);
    const role = getPlayerRole(name);
    return activeRoleFilter === 'all' || role === activeRoleFilter;
  });

  // Calculate counts per role across all players
  const allNames = [...squadA.map(getCleanName), ...squadB.map(getCleanName)];
  const roleCounts = {
    all: allNames.length,
    wk: allNames.filter(n => getPlayerRole(n) === 'wk').length,
    bat: allNames.filter(n => getPlayerRole(n) === 'bat').length,
    ar: allNames.filter(n => getPlayerRole(n) === 'ar').length,
    bowl: allNames.filter(n => getPlayerRole(n) === 'bowl').length,
  };

  const isComplete = selectedPlayers.length === 11 && !!captain && !!viceCaptain;

  return (
    <div className="teambuilder-page animate-fade-up">
      {/* Top Bar Navigation */}
      <div className="page-top-bar">
        <Link to={`/match-center/${matchId}`} className="top-back-btn" id="teambuilder-back-btn">
          <Icon name="arrow-left" size={15} />
          <span>Back to Match Details</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="match-format-chip">
            <Icon name="cricket" size={13} /> {match.matchType || 'T20'} Fantasy Arena
          </span>
        </div>
      </div>

      {/* Match Timing & Status Alert */}
      {isMatchClosed ? (
        <div style={{
          background: '#fef2f2',
          border: '1.5px solid #fecaca',
          borderRadius: 16,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          color: '#991b1b',
        }}>
          <Icon name="lock" size={20} color="#dc2626" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5 }}>Not applicable now (Registration Closed)</div>
            <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 2 }}>
              Contests and squad submissions close 2 minutes before the match start. This match has already {match.matchEnded ? 'concluded' : 'commenced'}.
            </div>
          </div>
          <Link to="/" className="top-back-btn" style={{ padding: '6px 14px', fontSize: 12 }}>
            <span>Pick Upcoming Match</span>
          </Link>
        </div>
      ) : (
        <div style={{
          background: '#f0fdf4',
          border: '1.5px solid #bbf7d0',
          borderRadius: 14,
          padding: '10px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#166534',
          fontSize: 12.5,
          fontWeight: 700,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a' }} />
          <span>Registration Open • Squad submissions lock 2 minutes before scheduled match start</span>
        </div>
      )}

      {submitError && (
        <div className="auth-error animate-fade-up" style={{ margin: '0' }}>
          <Icon name="shield" size={16} color="#dc2626" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Hero Match & Progress Card */}
      <div className="teambuilder-header-card">
        {/* Matchup Title Banner */}
        <div className="tb-match-teams-row">
          <div className="tb-team-info">
            {flagA ? <img src={flagA} alt={match.teamA} className="tb-team-flag" /> : <div className="tb-team-mono">{match.teamA?.slice(0, 2).toUpperCase()}</div>}
            <div>
              <div className="tb-team-name">{match.teamA}</div>
              <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 800 }}>{countTeamASelected} Selected</div>
            </div>
          </div>

          <div className="tb-vs-badge">VS</div>

          <div className="tb-team-info is-right">
            <div style={{ textAlign: 'right' }}>
              <div className="tb-team-name">{match.teamB}</div>
              <div style={{ fontSize: 11.5, color: '#2563eb', fontWeight: 800 }}>{countTeamBSelected} Selected</div>
            </div>
            {flagB ? <img src={flagB} alt={match.teamB} className="tb-team-flag" /> : <div className="tb-team-mono">{match.teamB?.slice(0, 2).toUpperCase()}</div>}
          </div>
        </div>

        {/* Squad Selection Progress Meter */}
        <div className="tb-progress-container">
          <div className="tb-progress-labels">
            <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
              Squad Selection: <strong style={{ color: selectedPlayers.length === 11 ? '#059669' : '#2563eb', fontSize: 15 }}>{selectedPlayers.length} / 11</strong>
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>
              {selectedPlayers.length === 11 ? '✓ Squad Full' : `${11 - selectedPlayers.length} players required`}
            </span>
          </div>
          <div className="tb-progress-track">
            <div
              className="tb-progress-fill"
              style={{
                width: `${(selectedPlayers.length / 11) * 100}%`,
                background: selectedPlayers.length === 11 ? '#059669' : 'linear-gradient(90deg, #2563eb, #38bdf8)',
              }}
            />
          </div>
        </div>

        {/* Multipliers Status Cards Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1.5px solid #e2e8f0' }}>
          <div style={{
            background: captain ? '#fffbeb' : '#f8fafc',
            border: `1.5px solid ${captain ? '#f59e0b' : '#cbd5e1'}`,
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: captain ? '#f59e0b' : '#e2e8f0',
              color: captain ? 'white' : '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 13,
            }}>
              C
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: '#b45309', letterSpacing: '0.05em' }}>
                Captain (2x Points)
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
                {captain || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pick from squad</span>}
              </div>
            </div>
          </div>

          <div style={{
            background: viceCaptain ? '#eff6ff' : '#f8fafc',
            border: `1.5px solid ${viceCaptain ? '#2563eb' : '#cbd5e1'}`,
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: viceCaptain ? '#2563eb' : '#e2e8f0',
              color: viceCaptain ? 'white' : '#64748b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 12,
            }}>
              VC
            </div>
            <div>
              <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', color: '#1d4ed8', letterSpacing: '0.05em' }}>
                Vice-Captain (1.5x Points)
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>
                {viceCaptain || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Pick from squad</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="tb-role-tabs">
        {[
          { id: 'all', label: 'All Players', icon: 'users', count: roleCounts.all },
          { id: 'wk', label: 'Wicket Keepers (WK)', icon: 'shield', count: roleCounts.wk },
          { id: 'bat', label: 'Batters (BAT)', icon: 'bat', count: roleCounts.bat },
          { id: 'ar', label: 'All-Rounders (AR)', icon: 'zap', count: roleCounts.ar },
          { id: 'bowl', label: 'Bowlers (BOWL)', icon: 'ball', count: roleCounts.bowl },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tb-role-btn ${activeRoleFilter === tab.id ? 'active' : ''}`}
            onClick={() => setActiveRoleFilter(tab.id)}
          >
            <Icon name={tab.icon} size={14} />
            <span>{tab.label}</span>
            <span style={{
              marginLeft: 4,
              padding: '1px 6px',
              borderRadius: 9999,
              fontSize: 10.5,
              fontWeight: 900,
              background: activeRoleFilter === tab.id ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
              color: activeRoleFilter === tab.id ? 'white' : '#475569',
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Dual Squads Selection Grid */}
      <div className="tb-squads-grid">
        {/* Team A Column */}
        <div className="tb-squad-column">
          <div className="tb-column-header team-a">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {flagA && <img src={flagA} alt="" style={{ width: 22, height: 16, borderRadius: 3 }} />}
              <span>{match.teamA} Squad</span>
            </div>
            <span className="tb-col-sub">{filteredSquadA.length} listed</span>
          </div>

          <div className="tb-players-list">
            {filteredSquadA.map((p, idx) => {
              const name = getCleanName(p);
              const isSelected = selectedPlayers.includes(name);
              const isC = captain === name;
              const isVC = viceCaptain === name;
              const role = getPlayerRole(name);
              const rConf = ROLE_CONFIG[role] || ROLE_CONFIG.bat;

              return (
                <div
                  key={idx}
                  className={`tb-player-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderColor: isC ? '#f59e0b' : isVC ? '#2563eb' : isSelected ? '#059669' : '#cbd5e1',
                    background: isC ? '#fffdf7' : isVC ? '#f8faff' : isSelected ? '#f0fdf4' : '#ffffff',
                    opacity: isMatchClosed ? 0.7 : 1,
                  }}
                >
                  <div className="tb-player-main" onClick={() => togglePlayer(name)}>
                    <div className={`tb-player-checkbox ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Icon name="check" size={12} color="white" />}
                    </div>

                    <div className="tb-player-avatar" style={{
                      background: isC ? '#fef3c7' : isVC ? '#eff6ff' : isSelected ? '#dcfce7' : '#f1f5f9',
                      color: isC ? '#b45309' : isVC ? '#1d4ed8' : isSelected ? '#15803d' : '#0f172a',
                    }}>
                      {name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="tb-player-name-block">
                      <div>
                        <div className="tb-player-name">{name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{rConf.name}</div>
                      </div>
                      <span className={`role-chip ${role}`}>{rConf.label}</span>
                    </div>
                  </div>

                  {/* Captain / Vice Captain Pickers */}
                  {isSelected && (
                    <div className="tb-multiplier-selectors">
                      <button
                        className={`tb-mult-btn ${isC ? 'active-c' : ''}`}
                        onClick={() => handleCaptainSelect(name)}
                        disabled={isMatchClosed}
                        title="Assign Captain (2x points multiplier)"
                      >
                        {isC ? '👑 Captain (2x)' : 'Make C (2x)'}
                      </button>
                      <button
                        className={`tb-mult-btn ${isVC ? 'active-vc' : ''}`}
                        onClick={() => handleViceCaptainSelect(name)}
                        disabled={isMatchClosed}
                        title="Assign Vice-Captain (1.5x points multiplier)"
                      >
                        {isVC ? '⚡ Vice-Captain (1.5x)' : 'Make VC (1.5x)'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Team B Column */}
        <div className="tb-squad-column">
          <div className="tb-column-header team-b">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {flagB && <img src={flagB} alt="" style={{ width: 22, height: 16, borderRadius: 3 }} />}
              <span>{match.teamB} Squad</span>
            </div>
            <span className="tb-col-sub">{filteredSquadB.length} listed</span>
          </div>

          <div className="tb-players-list">
            {filteredSquadB.map((p, idx) => {
              const name = getCleanName(p);
              const isSelected = selectedPlayers.includes(name);
              const isC = captain === name;
              const isVC = viceCaptain === name;
              const role = getPlayerRole(name);
              const rConf = ROLE_CONFIG[role] || ROLE_CONFIG.bat;

              return (
                <div
                  key={idx}
                  className={`tb-player-card ${isSelected ? 'selected' : ''}`}
                  style={{
                    borderColor: isC ? '#f59e0b' : isVC ? '#2563eb' : isSelected ? '#059669' : '#cbd5e1',
                    background: isC ? '#fffdf7' : isVC ? '#f8faff' : isSelected ? '#f0fdf4' : '#ffffff',
                    opacity: isMatchClosed ? 0.7 : 1,
                  }}
                >
                  <div className="tb-player-main" onClick={() => togglePlayer(name)}>
                    <div className={`tb-player-checkbox ${isSelected ? 'checked' : ''}`}>
                      {isSelected && <Icon name="check" size={12} color="white" />}
                    </div>

                    <div className="tb-player-avatar" style={{
                      background: isC ? '#fef3c7' : isVC ? '#eff6ff' : isSelected ? '#dcfce7' : '#f1f5f9',
                      color: isC ? '#b45309' : isVC ? '#1d4ed8' : isSelected ? '#15803d' : '#0f172a',
                    }}>
                      {name.slice(0, 2).toUpperCase()}
                    </div>

                    <div className="tb-player-name-block">
                      <div>
                        <div className="tb-player-name">{name}</div>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>{rConf.name}</div>
                      </div>
                      <span className={`role-chip ${role}`}>{rConf.label}</span>
                    </div>
                  </div>

                  {/* Captain / Vice Captain Pickers */}
                  {isSelected && (
                    <div className="tb-multiplier-selectors">
                      <button
                        className={`tb-mult-btn ${isC ? 'active-c' : ''}`}
                        onClick={() => handleCaptainSelect(name)}
                        disabled={isMatchClosed}
                        title="Assign Captain (2x points multiplier)"
                      >
                        {isC ? '👑 Captain (2x)' : 'Make C (2x)'}
                      </button>
                      <button
                        className={`tb-mult-btn ${isVC ? 'active-vc' : ''}`}
                        onClick={() => handleViceCaptainSelect(name)}
                        disabled={isMatchClosed}
                        title="Assign Vice-Captain (1.5x points multiplier)"
                      >
                        {isVC ? '⚡ Vice-Captain (1.5x)' : 'Make VC (1.5x)'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions Bar */}
      <div className="tb-bottom-actions-bar">
        <div className="tb-bottom-summary">
          <div className="tb-summary-item">
            <span className="tb-sum-lbl">Squad Progress</span>
            <span className="tb-sum-val" style={{ color: selectedPlayers.length === 11 ? '#059669' : '#2563eb' }}>
              {selectedPlayers.length} / 11 Selected
            </span>
          </div>
          <div className="tb-summary-item">
            <span className="tb-sum-lbl">Captain (2x)</span>
            <span className="tb-sum-val" style={{ color: captain ? '#b45309' : '#94a3b8' }}>
              {captain || 'Not Chosen'}
            </span>
          </div>
          <div className="tb-summary-item">
            <span className="tb-sum-lbl">Vice-Captain (1.5x)</span>
            <span className="tb-sum-val" style={{ color: viceCaptain ? '#1d4ed8' : '#94a3b8' }}>
              {viceCaptain || 'Not Chosen'}
            </span>
          </div>
        </div>

        <div className="tb-bottom-submit-wrap">
          <button
            className="tb-submit-btn"
            disabled={!isComplete || submitting || isMatchClosed}
            onClick={handleSubmitTeam}
            style={{
              opacity: (isComplete && !isMatchClosed) ? 1 : 0.5,
              cursor: (isComplete && !isMatchClosed) ? 'pointer' : 'not-allowed',
            }}
          >
            <Icon name={isMatchClosed ? 'lock' : 'check'} size={16} color="white" />
            <span>
              {isMatchClosed
                ? 'Not Applicable Now (Match Closed)'
                : submitting
                ? 'Locking Squad…'
                : isComplete
                ? 'Lock & Submit 11 Players'
                : `Select ${11 - selectedPlayers.length} More Players`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamBuilder;
