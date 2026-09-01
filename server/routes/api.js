const express = require('express');
const router = express.Router();
const Match = require('../models/match');
const axios = require('axios');

// Get all matches
router.get('/matches', async (req, res) => {
    try {
        const matches = await Match.find().sort({ createdAt: -1 });
        res.json(matches);
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

        if (scorecardData && scorecardData.available) {
            scorecardData.teamA = match.teamA;
            scorecardData.teamB = match.teamB;
            return res.json(scorecardData);
        }

        // Return clean not available response without any synthetic fake data
        const notAvailable = {
            matchId: effectiveId,
            teamA: match.teamA,
            teamB: match.teamB,
            innings: [],
            available: false,
            message: match.matchStarted ? 'Scorecard is being updated...' : 'Scorecard data will appear once the match commences'
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
router.post('/debug/emit-match-update/:id', async (req, res) => {
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
router.post('/debug/trigger-automation', async (req, res) => {
    try {
        const automation = require('../automation');
        res.json({ message: 'Automation triggered (will run in next cron cycle)' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update live match details
router.patch('/matches/:id/live', async (req, res) => {
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
router.post('/matches', async (req, res) => {
    try {
        const newMatch = new Match(req.body);
        const savedMatch = await newMatch.save();
        res.status(201).json(savedMatch);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;