/**
 * CricSense: answers cricket questions using only real data.
 *
 * Retrieval sources (all live, nothing hardcoded):
 *  - the match record in MongoDB (teams, score, status, venue, format, start time)
 *  - the Cricbuzz scorecard + live telemetry (batters, bowlers, run rates, recent balls)
 *  - the Cricbuzz squads (roles, captains, keepers, announced playing XI)
 *  - Cricbuzz player profiles (career stats per format, rankings, recent scores)
 *  - fantasy points already calculated for this match (MatchPoint)
 *
 * How a question is resolved:
 *  1. Teams named in the question ("Ind", "Aussies", "Proteas", "Perth"...) pick the match.
 *  2. Otherwise the match from the previous answer (conversation memory), then the
 *     match page the user is on.
 *  3. Players named in the question are looked up in that match's squads/scorecard,
 *     then in the national teams' Cricbuzz player lists. "he"/"his" refer to the
 *     player from the previous answer.
 *
 * With GEMINI_API_KEY set, the retrieved facts and the recent conversation go to
 * Gemini (newest Flash model available to the key, or GEMINI_MODEL) with strict
 * instructions not to invent anything. Without a key, a deterministic answer is
 * built from the same facts.
 */
const axios = require('axios');
const Match = require('../models/match');
const MatchPoint = require('../models/matchPoint');
const cricketService = require('./cricketLiveService');
const players = require('./playerService');
const retrieval = require('./retrieval');
const matchRecords = require('./matchRecords');
const appGuide = require('../knowledge/appGuide');
const { teamMentionScore, teamsMentioned, mentionsWomen, isWomenTeam } = require('../helpers/teamAliases');

const LIST_FIELDS = 'matchId teamA teamB scoreA scoreB status matchStarted matchEnded venue date startTime matchType';

// ── Intent detection ───────────────────────────────────────────────
function detectIntent(query = '') {
  const q = query.toLowerCase();
  if (/\b(captain|vice|fantasy|dream|pick|picks|points|lineup|line-up)\b/.test(q)) return 'fantasy';
  if (/\b(win|winning|chance|predict|probability|favourite|favorite|who will|equation|need)\b/.test(q)) return 'equation';
  if (/\b(pitch|dew|ground|weather|conditions|par score|venue|stadium|where)\b/.test(q)) return 'venue';
  if (/\b(squad|squads|playing xi|playing 11|xi|team news|players)\b/.test(q)) return 'squads';
  if (/\b(top scorer|best bowler|scorecard|batting|bowling|wickets|runs|performers?)\b/.test(q)) return 'scorecard';
  if (/\b(when|start|starts|starting|time|begin)\b/.test(q)) return 'start';
  return 'summary';
}

const LIST_RE = /\b(which|what|any|all)\b.*\bmatch(es)?\b|\blive matches\b|\bmatches (today|now|live|on)\b|\bschedule\b|\bfixtures\b|\bwhat'?s on\b/i;
const PAST_RE = /\b(result|won|win\b.*\blast|who won|last match|previous|yesterday|final score)\b/i;
const PRONOUN_RE = /\b(he|his|him|he's|she|her|she's)\b/i;

// ── Match retrieval ────────────────────────────────────────────────
const stateRank = (m) => (m.matchStarted && !m.matchEnded ? 0 : !m.matchStarted && !m.matchEnded ? 1 : 2);
const timeOf = (m) => m.startTime || (m.date ? Date.parse(m.date) : 0) || 0;

async function matchesNamedIn(query) {
  const all = await Match.find({}, LIST_FIELDS).lean();
  const women = mentionsWomen(query);
  let scored = all
    .map((m) => ({ m, score: teamMentionScore(query, m.teamA) + teamMentionScore(query, m.teamB) }))
    .filter((x) => x.score > 0);
  if (!scored.length) return [];

  // Men's unless the question says women ("India women", "IND-W", "White Ferns")
  const genderOk = scored.filter((x) => (isWomenTeam(x.m.teamA) || isWomenTeam(x.m.teamB)) === women);
  if (genderOk.length) scored = genderOk;

  const pastFirst = PAST_RE.test(query);
  const now = Date.now();
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ra = pastFirst ? (stateRank(a.m) === 2 ? -1 : stateRank(a.m)) : stateRank(a.m);
    const rb = pastFirst ? (stateRank(b.m) === 2 ? -1 : stateRank(b.m)) : stateRank(b.m);
    if (ra !== rb) return ra - rb;
    // upcoming: soonest first; completed: most recent first
    if (stateRank(a.m) === 1) return Math.abs(timeOf(a.m) - now) - Math.abs(timeOf(b.m) - now);
    return timeOf(b.m) - timeOf(a.m);
  });
  return scored.map((x) => x.m);
}

async function loadMatch(id) {
  if (!id) return null;
  const m = await Match.findOne({ matchId: String(id) }, '-__v').lean();
  // A match with runs on the board has started, whatever the flag says (older code marked
  // Tests at Stumps/Lunch/Tea as "not started")
  if (m && !m.matchStarted && [m.scoreA, m.scoreB].some((s) => s && !/^(0\/0 \(0(\.0)?\))?$/.test(String(s).trim()))) {
    m.matchStarted = true;
  }
  return m;
}

/**
 * Pick the match a question is about.
 * Teams named in the question win; otherwise the conversation's last match, then the page's.
 */
async function resolveMatch(query, { pageMatchId, lastMatchId, named }) {
  if (named.length) {
    // If the page's or the conversation's match involves the named team, stay on it
    for (const id of [lastMatchId, pageMatchId]) {
      const hit = id && named.find((m) => String(m.matchId) === String(id));
      if (hit && teamMentionScore(query, hit.teamA) + teamMentionScore(query, hit.teamB) >=
        teamMentionScore(query, named[0].teamA) + teamMentionScore(query, named[0].teamB)) {
        return { match: await loadMatch(hit.matchId), how: 'named' };
      }
    }
    return { match: await loadMatch(named[0].matchId), how: 'named' };
  }
  for (const [id, how] of [[lastMatchId, 'conversation'], [pageMatchId, 'page']]) {
    const m = await loadMatch(id);
    if (m) return { match: m, how };
  }
  return { match: null, how: 'none' };
}

// ── Context building (real data only) ──────────────────────────────
const playerName = (p) => (typeof p === 'object' && p ? p.name || '' : String(p || ''));

async function buildMatchContext(match) {
  const ctx = { match, scorecard: null, squads: null, fantasyTop: [] };
  const jobs = [];
  if (match.matchStarted) {
    jobs.push(cricketService.fetchMatchScorecard(match.matchId).then((s) => { ctx.scorecard = s; }).catch(() => {}));
    jobs.push(MatchPoint.find({ matchId: match.matchId }).sort({ points: -1 }).limit(5).lean()
      .then((r) => { ctx.fantasyTop = r; }).catch(() => {}));
  }
  if (!match.matchEnded) {
    jobs.push(cricketService.fetchMatchSquads(match.matchId, match).then((s) => { ctx.squads = s; }).catch(() => {}));
  }
  await Promise.all(jobs);
  return ctx;
}

/** Everyone involved in this match, with Cricbuzz ids (squads + scorecard). */
function matchPeople(ctx) {
  if (!ctx) return [];
  const m = ctx.match;
  const people = [
    ...(ctx.squads?.squadA || []).map((p) => ({ id: p.id, name: p.name, team: m.teamA })),
    ...(ctx.squads?.squadB || []).map((p) => ({ id: p.id, name: p.name, team: m.teamB })),
  ];
  for (const inn of ctx.scorecard?.innings || []) {
    for (const b of inn.batting || []) people.push({ id: b.id, name: b.batsman, team: inn.teamName });
    for (const b of inn.bowling || []) people.push({ id: b.id, name: b.bowler, team: '' });
  }
  return people.filter((p) => p.id);
}

/**
 * Which player is the question about?
 * Match squads/scorecard first, then national-team player lists, then "he/his" → last player.
 */
async function resolvePlayer(query, ctx, { lastPlayerId, matchNamed }) {
  const fromMatch = players.findPlayers(query, matchPeople(ctx));
  if (fromMatch.best || fromMatch.ambiguous.length) return fromMatch;

  // Beyond the match: only when it reads like a player question, or nothing else matched
  if (players.looksLikePlayerQuestion(query) || !matchNamed) {
    const teams = teamsMentioned(query);
    if (ctx?.match) teams.push(ctx.match.teamA, ctx.match.teamB);
    let found = players.findPlayers(query, await players.directoryFor(teams));
    if (!found.best && !found.ambiguous.length && teams.length) {
      found = players.findPlayers(query, await players.directoryFor([]));
    }
    if (found.best || found.ambiguous.length) return found;
  }

  if (lastPlayerId && PRONOUN_RE.test(query)) return { best: { id: String(lastPlayerId) }, ambiguous: [], carried: true };
  return { best: null, ambiguous: [] };
}

// What the player did in this match (scorecard) and whether they're in the XI
function playerInMatch(ctx, profile) {
  if (!ctx || !profile) return [];
  const same = (id, name) => (id && String(id) === String(profile.id)) || (name && name.toLowerCase() === profile.name.toLowerCase());
  const out = [];
  for (const inn of ctx.scorecard?.innings || []) {
    for (const b of inn.batting || []) {
      if (same(b.id, b.batsman)) out.push(`Batting in ${inn.inning}: ${b.r} (${b.b}), ${b['4s']}x4, ${b['6s']}x6, ${b.dismissal}`);
    }
    for (const b of inn.bowling || []) {
      if (same(b.id, b.bowler)) out.push(`Bowling in ${inn.inning}: ${b.w}/${b.r} in ${b.o} overs (econ ${b.eco})`);
    }
  }
  const ms = ctx.scorecard?.miniscore;
  if (ms && !ctx.match.matchEnded) {
    for (const p of [ms.striker, ms.nonStriker]) if (p?.name && same(null, p.name)) out.push(`At the crease now: ${p.runs ?? '?'} (${p.balls ?? '?'})`);
    if (ms.bowler?.name && same(null, ms.bowler.name)) out.push(`Bowling now: ${ms.bowler.wickets ?? 0}-${ms.bowler.runs ?? 0} (${ms.bowler.overs ?? 0} ov)`);
  }
  const squadEntry = [...(ctx.squads?.squadA || []), ...(ctx.squads?.squadB || [])].find((p) => same(p.id, p.name));
  if (squadEntry && !ctx.match.matchStarted) {
    out.push(squadEntry.playingXI === true ? 'In the announced playing XI' : squadEntry.playingXI === false ? 'On the bench (not in the playing XI)' : 'In the squad (playing XI not announced yet)');
  }
  return out;
}

function matchFacts(ctx) {
  const { match: m, scorecard: sc, squads, fantasyTop } = ctx;
  const lines = [];
  lines.push(`Match: ${m.teamA} vs ${m.teamB} (${m.matchType || 'format unknown'})`);
  lines.push(`Venue: ${m.venue || 'not available'}`);
  if (m.startTime) lines.push(`Scheduled start: ${new Date(m.startTime).toISOString()} (${istTime(m.startTime)} IST)`);
  lines.push(`State: ${m.matchEnded ? 'completed' : m.matchStarted ? 'in progress' : 'not started'}`);
  lines.push(`Status: ${m.status || 'not available'}`);
  if (m.matchStarted) lines.push(`Score: ${m.teamA} ${scoreOf(m.scoreA)} | ${m.teamB} ${scoreOf(m.scoreB)}`);

  const ms = sc?.miniscore;
  if (ms && !m.matchEnded) {
    if (ms.striker?.name) lines.push(`At the crease: ${ms.striker.name} ${ms.striker.runs ?? '?'} (${ms.striker.balls ?? '?'})${ms.nonStriker?.name ? `, ${ms.nonStriker.name} ${ms.nonStriker.runs ?? '?'} (${ms.nonStriker.balls ?? '?'})` : ''}`);
    if (ms.bowler?.name) lines.push(`Bowling: ${ms.bowler.name} ${ms.bowler.wickets ?? 0}-${ms.bowler.runs ?? 0} (${ms.bowler.overs ?? 0} ov)`);
    if (ms.currentRunRate != null) lines.push(`Current run rate: ${ms.currentRunRate}`);
    if (ms.requiredRunRate) lines.push(`Required run rate: ${ms.requiredRunRate}`);
    if (ms.target) lines.push(`Target: ${ms.target}`);
    if (ms.recentBalls) lines.push(`Recent balls: ${ms.recentBalls}`);
    if (ms.partnership?.runs != null) lines.push(`Partnership: ${ms.partnership.runs} (${ms.partnership.balls ?? '?'} balls)`);
  }

  (sc?.innings || []).forEach((inn) => {
    const bat = (inn.batting || []).map((b) => `${b.batsman} ${b.r} (${b.b}) ${b.dismissal}`).join('; ');
    const bowl = (inn.bowling || []).map((b) => `${b.bowler} ${b.w}-${b.r} (${b.o})`).join('; ');
    lines.push(`${inn.inning}: ${inn.runs}/${inn.wickets} (${inn.overs} ov). Batting: ${bat || 'n/a'}. Bowling: ${bowl || 'n/a'}`);
  });

  if (squads && (squads.squadA?.length || squads.squadB?.length)) {
    const describe = (team, list) => {
      const xi = list.filter((p) => p.playingXI === true);
      const shown = xi.length ? xi : list;
      return `${team} ${xi.length ? 'playing XI' : 'squad (XI not announced)'}: ` + shown.map((p) =>
        `${playerName(p)}${p.role ? ` [${p.role}]` : ''}${p.isCaptain ? ' (c)' : ''}${p.isKeeper ? ' (wk)' : ''}`
      ).join(', ');
    };
    lines.push(describe(m.teamA, squads.squadA || []));
    lines.push(describe(m.teamB, squads.squadB || []));
  }

  if (fantasyTop.length) {
    lines.push('Top fantasy scorers in this match: ' + fantasyTop.map((p) => `${p.playerName} ${p.points} pts`).join(', '));
  }
  return lines;
}

function playerFacts(profile, inMatch = []) {
  const lines = [`Player: ${profile.name}${profile.fullName !== profile.name ? ` (${profile.fullName})` : ''}`];
  lines.push(`Team: ${profile.team || 'n/a'} · Role: ${profile.role || 'n/a'} · Bats: ${profile.battingStyle || 'n/a'} · Bowls: ${profile.bowlingStyle || 'n/a'}`);
  if (profile.born) lines.push(`Born: ${profile.born}${profile.birthPlace ? `, ${profile.birthPlace}` : ''}`);
  for (const [fmt, s] of Object.entries(profile.batting)) {
    if (!s.Matches || s.Matches === '0') continue;
    lines.push(`Career batting ${fmt}: ${s.Matches} matches, ${s.Innings} inns, ${s.Runs} runs, HS ${s.Highest}, avg ${s.Average}, SR ${s.SR}, 100s ${s['100s']}, 50s ${s['50s']}, 4s ${s.Fours}, 6s ${s.Sixes}`);
  }
  for (const [fmt, s] of Object.entries(profile.bowling)) {
    if (!s.Wickets || s.Wickets === '0') continue;
    lines.push(`Career bowling ${fmt}: ${s.Wickets} wickets in ${s.Innings} inns, avg ${s.Avg}, econ ${s.Eco}, best ${s.BBI}, 5w ${s['5w']}`);
  }
  const rk = rankingText(profile.rankings);
  if (rk) lines.push(`ICC rankings: ${rk}`);
  if (profile.recentBatting.length) lines.push(`Recent batting: ${profile.recentBatting.map((r) => `${r.score} vs ${r.opp} (${r.format}, ${r.date})`).join('; ')}`);
  if (profile.recentBowling.length) lines.push(`Recent bowling: ${profile.recentBowling.map((r) => `${r.score} vs ${r.opp} (${r.format}, ${r.date})`).join('; ')}`);
  inMatch.forEach((l) => lines.push(`In the current match: ${l}`));
  return lines;
}

function rankingText(r = {}) {
  const parts = [];
  const label = { testRank: 'Test', odiRank: 'ODI', t20Rank: 'T20I', testBestRank: 'Test best', odiBestRank: 'ODI best', t20BestRank: 'T20I best' };
  for (const [kind, name] of [['batting', 'batting'], ['bowling', 'bowling'], ['allRounder', 'all-rounder']]) {
    const now = Object.entries(r[kind] || {}).filter(([k]) => !k.includes('Best')).map(([k, v]) => `${label[k] || k} #${v}`);
    const best = Object.entries(r[kind] || {}).filter(([k]) => k.includes('Best')).map(([k, v]) => `${label[k] || k} #${v}`);
    if (now.length || best.length) parts.push(`${name}: ${[...now, ...best].join(', ')}`);
  }
  return parts.join(' | ');
}

// Cricbuzz reports a side that hasn't batted as "0/0 (0)"
const scoreOf = (s) => (!s || /^0\/0 \(0(\.0)?\)$/.test(String(s).trim()) ? 'yet to bat' : s);
const istTime = (ms) => new Date(ms).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

// ── Deterministic answers (used when no LLM key is set) ────────────
function equationAnswer(ctx) {
  const { match: m, scorecard: sc } = ctx;
  if (m.matchEnded) return `🏁 **Result:** ${m.status || 'Result not available'}\n\n• ${m.teamA}: ${scoreOf(m.scoreA)}\n• ${m.teamB}: ${scoreOf(m.scoreB)}`;
  if (!m.matchStarted) {
    return `⏳ **${m.teamA} vs ${m.teamB}** hasn't started yet (${m.status || 'scheduled'}).\n\n` +
      'CricSense does not publish win percentages, because there is no verified model behind them. ' +
      'Once play starts I can give you the live equation: runs needed, balls left, run rates and wickets in hand.';
  }
  const ms = sc?.miniscore || {};
  const lines = [`📊 **State of play: ${m.teamA} vs ${m.teamB}**`, '', `• ${m.teamA}: ${scoreOf(m.scoreA)}`, `• ${m.teamB}: ${scoreOf(m.scoreB)}`, `• Status: ${m.status}`];
  if (ms.target) lines.push(`• Target: ${ms.target}`);
  if (ms.currentRunRate != null) lines.push(`• Current run rate: ${ms.currentRunRate}`);
  if (ms.requiredRunRate) lines.push(`• Required run rate: ${ms.requiredRunRate}`);
  if (ms.partnership?.runs != null) lines.push(`• Current partnership: ${ms.partnership.runs} (${ms.partnership.balls ?? '?'} balls)`);
  return lines.join('\n');
}

function fantasyAnswer(ctx) {
  const { match: m, squads, fantasyTop } = ctx;
  if (m.matchStarted) {
    if (!fantasyTop.length) {
      return `No fantasy points have been calculated for **${m.teamA} vs ${m.teamB}** yet (they are worked out for matches with contest entries). Here is how players are doing on the scorecard:\n\n` + scorecardAnswer(ctx);
    }
    return `⚡ **Top fantasy scorers so far (${m.teamA} vs ${m.teamB})**\n\n` +
      fantasyTop.map((p, i) => `${i + 1}. **${p.playerName}**: ${p.points} pts (${p.stats?.runs ?? 0} runs, ${p.stats?.wickets ?? 0} wkts, ${p.stats?.catches ?? 0} catches)`).join('\n') +
      (m.matchEnded ? '' : '\n\nTeam entries are locked because the match has started.');
  }
  const all = [...(squads?.squadA || []).map((p) => ({ ...p, team: m.teamA })), ...(squads?.squadB || []).map((p) => ({ ...p, team: m.teamB }))];
  if (!all.length) return `The squads for **${m.teamA} vs ${m.teamB}** haven't been announced yet. Check back closer to the start.`;
  const xiKnown = all.some((p) => p.playingXI === true);
  const pool = xiKnown ? all.filter((p) => p.playingXI) : all;
  const byRole = (r) => pool.filter((p) => p.fantasyRole === r).map((p) => `${p.name} (${p.team}${p.isCaptain ? ', c' : ''})`);
  return `🧢 **Fantasy picks for ${m.teamA} vs ${m.teamB}**\n\n` +
    (xiKnown ? '✅ Playing XIs are announced. Only these players will score points.\n\n' : '⚠️ Playing XIs are not announced yet. Players who are left out will score 0, so re-check after the toss.\n\n') +
    `• **All-rounders** (can score with bat and ball): ${byRole('ar').join(', ') || 'none listed'}\n` +
    `• **Wicket-keepers**: ${byRole('wk').join(', ') || 'none listed'}\n` +
    `• **Batters**: ${byRole('bat').join(', ') || 'none listed'}\n` +
    `• **Bowlers**: ${byRole('bowl').join(', ') || 'none listed'}\n\n` +
    'Your captain earns 2x points and your vice-captain 1.5x. Ask me about any player (for example "Kohli career stats") to compare form.';
}

function venueAnswer(ctx) {
  const { match: m, scorecard: sc } = ctx;
  const lines = [`🏟️ **${m.teamA} vs ${m.teamB}** is at **${m.venue || 'a venue not yet listed'}**`, ''];
  const first = sc?.innings?.[0];
  if (first) lines.push(`• First innings in this match: ${first.teamName} ${first.runs}/${first.wickets} (${first.overs} ov)`);
  lines.push('• CricSense has no verified pitch, weather or dew report for this ground, so it won\'t guess one.');
  return lines.join('\n');
}

function squadsAnswer(ctx) {
  const { match: m, squads } = ctx;
  if (!squads || (!squads.squadA?.length && !squads.squadB?.length)) {
    return m.matchEnded ? `**${m.teamA} vs ${m.teamB}** is completed. See the Scorecard tab for who played.` :
      `Squads for **${m.teamA} vs ${m.teamB}** aren't available yet.`;
  }
  const fmt = (team, list) => {
    const xi = list.filter((p) => p.playingXI === true);
    const shown = xi.length ? xi : list;
    return `**${team}** ${xi.length ? '(playing XI)' : '(squad)'}: ` + shown.map((p) => `${p.name}${p.isCaptain ? ' (c)' : ''}${p.isKeeper ? ' (wk)' : ''}`).join(', ');
  };
  return `${fmt(m.teamA, squads.squadA || [])}\n\n${fmt(m.teamB, squads.squadB || [])}`;
}

function scorecardAnswer(ctx) {
  const { match: m, scorecard: sc } = ctx;
  if (!sc?.innings?.length) return `There's no scorecard yet for **${m.teamA} vs ${m.teamB}** (${m.status || 'not started'}).`;
  return `📋 **${m.teamA} vs ${m.teamB}**: ${m.status}\n\n` + sc.innings.map((inn) => {
    const bat = [...inn.batting].sort((a, b) => (b.r || 0) - (a.r || 0)).slice(0, 3).map((b) => `${b.batsman} ${b.r} (${b.b})`).join(', ');
    const bowl = [...inn.bowling].sort((a, b) => (b.w || 0) - (a.w || 0) || (a.r || 0) - (b.r || 0)).slice(0, 3).map((b) => `${b.bowler} ${b.w}/${b.r}`).join(', ');
    return `**${inn.inning}**: ${inn.runs}/${inn.wickets} (${inn.overs} ov)\n• Top batters: ${bat || 'n/a'}\n• Top bowlers: ${bowl || 'n/a'}`;
  }).join('\n\n');
}

function startAnswer(ctx) {
  const { match: m } = ctx;
  if (m.matchEnded) return `**${m.teamA} vs ${m.teamB}** is over: ${m.status || 'result not available'}.`;
  if (m.matchStarted) return `**${m.teamA} vs ${m.teamB}** is already under way: ${m.status}.`;
  return `⏳ **${m.teamA} vs ${m.teamB}** (${(m.matchType || '').toUpperCase()}) starts ${m.startTime ? `**${istTime(m.startTime)} IST**` : 'at a time not yet published'}${m.venue ? ` at ${m.venue}` : ''}.`;
}

function summaryAnswer(ctx) {
  const { match: m, scorecard: sc } = ctx;
  if (!m.matchStarted) return startAnswer(ctx) + (m.status ? `\n\n${m.status}` : '');
  const ms = sc?.miniscore;
  const lines = [`🏏 **${m.teamA} vs ${m.teamB}**: ${m.status}`, '', `• ${m.teamA}: ${scoreOf(m.scoreA)}`, `• ${m.teamB}: ${scoreOf(m.scoreB)}`];
  if (ms && !m.matchEnded) {
    if (ms.striker?.name) lines.push(`• At the crease: ${ms.striker.name} ${ms.striker.runs ?? ''}${ms.striker.balls != null ? ` (${ms.striker.balls})` : ''}${ms.nonStriker?.name ? `, ${ms.nonStriker.name} ${ms.nonStriker.runs ?? ''}${ms.nonStriker.balls != null ? ` (${ms.nonStriker.balls})` : ''}` : ''}`);
    if (ms.bowler?.name) lines.push(`• Bowling: ${ms.bowler.name} ${ms.bowler.wickets ?? 0}-${ms.bowler.runs ?? 0} (${ms.bowler.overs ?? 0} ov)`);
    if (ms.recentBalls) lines.push(`• Recent: ${ms.recentBalls}`);
  }
  return lines.join('\n');
}

const ANSWERS = {
  equation: equationAnswer, fantasy: fantasyAnswer, venue: venueAnswer, squads: squadsAnswer,
  scorecard: scorecardAnswer, start: startAnswer, summary: summaryAnswer,
};

function playerAnswer(profile, query, inMatch = []) {
  const q = query.toLowerCase();
  const wantFmt = /\btests?\b/.test(q) ? 'Test' : /\bodis?\b|one.?day/.test(q) ? 'ODI' : /\bipl\b/.test(q) ? 'IPL' : /\bt20i?s?\b/.test(q) ? 'T20I' : null;
  const lines = [`👤 **${profile.name}** (${[profile.team, profile.role].filter(Boolean).join(' · ')})`];
  const style = [profile.battingStyle, profile.bowlingStyle].filter(Boolean).join(', ');
  if (style) lines.push(style);
  if (inMatch.length) lines.push('', '**In this match**', ...inMatch.map((l) => `• ${l}`));

  const fmts = (obj, key) => Object.entries(obj).filter(([f, s]) => (!wantFmt || f === wantFmt) && s[key] && s[key] !== '0');
  const bat = fmts(profile.batting, 'Matches');
  if (bat.length) {
    lines.push('', '**Career batting**');
    bat.forEach(([f, s]) => lines.push(`• **${f}**: ${s.Runs} runs in ${s.Matches} matches · avg ${s.Average} · SR ${s.SR} · ${s['100s']}×100, ${s['50s']}×50 · HS ${s.Highest}`));
  }
  const bowlWanted = /\b(bowl|bowling|wickets?|economy|spell)\b/.test(q) || /bowler|allrounder|all-rounder/i.test(profile.role);
  const bowl = fmts(profile.bowling, 'Wickets');
  if (bowl.length && (bowlWanted || bowl.some(([, s]) => Number(s.Wickets) >= 20))) {
    lines.push('', '**Career bowling**');
    bowl.forEach(([f, s]) => lines.push(`• **${f}**: ${s.Wickets} wkts · avg ${s.Avg} · econ ${s.Eco} · best ${s.BBI} · ${s['5w']}×5w`));
  }
  const rk = rankingText(profile.rankings);
  if (rk) lines.push('', `**ICC rankings**: ${rk}`);
  const recent = bowlWanted && profile.recentBowling.length ? profile.recentBowling : profile.recentBatting;
  if (recent.length) {
    lines.push('', `**Recent ${recent === profile.recentBowling ? 'bowling' : 'scores'}**: ` + recent.slice(0, 5).map((r) => `${r.score} vs ${r.opp} (${r.format})`).join(', '));
  }
  if (lines.length <= 2) lines.push('', 'No career stats are available for this player yet.');
  return lines.join('\n');
}

async function liveListAnswer() {
  const all = await Match.find({ matchEnded: { $ne: true } }, LIST_FIELDS).lean();
  const live = all.filter((m) => m.matchStarted).slice(0, 8);
  const next = all.filter((m) => !m.matchStarted && m.startTime).sort((a, b) => a.startTime - b.startTime).slice(0, 5);
  const lines = [];
  if (live.length) lines.push('🔴 **Live right now**', ...live.map((m) => `• ${m.teamA} vs ${m.teamB}: ${m.status}`));
  if (next.length) lines.push('', '⏳ **Coming up**', ...next.map((m) => `• ${m.teamA} vs ${m.teamB}: ${istTime(m.startTime)} IST`));
  return { text: lines.join('\n').trim() || 'No live or upcoming matches are listed right now.', facts: lines };
}

// ── LLM layer (grounded strictly in the retrieved facts) ───────────
const GEMINI_API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_MODEL_TRIES = 4;          // models tried per question before giving up
const MODEL_TIMEOUT_MS = 15000;     // per attempt; an overloaded model shouldn't stall the chat
const TOTAL_BUDGET_MS = 22000;      // after this, answer from the data without the LLM
const STICKY_MS = 60 * 60 * 1000;   // keep using a model that answered; retry newer ones hourly
const BENCH_MS = 15 * 60 * 1000;    // skip an overloaded/slow model for a while
const LLM_COOLDOWN_MS = 10 * 60 * 1000;

let modelList = { names: [], time: 0 }; // Flash models this key can call, newest first
let preferred = { name: null, time: 0 }; // last model that answered
const benchedUntil = new Map();          // model → time it may be tried again
let llmBlockedUntil = 0;                 // set after key/billing problems

/**
 * Flash models this API key can call, newest first (stable → -latest → -preview).
 * Read from the Gemini models list rather than hardcoded, refreshed every 12 hours.
 */
async function flashModels(key) {
  if (modelList.names.length && Date.now() - modelList.time < 12 * 60 * 60 * 1000) return modelList.names;
  try {
    const res = await axios.get(`${GEMINI_API}?pageSize=1000`, { headers: { 'x-goog-api-key': key }, timeout: 6000 });
    const usable = (res.data?.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
      .map((m) => m.name.replace(/^models\//, ''));
    const version = (n) => parseFloat((n.match(/^gemini-(\d+(?:\.\d+)?)/) || [])[1] || 0);
    const group = (re) => usable.filter((n) => re.test(n)).sort((a, b) => version(b) - version(a));
    const names = [
      ...group(/^gemini-\d+(\.\d+)?-flash$/),
      ...group(/^gemini-\d+(\.\d+)?-flash-latest$/),
      ...group(/^gemini-\d+(\.\d+)?-flash-preview$/),
    ];
    if (names.length) modelList = { names, time: Date.now() };
    return names;
  } catch (err) {
    console.warn('Gemini model list unavailable:', err.response?.status || err.message);
    return modelList.names;
  }
}

/** Order to try models in: GEMINI_MODEL if set; else the model that last answered, then newest first. */
async function modelsToTry(key) {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL];
  const names = await flashModels(key);
  const now = Date.now();
  const benched = (n) => (benchedUntil.get(n) || 0) > now;
  const ordered = [...names.filter((n) => !benched(n)), ...names.filter(benched)];
  if (preferred.name && now - preferred.time < STICKY_MS && names.includes(preferred.name)) {
    return [preferred.name, ...ordered.filter((n) => n !== preferred.name)];
  }
  return ordered;
}

const SYSTEM_PROMPT = [
  'You are CricSense, the cricket assistant on the Striker live-score and fantasy app.',
  'Answer using ONLY the latest message\'s LIVE DATA (fetched moments ago), its numbered SOURCES (retrieved from the CricSense knowledge base: ball-by-ball commentary, scorecards, results, player profiles and app rules) and the earlier conversation.',
  'Rules:',
  '- Never invent scores, statistics, records, percentages, pitch reports, weather, injuries or player form. If neither the data nor the sources contain the answer, say so plainly and suggest what you can answer instead.',
  '- When you use a SOURCE, cite it inline like [1] or [2]. Use LIVE DATA for the current score; use SOURCES for what happened earlier, commentary details, past results and app rules. Ignore sources that are not relevant to the question.',
  '- Do not give win probabilities or betting advice. If asked, say CricSense does not predict results, then share the live situation and the real record from the data. For fantasy questions you may compare players using the stats provided and explain the trade-offs, but the choice is the user\'s.',
  '- Follow-up questions ("what about him?", "and the squads?") refer to the match or player from the conversation.',
  '- Reply in the language the user writes in (English, Hindi or Hinglish).',
  '- Never mention or recommend any other website, app or data provider; just answer as CricSense.',
  '- Keep it short: 2 to 8 lines. Use **bold** for names and key numbers and "• " for bullet lines. No markdown tables or # headings.',
].join('\n');

async function askGemini(question, facts, history, sources = []) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.length < 16) return null;
  if (Date.now() < llmBlockedUntil) return null;
  const sourceBlock = sources.length
    ? `\n\nSOURCES:\n${sources.map((c, i) => `[${i + 1}] (${c.title})\n${c.text.slice(0, 3500)}`).join('\n\n')}`
    : '\n\nSOURCES: none found for this question.';
  const contents = [
    ...history.map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] })),
    { role: 'user', parts: [{ text: `LIVE DATA (retrieved ${new Date().toISOString()}):\n${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '- none for this question'}${sourceBlock}\n\nQUESTION: ${question}` }] },
  ];
  // Gemini requires the conversation to start with a user turn
  while (contents.length && contents[0].role !== 'user') contents.shift();

  const candidates = (await modelsToTry(key)).slice(0, MAX_MODEL_TRIES);
  let allRateLimited = candidates.length > 0;

  const deadline = Date.now() + TOTAL_BUDGET_MS;
  for (const model of candidates) {
    const timeLeft = deadline - Date.now();
    if (timeLeft < 3000) { allRateLimited = false; break; }
    const generationConfig = { maxOutputTokens: 2048 };
    if (/^gemini-[3-9]/.test(model)) {
      // Answers are grounded summaries of the data: light thinking is enough and much faster
      generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    } else {
      generationConfig.temperature = 0.3; // Gemini 3+ works best at its default temperature
    }
    try {
      const res = await axios.post(
        `${GEMINI_API}/${model}:generateContent`,
        { systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }, contents, generationConfig },
        { timeout: Math.min(MODEL_TIMEOUT_MS, timeLeft), headers: { 'x-goog-api-key': key } }
      );
      const text = res.data?.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text).join('').trim();
      if (!text) { allRateLimited = false; continue; }
      if (preferred.name !== model) console.log(`CricSense: using ${model}`);
      preferred = { name: model, time: preferred.name === model ? preferred.time : Date.now() };
      return { text, model };
    } catch (err) {
      const status = err.response?.status;
      console.warn(`CricSense LLM (${model}) failed:`, status || err.code || err.message, (err.response?.data?.error?.message || '').slice(0, 160));
      // The key itself is unusable (wrong key, billing, permission): stop and pause
      if ([401, 402, 403].includes(status)) {
        llmBlockedUntil = Date.now() + LLM_COOLDOWN_MS;
        console.warn('CricSense: Gemini paused for 10 minutes (key or billing problem); using data-only answers.');
        return null;
      }
      if (status !== 429) allRateLimited = false;
      if (preferred.name === model) preferred = { name: null, time: 0 };
      // Not offered to this key: skip for 12h; overloaded/slow/quota: skip for 15 min
      benchedUntil.set(model, Date.now() + (status === 404 ? 12 * 60 * 60 * 1000 : BENCH_MS));
      // 404/400 (not available), 429 (this model's quota), 5xx (overloaded), timeout: try the next model
    }
  }
  if (allRateLimited) {
    llmBlockedUntil = Date.now() + LLM_COOLDOWN_MS;
    console.warn('CricSense: every Gemini model is rate-limited; paused for 10 minutes.');
  }
  return null;
}

// ── Question types answered from the knowledge base ────────────────
const RECORD_RE = /\b(win(ning)?\s*(percentage|%|rate|ratio|record)|win %|record|records against|head[\s-]*to[\s-]*head|h2h|track record|recent (results|form)|last \d+ (matches|games)|how many (matches|wins|games))\b/i;
const PREDICT_RE = /\b(probability|chances?|predict(ion)?|odds|who will win|favou?rites?)\b/i;
const STORY_RE = /\b(how did|what happened|how was|got out|get out|dismiss(ed|al)|dropped|review|drs|turning point|highlights?|key moments?|toss|pitch|conditions|team news|injur(y|ed)|report)\b/i;
const GUIDE_RE = /\b(points? (system|rules?|calculat\w*)|how (are|is) (fantasy )?points|scoring (system|rules)|how many points|rules?|how (do|can) i (join|create|play|build|enter|win)|entry fee|coins?|deadline|(entries|teams?) (close|lock)|captain (gets?|earns?|points)|vice[- ]captain (gets?|earns?)|what is cricsense)\b/i;
const STOP_WORDS = new Set(['what', 'when', 'where', 'which', 'with', 'that', 'this', 'about', 'they', 'them', 'from', 'were', 'there', 'their', 'have', 'happened', 'match', 'innings', 'over', 'overs', 'today', 'yesterday', 'tell', 'show', 'please', 'does', 'did', 'how', 'the', 'and', 'get', 'got']);

const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const teamsOf = (m) => [m.teamA, m.teamB].filter(Boolean).map((t) => t.toLowerCase());

const FORMAT_IN_QUERY = (q) => (/\btests?\b/i.test(q) ? 'TEST' : /\bodis?\b|one.?day/i.test(q) ? 'ODI' : /\bt20i?s?\b/i.test(q) ? 'T20' : null);

/** Win/loss records for the team(s) in the question (or in the match being discussed). */
async function recordsFor(q, match, asked, women) {
  let teams = asked.map((t) => titleCase(t) + (women ? ' Women' : ''));
  if (!teams.length && match) teams = [match.teamA, match.teamB];
  if (!teams.length) return [];
  const format = FORMAT_IN_QUERY(q);
  const jobs = [matchRecords.teamRecord(teams[0], { format })];
  const opponent = teams[1] || (match && [match.teamA, match.teamB].find((t) => t.toLowerCase() !== teams[0].toLowerCase()
    && [match.teamA, match.teamB].some((x) => x.toLowerCase() === teams[0].toLowerCase())));
  if (opponent) jobs.push(matchRecords.teamRecord(teams[0], { format, opponent }));
  return Promise.all(jobs);
}

function recordFacts(records) {
  return records.flatMap((r) => [
    matchRecords.recordText(r),
    ...r.recent.map((x) => `${r.team} recent: vs ${x.opponent} (${x.format}, ${x.date}): ${x.status}`),
  ]);
}

function recordAnswer(records, { predict, ctx } = {}) {
  const lines = [];
  if (predict) {
    lines.push('CricSense doesn\'t predict results or quote win probabilities. Here is the real record and the situation right now.', '');
    if (ctx?.match) lines.push(equationAnswer(ctx), '');
  }
  for (const r of records) {
    lines.push(`📈 ${matchRecords.recordText(r).replace(r.team, `**${r.team}**`)}`);
    if (r.recent.length && !r.opponent) {
      lines.push(...r.recent.map((x) => `• vs ${x.opponent} (${x.format}, ${x.date}): ${x.status}`));
    }
    lines.push('');
  }
  return lines.join('\n').trim();
}

function guideAnswer(chunks) {
  return chunks.filter((c) => c.type === 'guide').slice(0, 2)
    .map((c, i) => `📘 **${c.title}** [${i + 1}]\n${c.text.split('\n').slice(1).map((l) => `• ${l}`).join('\n')}`)
    .join('\n\n');
}

/**
 * App-rules questions still work when retrieval is unavailable (no key, quota pause):
 * rank the guide sections by keyword overlap instead of embeddings.
 */
function guideByKeywords(q) {
  const stems = [...new Set((q.toLowerCase().match(/[a-z]{3,}/g) || []).filter((w) => !STOP_WORDS.has(w)).map((w) => w.slice(0, 5)))];
  return appGuide
    .map((g) => {
      const body = `${g.title} ${g.text}`.toLowerCase();
      return { g, score: stems.reduce((n, st) => n + (body.includes(st) ? 1 : 0), 0) };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(({ g }) => ({ key: `guide:${g.id}`, type: 'guide', title: g.title, text: g.text, similarity: 0 }));
}

/** "How did Babar get out?": what the scorecard says, plus the matching commentary. */
function playerStoryAnswer(profile, inMatch, chunks) {
  const surname = profile.name.split(' ').pop().toLowerCase();
  const lines = [`👤 **${profile.name}** in this match`];
  inMatch.forEach((l) => lines.push(`• ${l}`));
  const idx = chunks.findIndex((c) => c.type === 'commentary' && c.text.toLowerCase().includes(surname));
  if (idx >= 0) {
    const hits = chunks[idx].text.split('\n').filter((l) => l.toLowerCase().includes(surname) && /\b(out|four|six|dropped|review|caught|bowled|lbw|edge)\b/i.test(l));
    if (hits.length) lines.push('', `**From the commentary** [${idx + 1}]`, ...hits.slice(0, 4).map((l) => `• ${l.slice(0, 300)}`));
  }
  return lines.join('\n');
}

function storyAnswer(q, chunks) {
  const words = (q.toLowerCase().match(/[a-z]{4,}/g) || []).filter((w) => !STOP_WORDS.has(w));
  const idx = chunks.findIndex((c) => c.type === 'commentary' || c.type === 'scorecard' || c.type === 'result');
  const c = chunks[idx >= 0 ? idx : 0];
  const lines = c.text.split('\n').slice(1).filter(Boolean);
  let picked = lines.filter((l) => words.some((w) => l.toLowerCase().includes(w)));
  if (!picked.length) picked = lines.filter((l) => /\b(out|four|six|dropped|review|wicket)\b/i.test(l));
  if (!picked.length) picked = lines.length ? lines : [c.text];
  return `📝 **${c.title}** [${(idx >= 0 ? idx : 0) + 1}]\n\n` + picked.slice(0, 6).map((l) => `• ${l.slice(0, 300)}`).join('\n');
}

// ── Entry point ────────────────────────────────────────────────────
/**
 * @param {object} p
 * @param {string} p.query        the question
 * @param {string} [p.pageMatchId] match page the user is on
 * @param {string} [p.lastMatchId] match the previous answer was about
 * @param {string} [p.lastPlayerId] player the previous answer was about
 * @param {{role:'user'|'assistant', text:string}[]} [p.history] recent conversation
 */
async function generateCricSenseResponse({ query, pageMatchId, lastMatchId, lastPlayerId, history = [] }) {
  const q = String(query || '').trim();
  const named = await matchesNamedIn(q);
  const namedTeams = named.length > 0;
  const isGuide = GUIDE_RE.test(q);

  // "Which matches are live?": no specific match needed
  if (LIST_RE.test(q) && !namedTeams && !isGuide) {
    const list = await liveListAnswer();
    const llm = await askGemini(q, list.facts, history, []);
    return { reply: llm?.text || list.text, retrievedContext: { source: sourceLabel(llm) } };
  }

  const { match, how } = await resolveMatch(q, { pageMatchId, lastMatchId, named });
  const asked = teamsMentioned(q);
  const women = mentionsWomen(q);
  const scopeTeams = match ? teamsOf(match) : asked.map((t) => (women ? `${t} women` : t));

  // Live data and the knowledge base are fetched in parallel
  const [ctx, rag] = await Promise.all([
    match ? buildMatchContext(match) : null,
    retrieval.retrieve(q, { matchId: match?.matchId, teams: scopeTeams, k: 4 }).catch((err) => {
      console.warn('RAG retrieval failed:', err.message);
      return { chunks: [], via: 'error' };
    }),
  ]);
  const chunks = rag.chunks || [];
  if (isGuide && !chunks.some((c) => c.type === 'guide')) chunks.unshift(...guideByKeywords(q));

  const found = isGuide ? { best: null, ambiguous: [] } : await resolvePlayer(q, ctx, { lastPlayerId, matchNamed: namedTeams });
  if (!found.best && found.ambiguous.length > 1) {
    const names = found.ambiguous.map((p) => `• ${p.name}${p.team ? ` (${p.team})` : ''}`).join('\n');
    return {
      reply: `Which player do you mean?\n\n${names}\n\nAsk again with the full name.`,
      retrievedContext: { ...matchContext(match), source: 'player-lookup' },
    };
  }
  const profile = found.best ? await players.fetchPlayerProfile(found.best.id) : null;

  const wantsRecord = RECORD_RE.test(q);
  const wantsPrediction = PREDICT_RE.test(q);
  const records = (wantsRecord || wantsPrediction) && !profile ? await recordsFor(q, match, asked, women) : [];

  // A national side was named but nothing current involves it, and nothing on record helps
  if (!profile && asked.length && !namedTeams && !records.some((r) => r.played) && !chunks.length) {
    const list = await liveListAnswer();
    const names = asked.map(titleCase).join(' / ');
    return {
      reply: `There's no live, upcoming or recent **${names}** match right now.\n\n${list.text}`,
      retrievedContext: { source: 'match-lookup' },
    };
  }

  // A player question about someone not in this match shouldn't drag in an unrelated match
  const useMatch = ctx && (!profile || namedTeams || how !== 'conversation' || playerInMatch(ctx, profile).length);

  if (!profile && !useMatch && !records.length && !chunks.length) {
    const list = await liveListAnswer();
    return {
      reply: "I couldn't tell which match or player you mean. Name a team (\"Ind\", \"Aussies\", \"Proteas\"...) or a player (\"Kohli career stats\"), or open a match and ask from there." +
        `\n\n${list.text}`,
      retrievedContext: { source: 'match-lookup' },
    };
  }

  const inMatch = profile && useMatch ? playerInMatch(ctx, profile) : [];
  const facts = [
    ...(useMatch ? matchFacts(ctx) : []),
    ...(profile ? playerFacts(profile, inMatch) : []),
    ...recordFacts(records),
  ];
  const llm = await askGemini(q, facts, history, chunks);

  // Without the LLM: pick the answer that fits the question best
  let reply = llm?.text;
  if (!reply) {
    if (profile && STORY_RE.test(q) && inMatch.length) reply = playerStoryAnswer(profile, inMatch, chunks);
    else if (profile) reply = playerAnswer(profile, q, inMatch);
    else if (isGuide && chunks.some((c) => c.type === 'guide')) reply = guideAnswer(chunks);
    else if (records.length) reply = recordAnswer(records, { predict: wantsPrediction, ctx: useMatch ? ctx : null });
    else if (STORY_RE.test(q) && chunks.length) reply = storyAnswer(q, chunks);
    else if (useMatch) reply = ANSWERS[detectIntent(q)](ctx);
    else reply = storyAnswer(q, chunks);
  }

  return {
    reply,
    retrievedContext: {
      ...(useMatch ? matchContext(match) : {}),
      ...(profile ? { playerId: profile.id, player: profile.name } : {}),
      source: sourceLabel(llm, chunks),
      sources: chunks.map((c, i) => ({ n: i + 1, type: c.type, title: c.title, similarity: Math.round((c.similarity || 0) * 1000) / 1000 })),
      retrieval: rag.via,
      ...(llm ? { model: llm.model } : {}),
    },
  };
}

function matchContext(match) {
  if (!match) return {};
  return {
    matchId: String(match.matchId),
    fixture: `${match.teamA} vs ${match.teamB}`,
    venue: match.venue || '',
    format: (match.matchType || '').toUpperCase(),
    scores: `${match.teamA}: ${scoreOf(match.scoreA)} | ${match.teamB}: ${scoreOf(match.scoreB)}`,
    status: match.status || '',
  };
}

const sourceLabel = (llm, chunks = []) => (llm ? 'AI answer' : 'Live data') + (chunks.length ? ` · ${chunks.length} source${chunks.length === 1 ? '' : 's'}` : (llm ? ' · live data' : ''));

/**
 * At server start, find a Gemini model that is responding right now, so the first user
 * question doesn't spend its time budget on overloaded models.
 */
async function warmUpModel() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key.length < 16 || process.env.GEMINI_MODEL) return;
  for (const model of (await modelsToTry(key)).slice(0, MAX_MODEL_TRIES)) {
    try {
      await axios.post(`${GEMINI_API}/${model}:generateContent`,
        { contents: [{ role: 'user', parts: [{ text: 'Reply with OK.' }] }], generationConfig: { maxOutputTokens: 256 } },
        { timeout: 10000, headers: { 'x-goog-api-key': key } });
      preferred = { name: model, time: Date.now() };
      console.log(`CricSense: ${model} is responding; using it`);
      return;
    } catch (err) {
      const status = err.response?.status;
      if ([401, 402, 403].includes(status)) return;
      benchedUntil.set(model, Date.now() + (status === 404 ? 12 * 60 * 60 * 1000 : BENCH_MS));
    }
  }
}

module.exports = { generateCricSenseResponse, detectIntent, warmUpModel };
