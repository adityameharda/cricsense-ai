const mongoose = require('mongoose');

/**
 * One searchable piece of CricSense's knowledge base (the "R" in RAG).
 *
 * text       what the LLM reads when this chunk is retrieved
 * embedding  Gemini embedding of `text` (768 numbers), searched with Atlas Vector Search
 * key        stable id per source piece, so re-ingesting never duplicates
 * hash       hash of `text`; a chunk is only re-embedded when its text changes
 */
const knowledgeChunkSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  type: { type: String, required: true, index: true }, // commentary | scorecard | result | player | guide
  text: { type: String, required: true },
  title: { type: String, default: '' },                 // short label shown as the source chip
  embedding: { type: [Number], default: undefined },
  hash: { type: String, required: true },
  matchId: { type: String, index: true },
  teams: { type: [String], default: [] },               // lower-case base names, e.g. "india", "india women"
  players: { type: [String], default: [] },
  format: { type: String, default: '' },
  date: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('KnowledgeChunk', knowledgeChunkSchema);
