const express = require('express');
const router = express.Router();
const Match = require('../models/match');
const { requireAdmin } = require('../helpers/adminAuth');

// Get all matches (lightweight list for the home page / pickers).
// Squads are excluded (they are only needed on /matches/:id and /matches/:id/squad)
// and the serialized result is cached briefly in memory so concurrent visitors
// don't each hit MongoDB.
const LIST_CACHE_MS = 5000;
let listCache = { body: null, time: 0 };
let listInFlight = null;

const loadMatchList = async () => {
    const matches = await Match.find({}, '-squadA -squadB -__v').lean();
    return JSON.stringify(matches);
};

router.get('/matches', async (req, res) => {
    try {
        if (!listCache.body || Date.now() - listCache.time > LIST_CACHE_MS) {
            if (!listInFlight) {
                listInFlight = loadMatchList()
                    .then((body) => { listCache = { body, time: Date.now() }; return body; })
                    .finally(() => { listInFlight = null; });
            }
            await listInFlight;
        }
        res.set('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
        res.type('application/json').send(listCache.body);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single match by ID
router.get('/matches/:id', async (req, res) => {
    try {
        const queryId = req.params.id;
        const match = await Match.findOne({
            $or: [
                { matchId: queryId },
                { _id: queryId.length === 24 ? queryId : null }
            ]
        });
        if (!match) return res.status(404).json({ error: 'Match not found' });
        res.json(match);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const cricketService = require('../services/cricketLiveService');

// Scorecard - fetches authentic scorecard from live cricket telemetry service, cached 45 seconds
router.get('/matches/:id/scorecard', async (req, res) => {
    const matchId = req.params.id;

    try {
        const match = await Match.findOne({
            $or: [
                { matchId: matchId },
                { _id: matchId.length === 24 ? matchId : null }
            ]
        });

        if (!match) return res.status(404).json({ error: 'Match not found', available: false });

        const effectiveId = match.matchId || matchId;
        const scorecardData = await cricketService.fetchMatchScorecard(effectiveId);

        // Cricbuzz's own match header is the source of truth for the match state.
        // If our stored record is behind (e.g. still "live" after the result), fix it now.
        let matchUpdate = null;
        if (scorecardData?.header) {
            const update = await cricketService.fetchMatchState(effectiveId, match);
            if (update) {
                const differs = Object.keys(update).some((k) => String(match[k] ?? '') !== String(update[k] ?? ''));
                if (differs) {
                    const saved = await Match.findOneAndUpdate(
                        { matchId: effectiveId },
                        { $set: { ...update, lastCheckedAt: new Date() } },
                        { returnDocument: 'after', projection: '-squadA -squadB -__v' }
                    ).lean();
                    const io = req.app.get('io');
                    if (io && saved) {
                        io.to('live_matches').emit('match_update', saved);
                        io.to(`match_${effectiveId}`).emit('match_update', saved);
                    }
                }
                matchUpdate = update;
            }
        }

        if (scorecardData && scorecardData.available) {
            return res.json({ ...scorecardData, teamA: match.teamA, teamB: match.teamB, matchUpdate });
        }

        // Return clean not available response without any synthetic fake data
        const notAvailable = {
            matchId: effectiveId,
            teamA: match.teamA,
            teamB: match.teamB,
            innings: [],
            available: false,
            matchUpdate,
            miniscore: scorecardData?.miniscore || null,
            message: (matchUpdate?.matchStarted ?? match.matchStarted) ? 'Scorecard is being updated...' : 'Scorecard data will appear once the match commences'
        };
        return res.json(notAvailable);
    } catch (err) {
        console.error('Scorecard fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch scorecard', available: false });
    }
});

// Squad - fetches authentic squad & Playing XI on demand
router.get('/matches/:id/squad', async (req, res) => {
    const matchId = req.params.id;

    try {
        const match = await Match.findOne({
            $or: [
                { matchId: matchId },
                { _id: matchId.length === 24 ? matchId : null }
            ]
        });

        if (!match) return res.status(404).json({ error: 'Match not found' });

        const effectiveId = match.matchId || matchId;
        const squadData = await cricketService.fetchMatchSquads(effectiveId, match);

        if (squadData.squadA.length > 0 || squadData.squadB.length > 0) {
            match.squadA = squadData.squadA;
            match.squadB = squadData.squadB;
            match.squadFetched = true;
            await match.save();
        }

        return res.json(squadData);
    } catch (err) {
        console.error('Squad fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch squad' });
    }
});

// Debug: emit match update manually
router.post('/debug/emit-match-update/:id', requireAdmin, async (req, res) => {
    try {
        const queryId = req.params.id;
        const match = await Match.findOne({
            $or: [
                { matchId: queryId },
                { _id: queryId.length === 24 ? queryId : null }
            ]
        });
        if (!match) return res.status(404).json({ error: 'Match not found' });

        const io = req.app.get('io');
        if (io) {
            io.to('live_matches').emit('match_update', match);
            io.to(`match_${match.matchId}`).emit('match_update', match);
        }

        res.json({ message: 'Emitted match_update event', match });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Debug: trigger automation manually
router.post('/debug/trigger-automation', requireAdmin, async (req, res) => {
    try {
        const automation = require('../automation');
        res.json({ message: 'Automation triggered (will run in next cron cycle)' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update live match details
router.patch('/matches/:id/live', requireAdmin, async (req, res) => {
    try {
        const queryId = req.params.id;
        const allowedFields = [
            'striker', 'nonStriker', 'bowler',
            'strikerRuns', 'strikerBalls', 'nonStrikerRuns', 'nonStrikerBalls',
            'bowlerOvers', 'bowlerRuns', 'bowlerWickets',
            'scoreA', 'scoreB', 'status', 'venue', 'date'
        ];

        const updates = {};
        allowedFields.forEach((field) => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (Object.keys(updates).length === 0) {
            return res.status(400).json({ error: 'No valid live fields provided.' });
        }

        const match = await Match.findOneAndUpdate(
            {
                $or: [
                    { matchId: queryId },
                    { _id: queryId.length === 24 ? queryId : null }
                ]
            },
            { $set: updates },
            { new: true }
        );

        if (!match) return res.status(404).json({ error: 'Match not found' });
        res.json(match);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create a new match
router.post('/matches', requireAdmin, async (req, res) => {
    try {
        const newMatch = new Match(req.body);
        const savedMatch = await newMatch.save();
        res.status(201).json(savedMatch);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;