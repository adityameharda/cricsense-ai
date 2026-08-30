const cron = require('node-cron');
const axios = require('axios');
const Match = require('./models/Match');

const API_TOKEN = 'your_api_token_here';

cron.schedule('*/2 * * * *', async () => {
  console.log('--- 🔄 Auto-Syncing Live Data ---');
  try {
    const response = await axios.get('https://api.example.com/live-data', {
      params: {
        token: API_TOKEN,
        sport: 'kabaddi',
        status: 'live',
      }
    });

    const matches = response.data?.response?.items || [];

    if (matches.length === 0) {
      console.log('⚠️ No live matches found.');
      return;
    }

    for (let match of matches) {
      await Match.findOneAndUpdate(
        { teamA: match.teama.name, teamB: match.teamb.name },
        { 
          scoreA: match.teama.scores || 0, 
          scoreB: match.teamb.scores || 0, 
          status: match.status_str,
          venue: match.venue || 'Default Venue',
          date: match.date_start
        },
        { upsert: true, new: true }
      );
    }
    console.log(`✅ Successfully synced ${matches.length} live matches.`);
  } catch (error) {
    if (error.response) {
      console.error('❌ API Rejection:', error.response.data.response || error.response.data);
    } else {
      console.error('❌ Connection Error:', error.message);
    }
  }
});