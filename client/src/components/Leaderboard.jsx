import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import socket from '../socket';
import Icon from './common/Icons';

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

const Leaderboard = ({ user }) => {
  const { matchId } = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const contestId = searchParams.get('contestId') || 'general';

  const [leaderboard, setLeaderboard] = useState([]);
  const [expandedTeam, setExpandedTeam] = useState(null);
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(location.state?.successMessage || null);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const resLB = await axios.get(
          `http://localhost:5000/api/fantasy/leaderboard/${matchId}?contestId=${contestId}`
        );
        setLeaderboard(resLB.data || []);

        const resMatch = await axios.get(`http://localhost:5000/api/matches/${matchId}`);
        setMatch(resMatch.data);
      } catch (err) {
        console.error('Leaderboard fetch error:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const handleLeaderboardUpdate = (newLeaderboard) => {
      setLeaderboard(newLeaderboard || []);
    };

    socket.on('leaderboard_update', handleLeaderboardUpdate);
    return () => {
      socket.off('leaderboard_update', handleLeaderboardUpdate);
    };
  }, [matchId, contestId]);

  const isLive = match?.matchStarted && !match?.matchEnded;

  // HLD Metrics calculations
  const totalTeamsCount = leaderboard.length;
  const topScore = totalTeamsCount > 0 ? Math.max(...leaderboard.map(t => t.totalPoints || 0)) : 0;
  const avgScore = totalTeamsCount > 0
    ? (leaderboard.reduce((acc, t) => acc + (t.totalPoints || 0), 0) / totalTeamsCount).toFixed(1)
    : 0;

  const top3 = leaderboard.slice(0, 3);

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="medal-pill gold"><Icon name="crown" size={13} /> 1st</span>;
    if (rank === 2) return <span className="medal-pill silver"><Icon name="award" size={13} /> 2nd</span>;
    if (rank === 3) return <span className="medal-pill bronze"><Icon name="medal" size={13} /> 3rd</span>;
    return <span className="medal-pill default">#{rank}</span>;
  };

  return (
    <div className="leaderboard-page animate-fade-up">
      {/* Top Bar Navigation */}
      <div className="page-top-bar">
        <Link to={`/match-center/${matchId}`} className="top-back-btn" id="leaderboard-back-btn">
          <Icon name="arrow-left" size={14} />
          <span>Back to Match Details</span>
        </Link>
        <Link to="/" className="top-back-btn-sub">
          <Icon name="cricket" size={13} />
          <span>All Matches</span>
        </Link>
      </div>

      {/* Success Toast */}
      {toast && (
        <div className="toast-success animate-fade-up">
          <Icon name="check-circle" size={18} color="white" />
          <span>{toast}</span>
        </div>
      )}

      {/* Match Context Header Card */}
      {match && (
        <div className="leaderboard-header-card">
          <div className="lb-match-scores">
            <div className="lb-team-block">
              <div className="lb-team-name">{match.teamA}</div>
              <div className="lb-team-score">{match.scoreA || '—'}</div>
            </div>
            <div className="lb-vs-badge">VS</div>
            <div className="lb-team-block is-right">
              <div className="lb-team-name">{match.teamB}</div>
              <div className="lb-team-score">{match.scoreB || '—'}</div>
            </div>
          </div>

          <div className="lb-status-bar">
            <div className="lb-status-text">
              <Icon name="activity" size={14} color="var(--color-primary)" />
              <span>{match.status || (isLive ? 'Live leaderboard scoring in real-time' : 'Final rankings verified')}</span>
            </div>
            {isLive && (
              <span className="live-status-pill">
                <span className="live-dot" /> LIVE SCORING
              </span>
            )}
          </div>
        </div>
      )}

      {/* HLD Metrics Strip */}
      <div className="hld-metrics-grid">
        <div className="hld-metric-box">
          <div className="hld-metric-label">Total Fantasy Teams</div>
          <div className="hld-metric-value">{totalTeamsCount}</div>
        </div>
        <div className="hld-metric-box">
          <div className="hld-metric-label">Leader Score</div>
          <div className="hld-metric-value leader-score">{topScore} <span style={{ fontSize: 13, fontWeight: 600 }}>pts</span></div>
        </div>
        <div className="hld-metric-box">
          <div className="hld-metric-label">Average Score</div>
          <div className="hld-metric-value">{avgScore} <span style={{ fontSize: 13, fontWeight: 600 }}>pts</span></div>
        </div>
        <div className="hld-metric-box">
          <div className="hld-metric-label">Contest Type</div>
          <div className="hld-metric-value" style={{ textTransform: 'capitalize', fontSize: 18 }}>
            {contestId === 'general' ? 'Public Arena' : `Private (${contestId})`}
          </div>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      {top3.length > 0 && (
        <div>
          <div className="podium-section-title">
            <Icon name="trophy" size={18} color="var(--color-primary)" />
            <span>Leaderboard Podium</span>
          </div>

          <div className="podium-grid">
            {top3.map((entry, idx) => {
              const rank = idx + 1;
              const isCurrentUser = user && (entry.user?._id === user.id || entry.user?.username === user.username);
              const rankClass = rank === 1 ? 'gold-podium' : rank === 2 ? 'silver-podium' : 'bronze-podium';

              return (
                <div key={entry._id || idx} className={`podium-card ${rankClass} ${isCurrentUser ? 'current-user-podium' : ''}`}>
                  <div className="podium-rank-ribbon">
                    {getRankBadge(rank)}
                  </div>
                  <div className="podium-avatar-circle">
                    {entry.user?.username ? entry.user.username.slice(0, 2).toUpperCase() : 'P'}
                  </div>
                  <div className="podium-username">
                    {entry.user?.username || 'Player'}
                    {isCurrentUser && <span className="podium-you-tag">YOU</span>}
                  </div>
                  <div className="podium-points-val">
                    {entry.totalPoints || 0} <span className="pts-suffix">PTS</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Complete Standings Table */}
      <div className="standings-card">
        <div className="standings-header">
          <div className="standings-title">
            <Icon name="award" size={16} color="var(--color-primary)" />
            <span>Full Standings ({leaderboard.length})</span>
          </div>
          <span className="standings-auto-refresh">
            <Icon name="refresh" size={12} /> Auto-Sync Active
          </span>
        </div>

        {loading ? (
          <div className="app-loading" style={{ minHeight: 180 }}>
            <div className="spinner" />
            <span>Computing rankings…</span>
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icon name="users" size={36} color="var(--color-primary)" />
            </div>
            <div className="empty-state-title">No Fantasy Squads Yet</div>
            <div className="empty-state-desc">Build your 11-player squad to appear on the leaderboard.</div>
            {!match?.matchStarted && (
              <Link to={`/build-team/${matchId}`} className="top-back-btn" style={{ marginTop: 14 }}>
                <Icon name="cricket" size={14} />
                <span>Build Fantasy Squad</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="standings-list">
            {leaderboard.map((entry, index) => {
              const rank = index + 1;
              const isExpanded = expandedTeam === (entry._id || index);
              const isCurrentUser = user && (entry.user?._id === user.id || entry.user?.username === user.username);

              return (
                <div key={entry._id || index} className={`standing-item-card ${isCurrentUser ? 'is-current-user' : ''}`}>
                  <div
                    className="standing-row-bar"
                    onClick={() => setExpandedTeam(isExpanded ? null : (entry._id || index))}
                  >
                    <div className="standing-rank-cell">
                      {getRankBadge(rank)}
                    </div>
                    <div className="standing-user-cell">
                      <div className="standing-avatar-mini">
                        {entry.user?.username ? entry.user.username.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div>
                        <div className="standing-username-text">
                          {entry.user?.username || 'Player'}
                          {isCurrentUser && <span className="you-pill-mini">YOU</span>}
                        </div>
                        <div className="standing-captain-sub">
                          C: <strong>{entry.captain || '—'}</strong> | VC: <strong>{entry.viceCaptain || '—'}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="standing-points-cell">
                      <span className="standing-pts-num">{entry.totalPoints || 0}</span>
                      <span className="standing-pts-lbl">pts</span>
                    </div>

                    <button className="standing-expand-toggle" aria-label="Toggle squad breakdown">
                      <Icon name={isExpanded ? "chevron-left" : "chevron-right"} size={14} style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>
                  </div>

                  {/* Expanded Squad Breakdown */}
                  {isExpanded && (
                    <div className="standing-expanded-squad animate-fade-up">
                      <div className="expanded-squad-title">
                        <Icon name="users" size={14} color="var(--color-primary)" />
                        <span>Squad Performance Breakdown</span>
                      </div>
                      <div className="expanded-players-grid">
                        {(entry.players || []).map((p, pIdx) => {
                          const pName = typeof p === 'object' ? (p.name || '') : String(p || '');
                          const isCap = pName === entry.captain;
                          const isVCap = pName === entry.viceCaptain;
                          const role = getPlayerRole(pName);

                          return (
                            <div key={pIdx} className={`squad-player-micro-card ${isCap ? 'is-c' : isVCap ? 'is-vc' : ''}`}>
                              <div className="micro-card-name-row">
                                <span className="micro-player-name">{pName}</span>
                                <span className={`role-chip ${role}`}>{ROLE_LABELS[role]}</span>
                              </div>
                              <div className="micro-multiplier-row">
                                {isCap && <span className="multiplier-badge cap">2x Captain</span>}
                                {isVCap && <span className="multiplier-badge vcap">1.5x VC</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;
