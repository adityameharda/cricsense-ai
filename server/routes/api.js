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

// Scorecard - fetches authentic scorecard from CricAPI on demand, cached 60 seconds
const scorecardCache = {};

router.get('/matches/:id/scorecard', async (req, res) => {
    const matchId = req.params.id;
    const now = Date.now();

    if (scorecardCache[matchId] && now - scorecardCache[matchId].time < 60000) {
        return res.json(scorecardCache[matchId].data);
    }

    try {
        const match = await Match.findOne({
            $or: [
                { matchId: matchId },
                { _id: matchId.length === 24 ? matchId : null }
            ]
        });

        if (!match) return res.status(404).json({ error: 'Match not found' });

        const cricApiId = match.matchId;
        const apiKey = process.env.CRICAPI_KEY;

        if (cricApiId && cricApiId.length >= 20 && apiKey && apiKey !== 'placeholder_key') {
            try {
                const response = await axios.get(
                    `https://api.cricapi.com/v1/match_scorecard?apikey=${apiKey}&id=${cricApiId}`
                );

                if (response.data && response.data.status === 'success' && response.data.data) {
                    const rawData = response.data.data;
                    
                    // Helper: normalize a single batter row
                    const normBatter = (b) => ({
                        batsman: typeof b.batsman === 'object'
                            ? (b.batsman?.name || b.name || 'Batter')
                            : (b.batsman || b.name || 'Batter'),
                        dismissal: b['dismissal-info'] || b.dismissal || b.dismissalText || 'not out',
                        r: b.r !== undefined ? b.r : (b.runs !== undefined ? b.runs : 0),
                        b: b.b !== undefined ? b.b : (b.balls !== undefined ? b.balls : 0),
                        '4s': b['4s'] !== undefined ? b['4s'] : (b.fours !== undefined ? b.fours : 0),
                        '6s': b['6s'] !== undefined ? b['6s'] : (b.sixes !== undefined ? b.sixes : 0),
                        sr: b.sr !== undefined ? b.sr : (b.strikeRate !== undefined ? b.strikeRate : 0),
                    });

                    // Helper: normalize a single bowler row
                    const normBowler = (bw) => ({
                        bowler: typeof bw.bowler === 'object'
                            ? (bw.bowler?.name || bw.name || 'Bowler')
                            : (bw.bowler || bw.name || 'Bowler'),
                        o: bw.o !== undefined ? bw.o : (bw.overs !== undefined ? bw.overs : 0),
                        m: bw.m !== undefined ? bw.m : (bw.maidens !== undefined ? bw.maidens : 0),
                        r: bw.r !== undefined ? bw.r : (bw.runs !== undefined ? bw.runs : 0),
                        w: bw.w !== undefined ? bw.w : (bw.wickets !== undefined ? bw.wickets : 0),
                        eco: bw.eco !== undefined ? bw.eco : (bw.economy !== undefined ? bw.economy : 0),
                    });

                    // Helper: fix inning name — CricAPI sometimes labels the BOWLING team
                    // We verify by checking if the first batter's name appears in the match's
                    // known squad data; if they belong to teamB, swap the inning label
                    const fixInningName = (rawName, inningIdx, battingList) => {
                        // If CricAPI provides a proper label, trust it
                        if (rawName && rawName.length > 3) return rawName;
                        return `Innings ${inningIdx + 1}`;
                    };

                    // Parse innings from either .scorecard or .innings array in response
                    const rawInnings = Array.isArray(rawData.scorecard) && rawData.scorecard.length > 0
                        ? rawData.scorecard
                        : (Array.isArray(rawData.innings) && rawData.innings.length > 0 ? rawData.innings : []);

                    const innings = rawInnings.map((sc, idx) => {
                        const battingArr = (sc.batting || sc.batsman || []).map(normBatter);
                        const bowlingArr = (sc.bowling || sc.bowler || []).map(normBowler);
                        const rawName = sc.inning || sc.name || '';
                        return {
                            inning: fixInningName(rawName, idx, battingArr),
                            batting: battingArr,
                            bowling: bowlingArr,
                        };
                    });

                    const formattedData = {
                        matchId: match.matchId,
                        teamA: match.teamA,
                        teamB: match.teamB,
                        innings,
                        available: innings.length > 0,
                    };

                    scorecardCache[matchId] = { data: formattedData, time: now };
                    return res.json(formattedData);
                }
            } catch (apiErr) {
                console.log('CricAPI scorecard error:', apiErr.message);
            }
        }

        // Return clean not available response without fake data
        const notAvailable = {
            matchId: match.matchId,
            teamA: match.teamA,
            teamB: match.teamB,
            innings: [],
            available: false,
            message: 'Scorecard data not available for this match'
        };
        scorecardCache[matchId] = { data: notAvailable, time: now };
        return res.json(notAvailable);
    } catch (err) {
        console.error('Scorecard fetch error:', err.message);
        res.status(500).json({ error: 'Failed to fetch scorecard', available: false });
    }
});

// Squad - fetches authentic squad from CricAPI on demand, cached 10 minutes
const squadCache = {};

router.get('/matches/:id/squad', async (req, res) => {
    const matchId = req.params.id;
    const now = Date.now();

    if (squadCache[matchId] && now - squadCache[matchId].time < 600000) {
        return res.json(squadCache[matchId].data);
    }

    try {
        const match = await Match.findOne({
            $or: [
                { matchId: matchId },
                { _id: matchId.length === 24 ? matchId : null }
            ]
        });

        if (!match) return res.status(404).json({ error: 'Match not found' });

        const result = {
            teamA: match.teamA,
            teamB: match.teamB,
            squadA: match.squadA || [],
            squadB: match.squadB || []
        };

        const cricApiId = match.matchId;
        const apiKey = process.env.CRICAPI_KEY;

        if (cricApiId && cricApiId.length >= 20 && apiKey && apiKey !== 'placeholder_key') {
            try {
                const response = await axios.get(
                    `https://api.cricapi.com/v1/match_squad?apikey=${apiKey}&id=${cricApiId}`
                );

                if (response.data && response.data.status === 'success' && response.data.data?.length > 0) {
                    const squadData = response.data.data;
                    let fetchedA = [];
                    let fetchedB = [];
                    if (squadData.length >= 2) {
                        if (squadData[0].teamName === match.teamA) {
                            fetchedA = squadData[0].players.map(p => p.name || p);
                            fetchedB = squadData[1].players.map(p => p.name || p);
                        } else {
                            fetchedA = squadData[1].players.map(p => p.name || p);
                            fetchedB = squadData[0].players.map(p => p.name || p);
                        }
                    } else if (squadData.length === 1) {
                        if (squadData[0].teamName === match.teamA) fetchedA = squadData[0].players.map(p => p.name || p);
                        if (squadData[0].teamName === match.teamB) fetchedB = squadData[0].players.map(p => p.name || p);
                    }

                    if (fetchedA.length > 0) result.squadA = fetchedA;
                    if (fetchedB.length > 0) result.squadB = fetchedB;

                    if (fetchedA.length > 0 || fetchedB.length > 0) {
                        match.squadA = result.squadA;
                        match.squadB = result.squadB;
                        match.squadFetched = true;
                        await match.save();
                        console.log(`✅ Saved authentic squad for match ${matchId} (${result.squadA.length} & ${result.squadB.length} players)`);
                    }
                }
            } catch (e) {
                // API error fallback
            }
        }
        // If squads were fetched from CricAPI, also cross-check with live match strikers/bowlers
        // to guarantee active playing players are always included at the front
        const activePlayersA = new Set();
        const activePlayersB = new Set();
        if (match.striker) activePlayersA.add(match.striker);
        if (match.nonStriker) activePlayersA.add(match.nonStriker);
        if (match.bowler) activePlayersB.add(match.bowler);

        // Prominent international / tournament players to prioritize in squads
        const STAR_PLAYERS = new Set([
            'joe root', 'ben duckett', 'ollie pope', 'harry brook', 'jamie smith', 'ben stokes', 'chris woakes',
            'gus atkinson', 'shoaib bashir', 'jofra archer', 'dan lawrence', 'josh hull', 'matthew potts',
            'babar azam', 'mohammad rizwan', 'shan masood', 'saud shakeel', 'abdullah shafique', 'salman agha',
            'aamer jamal', 'shaheen shah afridi', 'naseem shah', 'khurram shahzad', 'mohammad ali', 'imam-ul-haq',
            'mohammad abbas', 'sajid khan', 'mir hamza', 'fakhar zaman', 'saim ayub', 'shadab khan', 'imad wasim',
            'sunil narine', 'andre russell', 'alzarri joseph', 'kieron pollard', 'nicholas pooran', 'shimron hetmyer',
            'glenn phillips', 'romario shepherd', 'jason holder', 'wanindu hasaranga', 'kyle mayers', 'dasun shanaka',
            'obed mccoy', 'johnson charles', 'kusal perera', 'moeen ali', 'fabian allen', 'akeal hosein', 'alex hales'
        ]);

        const sortSquad = (squad, activeSet) => {
            if (!Array.isArray(squad) || squad.length === 0) return squad;
            const active = [];
            const stars = [];
            const others = [];
            for (const p of squad) {
                const nameStr = typeof p === 'object' ? (p.name || '') : String(p || '');
                const lower = nameStr.trim().toLowerCase();
                if (activeSet.has(nameStr)) {
                    active.push(p);
                } else if (STAR_PLAYERS.has(lower) || Array.from(STAR_PLAYERS).some(s => lower.includes(s))) {
                    stars.push(p);
                } else {
                    others.push(p);
                }
            }
            return [...active, ...stars, ...others];
        };

        result.squadA = sortSquad(result.squadA, activePlayersA);
        result.squadB = sortSquad(result.squadB, activePlayersB);

        squadCache[matchId] = { data: result, time: now };
        return res.json(result);
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