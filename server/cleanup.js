require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/match');

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/cricscore').then(async () => {
    try {
        const seededMatches = ['ipl_srh_rcb', 'ipl_mi_kkr', 'ipl_csk_rr', 'ipl_dc_gt'];
        const res = await Match.deleteMany({ matchId: { $in: seededMatches } });
        console.log(`Cleaned ${res.deletedCount} old seed matches.`);
    } catch(err) {
        console.error(err);
    }
    process.exit();
});
