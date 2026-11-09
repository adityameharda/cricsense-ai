import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMatches, refreshMatches } from '../store/matchesStore';
import {
  isWomenMatch, getFormat, isLive, isUpcoming, isCompleted, splitByPriority,
} from '../utils/matchCategories';
import Icon from './common/Icons';
import ScoreDisplay from './common/ScoreDisplay';
import { CardSkeleton, HeroSkeleton } from './common/Skeletons';
import { formatToIST } from '../utils/formatTime';

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

const EMPTY_SCORE = '0/0 (0)';
const inningsCount = (s) => (!s || s === EMPTY_SCORE ? 0 : String(s).split('&').length);

// What to show for a side: nothing before the match starts, "Yet to bat" until they bat.
const scoreText = (m, score) => {
  if (!m.matchStarted) return '';
  if (!score || score === EMPTY_SCORE) return m.matchEnded ? '—' : 'Yet to bat';
  return score;
};

// The side batting now is the one with the most recent innings.
const battingSide = (m) => {
  if (!m.matchStarted || m.matchEnded) return null;
  const a = inningsCount(m.scoreA);
  const b = inningsCount(m.scoreB);
  if (a === 0 && b === 0) return null;
  return b >= a && b > 0 ? 'B' : 'A';
};

const MatchCard = React.memo(({ match }) => {
  const id = match.matchId || match._id;
  const isLive = match.matchStarted && !match.matchEnded;
  const isEnded = match.matchEnded;

  const flagA = match.teamALogo || getFlagUrl(match.teamA);
  const flagB = match.teamBLogo || getFlagUrl(match.teamB);

  const displayStatus = formatToIST(match.status);

  return (
    <div className={`match-card ${isLive ? 'is-live' : ''}`}>
      {/* Eyebrow */}
      <div className="card-eyebrow">
        <span className="card-venue-text">
          <Icon name="mappin" size={12} /> {match.venue || 'TBD'} · {match.matchType || 'T20'}
        </span>
        {isLive ? (
          <span className="status-pill live">
            <span className="live-dot" />
            LIVE
          </span>
        ) : isEnded ? (
          <span className="status-pill final">
            <Icon name="trophy" size={11} /> FINAL
          </span>
        ) : (
          <span className="status-pill upcoming">
            <Icon name="clock" size={11} /> UPCOMING
          </span>
        )}
      </div>

      {/* Teams Block */}
      <Link to={`/match-center/${id}`} className="card-teams-link">
        <div className="card-teams-block">
          {[
            { name: match.teamA, score: scoreText(match, match.scoreA), flag: flagA, isBatting: battingSide(match) === 'A' },
            { name: match.teamB, score: scoreText(match, match.scoreB), flag: flagB, isBatting: battingSide(match) === 'B' },
          ].map(({ name, score, flag, isBatting }) => (
            <div key={name} className="card-team-row">
              <div className="team-info-side">
                {flag ? (
                  <img src={flag} alt={name} className="team-flag-img" width="32" height="24" loading="lazy" decoding="async" />
                ) : (
                  <div className="team-flag-mono">{name?.slice(0, 2).toUpperCase()}</div>
                )}
                <span className="team-name-label">{name}</span>
              </div>
              <span className={`team-score-value ${isBatting ? 'batting' : ''}`}>
                <ScoreDisplay score={score} size="sm" highlight={!!isBatting} />
              </span>
            </div>
          ))}
        </div>
      </Link>

      {/* Status line */}
      {displayStatus && (
        <div className="card-status-line">
          <Icon name="zap" size={12} color="var(--color-primary)" />
          <span>{displayStatus}</span>
        </div>
      )}

      {/* Actions */}
      <div className="card-actions">
        <Link to={`/match-center/${id}`} className="card-btn primary" title={isLive ? 'Live Match Center' : 'View Full Scorecard'}>
          <Icon name={isLive ? "zap" : "activity"} size={12} />
          <span>{isLive ? 'Live' : 'Scorecard'}</span>
        </Link>
        {!match.matchStarted && (
          <Link to={`/build-team/${id}`} className="card-btn secondary" title="Build Fantasy Team">
            <Icon name="cricket" size={12} />
            <span>Fantasy</span>
          </Link>
        )}
        <Link to={`/leaderboard/${id}`} className="card-btn secondary" title="Leaderboard">
          <Icon name="trophy" size={12} />
          <span>Board</span>
        </Link>
      </div>
    </div>
  );
});

// Remember the viewer's Men/Women and format choice between visits.
const readPref = (key, fallback) => {
  try { return localStorage.getItem(`striker:pref:${key}`) || fallback; } catch { return fallback; }
};
const writePref = (key, value) => {
  try { localStorage.setItem(`striker:pref:${key}`, value); } catch { /* ignore */ }
};

// True when the first load is taking long (the free server is waking up).
const useSlowStart = (loaded) => {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (loaded) { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, [loaded]);
  return slow;
};

const PAGE_SIZE = 12;

// One horizontal row of cards, rendered a page at a time.
const MatchRow = ({ matches }) => {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shown = matches.slice(0, limit);
  const remaining = matches.length - shown.length;
  return (
    <div className="matches-grid">
      {shown.map((m) => <MatchCard key={m.matchId || m._id} match={m} />)}
      {remaining > 0 && (
        <button type="button" className="show-more-tile" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
          <Icon name="plus" size={18} />
          <span>Show {Math.min(remaining, PAGE_SIZE)} more</span>
          <small>{remaining} remaining</small>
        </button>
      )}
    </div>
  );
};

const MatchSection = ({ title, icon, live, groups }) => {
  const total = groups.top.length + groups.other.length;
  return (
    <div>
      <div className={`section-band ${live ? 'live' : ''}`}>
        {live && <span className="section-band-dot live" />}
        <Icon name={icon} size={15} color={live ? 'var(--color-live)' : 'var(--text-secondary)'} />
        <span>{title} ({total})</span>
      </div>
      {total === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="cricket" size={36} color="var(--text-muted)" />
          </div>
          <div className="empty-state-title">No matches here</div>
          <div className="empty-state-desc">Try another format or check back soon.</div>
        </div>
      ) : (
        <>
          {groups.top.length > 0 && (
            <>
              {groups.other.length > 0 && <div className="tier-label">Top teams</div>}
              <MatchRow matches={groups.top} />
            </>
          )}
          {groups.other.length > 0 && (
            <>
              {groups.top.length > 0 && <div className="tier-label">Other matches</div>}
              <MatchRow matches={groups.other} />
            </>
          )}
        </>
      )}
    </div>
  );
};

const FORMATS = [
  { id: 'all', label: 'All' },
  { id: 'T20', label: 'T20' },
  { id: 'ODI', label: 'ODI' },
  { id: 'TEST', label: 'Test' },
];

export const Matches = ({ user }) => {
  const { matches: allMatches, loaded, error } = useMatches();
  const [filter, setFilter] = useState('all');
  const [gender, setGender] = useState(() => readPref('gender', 'men'));
  const [format, setFormat] = useState(() => readPref('format', 'all'));
  const slowStart = useSlowStart(loaded);

  useEffect(() => { writePref('gender', gender); }, [gender]);
  useEffect(() => { writePref('format', format); }, [format]);

  const loading = !loaded && allMatches.length === 0;

  // Men's / Women's first, then format.
  const genderMatches = useMemo(
    () => allMatches.filter((m) => isWomenMatch(m) === (gender === 'women')),
    [allMatches, gender]
  );
  const matches = useMemo(
    () => (format === 'all' ? genderMatches : genderMatches.filter((m) => getFormat(m) === format)),
    [genderMatches, format]
  );

  const liveMatches = useMemo(() => splitByPriority(matches.filter(isLive), 'desc'), [matches]);
  const upcomingMatches = useMemo(() => splitByPriority(matches.filter(isUpcoming), 'asc'), [matches]);
  const completedMatches = useMemo(() => splitByPriority(matches.filter(isCompleted), 'desc'), [matches]);

  const countOf = (g) => g.top.length + g.other.length;
  const liveCount = countOf(liveMatches);
  const upcomingCount = countOf(upcomingMatches);
  const completedCount = countOf(completedMatches);

  // Hero: biggest live match, else biggest upcoming one, else latest result.
  const featuredMatch =
    liveMatches.top[0] || upcomingMatches.top[0] || liveMatches.other[0] ||
    completedMatches.top[0] || upcomingMatches.other[0] || completedMatches.other[0];

  const formatCounts = useMemo(() => {
    const c = { all: genderMatches.length, T20: 0, ODI: 0, TEST: 0 };
    genderMatches.forEach((m) => { const f = getFormat(m); if (f in c) c[f] += 1; });
    return c;
  }, [genderMatches]);

  const FILTERS = [
    { id: 'all', label: 'All Matches', count: matches.length, icon: 'cricket' },
    { id: 'live', label: 'Live Now', count: liveCount, isLive: true, icon: 'zap' },
    { id: 'upcoming', label: 'Upcoming', count: upcomingCount, icon: 'calendar' },
    { id: 'completed', label: 'Completed', count: completedCount, icon: 'trophy' },
  ];

  const SECTIONS = [
    { id: 'live', title: 'Live Matches', icon: 'zap', live: true, groups: liveMatches },
    { id: 'upcoming', title: 'Upcoming Matches', icon: 'calendar', groups: upcomingMatches },
    { id: 'completed', title: 'Recent Results', icon: 'trophy', groups: completedMatches },
  ];
  const visibleSections = SECTIONS.filter(
    (s) => (filter === 'all' || filter === s.id) && (filter !== 'all' || countOf(s.groups) > 0)
  );
  const resetKey = `${gender}-${format}-${filter}`;

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
                <>
                  <Icon name="trophy" size={13} color="white" />
                  <span>FEATURED MATCH</span>
                </>
              )}
            </span>
            {featuredMatch.venue && (
              <span className="hero-venue-tag">
                <Icon name="mappin" size={13} /> {featuredMatch.venue}
              </span>
            )}
          </div>

          <div className="hero-teams-grid">
            <div className="hero-team-side">
              <div className="hero-team-name">{featuredMatch.teamA}</div>
              <div className={`hero-team-score ${battingSide(featuredMatch) === 'A' ? 'live-batting' : ''}`}>
                <ScoreDisplay score={scoreText(featuredMatch, featuredMatch.scoreA)} size="hero" highlight={battingSide(featuredMatch) === 'A'} />
              </div>
            </div>

            <div className="hero-vs-badge">VS</div>

            <div className="hero-team-side is-right">
              <div className="hero-team-name">{featuredMatch.teamB}</div>
              <div className={`hero-team-score ${battingSide(featuredMatch) === 'B' ? 'live-batting' : ''}`}>
                <ScoreDisplay score={scoreText(featuredMatch, featuredMatch.scoreB)} size="hero" highlight={battingSide(featuredMatch) === 'B'} />
              </div>
            </div>
          </div>

          <div className="hero-footer">
            <div className="hero-status-text">
              <Icon name="bolt" size={14} color="#60a5fa" />
              <span>{formatToIST(featuredMatch.status) || (featuredMatch.matchStarted ? 'Live Match in Progress' : 'Upcoming Fixture')}</span>
            </div>
            <Link
              to={`/match-center/${featuredMatch.matchId || featuredMatch._id}`}
              className="hero-cta-btn"
            >
              <span>{featuredMatch.matchStarted && !featuredMatch.matchEnded ? 'Watch Live Center' : 'View Match Center'}</span>
              <Icon name="arrow-right" size={14} />
            </Link>
          </div>
        </div>
      ) : null}

      {/* Private Contest Banner */}
      <div style={{
        background: '#f8fafc',
        border: '1.5px solid #e2e8f0',
        borderRadius: 14,
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 8, background: '#eff6ff',
            color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon name="trophy" size={16} />
          </span>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }}>Play Fantasy with Friends</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Create private leagues or join with your friend's room code. <em>(You must be logged in to create or join a contest.)</em></div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/create-contest" className="top-back-btn" style={{ padding: '6px 14px', fontSize: 12 }}>
            <Icon name="plus" size={13} />
            <span>Create Contest</span>
          </Link>
          <Link to="/create-contest?tab=join" className="top-back-btn-sub" style={{ padding: '6px 14px', fontSize: 12 }}>
            <Icon name="key" size={13} />
            <span>Join with Code</span>
          </Link>
        </div>
      </div>

      {/* Filter Segment Control */}
      <div className="filter-segment">
        {FILTERS.map(({ id, label, count, isLive: liveTab, icon }) => (
          <button
            key={id}
            className={`segment-btn ${filter === id ? (liveTab ? 'active live-tab' : 'active') : ''}`}
            onClick={() => setFilter(id)}
          >
            <Icon name={icon} size={14} />
            {liveTab && filter === id && <span className="live-dot" />}
            <span>{label}</span>
            <span className="segment-count">{count}</span>
          </button>
        ))}
      </div>

      {/* Men's / Women's + format */}
      <div className="match-filters-row">
        <div className="gender-toggle" role="tablist" aria-label="Men's or women's cricket">
          {[{ id: 'men', label: "Men's" }, { id: 'women', label: "Women's" }].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={gender === id}
              className={`gender-btn ${gender === id ? 'active' : ''}`}
              onClick={() => setGender(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="format-chips" role="tablist" aria-label="Match format">
          {FORMATS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={format === id}
              className={`format-chip ${format === id ? 'active' : ''}`}
              onClick={() => setFormat(id)}
            >
              <span>{label}</span>
              <span className="format-chip-count">{formatCounts[id]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Matches Grid */}
      {loading ? (
        <>
          {slowStart && (
            <div className="wake-note">
              <span className="spinner" />
              <span>Connecting to the live score server… the first load can take a few seconds.</span>
            </div>
          )}
          <div className="matches-grid">
            {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
          </div>
        </>
      ) : allMatches.length === 0 && error ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Icon name="cricket" size={40} color="var(--color-primary)" />
          </div>
          <div className="empty-state-title">Couldn't load matches</div>
          <div className="empty-state-desc">
            <button type="button" className="top-back-btn" onClick={refreshMatches}>Try again</button>
          </div>
        </div>
      ) : (
        <div key={resetKey} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {visibleSections.map((s) => (
            <MatchSection key={s.id} title={s.title} icon={s.icon} live={s.live} groups={s.groups} />
          ))}
          {filter === 'all' && matches.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="cricket" size={40} color="var(--color-primary)" />
              </div>
              <div className="empty-state-title">No Matches Available</div>
              <div className="empty-state-desc">Try another format, or check back soon for new fixtures.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Matches;
