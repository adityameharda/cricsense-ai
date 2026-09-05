const Match = require('../models/match');
const FantasyTeam = require('../models/fantasyTeam');
const MatchPoint = require('../models/matchPoint');
const cricketService = require('./cricketLiveService');

/**
 * Normalizes a cricket player name for fuzzy matching across scorecards and fantasy teams.
 */
function cleanPlayerName(raw) {
  if (!raw) return '';
  const str = typeof raw === 'object' ? (raw.name || '') : String(raw);
  return str
    .replace(/\s*\([CWK\s\+\-]+\)\s*/gi, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase();
}

/**
 * Checks if two player names refer to the same cricketer.
 * Handles cases like:
 * - "Smriti Mandhana" vs "S Mandhana"
 * - "Shafali Verma" vs "S Verma"
 * - "Renuka Singh Thakur" vs "Renuka Singh"
 * - "Deepti Sharma" vs "Deepti"
 */
function isSamePlayer(nameA, nameB) {
  const a = cleanPlayerName(nameA);
  const b = cleanPlayerName(nameB);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const tokensA = a.split(/\s+/).filter(Boolean);
  const tokensB = b.split(/\s+/).filter(Boolean);

  // If last names match and first initial matches
  if (tokensA.length >= 2 && tokensB.length >= 2) {
    const lastNameA = tokensA[tokensA.length - 1];
    const lastNameB = tokensB[tokensB.length - 1];
    if (lastNameA === lastNameB) {
      if (tokensA[0][0] === tokensB[0][0]) return true;
    }
  }

  // Check token intersection
  const common = tokensA.filter(t => tokensB.includes(t) && t.length > 2);
  if (common.length > 0) return true;

  return false;
}

/**
 * Parses dismissal texts to assign fielding credits (Catches, Stumpings, Run Outs) and dismissal types (Bowled, LBW)
 * Examples:
 * - "c Smriti Mandhana b Renuka Singh"
 * - "c Nandani Sharma b Shree Charani"
 * - "c and b Fatima Sana"
 * - "st Richa Ghosh b Deepti Sharma"
 * - "run out (Bharti Fulmali/Deepti Sharma)"
 * - "run out (Shafali Verma)"
 * - "lbw b Deepti Sharma"
 * - "b Shafali Verma"
 */
function parseFieldingAndDismissal(dismissalText, bowlerName) {
  const result = {
    catches: [],
    stumpings: [],
    runouts: [],
    isBowled: false,
    isLbw: false,
  };

  if (!dismissalText || typeof dismissalText !== 'string') return result;
  const desc = dismissalText.trim();
  const lower = desc.toLowerCase();

  if (lower === 'not out' || lower === 'did not bat') return result;

  // 1. Caught & Bowled
  if (lower.startsWith('c & b ') || lower.startsWith('c and b ')) {
    if (bowlerName) result.catches.push(bowlerName);
    return result;
  }

  // 2. Catch
  const catchMatch = desc.match(/^c\s+([A-Za-z\s\-]+?)\s+b\s+/i);
  if (catchMatch && catchMatch[1]) {
    const fielder = catchMatch[1].trim();
    if (fielder && !fielder.toLowerCase().includes('&') && !fielder.toLowerCase().includes('and')) {
      result.catches.push(fielder);
    }
  }

  // 3. Stumping
  const stumpMatch = desc.match(/^st\s+([A-Za-z\s\-]+?)\s+b\s+/i);
  if (stumpMatch && stumpMatch[1]) {
    result.stumpings.push(stumpMatch[1].trim());
  }

  // 4. Run Out
  const runoutMatch = desc.match(/run\s*out\s*\(([^)]+)\)/i);
  if (runoutMatch && runoutMatch[1]) {
    const rawFielders = runoutMatch[1].split(/[\/,]/);
    rawFielders.forEach(f => {
      const trimmed = f.trim();
      if (trimmed) result.runouts.push(trimmed);
    });
  }

  // 5. Bowled
  if (lower.startsWith('b ') || lower.includes(' b ')) {
    if (!lower.startsWith('c ') && !lower.startsWith('st ') && !lower.startsWith('lbw ')) {
      result.isBowled = true;
    }
  }

  // 6. LBW
  if (lower.startsWith('lbw ') || lower.includes('lbw b ')) {
    result.isLbw = true;
  }

  return result;
}

/**
 * Calculates authentic Fantasy Points from batting figures
 */
function calculateBattingPoints(bat) {
  let pts = 0;
  const breakdown = { runs: 0, boundary: 0, six: 0, milestone: 0, duck: 0, strikeRate: 0 };

  const runs = Number(bat.r || bat.runs || 0);
  const balls = Number(bat.b || bat.balls || 0);
  const fours = Number(bat['4s'] || bat.fours || 0);
  const sixes = Number(bat['6s'] || bat.sixes || 0);
  const dismissal = String(bat.dismissal || bat['dismissal-info'] || '').toLowerCase();
  const isOut = dismissal !== 'not out' && dismissal !== '' && dismissal !== 'did not bat';

  // Base: 1 pt per run
  pts += runs;
  breakdown.runs = runs;

  // Boundary bonus: +1 pt per four
  pts += (fours * 1);
  breakdown.boundary = fours * 1;

  // Six bonus: +2 pts per six
  pts += (sixes * 2);
  breakdown.six = sixes * 2;

  // Milestones: 100 runs (+16), 50 runs (+8), 30 runs (+4)
  if (runs >= 100) {
    pts += 16;
    breakdown.milestone = 16;
  } else if (runs >= 50) {
    pts += 8;
    breakdown.milestone = 8;
  } else if (runs >= 30) {
    pts += 4;
    breakdown.milestone = 4;
  }

  // Duck penalty (-2 pts) if batsman is dismissed for 0 runs
  if (runs === 0 && isOut && balls >= 1) {
    pts -= 2;
    breakdown.duck = -2;
  }

  // Strike Rate bonus / penalty (minimum 10 balls faced)
  if (balls >= 10) {
    const sr = (runs / balls) * 100;
    if (sr >= 170) {
      pts += 6;
      breakdown.strikeRate = 6;
    } else if (sr >= 150) {
      pts += 4;
      breakdown.strikeRate = 4;
    } else if (sr >= 130) {
      pts += 2;
      breakdown.strikeRate = 2;
    } else if (sr >= 60 && sr <= 70) {
      pts -= 2;
      breakdown.strikeRate = -2;
    } else if (sr < 60) {
      pts -= 4;
      breakdown.strikeRate = -4;
    }
  }

  return { points: pts, breakdown };
}

/**
 * Calculates authentic Fantasy Points from bowling figures
 */
function calculateBowlingPoints(bowl, lbwBowledCount = 0) {
  let pts = 0;
  const breakdown = { wickets: 0, lbwBowled: 0, haul: 0, maidens: 0, economy: 0 };

  const wickets = Number(bowl.w || bowl.wickets || 0);
  const overs = parseFloat(bowl.o || bowl.overs || 0);
  const maidens = Number(bowl.m || bowl.maidens || 0);
  const runs = Number(bowl.r || bowl.runs || 0);

  // 25 pts per wicket
  pts += (wickets * 25);
  breakdown.wickets = wickets * 25;

  // LBW / Bowled bonus: +8 pts each
  if (lbwBowledCount > 0) {
    pts += (lbwBowledCount * 8);
    breakdown.lbwBowled = lbwBowledCount * 8;
  }

  // Wicket haul bonus: 5W (+16), 4W (+8), 3W (+4)
  if (wickets >= 5) {
    pts += 16;
    breakdown.haul = 16;
  } else if (wickets === 4) {
    pts += 8;
    breakdown.haul = 8;
  } else if (wickets === 3) {
    pts += 4;
    breakdown.haul = 4;
  }

  // Maiden overs: +12 pts each
  if (maidens > 0) {
    pts += (maidens * 12);
    breakdown.maidens = maidens * 12;
  }

  // Economy Rate bonus / penalty (minimum 2 overs bowled)
  if (overs >= 2) {
    const fullOvers = Math.floor(overs);
    const balls = (fullOvers * 6) + Math.round((overs - fullOvers) * 10);
    const totalOversDec = balls / 6;
    const eco = totalOversDec > 0 ? (runs / totalOversDec) : 0;

    if (eco < 5.0) {
      pts += 6;
      breakdown.economy = 6;
    } else if (eco >= 5.0 && eco <= 6.0) {
      pts += 4;
      breakdown.economy = 4;
    } else if (eco > 6.0 && eco <= 7.0) {
      pts += 2;
      breakdown.economy = 2;
    } else if (eco >= 10.0 && eco <= 11.0) {
      pts -= 2;
      breakdown.economy = -2;
    } else if (eco > 11.0) {
      pts -= 4;
      breakdown.economy = -4;
    }
  }

  return { points: pts, breakdown };
}

/**
 * Calculates authentic Fantasy Points from fielding figures
 */
function calculateFieldingPoints(catchesCount = 0, stumpingsCount = 0, runoutsCount = 0) {
  let pts = 0;
  const breakdown = { catches: 0, haul: 0, stumpings: 0, runouts: 0 };

  // Catch: 8 pts each
  if (catchesCount > 0) {
    pts += (catchesCount * 8);
    breakdown.catches = catchesCount * 8;
    // 3 Catches bonus: +4 pts
    if (catchesCount >= 3) {
      pts += 4;
      breakdown.haul = 4;
    }
  }

  // Stumping: 12 pts each
  if (stumpingsCount > 0) {
    pts += (stumpingsCount * 12);
    breakdown.stumpings = stumpingsCount * 12;
  }

  // Run out: 12 pts each (or 6 pts if split)
  if (runoutsCount > 0) {
    pts += (runoutsCount * 12);
    breakdown.runouts = runoutsCount * 12;
  }

  return { points: pts, breakdown };
}

/**
 * Main engine: computes match points for all players from the scorecard,
 * saves them in MatchPoint records, updates all FantasyTeams for that match,
 * and emits real-time leaderboard updates.
 */
async function calculateAndSyncMatchPoints(matchId, ioInstance = null) {
  try {
    if (!matchId) return { success: false, error: 'MatchId is required' };

    // 1. Fetch match record
    const match = await Match.findOne({
      $or: [{ matchId }, { _id: matchId.length === 24 ? matchId : null }]
    });

    const effectiveId = match?.matchId || matchId;

    // 2. Fetch authentic full scorecard
    const scorecard = await cricketService.fetchMatchScorecard(effectiveId);

    if (!scorecard || !scorecard.innings || scorecard.innings.length === 0) {
      console.log(`ℹ️ Scorecard not yet available for match ${effectiveId}`);
      return { success: false, message: 'Scorecard not available yet' };
    }

    // 3. Map of player performances
    // playerName -> { rawName, points, battingPts, bowlingPts, fieldingPts, stats: { runs, balls, fours, sixes, wickets, maidens, overs, runsConceded, catches, stumpings, runouts } }
    const playerStatsMap = new Map();

    const getOrCreatePlayerStat = (name) => {
      const clean = cleanPlayerName(name);
      for (const [key, val] of playerStatsMap.entries()) {
        if (isSamePlayer(key, clean)) {
          return val;
        }
      }
      const newEntry = {
        name: name.trim(),
        cleanKey: clean,
        totalPoints: 0,
        battingPoints: 0,
        bowlingPoints: 0,
        fieldingPoints: 0,
        stats: {
          runs: 0,
          balls: 0,
          fours: 0,
          sixes: 0,
          wickets: 0,
          maidens: 0,
          overs: 0,
          runsConceded: 0,
          catches: 0,
          stumpings: 0,
          runouts: 0,
          lbwBowledCount: 0
        },
        breakdowns: []
      };
      playerStatsMap.set(clean, newEntry);
      return newEntry;
    };

    // 4. Parse all innings
    scorecard.innings.forEach(inn => {
      // A. Batting entries
      (inn.batting || []).forEach(bat => {
        const batName = typeof bat.batsman === 'object' ? bat.batsman.name : bat.batsman;
        if (!batName) return;

        const pStat = getOrCreatePlayerStat(batName);
        pStat.stats.runs += Number(bat.r || bat.runs || 0);
        pStat.stats.balls += Number(bat.b || bat.balls || 0);
        pStat.stats.fours += Number(bat['4s'] || bat.fours || 0);
        pStat.stats.sixes += Number(bat['6s'] || bat.sixes || 0);

        const batResult = calculateBattingPoints(bat);
        pStat.battingPoints += batResult.points;
        pStat.totalPoints += batResult.points;

        // Parse fielding & dismissal events
        const dismissal = bat.dismissal || bat['dismissal-info'] || '';
        const parsed = parseFieldingAndDismissal(dismissal);

        // Catches
        parsed.catches.forEach(cName => {
          const fielderStat = getOrCreatePlayerStat(cName);
          fielderStat.stats.catches += 1;
        });

        // Stumpings
        parsed.stumpings.forEach(sName => {
          const keeperStat = getOrCreatePlayerStat(sName);
          keeperStat.stats.stumpings += 1;
        });

        // Run outs
        parsed.runouts.forEach(rName => {
          const roStat = getOrCreatePlayerStat(rName);
          roStat.stats.runouts += 1;
        });
      });

      // B. Bowling entries
      (inn.bowling || []).forEach(bowl => {
        const bowlName = typeof bowl.bowler === 'object' ? bowl.bowler.name : bowl.bowler;
        if (!bowlName) return;

        const pStat = getOrCreatePlayerStat(bowlName);
        const w = Number(bowl.w || bowl.wickets || 0);
        const m = Number(bowl.m || bowl.maidens || 0);
        const o = parseFloat(bowl.o || bowl.overs || 0);
        const r = Number(bowl.r || bowl.runs || 0);

        pStat.stats.wickets += w;
        pStat.stats.maidens += m;
        pStat.stats.overs = o;
        pStat.stats.runsConceded += r;

        // Check LBW & Bowled count by looking back at batting dismissals in this inning
        let lbwBowledCount = 0;
        (inn.batting || []).forEach(b => {
          const dis = b.dismissal || b['dismissal-info'] || '';
          if (dis.toLowerCase().includes(bowlName.toLowerCase())) {
            const p = parseFieldingAndDismissal(dis, bowlName);
            if (p.isBowled || p.isLbw) lbwBowledCount++;
          }
        });

        pStat.stats.lbwBowledCount += lbwBowledCount;

        const bowlResult = calculateBowlingPoints(bowl, lbwBowledCount);
        pStat.bowlingPoints += bowlResult.points;
        pStat.totalPoints += bowlResult.points;
      });
    });

    // C. Add Fielding points to totals
    for (const [, pStat] of playerStatsMap.entries()) {
      if (pStat.stats.catches > 0 || pStat.stats.stumpings > 0 || pStat.stats.runouts > 0) {
        const fResult = calculateFieldingPoints(pStat.stats.catches, pStat.stats.stumpings, pStat.stats.runouts);
        pStat.fieldingPoints += fResult.points;
        pStat.totalPoints += fResult.points;
      }
    }

    // 5. Upsert MatchPoint collection
    for (const [, pStat] of playerStatsMap.entries()) {
      await MatchPoint.findOneAndUpdate(
        { matchId: effectiveId, playerName: pStat.name },
        {
          $set: {
            points: pStat.totalPoints,
            stats: {
              runs: pStat.stats.runs,
              wickets: pStat.stats.wickets,
              catches: pStat.stats.catches
            }
          }
        },
        { upsert: true, returnDocument: 'after' }
      );
    }

    // 6. Find all FantasyTeams for this match (across ALL contests)
    const teams = await FantasyTeam.find({ matchId: effectiveId });

    for (const team of teams) {
      let squadTotalPoints = 0;
      const playerBreakdown = [];

      for (const p of team.players || []) {
        const cleanP = cleanPlayerName(p);
        let foundStat = null;

        for (const [, pStat] of playerStatsMap.entries()) {
          if (isSamePlayer(pStat.name, cleanP) || isSamePlayer(pStat.cleanKey, cleanP)) {
            foundStat = pStat;
            break;
          }
        }

        const basePoints = foundStat ? foundStat.totalPoints : 0;
        const isC = isSamePlayer(team.captain, cleanP);
        const isVC = isSamePlayer(team.viceCaptain, cleanP);
        const multiplier = isC ? 2 : isVC ? 1.5 : 1;
        const finalPlayerPoints = Math.round(basePoints * multiplier * 10) / 10;

        squadTotalPoints += finalPlayerPoints;

        playerBreakdown.push({
          name: p,
          basePoints,
          multiplier,
          finalPoints: finalPlayerPoints,
          isCaptain: isC,
          isViceCaptain: isVC,
          stats: foundStat ? foundStat.stats : null
        });
      }

      team.totalPoints = Math.round(squadTotalPoints * 10) / 10;
      await team.save();
    }

    // 7. Emit socket updates for live leaderboards
    if (ioInstance) {
      const updatedLeaderboards = await FantasyTeam.find({ matchId: effectiveId })
        .populate('userId', 'username email')
        .sort({ totalPoints: -1 });

      ioInstance.to(`match_${effectiveId}`).emit('leaderboard_update', updatedLeaderboards);
      ioInstance.to(`match_${effectiveId}_general`).emit('leaderboard_update', updatedLeaderboards);
    }

    console.log(`✅ Points calculation completed for match ${effectiveId}: ${playerStatsMap.size} players, ${teams.length} fantasy teams updated.`);
    return {
      success: true,
      matchId: effectiveId,
      playersCount: playerStatsMap.size,
      teamsUpdated: teams.length
    };
  } catch (err) {
    console.error(`❌ Error calculating match points for ${matchId}:`, err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  cleanPlayerName,
  isSamePlayer,
  calculateBattingPoints,
  calculateBowlingPoints,
  calculateFieldingPoints,
  calculateAndSyncMatchPoints
};
