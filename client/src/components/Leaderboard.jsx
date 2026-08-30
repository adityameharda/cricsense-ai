import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import axios from 'axios';
import socket from '../socket';
import Icon from './common/Icons';

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };
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
        console.error('⚠️ Leaderboard fetch error:', err.message);
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

  return (
    <div className="leaderboard-page animate-fade-up">
      {/* Top Bar with Prominent Back Buttons */}
      <div className="page-top-bar">
        <Link to={`/match-center/${matchId}`} className="top-back-btn" id="leaderboard-back-btn">
          <span className="back-arrow">←</span>
          <span>Back to Match Details</span>
        </Link>
        <Link to="/" className="top-back-btn-sub">
          Home
        </Link>
      </div>

      {/* Success Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--color-live)', color: '#fff', fontWeight: 700,
          padding: '12px 24px', borderRadius: 12, zIndex: 9999,
          boxShadow: '0 4px 20px rgba(5,150,105,0.35)', fontSize: 14,
          animation: 'fadeIn 0.3s ease'
        }}>
          {toast}
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
            <div className="lb-vs">VS</div>
            <div className="lb-team-block" style={{ textAlign: 'right' }}>
              <div className="lb-team-name">{match.teamB}</div>
              <div className="lb-team-score">{match.scoreB || '—'}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isLive ? (
                <span className="status-pill live">
                  <span className="live-dot" /> Live Match
                </span>
              ) : match.matchEnded ? (
                <span className="status-pill final">Concluded</span>
              ) : (
                <span className="status-pill upcoming">Upcoming Match</span>
              )}
              {match.venue && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📍 {match.venue}</span>
              )}
            </div>
            <Link
              to={`/build-team/${matchId}${contestId !== 'general' ? `?contestId=${contestId}` : ''}`}
              className="top-back-btn"
              style={{ padding: '6px 14px', fontSize: 12 }}
            >
              ✏️ Edit / Build Team
            </Link>
          </div>
        </div>
      )}

      {/* Private Room Share Banner */}
      {contestId !== 'general' && (
        <div className="contest-summary-card" style={{ padding: '12px 18px', background: '#f0fdf4', borderColor: '#86efac' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🔐</span>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Secret League Invite Code</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 900, color: '#14532d', letterSpacing: '0.08em' }}>{contestId}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(contestId);
                alert(`✓ Room Code "${contestId}" copied to clipboard!`);
              }}
              className="contest-code-copy-btn"
              style={{ background: '#16a34a' }}
            >
              📋 Copy Code
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/build-team/${matchId}?contestId=${contestId}`);
                alert('✓ Direct Invite Link copied to clipboard!');
              }}
              className="top-back-btn"
              style={{ fontSize: 12, padding: '4px 12px', background: '#ffffff' }}
            >
              🔗 Copy Invite Link
            </button>
          </div>
        </div>
      )}

      {/* HLD Metric Strip */}
      <div className="hld-metrics-grid">
        <div className="hld-metric-card">
          <div className="hld-metric-lbl">🥇 Leader Score</div>
          <div className="hld-metric-val highlight">{topScore > 0 ? `${topScore.toFixed(1)} pts` : '0.0 pts'}</div>
        </div>
        <div className="hld-metric-card">
          <div className="hld-metric-lbl">👥 Total Squads</div>
          <div className="hld-metric-val">{totalTeamsCount} Teams</div>
        </div>
        <div className="hld-metric-card">
          <div className="hld-metric-lbl">📊 Average Score</div>
          <div className="hld-metric-val">{avgScore} pts</div>
        </div>
        <div className="hld-metric-card">
          <div className="hld-metric-lbl">⚡ Multipliers</div>
          <div className="hld-metric-val" style={{ fontSize: 13, color: 'var(--color-primary)' }}>
            C: 2.0× · VC: 1.5×
          </div>
        </div>
      </div>

      {/* Top 3 Podium Showcase */}
      {top3.length > 0 && (
        <div className="hld-podium-section">
          <div className="hld-podium-grid">
            {top3.map((team, idx) => {
              const rank = idx + 1;
              const uname = team.userId?.username || team.userId || 'Player';
              return (
                <div key={team._id} className={`hld-podium-card rank-${rank}`}>
                  <div className="hld-podium-badge">
                    {RANK_MEDALS[rank]} Rank #{rank}
                  </div>
                  <div className="hld-podium-avatar">
                    {uname.charAt(0).toUpperCase()}
                  </div>
                  <div className="hld-podium-uname">{uname}</div>
                  <div className="hld-podium-pts">{(team.totalPoints || 0).toFixed(1)} PTS</div>
                  <div className="hld-podium-cvc">
                    {team.captain && <span className="hld-chip-c">C: {team.captain} (2×)</span>}
                    {team.viceCaptain && <span className="hld-chip-vc">VC: {team.viceCaptain} (1.5×)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Leaderboard Table */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h1 className="leaderboard-title" style={{ fontSize: 20 }}>
            {contestId === 'general' ? '🌍 Global Live Standings' : `🏆 Private League: ${contestId}`}
          </h1>
          <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
            Tap row to reveal 11-player squad
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : (
          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: 'var(--shadow-sm)',
              overflow: 'hidden',
            }}
          >
            <div className="lb-table-wrap">
              <table className="lb-table">
                <thead>
                  <tr>
                    <th style={{ width: 70 }}>Rank</th>
                    <th>Manager / Squad</th>
                    <th>Captain (2×) & VC (1.5×)</th>
                    <th style={{ textAlign: 'right' }}>Total Points</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.length === 0 ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        No fantasy teams submitted yet! Be the first to build your dream 11.
                      </td>
                    </tr>
                  ) : (
                    leaderboard.map((team, index) => {
                      const rank = index + 1;
                      const isExpanded = expandedTeam === team._id;
                      const uname = team.userId?.username || team.userId || 'Unknown';
                      return (
                        <React.Fragment key={team._id}>
                          <tr
                            className={isExpanded ? 'expanded' : ''}
                            onClick={() =>
                              setExpandedTeam(isExpanded ? null : team._id)
                            }
                            style={{ cursor: 'pointer' }}
                          >
                            <td className="lb-rank-cell">
                              {RANK_MEDALS[rank] ? (
                                <div className={`lb-rank-medal lb-rank-${rank}`}>
                                  {RANK_MEDALS[rank]}
                                </div>
                              ) : (
                                `#${rank}`
                              )}
                            </td>
                            <td className="lb-user-cell">
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div className="user-avatar-circle" style={{ width: 26, height: 26, fontSize: 11 }}>
                                  {uname.charAt(0).toUpperCase()}
                                </div>
                                <span style={{ fontWeight: 700 }}>{uname}</span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {team.captain && (
                                  <span className="lb-reveal-chip is-c" style={{ fontSize: 11 }}>
                                    © {team.captain} (2×)
                                  </span>
                                )}
                                {team.viceCaptain && (
                                  <span className="lb-reveal-chip is-vc" style={{ fontSize: 11 }}>
                                    Ⓥ {team.viceCaptain} (1.5×)
                                  </span>
                                )}
                              </div>
                            </td>
                            <td
                              className="lb-points-cell"
                              style={{ textAlign: 'right', fontWeight: 800, color: 'var(--color-primary)' }}
                            >
                              {(team.totalPoints || 0).toFixed(1)} pts
                            </td>
                            <td className="lb-expand-cell" style={{ textAlign: 'center' }}>
                              {isExpanded ? '▲' : '▼'}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="lb-team-reveal-row">
                              <td colSpan="5">
                                <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                  📋 11-Player Selected Roster
                                </div>
                                <div className="lb-reveal-grid">
                                  {(team.players || []).map((p) => {
                                    const isC = p === team.captain;
                                    const isVC = p === team.viceCaptain;
                                    const role = getPlayerRole(p);
                                    return (
                                      <span
                                        key={p}
                                        className={`lb-reveal-chip${isC ? ' is-c' : isVC ? ' is-vc' : ''}`}
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
                                      >
                                        <span className={`role-chip ${role}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                                          {ROLE_LABELS[role]}
                                        </span>
                                        <span style={{ fontWeight: isC || isVC ? 800 : 500 }}>{p}</span>
                                        {isC && <strong style={{ color: '#2563eb' }}> (2× C)</strong>}
                                        {isVC && <strong style={{ color: '#059669' }}> (1.5× VC)</strong>}
                                      </span>
                                    );
                                  })}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard;

