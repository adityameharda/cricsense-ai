/**
 * Gemini embeddings for CricSense RAG.
 *
 *  embedDocuments(texts) → vectors for knowledge chunks (taskType RETRIEVAL_DOCUMENT)
 *  embedQuery(text)      → vector for a user question  (taskType RETRIEVAL_QUERY)
 *
 * Uses the same GEMINI_API_KEY as the chat model. On the free tier embeddings are
 * rate-limited, so a 429 pauses embedding work for a while instead of hammering the API.
 */
const axios = require('axios');

const MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
const DIMENSIONS = 768;
const API = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CHARS = 7000; // the model reads ~2k tokens; longer text is cut

// Free tier: 30,000 embedding tokens per minute per model. Background ingestion stays well
// under that; if it is hit anyway, only ingestion pauses so questions can still be embedded.
const TOKENS_PER_RUN = 24000;
let docsPausedUntil = 0;
let allPausedUntil = 0;

const key = () => process.env.GEMINI_API_KEY;
const hasKey = () => Boolean(key() && key().length >= 16);
const isAvailable = () => hasKey() && Date.now() >= allPausedUntil;
const canEmbedDocuments = () => isAvailable() && Date.now() >= docsPausedUntil;
const estimateTokens = (text) => Math.ceil(Math.min(text.length, MAX_CHARS) / 3.6) + 8;

function retryDelayMs(err) {
  const detail = (err.response?.data?.error?.details || []).find((d) => d.retryDelay);
  const secs = parseFloat(detail?.retryDelay || '');
  return Number.isFinite(secs) ? (secs + 5) * 1000 : 70 * 1000;
}

function handleError(err, what) {
  const status = err.response?.status;
  if (status === 429 && what === 'batch') docsPausedUntil = Date.now() + retryDelayMs(err);
  if (status === 429 && what === 'query') allPausedUntil = Date.now() + 20 * 1000;
  if ([401, 402, 403].includes(status)) allPausedUntil = Date.now() + 30 * 60 * 1000;
  console.warn(`Embedding ${what} failed:`, status || err.code || err.message, (err.response?.data?.error?.message || '').slice(0, 140));
}

async function embedDocuments(texts) {
  if (!canEmbedDocuments() || !texts.length) return null;
  try {
    const res = await axios.post(`${API}/${MODEL}:batchEmbedContents`, {
      requests: texts.map((text) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text: text.slice(0, MAX_CHARS) }] },
        taskType: 'RETRIEVAL_DOCUMENT',
        outputDimensionality: DIMENSIONS,
      })),
    }, { headers: { 'x-goog-api-key': key() }, timeout: 60000 });
    return (res.data?.embeddings || []).map((e) => e.values);
  } catch (err) {
    handleError(err, 'batch');
    return null;
  }
}

async function embedQuery(text) {
  if (!isAvailable()) return null;
  try {
    const res = await axios.post(`${API}/${MODEL}:embedContent`, {
      content: { parts: [{ text: String(text).slice(0, 2000) }] },
      taskType: 'RETRIEVAL_QUERY',
      outputDimensionality: DIMENSIONS,
    }, { headers: { 'x-goog-api-key': key() }, timeout: 8000 });
    return res.data?.embedding?.values || null;
  } catch (err) {
    handleError(err, 'query');
    return null;
  }
}

function cosine(a, b) {
  let dot = 0; let na = 0; let nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

module.exports = { embedDocuments, embedQuery, cosine, isAvailable, canEmbedDocuments, estimateTokens, TOKENS_PER_RUN, DIMENSIONS, MODEL };
