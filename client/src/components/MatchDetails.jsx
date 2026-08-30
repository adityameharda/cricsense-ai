import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import Icon from './common/Icons';
import OverStrip from './common/OverStrip';
import ScoreDisplay from './common/ScoreDisplay';

const socket = io.connect('http://localhost:5000');

export const MatchDetails = ({ user }) => {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [realSquad, setRealSquad] = useState(null);
  const [activeTab, setActiveTab] = useState('live');
  const [selectedInningIdx, setSelectedInningIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/matches/${matchId}`);
        setMatch(res.data);
      } catch (err) {
        setError('Match information could not be retrieved.');
      } finally {
        setLoading(false);
      }
    };

    fetchMatch();
    socket.emit('join_match', matchId);

    socket.on('match_update', (updated) => {
      const updatedId = updated.matchId || updated._id;
      if (updatedId === matchId) {
        setMatch((prev) => ({ ...prev, ...updated }));
      }
    });

    return () => {
      socket.emit('leave_match', matchId);
      socket.off('match_update');
    };
  }, [matchId]);

  // Fetch scorecard on demand
  useEffect(() => {
    if (activeTab !== 'scorecard' || !match || scorecard) return;
    const fetchScorecard = async () => {
      setScorecardLoading(true);
      try {
        const res = await axios.get(`http://localhost:5000/api/matches/${matchId}/scorecard`);
        setScorecard(res.data);
      } catch (err) {
        setScorecard({ available: false });
      } finally {
        setScorecardLoading(false);
      }
    };
    fetchScorecard();
  }, [activeTab, match, matchId, scorecard]);

  // Fetch squad on demand
  useEffect(() => {
    if (activeTab !== 'squads' || !match || realSquad) return;
    const fetchSquad = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/matches/${matchId}/squad`);
        setRealSquad(res.data);
      } catch (err) {
        setRealSquad(null);
      }
    };
    fetchSquad();
  }, [activeTab, match, matchId, realSquad]);

  if (loading) {
    return (
      <div className="app-loading" style={{ minHeight: 300 }}>
        <div className="spinner" />
        <span>Connecting to Match Stream…</span>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="empty-state" style={{ maxWidth: 420, margin: '40px auto' }}>
        <div className="empty-state-icon">🏏</div>
        <div className="empty-state-title">Match Not Found</div>
        <div className="empty-state-desc">{error || 'This match fixture is not available.'}</div>
        <Link
          to="/"
          style={{
            display: 'inline-block',
            marginTop: 16,
            padding: '8px 20px',
            background: 'var(--color-primary)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Return to Matches
        </Link>
      </div>
    );
  }

  const isLive = match.matchStarted && !match.matchEnded;
  const isEnded = match.matchEnded;

  const computeCRR = (scoreStr) => {
    if (typeof scoreStr !== 'string') return '0.00';
    const m = scoreStr.match(/(\d+)\/\d+\s*\(([\d.]+)\)/);
    if (m) {
      const runs = parseFloat(m[1]);
      const overs = parseFloat(m[2]);
      if (overs > 0) return (runs / overs).toFixed(2);
    }
    return '0.00';
  };

  const computeSR = (runs, balls) => (balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0');

  const getPlayerRole = (idx, name = '') => {
    const n = name.toLowerCase();
    if (n.includes('(wk)') || n.includes('buttler') || n.includes('rizwan') || n.includes('pant') || n.includes('samson') || n.includes('carey') || n.includes('de kock') || n.includes('klaasen') || n.includes('bairstow') || n.includes('gurbaz') || n.includes('poorran') || n.includes('hope')) {
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
    // General distribution if unknown
    if (idx < 5) return 'bat';
    if (idx < 8) return 'ar';
    return 'bowl';
  };

  const ROLE_LABELS = { wk: 'WK', bat: 'BAT', ar: 'AR', bowl: 'BOWL' };

  const squadAList = realSquad?.squadA?.length > 0 ? realSquad.squadA : (match.squadA || []);
  const squadBList = realSquad?.squadB?.length > 0 ? realSquad.squadB : (match.squadB || []);

  const hasLiveData = match.striker || match.nonStriker || match.bowler;

  const TABS = [
    { id: 'live', label: 'Live Cockpit', icon: '●' },
    { id: 'scorecard', label: 'Scorecard', icon: '📊' },
    { id: 'squads', label: 'Squads', icon: '👥' },
    { id: 'info', label: 'Match Info', icon: 'ℹ' },
  ];

  return (
    <div className="match-details-page animate-fade-up">
      {/* Top Bar Navigation with Prominent Back Button */}
      <div className="page-top-bar">
        <Link to="/" className="top-back-btn" id="match-details-back-btn" title="Return to all live matches">
          <span className="back-arrow">←</span>
          <span>Back to Matches</span>
        </Link>
      </div>

      {/* Match Header Card */}
      <div className={`match-header${isLive ? ' is-live' : ''}`}>
        <div className="match-eyebrow">
          <div className="match-series-label">
            <span style={{ color: 'var(--color-primary)' }}>T20</span> · {match.teamA} vs {match.teamB}
          </div>
          {isLive ? (
            <span className="live-badge">
              <span className="live-pulse-ring">
                <span className="live-pulse-ring-outer" />
                <span className="live-pulse-ring-inner" />
              </span>
              LIVE
            </span>
          ) : isEnded ? (
            <span className="result-badge">
              <Icon name="trophy" size={13} />
              {match.status || 'Final'}
            </span>
          ) : (
            <span className="status-pill upcoming">Upcoming</span>
          )}
        </div>

        {/* Team Score Rows */}
        <div className="team-compare-block">
          {[
            { team: match.teamA, score: match.scoreA, isWinner: isEnded && match.scoreA > match.scoreB },
            { team: match.teamB, score: match.scoreB, isWinner: isEnded && match.scoreB > match.scoreA },
          ].map(({ team, score, isWinner }) => (
            <div key={team} className={`team-compare-row${isWinner ? ' winner' : ''}`}>
              <div className="team-compare-left">
                <div className="team-compare-monogram">{team?.slice(0, 2).toUpperCase()}</div>
                <span className="team-compare-name">{team}</span>
              </div>
              <span className={`team-compare-score${isLive && match.scoreB && score === match.scoreB ? ' live-batting' : ''}`}>
                <ScoreDisplay score={score} size="lg" />
              </span>
            </div>
          ))}
        </div>

        {/* Meta bar */}
        <div className="match-meta-bar">
          {match.venue && (
            <span className="match-meta-item">
              <Icon name="mappin" size={13} /> {match.venue}
            </span>
          )}
          {match.date && (
            <span className="match-meta-item">
              <Icon name="calendar" size={13} /> {match.date}
            </span>
          )}
          {isLive && (
            <span className="crr-chip">
              CRR: {computeCRR(match.scoreB !== '0/0 (0)' ? match.scoreB : match.scoreA)}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {/* BUG 3 FIX: Only show Build Team when match hasn't started */}
            {!match.matchStarted && !match.matchEnded && (
              <Link to={`/build-team/${matchId}`} className="card-btn primary" style={{ textDecoration: 'none', flex: 'none' }}>
                🏏 Build Team
              </Link>
            )}
            <Link to={`/leaderboard/${matchId}`} className="card-btn secondary" style={{ textDecoration: 'none', flex: 'none' }}>
              🏆 Leaderboard
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="details-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`details-tab-btn${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.id === 'live' && isLive && (
              <span className="live-dot" style={{ display: 'inline-block', marginRight: 2 }} />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="details-tab-content">

        {/* ── LIVE COCKPIT ── */}
        {activeTab === 'live' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {hasLiveData ? (
              <>
                {/* Over Strip */}
                <div className="over-strip-row">
                  <OverStrip balls={['1', '•', '4', 'W', '6', '1']} label="Current Over" />
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 16, fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                    {match.bowler && <span>Bowler: <strong style={{ color: 'var(--text-primary)' }}>{match.bowler}</strong></span>}
                    {match.bowlerOvers && <span>Overs: <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{match.bowlerOvers}</strong></span>}
                  </div>
                </div>

                {/* Batters + Bowler */}
                <div className="live-players-grid">
                  {/* Batters Card */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>
                      Batters at Crease
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[
                        { name: match.striker, runs: match.strikerRuns, balls: match.strikerBalls, onStrike: true },
                        { name: match.nonStriker, runs: match.nonStrikerRuns, balls: match.nonStrikerBalls, onStrike: false },
                      ].filter(b => b.name).map((batter) => (
                        <div key={batter.name} className={`live-player-card${batter.onStrike ? ' on-strike' : ''}`}>
                          <div className="live-player-card-header">
                            <div className="live-player-name">
                              {batter.onStrike && <span className="on-strike-dot" />}
                              {batter.name}
                              {batter.onStrike && <span className="on-strike-badge">ON STRIKE</span>}
                            </div>
                          </div>
                          <div className="live-player-stats">
                            <span className={`live-player-runs${batter.onStrike ? ' on-strike' : ''}`}>
                              {batter.runs ?? '--'}
                            </span>
                            <span className="live-player-balls">({batter.balls ?? '--'}b)</span>
                            <span className="live-player-sr">SR: {computeSR(batter.runs ?? 0, batter.balls ?? 1)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bowler Card */}
                  {match.bowler && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10 }}>
                        Current Bowler
                      </div>
                      <div className="live-player-card">
                        <div className="live-player-card-header">
                          <div className="live-player-name">{match.bowler}</div>
                          <span style={{ fontSize: 10, fontWeight: 800, background: 'var(--tint-primary)', color: 'var(--color-primary)', padding: '2px 8px', borderRadius: 'var(--radius-full)', border: '1px solid #bfdbfe' }}>
                            SPELL
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center', marginTop: 8 }}>
                          {[
                            { label: 'O', value: match.bowlerOvers || '—' },
                            { label: 'M', value: '0' },
                            { label: 'R', value: match.bowlerRuns || '—' },
                            { label: 'W', value: match.bowlerWickets || '0', isRed: true },
                          ].map(({ label, value, isRed }) => (
                            <div key={label}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: isRed ? 'var(--color-out)' : 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
                              <div style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color: isRed ? 'var(--color-out)' : 'var(--text-primary)' }}>{value}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📺</div>
                <div className="empty-state-title">
                  {isLive ? 'Awaiting live player data…' : isEnded ? 'Match has concluded' : 'Match not started yet'}
                </div>
                <div className="empty-state-desc">
                  {isLive
                    ? 'Live batter and bowler data will appear once the innings begins.'
                    : isEnded
                    ? `Result: ${match.status || 'See scorecard for details.'}`
                    : 'Check back when the match starts for live ball-by-ball updates.'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SCORECARD ── */}
        {activeTab === 'scorecard' && (
          <div>
            {scorecardLoading ? (
              <div className="app-loading" style={{ minHeight: 180 }}>
                <div className="spinner" />
                <span>Fetching scorecard…</span>
              </div>
            ) : scorecard?.innings?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Innings Selector */}
                {scorecard.innings.length > 1 && (
                  <div className="innings-selector">
                    {scorecard.innings.map((inn, idx) => (
                      <button
                        key={idx}
                        className={`innings-btn${selectedInningIdx === idx ? ' active' : ''}`}
                        onClick={() => setSelectedInningIdx(idx)}
                      >
                        {inn.inning || `Innings ${idx + 1}`}
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  const inn = scorecard.innings[selectedInningIdx] || scorecard.innings[0];
                  // Derive a clean batting-team label from the inning name
                  // CricAPI returns e.g. "England Innings 1" or "Pakistan 1st Innings"
                  const inningLabel = inn.inning || `Innings ${selectedInningIdx + 1}`;
                  return (
                    <>
                      {/* Inning heading */}
                      <div style={{
                        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17,
                        color: 'var(--text-primary)', padding: '4px 0 12px',
                        borderBottom: '2px solid var(--border)', marginBottom: 4
                      }}>
                        🏏 {inningLabel}
                      </div>

                      {/* Batting */}
                      <div className="scorecard-section">
                        <div className="scorecard-section-title">Batting</div>
                        <div className="sc-table-wrap">
                          <table className="sc-table">
                            <thead>
                              <tr>
                                <th>Batter</th>
                                <th>Dismissal</th>
                                <th className="num">R</th>
                                <th className="num">B</th>
                                <th className="num">4s</th>
                                <th className="num">6s</th>
                                <th className="num">SR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(inn.batting || []).map((b, i) => (
                                <tr key={i}>
                                  <td className="batter-name">
                                    {typeof b.batsman === 'object' ? (b.batsman?.name || 'Batter') : (b.batsman || 'Batter')}
                                  </td>
                                  <td className="dismissal">{b['dismissal-info'] || b.dismissal || 'not out'}</td>
                                  <td className="num runs-bold">{b.r ?? '—'}</td>
                                  <td className="num">{b.b ?? '—'}</td>
                                  <td className="num">{b['4s'] ?? '—'}</td>
                                  <td className="num">{b['6s'] ?? '—'}</td>
                                  <td className="num">{b.sr ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bowling */}
                      <div className="scorecard-section">
                        <div className="scorecard-section-title">🎳 Bowling</div>
                        <div className="sc-table-wrap">
                          <table className="sc-table">
                            <thead>
                              <tr>
                                <th>Bowler</th>
                                <th className="num">O</th>
                                <th className="num">M</th>
                                <th className="num">R</th>
                                <th className="num" style={{ color: 'var(--color-out)' }}>W</th>
                                <th className="num" style={{ color: 'var(--color-ball)' }}>Econ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(inn.bowling || []).map((bw, i) => (
                                <tr key={i}>
                                  <td className="batter-name">
                                    {typeof bw.bowler === 'object' ? (bw.bowler?.name || 'Bowler') : (bw.bowler || 'Bowler')}
                                  </td>
                                  <td className="num">{bw.o ?? '—'}</td>
                                  <td className="num">{bw.m ?? '0'}</td>
                                  <td className="num">{bw.r ?? '—'}</td>
                                  <td className="num wickets-red">{bw.w ?? '0'}</td>
                                  <td className="num economy-amber">{bw.eco ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <div className="empty-state-title">Scorecard not yet available</div>
                <div className="empty-state-desc">Detailed figures are published as the innings progresses.</div>
              </div>
            )}
          </div>
        )}

        {/* ── SQUADS ── */}
        {activeTab === 'squads' && (
          <div className="squads-two-col">
            {[
              { team: match.teamA, squad: squadAList, side: 'team-a' },
              { team: match.teamB, squad: squadBList, side: 'team-b' },
            ].map(({ team, squad, side }) => (
              <div key={team} className="squad-panel">
                <div className={`squad-panel-title ${side}`}>
                  {team} Squad
                  <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                    {squad.length} Players
                  </span>
                </div>
                {squad.length > 0 ? (
                  squad.map((p, idx) => {
                    const playerName = typeof p === 'object' ? (p.name || '') : String(p || '');
                    const cleanName = playerName.replace(/\s*\([c|C|vc|VC|w|wk|WK|Wk]+\)\s*/g, '').trim();
                    const isCaptain = playerName.toLowerCase().includes('(c)') || playerName.toLowerCase().includes('(capt)');
                    const isViceCaptain = playerName.toLowerCase().includes('(vc)');
                    const role = getPlayerRole(idx, playerName);
                    return (
                      <div key={idx} className="squad-player-item">
                        <span className="squad-player-num">{String(idx + 1).padStart(2, '0')}</span>
                        <span className="squad-player-name">
                          {cleanName || playerName}
                          {isCaptain && <span className="squad-captain-badge">C</span>}
                          {isViceCaptain && <span className="squad-vc-badge">VC</span>}
                        </span>
                        <span className={`role-chip ${role}`}>{ROLE_LABELS[role]}</span>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '20px 0' }}>
                    Squad announcement pending
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── INFO ── */}
        {activeTab === 'info' && (
          <div className="info-grid">
            {[
              { label: 'Teams', value: `${match.teamA} vs ${match.teamB}` },
              { label: 'Venue', value: match.venue || 'TBD' },
              { label: 'Date', value: match.date || 'Today' },
              { label: 'Format', value: 'T20 International' },
              { label: 'Status', value: match.status || (isLive ? 'Live' : isEnded ? 'Completed' : 'Upcoming') },
              { label: 'Toss', value: match.toss || 'Awaited' },
            ].map(({ label, value }) => (
              <div key={label} className="info-cell">
                <div className="info-cell-label">{label}</div>
                <div className="info-cell-value">{value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchDetails;