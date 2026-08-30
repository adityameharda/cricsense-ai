const axios = require('axios');
require('dotenv').config();

// fetch match ID first
const Match = require('./models/match');
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const m = await Match.findOne({ teamA: /Tanzania/i });
    if (!m) return;
    
    console.log("Fetching squad for match:", m.matchId);
    try {
        const res = await axios.get(`https://api.cricapi.com/v1/match_squad?apikey=${process.env.CRICAPI_KEY}&id=${m.matchId}`);
        console.log("Response:", JSON.stringify(res.data).slice(0, 500));
    } catch(err) {
        console.log("Error:", err.message);
    }
    process.exit(0);
});
