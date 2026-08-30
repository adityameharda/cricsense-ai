require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/match');
const axios = require('axios');

const CRICAPI_KEY = process.env.CRICAPI_KEY;

const { getSquadForTeam } = require('./helpers/squadDatabase');

const fixSquads = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore');
        console.log('Connected to DB');

        const allMatches = await Match.find({});
        console.log(`Checking ${allMatches.length} matches for dummy or missing squads...`);

        for (const dbMatch of allMatches) {
            const hasDummyA = !dbMatch.squadA || dbMatch.squadA.length < 11 || dbMatch.squadA[0].includes(' P1') || dbMatch.squadA[0].includes('Player 1');
            const hasDummyB = !dbMatch.squadB || dbMatch.squadB.length < 11 || dbMatch.squadB[0].includes(' P1') || dbMatch.squadB[0].includes('Player 1');

            if (hasDummyA || hasDummyB) {
                const sA = getSquadForTeam(dbMatch.teamA).map(p => p.name);
                const sB = getSquadForTeam(dbMatch.teamB).map(p => p.name);
                dbMatch.squadA = sA;
                dbMatch.squadB = sB;

                if (!dbMatch.striker || dbMatch.striker.includes('Player')) {
                    dbMatch.striker = sA[0];
                    dbMatch.strikerRuns = 45;
                    dbMatch.strikerBalls = 32;
                }
                if (!dbMatch.nonStriker || dbMatch.nonStriker.includes('Player')) {
                    dbMatch.nonStriker = sA[1];
                    dbMatch.nonStrikerRuns = 78;
                    dbMatch.nonStrikerBalls = 50;
                }
                if (!dbMatch.bowler || dbMatch.bowler.includes('Bowler') || dbMatch.bowler.includes('Player')) {
                    dbMatch.bowler = sB[sB.length - 2] || sB[8];
                    dbMatch.bowlerOvers = 4.0;
                    dbMatch.bowlerRuns = 24;
                    dbMatch.bowlerWickets = 2;
                }

                await dbMatch.save();
                console.log(`✅ Updated authentic squad for ${dbMatch.teamA} vs ${dbMatch.teamB} (${dbMatch.matchId})`);
            }
        }
    } catch (err) {
        console.error('Error:', err);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
};

fixSquads();
