/**
 * Player lookup + career stats for CricSense, all from Cricbuzz.
 *
 *  - fetchPlayerProfile(id): career batting/bowling tables per format, ICC rankings,
 *    personal info and recent scores from cricbuzz.com/profiles/{id}/…
 *  - fetchTeamPlayers(teamName): the player list on a national team's Cricbuzz page
 *    (used to find players who are not in the current match's squad)
 *  - findPlayers(query, candidates): which player(s) the question is about
 *
 * Cricbuzz has no public search endpoint, so the team pages act as the directory.
 * The team ids themselves are read from cricbuzz.com/cricket-team, not hardcoded.
 */
const axios = require('axios');
const { extractNextData, extractBalancedJson, USER_AGENT } = require('./cricketLiveService');
const { baseName } = require('../helpers/teamAliases');

const PROFILE_TTL = 6 * 60 * 60 * 1000;
const DIRECTORY_TTL = 24 * 60 * 60 * 1000;
const profileCache = new Map();   // id → { time, data }
const teamPlayersCache = new Map(); // teamId → { time, data }
let teamIndex = { time: 0, data: null, pending: null };

const get = (url) => axios.get(url, { headers: { 'User-Agent': USER_AGENT }, timeout: 8000 });

// Top men's sides: the directory searched when a question names no team
const DIRECTORY_TEAMS = ['india', 'australia', 'england', 'south africa', 'new zealand', 'pakistan', 'sri lanka', 'west indies', 'afghanistan', 'bangladesh'];

// ── Team directory ───────────────────────────────────────────────────
async function loadTeamIndex() {
  if (teamIndex.data && Date.now() - teamIndex.time < DIRECTORY_TTL) return teamIndex.data;
  if (teamIndex.pending) return teamIndex.pending;
  teamIndex.pending = (async () => {
    try {
      const res = await get('https://www.cricbuzz.com/cricket-team');
      const map = new Map();
      for (const [, slug, id] of res.data.matchAll(/\/cricket-team\/([a-z0-9-]+)\/(\d+)/g)) {
        const name = slug.replace(/-/g, ' ');
        if (!map.has(name)) map.set(name, { id, slug });
      }
      if (map.size) teamIndex = { time: Date.now(), data: map, pending: null };
      return map;
    } catch (err) {
      console.warn('Team index unavailable:', err.message);
      return teamIndex.data || new Map();
    } finally {
      teamIndex.pending = null;
    }
  })();
  return teamIndex.pending;
}

async function fetchTeamPlayers(teamName) {
  const index = await loadTeamIndex();
  const key = baseName(teamName);
  const team = index.get(key);
  if (!team) return [];
  const cached = teamPlayersCache.get(team.id);
  if (cached && Date.now() - cached.time < DIRECTORY_TTL) return cached.data;
  try {
    const res = await get(`https://www.cricbuzz.com/cricket-team/${team.slug}/${team.id}/players`);
    const seen = new Set();
    const players = [];
    for (const [, id, , name] of res.data.matchAll(/href="\/profiles\/(\d+)\/([a-z0-9-]+)"\s+title="([^"]+)"/g)) {
      if (seen.has(id)) continue;
      seen.add(id);
      players.push({ id, name: decodeEntities(name), team: titleCase(key) });
    }
    teamPlayersCache.set(team.id, { time: Date.now(), data: players });
    return players;
  } catch (err) {
    console.warn(`Players for ${teamName} unavailable:`, err.message);
    return cached?.data || [];
  }
}

/** Player lists for several teams in parallel (defaults to the top men's sides). */
async function directoryFor(teamNames = []) {
  const names = [...new Set((teamNames.length ? teamNames : DIRECTORY_TEAMS).map(baseName))];
  const lists = await Promise.all(names.map(fetchTeamPlayers));
  return lists.flat();
}

// ── Profile ──────────────────────────────────────────────────────────
const FORMAT_LABEL = { T20: 'T20I' };

function tableToFormats(table) {
  if (!table?.headers || !Array.isArray(table.values)) return {};
  const formats = table.headers.slice(1);
  const out = {};
  formats.forEach((f, i) => {
    const row = {};
    table.values.forEach((r) => { if (r?.values?.[0]) row[r.values[0]] = r.values[i + 1]; });
    out[FORMAT_LABEL[f] || f] = row;
  });
  return out;
}

function recentRows(table) {
  return (table?.rows || []).slice(0, 6).map((r) => {
    const [, score, opp, format, date] = r.values || [];
    return { score, opp, format: FORMAT_LABEL[format] || format, date };
  }).filter((r) => r.score);
}

async function fetchPlayerProfile(id) {
  id = String(id || '').replace(/\D/g, '');
  if (!id) return null;
  const cached = profileCache.get(id);
  if (cached && Date.now() - cached.time < PROFILE_TTL) return cached.data;
  try {
    // Any slug works; the id decides the player
    const res = await get(`https://www.cricbuzz.com/profiles/${id}/player`);
    const combined = extractNextData(res.data);
    const info = extractBalancedJson(combined, '"playerData":{');
    if (!info?.name) return null;
    const ranks = info.rankings || {};
    const data = {
      id,
      name: info.name,
      fullName: info.fullName || info.name,
      role: info.role || '',
      battingStyle: info.bat || '',
      bowlingStyle: info.bowl || '',
      team: info.intlTeam || '',
      born: info.DoB || '',
      birthPlace: info.birthPlace || '',
      rankings: {
        batting: pickRanks(ranks.bat),
        bowling: pickRanks(ranks.bowl),
        allRounder: pickRanks(ranks.all),
      },
      batting: tableToFormats(extractBalancedJson(combined, '"battingStats":{')),
      bowling: tableToFormats(extractBalancedJson(combined, '"bowlingStats":{')),
      recentBatting: recentRows(extractBalancedJson(combined, '"recentBatting":{')),
      recentBowling: recentRows(extractBalancedJson(combined, '"recentBowling":{')),
      url: `https://www.cricbuzz.com/profiles/${id}/${slugify(info.name)}`,
    };
    profileCache.set(id, { time: Date.now(), data });
    return data;
  } catch (err) {
    console.warn(`Profile ${id} unavailable:`, err.message);
    return cached?.data || null;
  }
}

function pickRanks(r = {}) {
  const out = {};
  for (const [k, v] of Object.entries(r || {})) {
    if (v && /^\d+$/.test(String(v))) out[k] = Number(v);
  }
  return out;
}

// ── Name matching ────────────────────────────────────────────────────
// Surnames/first names that are also everyday words: only treat them as a name
// when the user capitalised them ("Head", "Hope", "Root").
const EVERYDAY_WORDS = new Set([
  'head', 'hope', 'young', 'wood', 'woods', 'green', 'short', 'root', 'rice', 'little', 'will', 'mark', 'bell', 'cook',
  'archer', 'hunt', 'pope', 'brook', 'salt', 'mills', 'chase', 'king', 'best', 'may', 'rich', 'cross', 'fine', 'stone',
  'smith', 'small', 'nash', 'shepherd', 'paul', 'carter', 'law', 'love', 'fox', 'rose', 'sharp', 'smart', 'strong',
  'wells', 'early', 'hill', 'hart', 'turner', 'bishop', 'holder',
]);

const clean = (s = '') => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').replace(/\s+/g, ' ').trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordIn = (text, w) => new RegExp(`(^|[^a-z0-9])${escapeRe(w)}('s)?(?=$|[^a-z0-9])`).test(text);
const capitalisedIn = (raw, w) => new RegExp(`(^|[^A-Za-z0-9])${escapeRe(w[0].toUpperCase() + w.slice(1))}('s)?(?=$|[^A-Za-z0-9])`).test(raw);

function nameScore(rawQuery, q, name) {
  const n = clean(name);
  if (!n) return 0;
  if (wordIn(q, n)) return 10;
  const tokens = n.split(' ').filter((t) => t.length >= 3);
  if (tokens.length > 1 && tokens.every((t) => wordIn(q, t))) return 9;
  const usable = (t) => t.length >= 3 && wordIn(q, t) && (!EVERYDAY_WORDS.has(t) || capitalisedIn(rawQuery, t));
  const last = tokens[tokens.length - 1];
  if (last && usable(last)) return 5;
  if (tokens.length > 1 && usable(tokens[0]) && tokens[0].length >= 4) return 4;
  return 0;
}

/**
 * Players named in the question. Returns { best, ambiguous } where ambiguous lists
 * other players that matched equally well (e.g. "Sharma").
 */
function findPlayers(rawQuery, candidates = []) {
  // Phrases that contain a surname-like word but are never about a player
  rawQuery = String(rawQuery || '').replace(/\bhead[\s-]+to[\s-]+head\b|\bh2h\b/gi, ' ');
  const q = clean(rawQuery);
  const byId = new Map();
  for (const c of candidates) {
    if (!c?.id || !c?.name) continue;
    const s = nameScore(rawQuery, q, c.name);
    if (!s) continue;
    const prev = byId.get(String(c.id));
    if (!prev || s > prev.score) byId.set(String(c.id), { ...c, id: String(c.id), score: s });
  }
  const ranked = [...byId.values()].sort((a, b) => b.score - a.score);
  if (!ranked.length) return { best: null, ambiguous: [] };
  const top = ranked.filter((r) => r.score === ranked[0].score);
  return top.length === 1 ? { best: top[0], ambiguous: [] } : { best: null, ambiguous: top.slice(0, 6) };
}

const PLAYER_QUESTION_RE = /\b(stats?|statistics|career|average|avg|record|records|centur(y|ies)|hundreds?|fift(y|ies)|100s|50s|profile|rank(ing|ings)?|form|recent|born|age|how old|highest|best|strike rate|economy|debut|bio|who is|who's|tell me about|about|how good|runs|wickets|scored|taken)\b/i;
const looksLikePlayerQuestion = (q) => PLAYER_QUESTION_RE.test(q);

const decodeEntities = (s) => s.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
const titleCase = (s) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());
const slugify = (s) => clean(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

module.exports = { fetchPlayerProfile, fetchTeamPlayers, directoryFor, findPlayers, looksLikePlayerQuestion };
