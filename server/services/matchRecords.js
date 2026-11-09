/**
 * Win/loss records computed from the completed matches stored in the database.
 * Used for questions like "winning percentage of Pakistan" or "India vs Australia record".
 * These are real results only; the answer always says how many matches they cover.
 */
const Match = require('../models/match');

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (s = '') => s.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();

function outcomeFor(team, m) {
  const status = String(m.status || '');
  if (/\bno result\b|\babandoned\b|\bcancelled\b/i.test(status)) return 'nr';
  if (/\bmatch tied\b|\btied\b/i.test(status) && !/\bwon\b/i.test(status)) return 'tied';
  if (/\bdrawn\b|\bdraw\b/i.test(status)) return 'drawn';
  const winner = (status.match(/^(.+?)\s+won\b/i) || [])[1];
  if (!winner) return null;
  return norm(winner) === norm(team) ? 'won' : 'lost';
}

/**
 * @param {string} team      exact team name, e.g. "Pakistan" or "Pakistan Women"
 * @param {object} [opts]
 * @param {string} [opts.opponent] restrict to head-to-head
 * @param {string} [opts.format]   'TEST' | 'ODI' | 'T20'
 */
async function teamRecord(team, { opponent, format } = {}) {
  const exact = new RegExp(`^${escapeRe(team)}$`, 'i');
  const query = { matchEnded: true, $or: [{ teamA: exact }, { teamB: exact }] };
  if (opponent) {
    const opp = new RegExp(`^${escapeRe(opponent)}$`, 'i');
    query.$and = [{ $or: [{ teamA: opp }, { teamB: opp }] }];
  }
  if (format) query.matchType = new RegExp(format === 'T20' ? 't20' : format, 'i');
  const matches = await Match.find(query, 'teamA teamB status date startTime matchType venue').lean();

  const rows = matches
    .map((m) => ({ m, outcome: outcomeFor(team, m), when: m.startTime || Date.parse(m.date) || 0 }))
    .filter((r) => r.outcome)
    .sort((a, b) => b.when - a.when);

  const count = (o) => rows.filter((r) => r.outcome === o).length;
  const won = count('won'); const lost = count('lost'); const drawn = count('drawn'); const tied = count('tied'); const nr = count('nr');
  const decided = rows.length - nr;
  const oldest = rows[rows.length - 1]?.when;
  return {
    team, opponent: opponent || null, format: format || null,
    played: rows.length, won, lost, drawn, tied, noResult: nr,
    winPct: decided > 0 ? Math.round((won / decided) * 1000) / 10 : null,
    since: oldest ? new Date(oldest).toISOString().slice(0, 10) : null,
    recent: rows.slice(0, 5).map(({ m, outcome, when }) => ({
      opponent: norm(m.teamA) === norm(team) ? m.teamB : m.teamA,
      outcome, status: m.status, format: (m.matchType || '').toUpperCase(),
      date: when ? new Date(when).toISOString().slice(0, 10) : '',
    })),
  };
}

function recordText(r) {
  if (!r.played) {
    return `CricSense has no completed ${r.format ? `${r.format} ` : ''}matches for ${r.team}${r.opponent ? ` against ${r.opponent}` : ''} on record yet.`;
  }
  const scope = `${r.played} completed ${r.format ? `${r.format} ` : ''}match${r.played === 1 ? '' : 'es'}${r.opponent ? ` against ${r.opponent}` : ''} recorded since ${r.since}`;
  const parts = [`won ${r.won}`, `lost ${r.lost}`];
  if (r.drawn) parts.push(`drew ${r.drawn}`);
  if (r.tied) parts.push(`tied ${r.tied}`);
  if (r.noResult) parts.push(`${r.noResult} no result`);
  return `${r.team} record (${scope}): ${parts.join(', ')}${r.winPct != null ? `; win rate ${r.winPct}%` : ''}.`;
}

module.exports = { teamRecord, recordText };
