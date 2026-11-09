/**
 * Builds and maintains CricSense's knowledge base (the documents RAG retrieves from).
 *
 * Every run (see start()) it works through, in priority order:
 *   1. App guide        how fantasy points, teams and contests work (knowledge/appGuide.js)
 *   2. Live matches     ball-by-ball commentary, in 4-over chunks, as overs complete
 *   3. Recent matches   commentary + innings scorecards of top-team matches that finished recently
 *   4. Results          one short document per completed match
 *   5. Players          career profiles of players in upcoming/live top-team squads
 *
 * Documents are only (re-)embedded when their text changes (hash check), and embedding
 * work is batched and capped per day so it fits the Gemini free tier.
 */
const crypto = require('crypto');
const cron = require('node-cron');
const Match = require('../models/match');
const KnowledgeChunk = require('../models/knowledgeChunk');
const cricketService = require('./cricketLiveService');
const players = require('./playerService');
const embeddings = require('./embeddings');
const { ensureVectorIndex } = require('./retrieval');
const { baseName } = require('../helpers/teamAliases');
const appGuide = require('../knowledge/appGuide');

const BATCH_SIZE = 40;                    // max chunks per run (also capped by tokens, see embeddings.js)
const DAILY_LIMIT = Number(process.env.RAG_DAILY_EMBED_LIMIT || 900);
const OVERS_PER_CHUNK = 4;
const LIVE_RESCAN_MS = 5 * 60 * 1000;     // live match commentary re-checked every 5 min
const RECENT_DAYS = 14;                   // finished matches this recent get commentary/scorecards
const PLAYER_REFRESH_MS = 24 * 60 * 60 * 1000;
const COMMENTARY_KEEP_DAYS = 120;

const TOP_TEAMS = new Set(['india', 'australia', 'england', 'south africa', 'new zealand', 'pakistan', 'sri lanka', 'west indies', 'afghanistan', 'bangladesh']);

const pending = new Map();      // key → doc waiting to be embedded
const scannedAt = new Map();    // matchId → last time its commentary/scorecards were built
let usage = { day: '', count: 0 };
let running = false;
let stats = { embedded: 0, lastRun: null, lastError: null };

const sha1 = (s) => crypto.createHash('sha1').update(s).digest('hex');
const teamsOf = (m) => [m.teamA, m.teamB].filter(Boolean).map((t) => t.toLowerCase());
const isPriority = (m) => [m.teamA, m.teamB].some((t) => TOP_TEAMS.has(baseName(t || '')));
const fmtOf = (m) => (m.matchType || '').toUpperCase();
const dateOf = (m) => new Date(m.startTime || Date.parse(m.date) || Date.now());
const dayLabel = (m) => dateOf(m).toISOString().slice(0, 10);
const fixture = (m) => `${m.teamA} vs ${m.teamB}`;
const shortFixture = (m) => `${m.teamA} v ${m.teamB}`;

function queue(doc) {
  if (!doc.text || doc.text.length < 40) return;
  pending.set(doc.key, { ...doc, hash: sha1(doc.text) });
}

// ── Document builders ────────────────────────────────────────────────
function guideDocs() {
  appGuide.forEach((g) => queue({
    key: `guide:${g.id}`, type: 'guide', title: g.title, text: g.text, teams: [], players: [], date: new Date(0),
  }));
}

function resultDoc(m) {
  if (!m.matchEnded || !m.status) return;
  queue({
    key: `result:${m.matchId}`,
    type: 'result',
    title: `Result · ${shortFixture(m)}`,
    text: `Result: ${fixture(m)} (${fmtOf(m) || 'match'}) at ${m.venue || 'venue n/a'} on ${dayLabel(m)}. ${m.status}. ` +
      `Scores: ${m.teamA} ${m.scoreA || 'n/a'}; ${m.teamB} ${m.scoreB || 'n/a'}.`,
    matchId: String(m.matchId), teams: teamsOf(m), players: [], format: fmtOf(m), date: dateOf(m),
  });
}

async function scorecardDocs(m) {
  const sc = await cricketService.fetchMatchScorecard(m.matchId).catch(() => null);
  (sc?.innings || []).forEach((inn, i) => {
    const bat = (inn.batting || []).map((b) => `${b.batsman} ${b.r} (${b.b} balls, ${b['4s']}x4, ${b['6s']}x6) ${b.dismissal}`).join('; ');
    const bowl = (inn.bowling || []).map((b) => `${b.bowler} ${b.o}-${b.m}-${b.r}-${b.w}`).join('; ');
    queue({
      key: `scorecard:${m.matchId}:${i + 1}`,
      type: 'scorecard',
      title: `Scorecard · ${inn.inning} · ${shortFixture(m)}`,
      text: `Scorecard: ${fixture(m)} (${fmtOf(m)}), ${dayLabel(m)}. ${inn.inning}: ${inn.runs}/${inn.wickets} in ${inn.overs} overs.\n` +
        `Batting: ${bat || 'n/a'}.\nBowling (overs-maidens-runs-wickets): ${bowl || 'n/a'}.` +
        (inn.didNotBat?.length ? `\nDid not bat: ${inn.didNotBat.join(', ')}.` : ''),
      matchId: String(m.matchId), teams: teamsOf(m),
      players: [...(inn.batting || []).map((b) => b.batsman), ...(inn.bowling || []).map((b) => b.bowler)],
      format: fmtOf(m), date: dateOf(m),
    });
  });
}

const overOf = (ball) => Math.floor(Number(ball.over) - 0.001) + 1; // 6.6 → over 7, 0.1 → over 1

async function commentaryDocs(m) {
  const header = (rest) => `Commentary: ${fixture(m)} (${fmtOf(m)}), ${dayLabel(m)}. ${rest}`;
  const innings = [];
  for (let inn = 1; inn <= 4; inn++) {
    const entries = await cricketService.fetchFullCommentary(m.matchId, inn);
    if (!entries.length) break;
    innings.push(entries);
  }
  for (let idx = 0; idx < innings.length; idx++) {
    const inn = idx + 1;
    const entries = innings[idx];
    const balls = entries.filter((e) => e.ballNbr > 0 && e.inningsId === inn && e.over != null);
    const notes = entries.filter((e) => e.ballNbr === 0 && e.text.length > 60);
    const batTeam = balls.find((b) => b.batTeam)?.batTeam || '';
    const lastOver = balls.length ? overOf(balls[balls.length - 1]) : 0;
    const inningsComplete = m.matchEnded || idx < innings.length - 1;

    // Ball-by-ball in windows of OVERS_PER_CHUNK overs; the open window waits until it's complete
    const windows = new Map();
    for (const b of balls) {
      const start = Math.floor((overOf(b) - 1) / OVERS_PER_CHUNK) * OVERS_PER_CHUNK + 1;
      if (!windows.has(start)) windows.set(start, []);
      windows.get(start).push(b);
    }
    for (const [start, list] of windows) {
      const end = start + OVERS_PER_CHUNK - 1;
      if (!inningsComplete && lastOver <= end) continue;
      const lines = [];
      for (const b of list) {
        lines.push(`${b.over} ${b.text}`);
        if (b.overSummary) lines.push(`End of over ${overOf(b)}: ${batTeam} ${b.overSummary.score}/${b.overSummary.wickets} (over: ${b.overSummary.summary || `${b.overSummary.runs} runs`})`);
      }
      const shown = Math.min(end, overOf(list[list.length - 1]));
      queue({
        key: `commentary:${m.matchId}:${inn}:${start}`,
        type: 'commentary',
        title: `Commentary · ${batTeam || `Inns ${inn}`} overs ${start}–${shown} · ${shortFixture(m)}`,
        text: header(`${batTeam} batting, innings ${inn}, overs ${start} to ${shown}.\n`) + lines.join('\n'),
        matchId: String(m.matchId), teams: teamsOf(m), players: [], format: fmtOf(m), date: dateOf(m),
      });
    }

    // Pre-match notes, breaks and end-of-day reports (toss, conditions, team news)
    if (notes.length && (inningsComplete || inn === 1)) {
      let part = 0; let buf = [];
      const flush = () => {
        if (!buf.length) return;
        part += 1;
        queue({
          key: `commentary:${m.matchId}:${inn}:notes:${part}`,
          type: 'commentary',
          title: `Match notes · innings ${inn} · ${shortFixture(m)}`,
          text: header(`Notes and reports around innings ${inn}.\n`) + buf.join('\n'),
          matchId: String(m.matchId), teams: teamsOf(m), players: [], format: fmtOf(m), date: dateOf(m),
        });
        buf = [];
      };
      for (const n of notes) {
        if (buf.join('\n').length + n.text.length > 4500) flush();
        buf.push(n.text);
      }
      flush();
    }
  }
}

function profileText(p) {
  const lines = [`Player profile: ${p.name}${p.fullName && p.fullName !== p.name ? ` (${p.fullName})` : ''}, ${p.team || 'team n/a'}, ${p.role || 'role n/a'}.`];
  lines.push(`Bats: ${p.battingStyle || 'n/a'}. Bowls: ${p.bowlingStyle || 'n/a'}.${p.born ? ` Born ${p.born}${p.birthPlace ? `, ${p.birthPlace}` : ''}.` : ''}`);
  for (const [f, s] of Object.entries(p.batting || {})) {
    if (s.Matches && s.Matches !== '0') lines.push(`${f} batting: ${s.Matches} matches, ${s.Runs} runs, average ${s.Average}, strike rate ${s.SR}, ${s['100s']} hundreds, ${s['50s']} fifties, highest ${s.Highest}.`);
  }
  for (const [f, s] of Object.entries(p.bowling || {})) {
    if (s.Wickets && s.Wickets !== '0') lines.push(`${f} bowling: ${s.Wickets} wickets, average ${s.Avg}, economy ${s.Eco}, best ${s.BBI}.`);
  }
  if (p.recentBatting?.length) lines.push(`Recent batting: ${p.recentBatting.map((r) => `${r.score} vs ${r.opp} (${r.format}, ${r.date})`).join('; ')}.`);
  if (p.recentBowling?.length) lines.push(`Recent bowling: ${p.recentBowling.map((r) => `${r.score} vs ${r.opp} (${r.format}, ${r.date})`).join('; ')}.`);
  return lines.join('\n');
}

async function playerDocs(list, limit) {
  let fetched = 0;
  const known = new Map((await KnowledgeChunk.find({ key: { $in: list.map((p) => `player:${p.id}`) } }, 'key updatedAt').lean())
    .map((c) => [c.key, c.updatedAt]));
  for (const p of list) {
    if (fetched >= limit) break;
    const key = `player:${p.id}`;
    if (pending.has(key)) continue;
    const seen = known.get(key);
    if (seen && Date.now() - new Date(seen).getTime() < PLAYER_REFRESH_MS) continue;
    fetched += 1;
    const profile = await players.fetchPlayerProfile(p.id);
    if (!profile) continue;
    queue({
      key, type: 'player', title: `Player · ${profile.name}`, text: profileText(profile),
      teams: [String(profile.team || p.team || '').toLowerCase()].filter(Boolean), players: [profile.name], date: new Date(),
    });
  }
}

// ── Embedding + storage ──────────────────────────────────────────────
async function flushPending() {
  if (!pending.size) return 0;
  const today = new Date().toISOString().slice(0, 10);
  if (usage.day !== today) usage = { day: today, count: 0 };
  const room = Math.min(BATCH_SIZE, DAILY_LIMIT - usage.count);
  if (room <= 0) return 0;

  // Skip documents whose text hasn't changed since they were embedded; stay under the token budget
  const docs = [];
  let tokens = 0;
  const keys = [...pending.keys()];
  for (let i = 0; i < keys.length && docs.length < room; i += 200) {
    const slice = keys.slice(i, i + 200);
    const stored = new Map((await KnowledgeChunk.find({ key: { $in: slice } }, 'key hash').lean()).map((c) => [c.key, c.hash]));
    for (const k of slice) {
      const doc = pending.get(k);
      if (stored.get(k) === doc.hash) { pending.delete(k); continue; }
      const cost = embeddings.estimateTokens(`${doc.title}
${doc.text}`);
      if (docs.length < room && tokens + cost <= embeddings.TOKENS_PER_RUN) { docs.push(doc); tokens += cost; }
    }
  }
  if (!docs.length) return 0;

  const vectors = await embeddings.embedDocuments(docs.map((d) => `${d.title}\n${d.text}`));
  if (!vectors || vectors.length !== docs.length) return 0;
  usage.count += docs.length;

  await KnowledgeChunk.bulkWrite(docs.map((d, i) => ({
    updateOne: {
      filter: { key: d.key },
      update: { $set: { ...d, embedding: vectors[i] } },
      upsert: true,
    },
  })), { ordered: false });
  docs.forEach((d) => pending.delete(d.key));
  stats.embedded += docs.length;
  return docs.length;
}

// ── One ingestion pass ───────────────────────────────────────────────
async function runIngestion() {
  if (running || !embeddings.canEmbedDocuments()) return;
  running = true;
  try {
    // Keep feeding the queue only while it is short; embed what's queued every run
    if (pending.size < BATCH_SIZE) {
      guideDocs();

      const now = Date.now();
      const all = await Match.find({}, 'matchId teamA teamB status matchStarted matchEnded venue date startTime matchType scoreA scoreB').lean();

      // Live top-team matches: commentary as overs complete
      for (const m of all.filter((x) => x.matchStarted && !x.matchEnded && isPriority(x))) {
        if (now - (scannedAt.get(m.matchId) || 0) < LIVE_RESCAN_MS) continue;
        scannedAt.set(m.matchId, now);
        await commentaryDocs(m);
        if (pending.size >= BATCH_SIZE * 3) break;
      }

      // Recently finished top-team matches, newest first: commentary + scorecards (once per process)
      const recent = all
        .filter((x) => x.matchEnded && isPriority(x) && now - dateOf(x).getTime() < RECENT_DAYS * 86400000)
        .sort((a, b) => dateOf(b) - dateOf(a));
      for (const m of recent) {
        if (pending.size >= BATCH_SIZE * 3) break;
        if (scannedAt.has(m.matchId)) continue;
        scannedAt.set(m.matchId, now);
        await scorecardDocs(m);
        await commentaryDocs(m);
      }

      // Results of every completed match (short, no extra fetches)
      all.filter((x) => x.matchEnded).forEach(resultDoc);

      // Players in squads of live/upcoming top-team matches (a few profiles per run)
      if (pending.size < BATCH_SIZE) {
        const soon = all.filter((x) => !x.matchEnded && isPriority(x)).slice(0, 4);
        for (const m of soon) {
          const sq = await cricketService.fetchMatchSquads(m.matchId, m).catch(() => null);
          const list = [...(sq?.squadA || []), ...(sq?.squadB || [])].filter((p) => p.id);
          await playerDocs(list, 3);
          if (pending.size >= BATCH_SIZE) break;
        }
      }
    }

    await flushPending();
    stats.lastRun = new Date().toISOString();
  } catch (err) {
    stats.lastError = err.message;
    console.warn('RAG ingestion error:', err.message);
  } finally {
    running = false;
  }
}

async function pruneOld() {
  const cutoff = new Date(Date.now() - COMMENTARY_KEEP_DAYS * 86400000);
  await KnowledgeChunk.deleteMany({ type: { $in: ['commentary', 'scorecard'] }, date: { $lt: cutoff } }).catch(() => {});
}

let started = false;
function start() {
  if (started) return;
  started = true;
  if (process.env.RAG_INGEST === 'off') {
    console.log('RAG: ingestion disabled (RAG_INGEST=off)');
    return;
  }
  ensureVectorIndex();
  cron.schedule('15 */2 * * * *', runIngestion); // every 2 minutes
  cron.schedule('0 30 3 * * *', pruneOld);       // daily
  setTimeout(runIngestion, 15000);
}

async function status() {
  const byType = await KnowledgeChunk.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }]);
  return {
    chunks: Object.fromEntries(byType.map((t) => [t._id, t.n])),
    pending: pending.size,
    embeddedThisProcess: stats.embedded,
    embeddedToday: usage.count,
    dailyLimit: DAILY_LIMIT,
    lastRun: stats.lastRun,
    lastError: stats.lastError,
  };
}

module.exports = { start, runIngestion, status };
