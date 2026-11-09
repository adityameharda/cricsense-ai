// Helpers to classify matches for the home page filters and ordering.

// Full-member nations shown first. Only senior national sides count:
// "India A", "India U19" or "India Champions" do not match.
const TOP_TEAMS = new Set([
  'india',
  'australia',
  'england',
  'south africa',
  'new zealand',
  'pakistan',
  'sri lanka',
  'west indies',
  'afghanistan',
]);

const WOMEN_RE = /\bwomen\b/i;

const baseTeamName = (name = '') =>
  name.toLowerCase().replace(WOMEN_RE, '').replace(/\s+/g, ' ').trim();

export const isTopTeam = (name) => TOP_TEAMS.has(baseTeamName(name));

export const isWomenMatch = (m) => WOMEN_RE.test(m.teamA || '') || WOMEN_RE.test(m.teamB || '');

// Normalises values like "T20 International", "ODI Series", "TEST" to T20 / ODI / TEST.
export const getFormat = (m) => {
  const t = (m.matchType || '').toUpperCase();
  if (t.includes('TEST')) return 'TEST';
  if (t.includes('ODI')) return 'ODI';
  if (t.includes('T20')) return 'T20';
  return 'OTHER';
};

// 2 = both teams are top nations, 1 = one of them is, 0 = neither.
export const getPriority = (m) => (isTopTeam(m.teamA) ? 1 : 0) + (isTopTeam(m.teamB) ? 1 : 0);

export const isLive = (m) => m.matchStarted && !m.matchEnded;
export const isUpcoming = (m) => !m.matchStarted && !m.matchEnded;
export const isCompleted = (m) => !!m.matchEnded;

const dateValue = (m) => {
  const t = Date.parse(m.date);
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Splits a list into top-team matches and other matches, each sorted.
 * order: 'asc' (soonest first, for upcoming) or 'desc' (latest first, for results).
 */
export const splitByPriority = (list, order = 'desc') => {
  const dir = order === 'asc' ? 1 : -1;
  const byDate = (a, b) => dir * (dateValue(a) - dateValue(b));
  const top = [];
  const other = [];
  for (const m of list) (getPriority(m) > 0 ? top : other).push(m);
  top.sort((a, b) => getPriority(b) - getPriority(a) || byDate(a, b));
  other.sort(byDate);
  return { top, other };
};
