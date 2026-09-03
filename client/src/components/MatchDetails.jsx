import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import socket from '../socket';
import { API_BASE_URL } from '../config';
import Icon from './common/Icons';
import OverStrip from './common/OverStrip';
import ScoreDisplay, { cleanCricketOvers } from './common/ScoreDisplay';
import { formatToIST, formatDateDisplay } from '../utils/formatTime';

const FLAG_MAP = {
  'india': 'in', 'australia': 'au', 'england': 'gb-eng', 'south africa': 'za',
  'new zealand': 'nz', 'pakistan': 'pk', 'bangladesh': 'bd', 'sri lanka': 'lk',
  'west indies': 'jm', 'afghanistan': 'af', 'ireland': 'ie', 'zimbabwe': 'zw',
  'netherlands': 'nl', 'scotland': 'gb-sct', 'uae': 'ae', 'usa': 'us',
  'namibia': 'na', 'nepal': 'np', 'canada': 'ca', 'malaysia': 'my',
  'belgium': 'be', 'luxembourg': 'lu', 'tanzania': 'tz', 'uganda': 'ug',
};

const getFlagUrl = (teamName) => {
  if (!teamName) return null;
  const name = teamName.toLowerCase().replace(/ women| u19| a$/g, '').trim();
  const code = FLAG_MAP[name];
  return code ? `https://flagcdn.com/32x24/${code}.png` : null;
};

export const MatchDetails = ({ user }) => {
  const { matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [realSquad, setRealSquad] = useState(null);
  const [activeTab, setActiveTab] = useState('live');
  const [selectedInningIdx, setSelectedInningIdx] = useState(0);
  const [expandedTeams, setExpandedTeams] = useState({ teamA: true, teamB: true });
  const [loading, setLoading] = useState(true);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const [error, setError] = useState(null);

  const toggleTeamSquad = (teamKey) => {
    setExpandedTeams((prev) => ({ ...prev, [teamKey]: !prev[teamKey] }));
  };

  useEffect(() => {
    const fetchMatch = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/matches/${matchId}`);
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

  // Fetch authentic scorecard immediately and whenever scorecard tab is active
  useEffect(() => {
    if (!matchId) return;

    const fetchScorecard = async () => {
      setScorecardLoading(true);
      try {
        const res = await axios.get(`${API_BASE_URL}/api/matches/${matchId}/scorecard`);
        setScorecard(res.data);
      } catch (err) {
        setScorecard({ available: false, innings: [] });
      } finally {
        setScorecardLoading(false);
      }
    };

    fetchScorecard();
  }, [matchId, activeTab]);

  // Live polling for in-progress matches to keep Cockpit & Scorecard live
  useEffect(() => {
    const isLiveMatch = match?.matchStarted && !match?.matchEnded;
    if (!matchId || !isLiveMatch) return;

    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/matches/${matchId}/scorecard`);
        if (res.data) {
          setScorecard(res.data);
        }
      } catch (e) {
        // silent fail on poll
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [matchId, match?.matchStarted, match?.matchEnded]);

  // Fetch squad as soon as match loads or on tab switch
  useEffect(() => {
    if (!matchId) return;
    const fetchSquad = async () => {
      try {
        const res = await axios.get(`${API_BASE_URL}/api/matches/${matchId}/squad`);
        if (res.data && (res.data.squadA?.length > 0 || res.data.squadB?.length > 0)) {
          setRealSquad(res.data);
        }
      } catch (err) {
        console.warn('Squad fetch:', err.message);
      }
    };
    fetchSquad();
  }, [matchId, activeTab]);

  const isLive = match?.matchStarted && !match?.matchEnded;
  const isEnded = match?.matchEnded;

  const flagA = match?.teamALogo || getFlagUrl(match?.teamA);
  const flagB = match?.teamBLogo || getFlagUrl(match?.teamB);

  const squadAList = realSquad?.squadA?.length > 0 ? realSquad.squadA : (match?.squadA || []);
  const squadBList = realSquad?.squadB?.length > 0 ? realSquad.squadB : (match?.squadB || []);

  // Display authentic innings strictly from live/completed scorecard data
  const displayInnings = useMemo(() => {
    if (scorecard?.innings && Array.isArray(scorecard.innings) && scorecard.innings.length > 0) {
      return scorecard.innings;
    }
    return [];
  }, [scorecard]);

  if (loading) {
    return (
      <div className="app-loading" style={{ minHeight: 360 }}>
        <div className="spinner" />
        <span>Connecting to Match Telemetry Stream…</span>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="empty-state" style={{ maxWidth: 460, margin: '40px auto' }}>
        <div className="empty-state-icon">
          <Icon name="cricket" size={40} color="var(--color-primary)" />
        </div>
        <div className="empty-state-title">Match Not Found</div>
        <div className="empty-state-desc">{error || 'This match fixture is currently unavailable.'}</div>
        <Link to="/" className="top-back-btn" style={{ marginTop: 16 }}>
          <Icon name="arrow-left" size={14} />
          <span>Return to Matches</span>
        </Link>
      </div>
    );
  }

  const computeCRR = (scoreStr) => {
    if (typeof scoreStr !== 'string') return '0.00';
    const cleaned = cleanCricketOvers(scoreStr);
    const m = cleaned.match(/(\d+)\/\d+\s*\(([\d.]+)\)/);
    if (m) {
      const runs = parseFloat(m[1]);
      let overs = parseFloat(m[2]);
      if (overs > 0) return (runs / overs).toFixed(2);
    }
    return '0.00';
  };

  const computeSR = (runs, balls) => (balls > 0 ? ((runs / balls) * 100).toFixed(2) : '0.00');

  const ROLE_LABELS = { wk: 'WK', bat: 'BAT', ar: 'AR', bowl: 'BOWL' };

  // Extract live telemetry from miniscore or match record
  const liveTelemetry = scorecard?.miniscore || match?.miniscore || null;
  const hasLiveTelemetry = !!(liveTelemetry?.striker || liveTelemetry?.bowler || match?.striker || match?.bowler);

  const TABS = [
    { id: 'live', label: 'Live Cockpit', icon: 'zap' },
    { id: 'scorecard', label: 'Scorecard', icon: 'activity' },
    { id: 'squads', label: 'Squads', icon: 'users' },
    { id: 'info', label: 'Match Info', icon: 'info' },
  ];

  // Helper for Strike Rate Badge styling
  const getSRBadge = (srNum) => {
    const sr = parseFloat(srNum);
    if (isNaN(sr)) return null;
    if (sr >= 200) return <span className="sr-badge sr-fire" title="Aggressive Strike Rate"><Icon name="flame" size={11} /> {sr}</span>;
    if (sr >= 150) return <span className="sr-badge sr-high" title="High Strike Rate"><Icon name="zap" size={11} /> {sr}</span>;
    if (sr >= 100) return <span className="sr-badge sr-normal">{sr}</span>;
    return <span className="sr-badge sr-low">{sr}</span>;
  };

  // Helper for Economy Rate Badge styling
  const getEconBadge = (econNum) => {
    const eco = parseFloat(econNum);
    if (isNaN(eco) || eco === 0) return <span className="econ-badge econ-normal">{econNum || '—'}</span>;
    if (eco < 6.0) return <span className="econ-badge econ-great" title="Exceptional Economy">{econNum}</span>;
    if (eco <= 8.5) return <span className="econ-badge econ-normal">{econNum}</span>;
    return <span className="econ-badge econ-high">{econNum}</span>;
  };

  // Helper for Player Roles in squad roster
  const getPlayerRole = (idx, playerName = '') => {
    const name = playerName.toLowerCase();
    if (name.includes('(wk)') || name.includes('wk') || idx === 2) return 'wk';
    if (idx < 4) return 'bat';
    if (idx < 7) return 'ar';
    return 'bowl';
  };

  // Helper for rendering recent ball-by-ball deliveries with prominent red Wicket badges
  const renderRecentDeliveries = (recentStr) => {
    if (!recentStr || typeof recentStr !== 'string') {
      return <OverStrip balls={['1', '•', '4', 'W', '6', '1']} label="Recent" />;
    }
    const tokens = recentStr.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;

    return (
      <div className="over-strip-container">
        <span className="over-strip-label">Recent:</span>
        <div className="over-strip-balls">
          {tokens.map((token, idx) => {
            const tUpper = token.toUpperCase();
            if (tUpper === '|' || tUpper === '/') {
              return (
                <span key={idx} className="recent-ball-divider" style={{ color: '#cbd5e1', fontWeight: 800, margin: '0 3px' }}>
                  |
                </span>
              );
            }
            const isWicket = tUpper === 'W' || tUpper.startsWith('W') || tUpper.includes('WKT') || tUpper.includes('OUT');
            const isFour = tUpper === '4';
            const isSix = tUpper === '6';
            const isDot = tUpper === '0' || tUpper === '•' || tUpper === '.' || tUpper === '-';

            let chipClass = 'ball-chip-run';
            if (isWicket) chipClass = 'ball-chip-wicket';
            else if (isSix) chipClass = 'ball-chip-six';
            else if (isFour) chipClass = 'ball-chip-four';
            else if (isDot) chipClass = 'ball-chip-dot';

            return (
              <div
                key={idx}
                className={`ball-chip ${chipClass}`}
                title={isWicket ? 'Wicket Dismissal' : `Ball ${idx + 1}: ${token}`}
              >
                {isDot ? '•' : isWicket ? 'W' : token}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const displayStatus = formatToIST(match.status);

  return (
    <div className="match-details-page animate-fade-up">
      {/* Top Bar Navigation */}
      <div className="page-top-bar">
        <Link to="/" className="top-back-btn" id="match-details-back-btn" title="Return to all live matches">
          <Icon name="arrow-left" size={15} />
          <span>Back to Matches</span>
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="match-format-chip">
            <Icon name="cricket" size={13} /> {match.matchType || 'T20 Match'}
          </span>
        </div>
      </div>

      {/* Match Header Hero Scoreboard Box */}
      <div className={`match-header-hero ${isLive ? 'is-live' : ''}`}>
        {/* Eyebrow info & status */}
        <div className="match-hero-eyebrow">
          <div className="match-series-info">
            <span className="match-series-name">{match.venue || 'International Ground'}</span>
            <span className="match-series-dot">•</span>
            <span>{formatDateDisplay(match.date) || 'Live Match'}</span>
          </div>

          {isLive ? (
            <span className="live-status-pill">
              <span className="live-pulse-ring">
                <span className="live-pulse-ring-outer" />
                <span className="live-pulse-ring-inner" />
              </span>
              <span>LIVE BROADCAST</span>
            </span>
          ) : isEnded ? (
            <span className="status-pill final">
              <Icon name="trophy" size={12} />
              <span>FINAL RESULT</span>
            </span>
          ) : (
            <span className="status-pill upcoming">
              <Icon name="clock" size={12} />
              <span>UPCOMING FIXTURE</span>
            </span>
          )}
        </div>

        {/* Dual Team Scoreboard Rows */}
        <div className="match-hero-scoreboard">
          {/* Team A Row */}
          <div className={`hero-team-box ${isEnded && match.scoreA > match.scoreB ? 'is-winner' : ''}`}>
            <div className="hero-team-identity">
              {flagA ? (
                <img src={flagA} alt={match.teamA} className="hero-team-flag" />
              ) : (
                <div className="hero-team-monogram">{match.teamA?.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="hero-team-text-wrap">
                <div className="hero-team-title">{match.teamA}</div>
                {isLive && !match.scoreB && <span className="hero-batting-tag"><Icon name="zap" size={10} /> Batting</span>}
              </div>
            </div>
            <div className="hero-team-score-wrap">
              <ScoreDisplay score={match.scoreA} size="hero" highlight={isLive && !match.scoreB} />
              {match.scoreA && match.scoreA !== '0/0 (0)' && (
                <div className="hero-crr-label">CRR: {computeCRR(match.scoreA)}</div>
              )}
            </div>
          </div>

          {/* Team B Row */}
          <div className={`hero-team-box is-team-b ${isEnded && match.scoreB > match.scoreA ? 'is-winner' : ''}`}>
            <div className="hero-team-identity">
              {flagB ? (
                <img src={flagB} alt={match.teamB} className="hero-team-flag" />
              ) : (
                <div className="hero-team-monogram">{match.teamB?.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="hero-team-text-wrap">
                <div className="hero-team-title">{match.teamB}</div>
                {isLive && match.scoreB && <span className="hero-batting-tag is-chasing"><Icon name="target" size={10} /> Chasing</span>}
              </div>
            </div>
            <div className="hero-team-score-wrap">
              <ScoreDisplay score={match.scoreB} size="hero" highlight={isLive && !!match.scoreB} />
              {match.scoreB && match.scoreB !== '0/0 (0)' && (
                <div className="hero-crr-label">CRR: {computeCRR(match.scoreB)}</div>
              )}
            </div>
          </div>
        </div>

        {/* Live Equation / Result Bar */}
        <div className="match-hero-equation-bar">
          <div className="equation-status-text">
            <Icon name="bolt" size={14} color="var(--color-primary)" />
            <span>{displayStatus || (isLive ? 'Live match in progress' : 'Fixture details scheduled')}</span>
          </div>

          <div className="hero-quick-actions">
            {!match.matchStarted && !match.matchEnded && (
              <Link to={`/build-team/${matchId}`} className="hero-action-btn primary">
                <Icon name="cricket" size={14} />
                <span>Build Team</span>
              </Link>
            )}
            <Link to={`/leaderboard/${matchId}`} className="hero-action-btn secondary">
              <Icon name="trophy" size={14} />
              <span>Leaderboard</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Details Navigation Tabs */}
      <div className="details-tabs-bar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            className={`details-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <Icon name={tab.icon} size={15} />
            <span>{tab.label}</span>
            {tab.id === 'live' && isLive && <span className="live-dot" />}
          </button>
        ))}
      </div>

      {/* Tab Content Panels */}
      <div className="details-tab-content-panel">

        {/* ── 1. LIVE COCKPIT TAB (Exact Reference UI) ── */}
        {activeTab === 'live' && (
          <div className="cockpit-container">
            {hasLiveTelemetry || isLive ? (
              <div className="live-cockpit-box animate-fade-up">
                {/* Live Scores & Run Rate Header with Both Teams */}
                <div className="live-cockpit-header">
                  <div className="cockpit-dual-scores-row">
                    {/* Team A Card */}
                    <div className={`cockpit-team-score-card ${isLive && !match.scoreB ? 'is-batting-now' : ''}`}>
                      <div className="cockpit-team-info">
                        {flagA ? (
                          <img src={flagA} alt={match.teamA} className="cockpit-team-flag" />
                        ) : (
                          <div className="cockpit-team-mono">{match.teamA?.slice(0, 2).toUpperCase()}</div>
                        )}
                        <div>
                          <div className="cockpit-team-name">{match.teamA}</div>
                          {isLive && !match.scoreB && <span className="cockpit-live-tag"><Icon name="zap" size={10} /> Batting</span>}
                        </div>
                      </div>
                      <div className="cockpit-team-score-val">
                        <ScoreDisplay score={match.scoreA} size="lg" highlight={isLive && !match.scoreB} />
                        {match.scoreA && match.scoreA !== '0/0 (0)' && (
                          <span className="cockpit-crr-val">CRR: {computeCRR(match.scoreA)}</span>
                        )}
                      </div>
                    </div>

                    {/* Team B Card */}
                    <div className={`cockpit-team-score-card ${isLive && !!match.scoreB ? 'is-batting-now' : ''}`}>
                      <div className="cockpit-team-info">
                        {flagB ? (
                          <img src={flagB} alt={match.teamB} className="cockpit-team-flag" />
                        ) : (
                          <div className="cockpit-team-mono">{match.teamB?.slice(0, 2).toUpperCase()}</div>
                        )}
                        <div>
                          <div className="cockpit-team-name">{match.teamB}</div>
                          {isLive && match.scoreB && <span className="cockpit-live-tag is-chasing"><Icon name="target" size={10} /> Chasing</span>}
                        </div>
                      </div>
                      <div className="cockpit-team-score-val">
                        <ScoreDisplay score={match.scoreB} size="lg" highlight={isLive && !!match.scoreB} />
                        {match.scoreB && match.scoreB !== '0/0 (0)' && (
                          <span className="cockpit-crr-val">CRR: {computeCRR(match.scoreB)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Highlighted Match Equation & Rates */}
                  <div className="live-equation-banner">
                    <div className="live-equation-left">
                      <Icon name="bolt" size={14} color="#2563eb" />
                      <span>{liveTelemetry?.status || displayStatus || 'Match in progress'}</span>
                    </div>
                    <div className="live-crr-req-group">
                      <span className="crr-pill">
                        CRR: {liveTelemetry?.currentRunRate || computeCRR(match.scoreB || match.scoreA)}
                      </span>
                      {liveTelemetry?.requiredRunRate ? (
                        <span className="req-pill">
                          REQ: {liveTelemetry.requiredRunRate}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Batters & Bowlers Live Tables */}
                <div className="cockpit-table-section">
                  {/* 1. Batters Table */}
                  <div className="cockpit-table-wrapper">
                    <table className="cockpit-table">
                      <thead>
                        <tr>
                          <th>Batter</th>
                          <th className="num-col">R</th>
                          <th className="num-col">B</th>
                          <th className="num-col">4s</th>
                          <th className="num-col">6s</th>
                          <th className="num-col">SR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Striker Row with * */}
                        {liveTelemetry?.striker ? (
                          <tr>
                            <td>
                              <span className="cockpit-player-name-link">
                                {liveTelemetry.striker.name}
                                <span className="strike-asterisk">*</span>
                              </span>
                            </td>
                            <td className="num-col">{liveTelemetry.striker.runs ?? 0}</td>
                            <td className="num-col">{liveTelemetry.striker.balls ?? 0}</td>
                            <td className="num-col">{liveTelemetry.striker.fours ?? 0}</td>
                            <td className="num-col">{liveTelemetry.striker.sixes ?? 0}</td>
                            <td className="num-col">{liveTelemetry.striker.strikeRate ?? '0.00'}</td>
                          </tr>
                        ) : match.striker ? (
                          <tr>
                            <td>
                              <span className="cockpit-player-name-link">
                                {match.striker}
                                <span className="strike-asterisk">*</span>
                              </span>
                            </td>
                            <td className="num-col">{match.strikerRuns ?? 0}</td>
                            <td className="num-col">{match.strikerBalls ?? 0}</td>
                            <td className="num-col">0</td>
                            <td className="num-col">0</td>
                            <td className="num-col">{computeSR(match.strikerRuns, match.strikerBalls)}</td>
                          </tr>
                        ) : null}

                        {/* Non-Striker Row */}
                        {liveTelemetry?.nonStriker ? (
                          <tr>
                            <td>
                              <span className="cockpit-player-name-link">
                                {liveTelemetry.nonStriker.name}
                              </span>
                            </td>
                            <td className="num-col">{liveTelemetry.nonStriker.runs ?? 0}</td>
                            <td className="num-col">{liveTelemetry.nonStriker.balls ?? 0}</td>
                            <td className="num-col">{liveTelemetry.nonStriker.fours ?? 0}</td>
                            <td className="num-col">{liveTelemetry.nonStriker.sixes ?? 0}</td>
                            <td className="num-col">{liveTelemetry.nonStriker.strikeRate ?? '0.00'}</td>
                          </tr>
                        ) : match.nonStriker ? (
                          <tr>
                            <td>
                              <span className="cockpit-player-name-link">
                                {match.nonStriker}
                              </span>
                            </td>
                            <td className="num-col">{match.nonStrikerRuns ?? 0}</td>
                            <td className="num-col">{match.nonStrikerBalls ?? 0}</td>
                            <td className="num-col">0</td>
                            <td className="num-col">0</td>
                            <td className="num-col">{computeSR(match.nonStrikerRuns, match.nonStrikerBalls)}</td>
                          </tr>
                        ) : null}

                        {!liveTelemetry?.striker && !match.striker && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                              Awaiting active batters telemetry...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 2. Bowlers Table */}
                  <div className="cockpit-table-wrapper">
                    <table className="cockpit-table">
                      <thead>
                        <tr>
                          <th>Bowler</th>
                          <th className="num-col">O</th>
                          <th className="num-col">M</th>
                          <th className="num-col">R</th>
                          <th className="num-col">W</th>
                          <th className="num-col">ECO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Active Bowler Row with * */}
                        {liveTelemetry?.bowler ? (
                          <tr>
                            <td>
                              <span className="cockpit-player-name-link">
                                {liveTelemetry.bowler.name}
                                <span className="strike-asterisk">*</span>
                              </span>
                            </td>
                            <td className="num-col">{cleanCricketOvers(liveTelemetry.bowler.overs) ?? 0}</td>
                            <td className="num-col">{liveTelemetry.bowler.maidens ?? 0}</td>
                            <td className="num-col">{liveTelemetry.bowler.runs ?? 0}</td>
                            <td className="num-col" style={{ color: '#dc2626', fontWeight: 900 }}>{liveTelemetry.bowler.wickets ?? 0}</td>
                            <td className="num-col">{liveTelemetry.bowler.economy ?? '0.00'}</td>
                          </tr>
                        ) : match.bowler ? (
                          <tr>
                            <td>
                              <span className="cockpit-player-name-link">
                                {match.bowler}
                                <span className="strike-asterisk">*</span>
                              </span>
                            </td>
                            <td className="num-col">{cleanCricketOvers(match.bowlerOvers) ?? 0}</td>
                            <td className="num-col">0</td>
                            <td className="num-col">{match.bowlerRuns ?? 0}</td>
                            <td className="num-col" style={{ color: '#dc2626', fontWeight: 900 }}>{match.bowlerWickets ?? 0}</td>
                            <td className="num-col">
                              {match.bowlerOvers > 0 ? (match.bowlerRuns / parseFloat(match.bowlerOvers)).toFixed(2) : '0.00'}
                            </td>
                          </tr>
                        ) : null}

                        {/* Second Bowler Row */}
                        {liveTelemetry?.bowlerNonStriker ? (
                          <tr>
                            <td>
                              <span className="cockpit-player-name-link">
                                {liveTelemetry.bowlerNonStriker.name}
                              </span>
                            </td>
                            <td className="num-col">{cleanCricketOvers(liveTelemetry.bowlerNonStriker.overs) ?? 0}</td>
                            <td className="num-col">{liveTelemetry.bowlerNonStriker.maidens ?? 0}</td>
                            <td className="num-col">{liveTelemetry.bowlerNonStriker.runs ?? 0}</td>
                            <td className="num-col" style={{ color: '#dc2626', fontWeight: 900 }}>{liveTelemetry.bowlerNonStriker.wickets ?? 0}</td>
                            <td className="num-col">{liveTelemetry.bowlerNonStriker.economy ?? '0.00'}</td>
                          </tr>
                        ) : null}

                        {!liveTelemetry?.bowler && !match.bowler && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: '#94a3b8', padding: '16px' }}>
                              Awaiting active bowler telemetry...
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 3. Recent Deliveries & Partnership Footer */}
                  <div className="cockpit-meta-footer">
                    <div className="cockpit-footer-item">
                      {renderRecentDeliveries(liveTelemetry?.recentBalls)}
                    </div>

                    {liveTelemetry?.partnership ? (
                      <div className="cockpit-footer-item">
                        <span>Partnership: </span>
                        <strong>{liveTelemetry.partnership.runs} runs ({liveTelemetry.partnership.balls} balls)</strong>
                      </div>
                    ) : null}

                    {liveTelemetry?.lastWicket ? (
                      <div className="cockpit-footer-item last-wkt-footer-row" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span className="wicket-badge-pill">
                          <Icon name="wicket" size={12} color="white" /> WICKET
                        </span>
                        <span className="last-wkt-text" style={{ color: '#1e293b', fontWeight: 600 }}>
                          {liveTelemetry.lastWicket}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icon name="tv" size={36} color="var(--color-primary)" />
                </div>
                <div className="empty-state-title">
                  {isLive ? 'Awaiting live ball telemetry…' : isEnded ? 'Match has concluded' : 'Match starts soon'}
                </div>
                <div className="empty-state-desc">
                  {isLive
                    ? 'Live strike rotation and delivery breakdown will populate as balls are bowled.'
                    : isEnded
                    ? `Result: ${displayStatus || 'View full scorecard for detailed innings figures.'}`
                    : 'Check back when the match begins for live ball-by-ball commentary.'}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 2. SCORECARD TAB ── */}
        {activeTab === 'scorecard' && (
          <div className="scorecard-box-container">
            {scorecardLoading ? (
              <div className="app-loading" style={{ minHeight: 220 }}>
                <div className="spinner" />
                <span>Loading Detailed Scorecard…</span>
              </div>
            ) : displayInnings.length > 0 ? (
              <div className="scorecard-wrapper">
                {/* Innings Switcher Tabs */}
                {displayInnings.length > 1 && (
                  <div className="scorecard-innings-nav">
                    {displayInnings.map((inn, idx) => {
                      const innTitle = inn.inning || `Innings ${idx + 1}`;
                      const isSelected = selectedInningIdx === idx;
                      return (
                        <button
                          key={idx}
                          className={`inning-nav-btn ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedInningIdx(idx)}
                        >
                          <Icon name="cricket" size={14} />
                          <span>{innTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {(() => {
                  const inn = displayInnings[selectedInningIdx] || displayInnings[0];
                  const inningLabel = inn.inning || `${inn.teamName || 'Innings'} ${selectedInningIdx + 1}`;

                  // Compute aggregate innings stats
                  const battingList = inn.batting || [];
                  const bowlingList = inn.bowling || [];

                  const totalRuns = inn.runs !== undefined ? inn.runs : battingList.reduce((acc, b) => acc + (parseInt(b.r, 10) || 0), 0);
                  const total4s = battingList.reduce((acc, b) => acc + (parseInt(b['4s'], 10) || 0), 0);
                  const total6s = battingList.reduce((acc, b) => acc + (parseInt(b['6s'], 10) || 0), 0);
                  const wicketsFallen = inn.wickets !== undefined ? inn.wickets : battingList.filter(b => {
                    const d = (b['dismissal-info'] || b.dismissal || '').toLowerCase();
                    return d && d !== 'not out' && d !== 'batting' && d !== '—';
                  }).length;

                  // Extract authentic Did Not Bat / Yet to Bat players
                  let yetToBat = [];
                  if (Array.isArray(inn.didNotBat) && inn.didNotBat.length > 0) {
                    yetToBat = inn.didNotBat;
                  } else {
                    const currentSquad = selectedInningIdx === 0 ? squadAList : squadBList;
                    const battedNames = battingList.map(b => (typeof b.batsman === 'object' ? b.batsman?.name : b.batsman || '').toLowerCase());
                    yetToBat = (currentSquad || []).filter(p => {
                      const pName = (typeof p === 'object' ? p.name : String(p)).toLowerCase();
                      return pName && !battedNames.some(bn => bn.includes(pName) || pName.includes(bn));
                    });
                  }

                  const extrasTotal = inn.extras?.total !== undefined ? inn.extras.total : 0;
                  const extrasBreakdown = `b ${inn.extras?.b || 0}, lb ${inn.extras?.lb || 0}, w ${inn.extras?.w || 0}, nb ${inn.extras?.nb || 0}`;

                  return (
                    <div className="scorecard-inning-card animate-fade-up">
                      {/* Inning Overview Header Banner */}
                      <div className="scorecard-inning-header">
                        <div className="scorecard-header-left">
                          <div className="inning-badge-icon">
                            <Icon name="trophy" size={18} color="white" />
                          </div>
                          <div>
                            <h3 className="scorecard-inning-title">{inningLabel}</h3>
                            <div className="scorecard-boundary-stats">
                              <span className="boundary-stat-pill four"><Icon name="zap" size={11} /> {total4s} Fours</span>
                              <span className="boundary-stat-pill six"><Icon name="flame" size={11} /> {total6s} Sixes</span>
                              {inn.overs ? <span className="boundary-stat-pill"><Icon name="clock" size={11} /> {cleanCricketOvers(inn.overs)} Overs</span> : null}
                            </div>
                          </div>
                        </div>

                        <div className="scorecard-total-box">
                          <div className="scorecard-total-val">
                            {totalRuns}<span>/{wicketsFallen}</span>
                          </div>
                          {inn.overs ? <div className="scorecard-overs-sub">({cleanCricketOvers(inn.overs)} ov)</div> : null}
                        </div>
                      </div>

                      {/* Batting Scorecard Table Box */}
                      <div className="scorecard-table-card">
                        <div className="scorecard-card-bar">
                          <div className="card-bar-title">
                            <Icon name="bat" size={15} color="var(--color-primary)" />
                            <span>Batting Figures</span>
                          </div>
                          <span className="card-bar-sub">Standard ICC T20 / ODI / Test Rules</span>
                        </div>

                        <div className="sc-table-responsive">
                          <table className="sc-table">
                            <thead>
                              <tr>
                                <th>Batter</th>
                                <th>Dismissal</th>
                                <th className="num-col">R</th>
                                <th className="num-col">B</th>
                                <th className="num-col">4s</th>
                                <th className="num-col">6s</th>
                                <th className="num-col">SR</th>
                              </tr>
                            </thead>
                            <tbody>
                              {battingList.map((b, i) => {
                                const bName = typeof b.batsman === 'object' ? (b.batsman?.name || 'Batter') : (b.batsman || 'Batter');
                                const dismissal = b['dismissal-info'] || b.dismissal || 'not out';
                                const isNotOut = dismissal.toLowerCase().includes('not out') || dismissal.toLowerCase().includes('batting');
                                const runs = parseInt(b.r, 10) || 0;
                                const is50 = runs >= 50 && runs < 100;
                                const is100 = runs >= 100;
                                const sr = b.sr ?? computeSR(runs, parseInt(b.b, 10) || 0);

                                return (
                                  <tr key={i} className={isNotOut ? 'row-not-out' : ''}>
                                    <td className="batter-cell">
                                      <div className="player-flex-cell">
                                        <div className="player-avatar-circle">
                                          {bName.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div className="player-meta-block">
                                          <span className="batter-name-text">
                                            {bName}
                                            {is100 && <span className="milestone-badge century"><Icon name="crown" size={10} /> 100</span>}
                                            {is50 && <span className="milestone-badge fifty"><Icon name="award" size={10} /> 50</span>}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="dismissal-cell">
                                      <span className={isNotOut ? 'dismissal-not-out' : 'dismissal-out'}>
                                        {dismissal}
                                      </span>
                                    </td>
                                    <td className="num-col runs-bold-cell">{b.r ?? '0'}</td>
                                    <td className="num-col balls-cell">{b.b ?? '0'}</td>
                                    <td className="num-col fours-cell">{b['4s'] ?? '0'}</td>
                                    <td className="num-col sixes-cell">{b['6s'] ?? '0'}</td>
                                    <td className="num-col sr-cell">{getSRBadge(sr)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Extras Row */}
                        <div className="scorecard-extras-strip">
                          <div className="extras-title">Extras</div>
                          <div className="extras-details">
                            <strong>{extrasTotal}</strong> ({extrasBreakdown})
                          </div>
                        </div>

                        {/* Did Not Bat list */}
                        {yetToBat.length > 0 && (
                          <div className="yet-to-bat-strip">
                            <span className="yet-to-bat-label">Did Not Bat:</span>
                            <div className="yet-to-bat-players">
                              {yetToBat.map((p, idx) => {
                                const pName = typeof p === 'object' ? (p.name || p.batsman || String(p)) : String(p);
                                return (
                                  <span key={idx} className="yet-to-bat-chip">
                                    {pName}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Bowling Scorecard Table Box */}
                      <div className="scorecard-table-card" style={{ marginTop: 20 }}>
                        <div className="scorecard-card-bar">
                          <div className="card-bar-title">
                            <Icon name="ball" size={15} color="var(--color-live)" />
                            <span>Bowling Figures</span>
                          </div>
                          <span className="card-bar-sub">Economy & Wickets Breakdown</span>
                        </div>

                        <div className="sc-table-responsive">
                          <table className="sc-table">
                            <thead>
                              <tr>
                                <th>Bowler</th>
                                <th className="num-col">O</th>
                                <th className="num-col">M</th>
                                <th className="num-col">R</th>
                                <th className="num-col wicket-hdr">W</th>
                                <th className="num-col econ-hdr">Econ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {bowlingList.map((bw, i) => {
                                const bwName = typeof bw.bowler === 'object' ? (bw.bowler?.name || 'Bowler') : (bw.bowler || 'Bowler');
                                const wickets = parseInt(bw.w, 10) || 0;
                                const isWicketTaker = wickets >= 2;

                                return (
                                  <tr key={i} className={isWicketTaker ? 'row-wicket-taker' : ''}>
                                    <td className="bowler-cell">
                                      <div className="player-flex-cell">
                                        <div className="player-avatar-circle bowler">
                                          {bwName.slice(0, 2).toUpperCase()}
                                        </div>
                                        <span className="bowler-name-text">{bwName}</span>
                                      </div>
                                    </td>
                                    <td className="num-col overs-cell">{cleanCricketOvers(bw.o) ?? '—'}</td>
                                    <td className="num-col maidens-cell">{bw.m ?? '0'}</td>
                                    <td className="num-col runs-conceded-cell">{bw.r ?? '—'}</td>
                                    <td className="num-col wickets-highlight-cell">
                                      <span className={`wickets-pill ${wickets > 0 ? 'has-wickets' : ''}`}>
                                        {bw.w ?? '0'}
                                      </span>
                                    </td>
                                    <td className="num-col econ-cell">{getEconBadge(bw.eco)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Fall of Wickets Timeline */}
                      <div className="fow-strip-card" style={{ marginTop: 20 }}>
                        <div className="fow-title">
                          <Icon name="wicket" size={14} color="var(--color-out)" />
                          <span>Fall of Wickets Timeline</span>
                        </div>
                        <div className="fow-items-row">
                          {battingList
                            .filter(b => {
                              const d = (b['dismissal-info'] || b.dismissal || '').toLowerCase();
                              return d && !d.includes('not out') && !d.includes('batting') && d !== '—';
                            })
                            .map((b, idx) => {
                              const bName = typeof b.batsman === 'object' ? (b.batsman?.name || 'Batter') : (b.batsman || 'Batter');
                              const n = idx + 1;
                              const ordinal = n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
                              return (
                                <div key={idx} className="fow-pill">
                                  <span className="fow-number">{ordinal} Wkt</span>
                                  <span className="fow-player">{bName}</span>
                                  <span className="fow-score">({b.r ?? '0'} runs)</span>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Icon name="activity" size={36} color="var(--color-primary)" />
                </div>
                <div className="empty-state-title">Scorecard Not Yet Available</div>
                <div className="empty-state-desc">Full inning scorecards will appear once the innings commence.</div>
              </div>
            )}
          </div>
        )}

        {/* ── 3. SQUADS TAB ── */}
        {activeTab === 'squads' && (
          <div className="squads-accordion-container animate-fade-up">
            {[
              { key: 'teamA', team: match.teamA, squad: squadAList, flag: flagA, isOpen: expandedTeams.teamA },
              { key: 'teamB', team: match.teamB, squad: squadBList, flag: flagB, isOpen: expandedTeams.teamB },
            ].map(({ key, team, squad, flag, isOpen }) => (
              <div key={key} className={`squad-accordion-card ${isOpen ? 'is-open' : ''}`}>
                {/* Accordion Dropdown Toggle Header */}
                <button
                  type="button"
                  id={`squad-accordion-btn-${key}`}
                  className="squad-accordion-header-btn"
                  onClick={() => toggleTeamSquad(key)}
                  aria-expanded={isOpen}
                >
                  <div className="squad-header-left">
                    {flag ? (
                      <img src={flag} alt={team} className="squad-team-flag" />
                    ) : (
                      <div className="squad-team-mono">{team?.slice(0, 2).toUpperCase()}</div>
                    )}
                    <div className="squad-header-titles">
                      <span className="squad-accordion-team-name">{team}</span>
                      <span className="squad-count-chip">
                        <Icon name="users" size={12} /> {squad.length} Players
                      </span>
                    </div>
                  </div>

                  <div className="squad-header-right">
                    <span className="squad-toggle-hint">{isOpen ? 'Hide Squad' : 'Show Squad'}</span>
                    <div className={`squad-chevron-icon ${isOpen ? 'is-rotated' : ''}`}>
                      <Icon name="chevron-down" size={18} />
                    </div>
                  </div>
                </button>

                {/* Dropdown Players Roster */}
                {isOpen && (
                  <div className="squad-players-roster animate-fade-up">
                    {squad.length > 0 ? (
                      <div className="squad-players-grid">
                        {squad.map((p, idx) => {
                          const isObj = typeof p === 'object' && p !== null;
                          const rawName = isObj ? (p.name || '') : String(p || '');
                          const cleanName = rawName
                            .replace(/&#x27;/g, "'")
                            .replace(/&amp;/g, '&')
                            .replace(/\s*\([c|C|vc|VC|w|wk|WK|Wk]+\)\s*/g, '')
                            .trim();
                          const isCaptain = isObj
                            ? (p.isCaptain || p.badge?.includes('(C)') || rawName.toLowerCase().includes('(c)'))
                            : (rawName.toLowerCase().includes('(c)') || rawName.toLowerCase().includes('(capt)'));
                          const isKeeper = isObj
                            ? (p.isKeeper || p.badge?.includes('(WK)') || (p.role && p.role.toLowerCase().includes('wk')) || rawName.toLowerCase().includes('(wk)'))
                            : (rawName.toLowerCase().includes('(wk)') || rawName.toLowerCase().includes('wk'));
                          const playerImg = isObj && p.image ? p.image : null;
                          const roleLabel = isObj && p.role
                            ? p.role
                            : (ROLE_LABELS[getPlayerRole(idx, rawName)] || 'Player');

                          return (
                            <div key={idx} className="squad-player-item-card">
                              <div className="squad-player-identity">
                                {playerImg ? (
                                  <img src={playerImg} alt={cleanName} className="squad-player-avatar" />
                                ) : (
                                  <div className="squad-player-avatar-mono">
                                    {cleanName.slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div className="squad-player-meta">
                                  <div className="squad-player-name-row">
                                    <span className="squad-player-fullname">{cleanName || rawName}</span>
                                    {isCaptain && <span className="captain-badge-pill" title="Team Captain">👑 (C)</span>}
                                    {isKeeper && <span className="wk-badge-pill" title="Wicket Keeper">🧤 (WK)</span>}
                                  </div>
                                  <span className="squad-player-role-label">{roleLabel}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="squad-empty-text">Squad announcement awaited for this fixture.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── 4. MATCH INFO TAB (Exact Image 1 Reference UI) ── */}
        {activeTab === 'info' && (
          <div className="match-info-table-card animate-fade-up">
            <div className="match-info-card-header">
              <h3>Info</h3>
            </div>

            <div className="match-info-table-body">
              {/* Match */}
              <div className="match-info-row">
                <div className="match-info-label">Match</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value">
                    {match.teamA} vs {match.teamB} • {match.matchType || 'Match'} • {match.series || 'Cricket Series'}
                  </span>
                </div>
              </div>

              {/* Series */}
              <div className="match-info-row">
                <div className="match-info-label">Series</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value">
                    {match.series || match.matchType || 'International Tournament'}
                  </span>
                  <span className="match-info-chevron">›</span>
                </div>
              </div>

              {/* Date */}
              <div className="match-info-row">
                <div className="match-info-label">Date</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value">
                    {match.date ? formatToIST(match.date) : 'Today'}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="match-info-row">
                <div className="match-info-label">Time</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value">
                    {displayStatus || (isLive ? 'Live In Progress' : isEnded ? 'Concluded' : 'Scheduled')}
                  </span>
                </div>
              </div>

              {/* Toss */}
              <div className="match-info-row">
                <div className="match-info-label">Toss</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value">
                    {match.toss || `${match.teamA} vs ${match.teamB} (Standard Toss Guidelines)`}
                  </span>
                </div>
              </div>

              {/* Venue */}
              <div className="match-info-row">
                <div className="match-info-label">Venue</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value">
                    {match.venue || 'International Ground'}
                  </span>
                  <span className="match-info-chevron">›</span>
                </div>
              </div>

              {/* Format */}
              <div className="match-info-row">
                <div className="match-info-label">Format</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value">
                    {match.matchType || 'T20 Match'}
                  </span>
                </div>
              </div>

              {/* Status */}
              <div className="match-info-row">
                <div className="match-info-label">Status</div>
                <div className="match-info-value-wrap">
                  <span className="match-info-value" style={{ color: isLive ? '#059669' : isEnded ? '#2563eb' : '#d97706', fontWeight: 700 }}>
                    {displayStatus || (isLive ? 'Live match in progress' : isEnded ? 'Match completed' : 'Upcoming')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchDetails;