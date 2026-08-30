const cron = require('node-cron');
const axios = require('axios');
const Match = require('./models/match');
require('dotenv').config();

const CRICAPI_KEY = process.env.CRICAPI_KEY;

const toNumber = (value) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const safeString = (value) => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
};

const extractLiveBatsmen = (rm) => {
  const result = {};
  if (!rm.batting || !Array.isArray(rm.batting) || rm.batting.length === 0) return result;

  const battingBlock = rm.batting[0];
  const batsmen = battingBlock.batsmen || battingBlock.batsman || [];
  if (!Array.isArray(batsmen) || batsmen.length === 0) return result;

  const striker = batsmen.find(b => b?.is_striker || b?.strike === true) || batsmen[0];
  const nonStriker = batsmen.find(b => b?.is_nonstriker || b?.non_strike === true) || batsmen[1] || batsmen[0];

  if (striker) {
    result.striker = safeString(striker.name) || safeString(striker.batsman) || safeString(striker.batsman_name) || result.striker;
    result.strikerRuns = striker.r !== undefined ? toNumber(striker.r) : striker.runs !== undefined ? toNumber(striker.runs) : undefined;
    result.strikerBalls = striker.b !== undefined ? toNumber(striker.b) : striker.balls !== undefined ? toNumber(striker.balls) : undefined;
  }

  if (nonStriker) {
    result.nonStriker = safeString(nonStriker.name) || safeString(nonStriker.batsman) || safeString(nonStriker.batsman_name) || result.nonStriker;
    result.nonStrikerRuns = nonStriker.r !== undefined ? toNumber(nonStriker.r) : nonStriker.runs !== undefined ? toNumber(nonStriker.runs) : undefined;
    result.nonStrikerBalls = nonStriker.b !== undefined ? toNumber(nonStriker.b) : nonStriker.balls !== undefined ? toNumber(nonStriker.balls) : undefined;
  }

  return result;
};

const extractLiveBowler = (rm) => {
  const result = {};
  const bowlers = rm.bowling || rm.bowlers || [];
  if (!Array.isArray(bowlers) || bowlers.length === 0) return result;

  const bowler = bowlers[0];
  if (!bowler) return result;

  result.bowler = safeString(bowler.name) || safeString(bowler.bowler) || safeString(bowler.bowler_name) || result.bowler;
  result.bowlerOvers = bowler.o !== undefined ? toNumber(bowler.o) : bowler.overs !== undefined ? toNumber(bowler.overs) : undefined;
  result.bowlerRuns = bowler.r !== undefined ? toNumber(bowler.r) : bowler.runs !== undefined ? toNumber(bowler.runs) : undefined;
  result.bowlerWickets = bowler.w !== undefined ? toNumber(bowler.w) : bowler.wickets !== undefined ? toNumber(bowler.wickets) : undefined;

  return result;
};

let lastApiFetchTime = 0;
let cachedRealMatches = [];
let io = null;

const calculateAndDispatchPoints = async (matchId, playerName, diff, type) => {
  let pointsToAdd = 0;
  if (type === 'runs') {
    pointsToAdd = diff * 1; // 1 point per run
    if (diff === 4) pointsToAdd += 1;
    if (diff >= 6) pointsToAdd += 2;
  } else if (type === 'wickets') {
    pointsToAdd = diff * 20; // 20 points per wicket
  }

  if (pointsToAdd > 0) {
    try {
      const PORT = process.env.PORT || 5000;
      await axios.post(`http://localhost:${PORT}/api/fantasy/update-score`, {
        matchId,
        playerName,
        pointsToAdd
      });
      console.log(`🏆 Awarded ${pointsToAdd} points to ${playerName} for ${diff} ${type}`);
    } catch (err) {
      console.error('⚠️ Failed to update fantasy points', err.message);
    }
  }
};

const init = (serverIo) => {
  io = serverIo;
};

const fetchAndSaveSquad = async (matchId, dbMatch) => {
  try {
    const url = `https://api.cricapi.com/v1/match_squad?apikey=${CRICAPI_KEY}&id=${matchId}`;
    const res = await axios.get(url);
    if (res.data && res.data.status === 'success' && res.data.data) {
      let squadA = [];
      let squadB = [];
      const squadData = res.data.data;
      if (squadData.length >= 2) {
         if (squadData[0].teamName === dbMatch.teamA) {
             squadA = squadData[0].players.map(p => p.name);
             squadB = squadData[1].players.map(p => p.name);
         } else {
             squadA = squadData[1].players.map(p => p.name);
             squadB = squadData[0].players.map(p => p.name);
         }
      } else if (squadData.length === 1) {
         if (squadData[0].teamName === dbMatch.teamA) squadA = squadData[0].players.map(p => p.name);
         if (squadData[0].teamName === dbMatch.teamB) squadB = squadData[0].players.map(p => p.name);
      }
      
      if (squadA.length > 0 || squadB.length > 0) {
         dbMatch.squadA = squadA.length > 0 ? squadA : dbMatch.squadA;
         dbMatch.squadB = squadB.length > 0 ? squadB : dbMatch.squadB;
         console.log(`🏏 Fetched and saved real squads for match ${matchId} (${squadA.length} & ${squadB.length} players)`);
      }
    }
  } catch (err) {
     console.error('⚠️ Error fetching squad for', matchId, err.message);
  } finally {
     dbMatch.squadFetched = true;
     await dbMatch.save();
  }
};

cron.schedule('*/10 * * * * *', async () => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    try {
      const deleted = await Match.deleteMany({ date: { $lt: sevenDaysAgo, $ne: 'TBA' } });
      if (deleted && deleted.deletedCount > 0) {
        console.log(`🗑️ Deleted ${deleted.deletedCount} matches older than 7 days.`);
      }
    } catch (err) {
      console.error('⚠️ Error deleting old matches', err.message);
    }

    const nowMs = Date.now();
    if (CRICAPI_KEY && CRICAPI_KEY !== 'placeholder_key') {
      if (nowMs - lastApiFetchTime > 180000) {
        console.log('--- 📡 Fetching Live Authentic Cricket Updates from CricketData API ---');
        try {
          const response = await axios.get(`https://api.cricapi.com/v1/currentMatches?apikey=${CRICAPI_KEY}&offset=0`);
          if (response.data && response.data.status === 'success') {
            cachedRealMatches = response.data.data || [];
            lastApiFetchTime = nowMs;
            console.log(`✅ Successfully fetched ${cachedRealMatches.length} authentic matches.`);
          } else if (response.data && (response.data.reason || response.data.status === 'failure')) {
            const reason = response.data.reason || 'Quota exceeded or error';
            console.error('⚠️ CricAPI Notice:', reason);
            if (reason.includes('Blocked') || reason.includes('exceeded') || response.data.status === 'failure') {
              lastApiFetchTime = nowMs + (30 * 60 * 1000);
              console.log('⏳ Pausing authentic API fetch for 30 minutes to preserve hits.');
            }
          }
        } catch (err) {
          console.error('⚠️ CricketData API Network Error:', err.message);
        }
      }
    }

    const realMatches = cachedRealMatches;

    if (realMatches.length > 0) {
      for (let rm of realMatches) {
        if (!rm.teams || rm.teams.length < 2) continue;

        let scoreA = '0/0 (0)';
        let scoreB = '0/0 (0)';
        if (rm.score && Array.isArray(rm.score) && rm.score.length > 0) {
          const sA = rm.score.filter((s, i) => i % 2 === 0).map(s => `${s.r}/${s.w} (${s.o})`);
          const sB = rm.score.filter((s, i) => i % 2 === 1).map(s => `${s.r}/${s.w} (${s.o})`);
          if (sA.length > 0) scoreA = sA.join(' & ');
          if (sB.length > 0) scoreB = sB.join(' & ');
        }

        const liveBat = extractLiveBatsmen(rm);
        const liveBowl = extractLiveBowler(rm);
        let status = rm.status || 'Upcoming';
        let matchEnded = rm.matchEnded || false;
        let matchStarted = rm.matchStarted || false;

        const statusLower = status.toLowerCase();
        if (statusLower.includes('won by') || statusLower.includes('awarded') || statusLower.includes('abandoned') || statusLower.includes('no result')) {
           matchEnded = true;
           matchStarted = true;
        }

        const updates = {
          teamA: rm.teams[0],
          teamB: rm.teams[1],
          teamALogo: rm.teamInfo?.[0]?.img || '',
          teamBLogo: rm.teamInfo?.[1]?.img || '',
          scoreA,
          scoreB,
          status,
          matchStarted,
          matchEnded,
          venue: rm.venue || 'TBA',
          date: rm.date || 'TBA',
          matchType: rm.matchType || ''
        };

        Object.keys(liveBat).forEach((field) => {
          if (liveBat[field] !== undefined && liveBat[field] !== null) {
            updates[field] = liveBat[field];
          }
        });

        Object.keys(liveBowl).forEach((field) => {
          if (liveBowl[field] !== undefined && liveBowl[field] !== null) {
            updates[field] = liveBowl[field];
          }
        });

        const oldMatch = await Match.findOne({ matchId: String(rm.id) });

        const updatedMatch = await Match.findOneAndUpdate(
          { matchId: String(rm.id) },
          {
            ...updates,
            $setOnInsert: {
              squadA: [],
              squadB: []
            }
          },
          { upsert: true, new: true }
        );

        if (oldMatch && updatedMatch) {
          if (oldMatch.striker === updatedMatch.striker && updatedMatch.strikerRuns > oldMatch.strikerRuns) {
            await calculateAndDispatchPoints(String(rm.id), updatedMatch.striker, updatedMatch.strikerRuns - oldMatch.strikerRuns, 'runs');
          }
          if (oldMatch.nonStriker === updatedMatch.nonStriker && updatedMatch.nonStrikerRuns > oldMatch.nonStrikerRuns) {
            await calculateAndDispatchPoints(String(rm.id), updatedMatch.nonStriker, updatedMatch.nonStrikerRuns - oldMatch.nonStrikerRuns, 'runs');
          }
          if (oldMatch.bowler === updatedMatch.bowler && updatedMatch.bowlerWickets > oldMatch.bowlerWickets) {
            await calculateAndDispatchPoints(String(rm.id), updatedMatch.bowler, updatedMatch.bowlerWickets - oldMatch.bowlerWickets, 'wickets');
          }
        }

        // Squad fetch: fetch real squad ONCE for any new match that doesn't have one yet
        if (updatedMatch && !updatedMatch.squadFetched) {
          // Run in background without blocking the cron loop
          fetchAndSaveSquad(String(rm.id), updatedMatch);
        } else if (updatedMatch && updatedMatch.squadFetched) {
          // BUG 5 FIX: If live batter/bowler is not in any squad, add them cleanly
          // WITHOUT appending '(Sub)' so their name matches fantasy team selections
          let changed = false;
          const checkAndAdd = (playerName) => {
            if (!playerName || !playerName.trim()) return;
            const inA = updatedMatch.squadA.some(p => p.trim().toLowerCase() === playerName.trim().toLowerCase());
            const inB = updatedMatch.squadB.some(p => p.trim().toLowerCase() === playerName.trim().toLowerCase());
            if (!inA && !inB) {
              // Can't tell which team — add to both so they appear in TeamBuilder
              updatedMatch.squadA.push(playerName.trim());
              updatedMatch.squadB.push(playerName.trim());
              changed = true;
              console.log(`➕ Added missing player '${playerName}' to squads`);
            }
          };
          checkAndAdd(updatedMatch.striker);
          checkAndAdd(updatedMatch.nonStriker);
          checkAndAdd(updatedMatch.bowler);
          if (changed) await updatedMatch.save();
        }

        if (io && updatedMatch) {
          io.to('live_matches').emit('match_update', updatedMatch);
          io.to(`match_${String(rm.id)}`).emit('match_update', updatedMatch);
        }
      }
      console.log(`✅ Synced ${realMatches.length} raw API matches to the database.`);
    } else {
      console.log('--- ⚠️ No real matches currently available from CricAPI ---');
    }

    // Broadcast genuinely live matches from the DB (using the real matchStarted/matchEnded flags)
    if (io) {
      const dbLiveMatches = await Match.find({ matchStarted: true, matchEnded: false });
      if (dbLiveMatches.length > 0) {
        dbLiveMatches.forEach((liveMatch) => {
          io.to('live_matches').emit('match_update', liveMatch);
          io.to(`match_${liveMatch.matchId}`).emit('match_update', liveMatch);
        });
        console.log(`✅ Broadcast ${dbLiveMatches.length} live match(es) from DB.`);
      }
    }
  } catch (error) {
    console.error('❌ Automation Error:', error.message);
  }
});

module.exports = { init };