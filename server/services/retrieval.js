/**
 * Semantic retrieval over the CricSense knowledge base.
 *
 * Primary path: MongoDB Atlas Vector Search ($vectorSearch on the `chunk_vectors` index).
 * Fallback (index still building, or a non-Atlas MongoDB such as a local test DB):
 * load the filtered candidates and rank them by cosine similarity in Node.
 */
const KnowledgeChunk = require('../models/knowledgeChunk');
const { embedQuery, cosine, DIMENSIONS } = require('./embeddings');

const INDEX_NAME = 'chunk_vectors';
const MIN_SIMILARITY = 0.64;   // below this a chunk is about something else
const RELATIVE_WINDOW = 0.08;  // keep chunks close to the best match
const FALLBACK_SCAN_LIMIT = 3000;

let vectorIndexReady = false;
let vectorSearchSupported = true;

/** Create the Atlas vector index once (no-op if it exists or the DB isn't Atlas). */
async function ensureVectorIndex() {
  try {
    await KnowledgeChunk.createCollection().catch(() => {});
    const existing = await KnowledgeChunk.collection.listSearchIndexes(INDEX_NAME).toArray();
    if (!existing.length) {
      await KnowledgeChunk.collection.createSearchIndex({
        name: INDEX_NAME,
        type: 'vectorSearch',
        definition: {
          fields: [
            { type: 'vector', path: 'embedding', numDimensions: DIMENSIONS, similarity: 'cosine' },
            { type: 'filter', path: 'matchId' },
            { type: 'filter', path: 'teams' },
            { type: 'filter', path: 'type' },
          ],
        },
      });
      console.log('RAG: created Atlas vector search index', INDEX_NAME);
    }
    await refreshIndexStatus();
  } catch (err) {
    vectorSearchSupported = false;
    console.log('RAG: Atlas Vector Search not available here, using in-app similarity search.', err.codeName || err.message);
  }
}

async function refreshIndexStatus() {
  try {
    const [idx] = await KnowledgeChunk.collection.listSearchIndexes(INDEX_NAME).toArray();
    vectorIndexReady = Boolean(idx && (idx.queryable || idx.status === 'READY'));
  } catch {
    vectorIndexReady = false;
  }
  return vectorIndexReady;
}

const PROJECT = { key: 1, type: 1, title: 1, text: 1, matchId: 1, teams: 1, date: 1 };

async function atlasSearch(queryVector, filter, limit) {
  const stage = { index: INDEX_NAME, path: 'embedding', queryVector, numCandidates: Math.max(100, limit * 25), limit };
  if (filter && Object.keys(filter).length) stage.filter = filter;
  const rows = await KnowledgeChunk.aggregate([
    { $vectorSearch: stage },
    { $project: { ...PROJECT, score: { $meta: 'vectorSearchScore' } } },
  ]);
  // Atlas reports cosine as (1 + cos) / 2; convert back to plain cosine similarity
  return rows.map((r) => ({ ...r, similarity: 2 * r.score - 1 }));
}

async function localSearch(queryVector, filter, limit) {
  const rows = await KnowledgeChunk.find({ ...(filter || {}), embedding: { $exists: true } }, { ...PROJECT, embedding: 1 })
    .sort({ date: -1 }).limit(FALLBACK_SCAN_LIMIT).lean();
  return rows
    .map(({ embedding, ...r }) => ({ ...r, similarity: cosine(queryVector, embedding) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);
}

async function search(queryVector, filter, limit) {
  if (vectorSearchSupported && (vectorIndexReady || await refreshIndexStatus())) {
    try {
      return { rows: await atlasSearch(queryVector, filter, limit), via: 'atlas-vector-search' };
    } catch (err) {
      console.warn('RAG: $vectorSearch failed, using in-app search:', err.codeName || err.message);
    }
  }
  return { rows: await localSearch(queryVector, filter, limit), via: 'in-app-cosine' };
}

/**
 * Most relevant chunks for a question.
 * @param {string} question
 * @param {object} scope
 * @param {string}   [scope.matchId] the match being discussed: its chunks are searched first
 * @param {string[]} [scope.teams]   lower-case team names to keep the wider search on topic
 * @param {number}   [scope.k]       how many chunks to return
 */
async function retrieve(question, { matchId, teams = [], k = 4 } = {}) {
  const queryVector = await embedQuery(question);
  if (!queryVector) return { chunks: [], via: 'unavailable' };

  const searches = [];
  if (matchId) searches.push(search(queryVector, { matchId: String(matchId) }, k));
  const wide = teams.length ? { $or: [{ teams: { $in: teams } }, { type: 'guide' }] } : {};
  searches.push(search(queryVector, wide, k));

  const results = await Promise.all(searches);
  const byKey = new Map();
  for (const { rows } of results) for (const r of rows) if (!byKey.has(r.key) || byKey.get(r.key).similarity < r.similarity) byKey.set(r.key, r);
  const ranked = [...byKey.values()].sort((a, b) => b.similarity - a.similarity);
  const best = ranked[0]?.similarity || 0;
  const chunks = ranked.filter((r) => r.similarity >= MIN_SIMILARITY && r.similarity >= best - RELATIVE_WINDOW).slice(0, k);
  return { chunks, via: results[0]?.via || 'none' };
}

module.exports = { retrieve, ensureVectorIndex, refreshIndexStatus };
