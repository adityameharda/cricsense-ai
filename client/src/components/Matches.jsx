import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import socket from '../socket';
import Icon from './common/Icons';
import OverStrip from './common/OverStrip';
import ScoreDisplay from './common/ScoreDisplay';
import { CardSkeleton, HeroSkeleton } from './common/Skeletons';

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

const MatchCard = React.memo(({ match }) => {
  const id = match.matchId || match._id;
  const isLive = match.matchStarted && !match.matchEnded;
  const isEnded = match.matchEnded;

  const flagA = match.teamALogo || getFlagUrl(match.teamA);
  const flagB = match.teamBLogo || getFlagUrl(match.teamB);

  return (
    <div className={`match-card${isLive ? ' is-live' : ''}`}>
      {/* Eyebrow */}
      <div className="card-eyebrow">
        <span className="card-venue-text">
          {match.venue || 'TBD'} · {match.matchType || 'T20'}
        </span>
        {isLive ? (
          <span className="status-pill live">
            <span className="live-dot" />
            LIVE
          </span>
        ) : isEnded ? (
          <span className="status-pill final">FINAL</span>
        ) : (
          <span className="status-pill upcoming">UPCOMING</span>
        )}
      </div>

      {/* Teams */}
      <Link to={`/match-center/${id}`} style={{ textDecoration: 'none' }}>
        <div className="card-teams-block">
          {[
            { name: match.teamA, score: match.scoreA, flag: flagA },
            { name: match.teamB, score: match.scoreB, flag: flagB, isBatting: isLive },
          ].map(({ name, score, flag, isBatting }) => (
            <div key={name} className="card-team-row">
              <div className="team-info-side">
                {flag ? (
                  <img src={flag} alt={name} className="team-flag-img" />
                ) : (
                  <div className="team-flag-mono">{name?.slice(0, 2).toUpperCase()}</div>
                )}
                <span className="team-name-label">{name}</span>
              </div>
              <span className={`team-score-value${isBatting ? ' batting' : ''}`}>
                <ScoreDisplay score={score} size="sm" highlight={!!isBatting} />
              </span>
            </div>
          ))}
        </div>
      </Link>

      {/* Over strip */}
      {isLive && (
        <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <OverStrip balls={['1', '•', '4', 'W', '6', '1']} label="Last Over" />
        </div>
      )}

      {/* Status line */}
      {match.status && (
        <div className="card-status-line">⚡ {match.status}</div>
      )}

      {/* Actions */}
      <div className="card-actions">
        <Link to={`/match-center/${id}`} className="card-btn primary">
          {isLive ? '⚡ Live Center' : '📊 Scorecard'}
        </Link>
        {!match.matchStarted && (
          <Link to={`/build-team/${id}`} className="card-btn secondary">
            🏆 Fantasy
          </Link>
        )}
        <Link to={`/leaderboard/${id}`} className="card-btn secondary">
          📈 Board
        </Link>
      </div>
    </div>
  );
});

export const Matches = ({ user }) => {
  const [matches, setMatches] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const handleMatchUpdate = (updatedMatch) => {
    setMatches((prevMatches) => {
      const updatedId = updatedMatch.matchId || updatedMatch._id;
      const found = prevMatches.some((m) => (m.matchId || m._id) === updatedId);
      if (!found) return [updatedMatch, ...prevMatches];
      return prevMatches.map((m) =>
        (m.matchId || m._id) === updatedId ? { ...m, ...updatedMatch } : m
      );
    });
  };

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/matches');
        setMatches(response.data || []);
      } catch (err) {
        console.error('Error fetching matches:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
    socket.emit('join_live_matches');
    socket.on('match_update', handleMatchUpdate);
    return () => { socket.off('match_update', handleMatchUpdate); };
  }, []);

  const liveMatches = useMemo(() => matches.filter((m) => m.matchStarted && !m.matchEnded), [matches]);
  const upcomingMatches = useMemo(() => matches.filter((m) => !m.matchStarted && !m.matchEnded), [matches]);
  const completedMatches = useMemo(() => matches.filter((m) => m.matchEnded), [matches]);
  const featuredMatch = liveMatches[0] || matches[0];

  const filteredMatches = useMemo(() => {
    if (filter === 'live') return liveMatches;
    if (filter === 'upcoming') return upcomingMatches;
    if (filter === 'completed') return completedMatches;
    return matches;
  }, [filter, matches, liveMatches, upcomingMatches, completedMatches]);

  const FILTERS = [
    { id: 'all', label: 'All Matches', count: matches.length },
    { id: 'live', label: 'Live Now', count: liveMatches.length, isLive: true },
    { id: 'upcoming', label: 'Upcoming', count: upcomingMatches.length },
    { id: 'completed', label: 'Completed', count: completedMatches.length },
  ];

  return (
    <div className="matches-page animate-fade-up">
      {/* Hero Broadcast Card */}
      {loading ? (
        <HeroSkeleton />
      ) : featuredMatch ? (
        <div className="hero-broadcast-card">
          <div className="hero-eyebrow">
            <span className="hero-live-chip">
              {featuredMatch.matchStarted && !featuredMatch.matchEnded ? (
                <>
                  <span className="live-pulse-ring" style={{ width: 8, height: 8 }}>
                    <span className="live-pulse-ring-outer" style={{ background: 'white' }} />
                    <span className="live-pulse-ring-inner" style={{ background: 'white', width: 8, height: 8 }} />
                  </span>
                  LIVE NOW
                </>
              ) : (
                '🏏 FEATURED'
              )}
            </span>
            {featuredMatch.venue && (
              <span>{featuredMatch.venue}</span>
            )}
          </div>

          <div className="hero-teams-grid">
            <div>
              <div className="hero-team-name">{featuredMatch.teamA}</div>
              <div className={`hero-team-score${featuredMatch.matchStarted && !featuredMatch.matchEnded && featuredMatch.scoreA ? ' live-batting' : ''}`}>
                <ScoreDisplay score={featuredMatch.scoreA} size="xl" />
              </div>
            </div>
            <div className="hero-vs-badge">VS</div>
            <div style={{ textAlign: 'right' }}>
              <div className="hero-team-name">{featuredMatch.teamB}</div>
              <div className={`hero-team-score${featuredMatch.matchStarted && !featuredMatch.matchEnded ? ' live-batting' : ''}`}>
                <ScoreDisplay score={featuredMatch.scoreB} size="xl" highlight={featuredMatch.matchStarted && !featuredMatch.matchEnded} />
              </div>
            </div>
          </div>

          <div className="hero-footer">
            <div className="hero-status-text">
              ⚡ {featuredMatch.status || (featuredMatch.matchStarted ? 'Live Match in Progress' : 'Upcoming Match')}
            </div>
            <Link
              to={`/match-center/${featuredMatch.matchId || featuredMatch._id}`}
              className="hero-cta-btn"
            >
              {featuredMatch.matchStarted && !featuredMatch.matchEnded ? 'Watch Live Center' : 'View Match'} →
            </Link>
          </div>
        </div>
      ) : null}

      {/* Filter Segment Control */}
      <div className="filter-segment">
        {FILTERS.map(({ id, label, count, isLive: liveTab }) => (
          <button
            key={id}
            className={`segment-btn${filter === id ? (liveTab ? ' active live-tab' : ' active') : ''}`}
            onClick={() => setFilter(id)}
          >
            {liveTab && filter === id && <span className="live-dot" />}
            {label}
            <span className="segment-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Matches Grid */}
      {loading ? (
        <div className="matches-grid">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : filter === 'all' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {liveMatches.length > 0 && (
            <div>
              <div className="section-band live">
                <span className="section-band-dot live" />
                Live Matches ({liveMatches.length})
              </div>
              <div className="matches-grid">
                {liveMatches.map((m) => <MatchCard key={m.matchId || m._id} match={m} />)}
              </div>
            </div>
          )}
          {upcomingMatches.length > 0 && (
            <div>
              <div className="section-band">
                <span className="section-band-dot" style={{ background: 'var(--text-secondary)' }} />
                Upcoming ({upcomingMatches.length})
              </div>
              <div className="matches-grid">
                {upcomingMatches.map((m) => <MatchCard key={m.matchId || m._id} match={m} />)}
              </div>
            </div>
          )}
          {completedMatches.length > 0 && (
            <div>
              <div className="section-band">
                <span className="section-band-dot" style={{ background: 'var(--text-muted)' }} />
                Recent Results ({completedMatches.length})
              </div>
              <div className="matches-grid">
                {completedMatches.map((m) => <MatchCard key={m.matchId || m._id} match={m} />)}
              </div>
            </div>
          )}
          {matches.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🏏</div>
              <div className="empty-state-title">No matches available</div>
              <div className="empty-state-desc">Check back soon for upcoming tournaments and live fixtures.</div>
            </div>
          )}
        </div>
      ) : (
        <div className="matches-grid">
          {filteredMatches.length > 0 ? (
            filteredMatches.map((m) => <MatchCard key={m.matchId || m._id} match={m} />)
          ) : (
            <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-state-icon">🏏</div>
              <div className="empty-state-title">No {filter} matches</div>
              <div className="empty-state-desc">Check back soon for updates.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Matches;
