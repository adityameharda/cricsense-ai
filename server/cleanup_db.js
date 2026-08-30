require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/match');

const cleanup = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore');
        console.log('Connected to DB');

        // 1. Delete matches with dummy players
        const deleteResult = await Match.deleteMany({
            $or: [
                { 'squadA': { $regex: /P1/ } },
                { 'squadA.0': { $regex: /P1/ } }
            ]
        });
        console.log(`🗑️ Deleted ${deleteResult.deletedCount} matches with dummy players.`);

        // 2. Fix matchEnded flags for matches with "awarded", "abandoned", "won by" etc.
        const matchesToFix = await Match.find({ matchEnded: false });
        let fixedCount = 0;

        for (const match of matchesToFix) {
            const statusLower = (match.status || '').toLowerCase();
            if (statusLower.includes('won by') || statusLower.includes('awarded') || statusLower.includes('abandoned') || statusLower.includes('no result')) {
                match.matchEnded = true;
                match.matchStarted = true;
                await match.save();
                fixedCount++;
                console.log(`✅ Fixed status for match: ${match.teamA} vs ${match.teamB} (${match.status})`);
            }
        }
        
        console.log(`✅ Fixed matchEnded flag for ${fixedCount} matches.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        mongoose.disconnect();
        process.exit(0);
    }
};

cleanup();
