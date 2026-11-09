// Shared store for the match list.
// - Fetches /api/matches once and shares the result with every component.
// - Shows the last list saved in this browser immediately, then refreshes it.
// - Merges live socket updates in small batches instead of refetching everything.
import { useSyncExternalStore } from 'react';
import axios from 'axios';
import socket from '../socket';
import { API_BASE_URL } from '../config';

const CACHE_KEY = 'striker:matches:v1';
const LIST_FIELDS = [
  '_id', 'matchId', 'teamA', 'teamB', 'teamALogo', 'teamBLogo', 'scoreA', 'scoreB',
  'status', 'matchStarted', 'matchEnded', 'venue', 'date', 'startTime', 'matchType',
];
const FLUSH_MS = 1000;
const REFRESH_ON_RECONNECT_MS = 30000;

const slim = (m) => {
  const out = {};
  for (const k of LIST_FIELDS) if (m[k] !== undefined) out[k] = m[k];
  return out;
};
const idOf = (m) => m.matchId || m._id;

const readCache = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

let saveTimer = null;
const saveCache = (matches) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(matches));
    } catch {
      // storage full or blocked: the cache is only an optimisation
    }
  }, 2000);
};

// loaded: true once a network response has arrived (cached data may show before that)
let state = { matches: readCache(), loaded: false, error: null };
const listeners = new Set();

const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let inFlight = null;
let lastFetch = 0;

export const refreshMatches = () => {
  if (inFlight) return inFlight;
  inFlight = axios
    .get(`${API_BASE_URL}/api/matches`)
    .then((res) => {
      const matches = Array.isArray(res.data) ? res.data.map(slim) : [];
      lastFetch = Date.now();
      setState({ matches, loaded: true, error: null });
      saveCache(matches);
    })
    .catch((err) => {
      setState({ loaded: true, error: err.message || 'Failed to load matches' });
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};

// ── Live updates (batched) ─────────────────────────
let pending = new Map();
let flushTimer = null;

const flush = () => {
  flushTimer = null;
  if (pending.size === 0) return;
  const updates = pending;
  pending = new Map();

  const seen = new Set();
  const merged = state.matches.map((m) => {
    const u = updates.get(idOf(m));
    if (!u) return m;
    seen.add(idOf(m));
    return { ...m, ...u };
  });
  const added = [];
  updates.forEach((u, id) => { if (!seen.has(id)) added.push(u); });
  const matches = added.length ? [...added, ...merged] : merged;

  setState({ matches });
  saveCache(matches);
};

socket.on('match_update', (updated) => {
  if (!updated) return;
  const s = slim(updated);
  const id = idOf(s);
  pending.set(id, { ...(pending.get(id) || {}), ...s });
  if (!flushTimer) flushTimer = setTimeout(flush, FLUSH_MS);
});

// Rooms are lost when the socket reconnects (e.g. after the server restarts), so
// rejoin on every connect and refresh the list if it may be stale.
const onConnect = () => {
  socket.emit('join_live_matches');
  if (lastFetch && Date.now() - lastFetch > REFRESH_ON_RECONNECT_MS) refreshMatches();
};
socket.on('connect', onConnect);
if (socket.connected) onConnect();

// Start loading as soon as the app's JavaScript runs.
refreshMatches();

const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => state;

export const useMatches = () => useSyncExternalStore(subscribe, getSnapshot);
