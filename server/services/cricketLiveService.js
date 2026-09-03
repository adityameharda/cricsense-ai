const axios = require('axios');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Cache stores
let cachedMatches = [];
let lastMatchesFetchTime = 0;
const scorecardCache = new Map();
const squadCache = new Map();
const telemetryCache = new Map();

/**
 * Normalizes cricket over strings to prevent displaying .6 (6 balls = full completed over)
 * E.g. 18.6 -> 19, 14.6 -> 15, "165/10 (18.6)" -> "165/10 (19)"
 */
function cleanCricketOvers(str) {
  if (typeof str === 'number') {
    const s = str.toFixed(1);
    if (s.endsWith('.6')) {
      return Math.floor(str) + 1;
    }
    return str;
  }
  if (!str || typeof str !== 'string') return str;
  return str.replace(/(\d+)\.6(?=[^\d]|$)/gi, (match, oversNum) => {
    return String(parseInt(oversNum, 10) + 1);
  });
}

/**
 * Converts any GMT / UTC formatted time string or match status to IST (Indian Standard Time)
 * E.g. "Match starts at Sep 01, 12:00 GMT" -> "Match starts at Sep 01, 5:30 PM IST"
 */
function convertGmtToIst(text) {
  if (!text || typeof text !== 'string') return text;

  // Pattern with Month and Day: "Sep 01, 12:00 GMT" or "Sep 02, 01:30 GMT"
  let formatted = text.replace(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{1,2}):(\d{2})\s*GMT/gi, (match, mon, day, hour, min) => {
    const year = new Date().getFullYear();
    const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
    const mIdx = months[mon.toLowerCase()] !== undefined ? months[mon.toLowerCase()] : 0;
    const dUtc = new Date(Date.UTC(year, mIdx, parseInt(day, 10), parseInt(hour, 10), parseInt(min, 10)));
    const istMs = dUtc.getTime() + (5.5 * 3600 * 1000);
    const istDate = new Date(istMs);
    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthStr = mNames[istDate.getUTCMonth()];
    const dayStr = String(istDate.getUTCDate()).padStart(2, '0');
    let h = istDate.getUTCHours();
    const m = String(istDate.getUTCMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    return `${monthStr} ${dayStr}, ${h}:${m} ${ampm} IST`;
  });

  // Pattern with standalone hour: "19:30 GMT" -> "1:00 AM IST"
  formatted = formatted.replace(/(\d{1,2}):(\d{2})\s*GMT/gi, (match, hour, min) => {
    let h = parseInt(hour, 10) + 5;
    let m = parseInt(min, 10) + 30;
    if (m >= 60) {
      h += 1;
      m -= 60;
    }
    h = h % 24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0) h = 12;
    const mStr = String(m).padStart(2, '0');
    return `${h}:${mStr} ${ampm} IST`;
  });

  return formatted;
}

// Helper to extract JSON from Next.js SSR streaming payloads
function extractNextData(rawHtml) {
  const nextPushes = [...rawHtml.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)];
  let combinedNext = '';
  nextPushes.forEach(p => {
    try {
      const str = JSON.parse(`"${p[1]}"`);
      combinedNext += str;
    } catch (e) {
      combinedNext += p[1];
    }
  });
  return combinedNext;
}

function extractBalancedJson(str, startKeyword) {
  const startIdx = str.indexOf(startKeyword);
  if (startIdx === -1) return null;
  
  const sliceFrom = startIdx + startKeyword.length;
  const isArray = startKeyword.trim().endsWith('[');
  const openChar = isArray ? '[' : '{';
  const closeChar = isArray ? ']' : '}';

  let depth = 0;
  let jsonStr = '';
  let inString = false;
  let escape = false;

  for (let i = sliceFrom - 1; i < str.length; i++) {
    const char = str[i];
    jsonStr += char;

    if (escape) {
      escape = false;
      continue;
    }
    if (char === '\\') {
      escape = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === openChar) depth++;
      else if (char === closeChar) {
        depth--;
        if (depth === 0) break;
      }
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch (err) {
    return null;
  }
}

/**
 * Fetch live match telemetry (striker, non-striker, bowler, second bowler, CRR, REQ, equation, recent balls)
 */
async function fetchLiveTelemetry(matchId) {
  const now = Date.now();
  if (telemetryCache.has(matchId)) {
    const cached = telemetryCache.get(matchId);
    if (now - cached.time < 15000) {
      return cached.data;
    }
  }

  try {
    const url = `https://www.cricbuzz.com/live-cricket-scores/${matchId}/match`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 6000
    });

    const combined = extractNextData(res.data);
    const miniscore = extractBalancedJson(combined, '"miniscore":{');
    const matchHeader = extractBalancedJson(combined, '"matchHeader":{');

    if (!miniscore) return null;

    const data = {
      striker: miniscore.batsmanStriker ? {
        name: miniscore.batsmanStriker.name || 'Striker',
        runs: miniscore.batsmanStriker.runs !== undefined ? miniscore.batsmanStriker.runs : 0,
        balls: miniscore.batsmanStriker.balls !== undefined ? miniscore.batsmanStriker.balls : 0,
        fours: miniscore.batsmanStriker.fours !== undefined ? miniscore.batsmanStriker.fours : 0,
        sixes: miniscore.batsmanStriker.sixes !== undefined ? miniscore.batsmanStriker.sixes : 0,
        strikeRate: miniscore.batsmanStriker.strikeRate !== undefined ? String(miniscore.batsmanStriker.strikeRate) : '0.0',
        onStrike: true
      } : null,
      nonStriker: miniscore.batsmanNonStriker ? {
        name: miniscore.batsmanNonStriker.name || 'Non-Striker',
        runs: miniscore.batsmanNonStriker.runs !== undefined ? miniscore.batsmanNonStriker.runs : 0,
        balls: miniscore.batsmanNonStriker.balls !== undefined ? miniscore.batsmanNonStriker.balls : 0,
        fours: miniscore.batsmanNonStriker.fours !== undefined ? miniscore.batsmanNonStriker.fours : 0,
        sixes: miniscore.batsmanNonStriker.sixes !== undefined ? miniscore.batsmanNonStriker.sixes : 0,
        strikeRate: miniscore.batsmanNonStriker.strikeRate !== undefined ? String(miniscore.batsmanNonStriker.strikeRate) : '0.0',
        onStrike: false
      } : null,
      bowler: miniscore.bowlerStriker ? {
        name: miniscore.bowlerStriker.name || 'Bowler',
        overs: cleanCricketOvers(miniscore.bowlerStriker.overs !== undefined ? miniscore.bowlerStriker.overs : 0),
        maidens: miniscore.bowlerStriker.maidens !== undefined ? miniscore.bowlerStriker.maidens : 0,
        runs: miniscore.bowlerStriker.runs !== undefined ? miniscore.bowlerStriker.runs : 0,
        wickets: miniscore.bowlerStriker.wickets !== undefined ? miniscore.bowlerStriker.wickets : 0,
        economy: miniscore.bowlerStriker.economy !== undefined ? String(miniscore.bowlerStriker.economy) : '0.0',
        isActive: true
      } : null,
      bowlerNonStriker: miniscore.bowlerNonStriker ? {
        name: miniscore.bowlerNonStriker.name || 'Bowler',
        overs: cleanCricketOvers(miniscore.bowlerNonStriker.overs !== undefined ? miniscore.bowlerNonStriker.overs : 0),
        maidens: miniscore.bowlerNonStriker.maidens !== undefined ? miniscore.bowlerNonStriker.maidens : 0,
        runs: miniscore.bowlerNonStriker.runs !== undefined ? miniscore.bowlerNonStriker.runs : 0,
        wickets: miniscore.bowlerNonStriker.wickets !== undefined ? miniscore.bowlerNonStriker.wickets : 0,
        economy: miniscore.bowlerNonStriker.economy !== undefined ? String(miniscore.bowlerNonStriker.economy) : '0.0',
        isActive: false
      } : null,
      currentRunRate: miniscore.currentRunRate !== undefined ? miniscore.currentRunRate : null,
      requiredRunRate: miniscore.requiredRunRate !== undefined ? miniscore.requiredRunRate : null,
      target: miniscore.target || null,
      status: convertGmtToIst(cleanCricketOvers(miniscore.status || miniscore.customStatus || matchHeader?.status || '')),
      recentBalls: miniscore.recentOvsStats || '',
      partnership: miniscore.partnerShip || null,
      lastWicket: cleanCricketOvers(miniscore.lastWicket || ''),
      overs: miniscore.overs !== undefined ? cleanCricketOvers(miniscore.overs) : null,
      batTeam: miniscore.batTeamScoreObj || null,
      bowlTeam: miniscore.bowlTeamScoreObj || null
    };

    telemetryCache.set(matchId, { data, time: now });
    return data;
  } catch (err) {
    return null;
  }
}

/**
 * Fetch and extract all real matches (Live, Upcoming, Complete)
 */
async function fetchAllRealMatches() {
  const now = Date.now();
  if (cachedMatches.length > 0 && now - lastMatchesFetchTime < 30000) {
    return cachedMatches;
  }

  try {
    const res = await axios.get('https://www.cricbuzz.com/cricket-match/live-scores', {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000
    });

    const combinedNext = extractNextData(res.data);
    const parsedTypeMatches = extractBalancedJson(combinedNext, '"typeMatches":[');

    if (!parsedTypeMatches || !Array.isArray(parsedTypeMatches)) {
      if (cachedMatches.length > 0) return cachedMatches;
      return [];
    }

    const matches = [];
    parsedTypeMatches.forEach(cat => {
      const seriesMatches = cat.seriesMatches || [];
      seriesMatches.forEach(sm => {
        const seriesAdWrapper = sm.seriesAdWrapper;
        if (seriesAdWrapper && Array.isArray(seriesAdWrapper.matches)) {
          seriesAdWrapper.matches.forEach(m => {
            const info = m.matchInfo;
            const score = m.matchScore;
            if (!info || !info.matchId || !info.team1 || !info.team2) return;

            const state = info.state || '';
            const rawStatus = info.status || '';
            const status = convertGmtToIst(rawStatus);

            const matchStarted = state === 'In Progress' || state === 'Complete' || state === 'Innings Break' || state === 'Delay';
            const matchEnded = state === 'Complete' || rawStatus.toLowerCase().includes('won by') || rawStatus.toLowerCase().includes('match drawn') || rawStatus.toLowerCase().includes('no result') || rawStatus.toLowerCase().includes('abandoned');

            let scoreA = '0/0 (0)';
            let scoreB = '0/0 (0)';

            if (score?.team1Score) {
              const inngs = [];
              if (score.team1Score.inngs1) inngs.push(`${score.team1Score.inngs1.runs || 0}/${score.team1Score.inngs1.wickets || 0} (${cleanCricketOvers(score.team1Score.inngs1.overs || 0)})`);
              if (score.team1Score.inngs2) inngs.push(`${score.team1Score.inngs2.runs || 0}/${score.team1Score.inngs2.wickets || 0} (${cleanCricketOvers(score.team1Score.inngs2.overs || 0)})`);
              if (inngs.length > 0) scoreA = inngs.join(' & ');
            }

            if (score?.team2Score) {
              const inngs = [];
              if (score.team2Score.inngs1) inngs.push(`${score.team2Score.inngs1.runs || 0}/${score.team2Score.inngs1.wickets || 0} (${cleanCricketOvers(score.team2Score.inngs1.overs || 0)})`);
              if (score.team2Score.inngs2) inngs.push(`${score.team2Score.inngs2.runs || 0}/${score.team2Score.inngs2.wickets || 0} (${cleanCricketOvers(score.team2Score.inngs2.overs || 0)})`);
              if (inngs.length > 0) scoreB = inngs.join(' & ');
            }

            const ground = info.venueInfo?.ground || '';
            const city = info.venueInfo?.city || '';
            const venue = ground && city ? `${ground}, ${city}` : (ground || city || 'TBA');

            let dateStr = 'TBA';
            if (info.startDate) {
              const d = new Date(parseInt(info.startDate, 10));
              if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().split('T')[0];
              }
            }

            matches.push({
              matchId: String(info.matchId),
              series: info.seriesName || '',
              teamA: info.team1.teamName || info.team1.teamSName || 'Team A',
              teamB: info.team2.teamName || info.team2.teamSName || 'Team B',
              teamALogo: info.team1.imageId ? `https://static.cricbuzz.com/a/img/v1/72x72/i1/c${info.team1.imageId}/team.jpg` : '',
              teamBLogo: info.team2.imageId ? `https://static.cricbuzz.com/a/img/v1/72x72/i1/c${info.team2.imageId}/team.jpg` : '',
              scoreA,
              scoreB,
              status,
              state,
              matchStarted,
              matchEnded,
              venue,
              date: dateStr,
              matchType: info.matchFormat || cat.matchType || 'Cricket'
            });
          });
        }
      });
    });

    cachedMatches = matches;
    lastMatchesFetchTime = now;
    return matches;
  } catch (err) {
    console.error('Error fetching real matches:', err.message);
    return cachedMatches;
  }
}

/**
 * Fetch authentic full match scorecard and live telemetry for a match
 */
async function fetchMatchScorecard(matchId) {
  const now = Date.now();
  if (scorecardCache.has(matchId)) {
    const cached = scorecardCache.get(matchId);
    if (now - cached.time < 30000) {
      return cached.data;
    }
  }

  try {
    const url = `https://www.cricbuzz.com/live-cricket-scorecard/${matchId}/match`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 8000
    });

    const combinedNext = extractNextData(res.data);
    const scorecardArray = extractBalancedJson(combinedNext, '"scoreCard":[');
    const matchHeader = extractBalancedJson(combinedNext, '"matchHeader":{');
    let miniscore = extractBalancedJson(combinedNext, '"miniscore":{');

    // If miniscore is empty, fetch live telemetry from live scores page
    if (!miniscore || !miniscore.batsmanStriker) {
      const liveData = await fetchLiveTelemetry(matchId);
      if (liveData) {
        miniscore = liveData;
      }
    }

    const rawStatus = matchHeader?.status || '';
    const status = convertGmtToIst(rawStatus);

    if (!scorecardArray || !Array.isArray(scorecardArray) || scorecardArray.length === 0) {
      const emptyResult = {
        matchId: String(matchId),
        innings: [],
        available: false,
        status: status || 'Scorecard not yet available',
        miniscore: miniscore || null
      };
      scorecardCache.set(matchId, { data: emptyResult, time: now });
      return emptyResult;
    }

    const innings = scorecardArray.map((inn, idx) => {
      const batTeamName = inn.batTeamDetails?.batTeamName || inn.batTeamDetails?.batTeamShortName || `Team ${idx + 1}`;
      const runs = inn.scoreDetails?.runs !== undefined ? inn.scoreDetails.runs : 0;
      const wickets = inn.scoreDetails?.wickets !== undefined ? inn.scoreDetails.wickets : 0;
      const rawOvers = inn.scoreDetails?.overs !== undefined ? inn.scoreDetails.overs : 0;
      const overs = cleanCricketOvers(rawOvers);

      const batting = [];
      const didNotBat = [];

      const rawBatsmen = inn.batTeamDetails?.batsmenData || {};
      Object.values(rawBatsmen).forEach(b => {
        const batName = b.batName || b.batShortName || 'Batter';
        const runs = b.runs !== undefined ? b.runs : 0;
        const balls = b.balls !== undefined ? b.balls : 0;
        const fours = b.fours !== undefined ? b.fours : 0;
        const sixes = b.sixes !== undefined ? b.sixes : 0;
        const sr = b.strikeRate !== undefined ? String(b.strikeRate) : (balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0');
        const outDesc = (b.outDesc || '').trim();

        // If player has balls faced or has a dismissal, they batted
        if (balls > 0 || (outDesc && outDesc.toLowerCase() !== 'not out' && outDesc !== '')) {
          batting.push({
            batsman: batName,
            dismissal: outDesc || 'not out',
            'dismissal-info': outDesc || 'not out',
            r: runs,
            b: balls,
            '4s': fours,
            '6s': sixes,
            sr
          });
        } else if (outDesc.toLowerCase() === 'not out' && (runs > 0 || balls > 0)) {
          batting.push({
            batsman: batName,
            dismissal: 'not out',
            'dismissal-info': 'not out',
            r: runs,
            b: balls,
            '4s': fours,
            '6s': sixes,
            sr
          });
        } else {
          // Genuine Did Not Bat player
          didNotBat.push(batName);
        }
      });

      const bowling = [];
      const rawBowlers = inn.bowlTeamDetails?.bowlersData || {};
      Object.values(rawBowlers).forEach(bw => {
        const bowlerName = bw.bowlName || bw.bowlShortName || 'Bowler';
        const rawOvers = bw.overs !== undefined ? bw.overs : 0;
        const overs = cleanCricketOvers(rawOvers);
        const maidens = bw.maidens !== undefined ? bw.maidens : 0;
        const runs = bw.runs !== undefined ? bw.runs : 0;
        const wickets = bw.wickets !== undefined ? bw.wickets : 0;
        const eco = bw.economy !== undefined ? String(bw.economy) : (overs > 0 ? (runs / parseFloat(overs)).toFixed(2) : '0.00');

        bowling.push({
          bowler: bowlerName,
          o: overs,
          m: maidens,
          r: runs,
          w: wickets,
          eco
        });
      });

      const extrasData = inn.extrasData || {};
      const extras = {
        total: extrasData.total || 0,
        b: extrasData.byes || 0,
        lb: extrasData.legByes || 0,
        w: extrasData.wides || 0,
        nb: extrasData.noBalls || 0,
        penalty: extrasData.penalty || 0
      };

      return {
        inning: `${batTeamName} Innings`,
        teamName: batTeamName,
        runs,
        wickets,
        overs,
        batting,
        bowling,
        extras,
        didNotBat
      };
    });

    const formattedMiniscore = miniscore?.striker ? miniscore : (miniscore?.batsmanStriker ? {
      striker: {
        name: miniscore.batsmanStriker.name,
        runs: miniscore.batsmanStriker.runs,
        balls: miniscore.batsmanStriker.balls,
        fours: miniscore.batsmanStriker.fours,
        sixes: miniscore.batsmanStriker.sixes,
        strikeRate: miniscore.batsmanStriker.strikeRate,
        onStrike: true
      },
      nonStriker: miniscore.batsmanNonStriker ? {
        name: miniscore.batsmanNonStriker.name,
        runs: miniscore.batsmanNonStriker.runs,
        balls: miniscore.batsmanNonStriker.balls,
        fours: miniscore.batsmanNonStriker.fours,
        sixes: miniscore.batsmanNonStriker.sixes,
        strikeRate: miniscore.batsmanNonStriker.strikeRate,
        onStrike: false
      } : null,
      bowler: miniscore.bowlerStriker ? {
        name: miniscore.bowlerStriker.name,
        overs: miniscore.bowlerStriker.overs,
        maidens: miniscore.bowlerStriker.maidens,
        runs: miniscore.bowlerStriker.runs,
        wickets: miniscore.bowlerStriker.wickets,
        economy: miniscore.bowlerStriker.economy,
        isActive: true
      } : null,
      bowlerNonStriker: miniscore.bowlerNonStriker ? {
        name: miniscore.bowlerNonStriker.name,
        overs: miniscore.bowlerNonStriker.overs,
        maidens: miniscore.bowlerNonStriker.maidens,
        runs: miniscore.bowlerNonStriker.runs,
        wickets: miniscore.bowlerNonStriker.wickets,
        economy: miniscore.bowlerNonStriker.economy,
        isActive: false
      } : null,
      currentRunRate: miniscore.currentRunRate,
      requiredRunRate: miniscore.requiredRunRate,
      target: miniscore.target,
      status: convertGmtToIst(miniscore.status || miniscore.customStatus || status),
      recentBalls: miniscore.recentOvsStats || '',
      partnership: miniscore.partnerShip || null,
      lastWicket: miniscore.lastWicket || ''
    } : null);

    const result = {
      matchId: String(matchId),
      innings,
      available: innings.length > 0,
      status,
      miniscore: formattedMiniscore
    };

    scorecardCache.set(matchId, { data: result, time: now });
    return result;
  } catch (err) {
    console.error(`Error fetching scorecard for match ${matchId}:`, err.message);
    const fallback = {
      matchId: String(matchId),
      innings: [],
      available: false,
      message: 'Scorecard temporarily unavailable'
    };
    return fallback;
  }
}

/**
 * Fetch authentic squads / playing XIs for a match
 */
async function fetchMatchSquads(matchId, matchRecord) {
  const now = Date.now();
  if (squadCache.has(matchId)) {
    const cached = squadCache.get(matchId);
    if (now - cached.time < 300000) {
      return cached.data;
    }
  }

  let squadA = [];
  let squadB = [];

  // 1. Try fetching from Cricbuzz Match Squads page
  try {
    const url = `https://www.cricbuzz.com/cricket-match-squads/${matchId}/match`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 7000
    });

    const html = res.data;
    const teamAName = matchRecord?.teamA || '';
    const teamBName = matchRecord?.teamB || '';

    // Helper to extract player objects from a section of HTML
    const extractPlayersFromHtml = (htmlChunk) => {
      const list = [];
      const linkRegex = /<a[^>]*href="\/profiles\/(\d+)\/([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
      let m;
      while ((m = linkRegex.exec(htmlChunk)) !== null) {
        const id = m[1];
        const inner = m[3];
        const imgMatch = inner.match(/src="([^"]+)"/);
        const nameMatch = inner.match(/<span>([^<]+)<\/span>/);
        const badgeMatch = inner.match(/<span[^>]*>\s*(\([CWK\s]+\))\s*<\/span>/);
        const roleMatch = inner.match(/<div class="text-cbTxtSec text-xs">([^<]+)<\/div>/);

        const name = nameMatch ? nameMatch[1].trim() : '';
        const badge = badgeMatch ? badgeMatch[1].trim().toUpperCase() : '';
        const role = roleMatch ? roleMatch[1].trim() : '';
        let image = imgMatch ? imgMatch[1].replace(/&amp;/g, '&') : '';

        if (name && !name.toLowerCase().includes('playing xi') && !name.toLowerCase().includes('bench')) {
          const isCaptain = badge.includes('(C)') || badge.includes('C');
          const isKeeper = badge.includes('(WK)') || badge.includes('WK') || role.toLowerCase().includes('wk');
          list.push({
            id,
            name,
            image,
            role,
            isCaptain,
            isKeeper,
            badge
          });
        }
      }
      return list;
    };

    // Find headings or boundaries for Team 1 and Team 2 in squads page
    // Cricbuzz squads pages render Team 1 followed by Team 2
    const allSquadPlayers = extractPlayersFromHtml(html);
    if (allSquadPlayers.length >= 11) {
      // Split between team 1 and team 2
      // Check if team 1 is teamA or teamB
      const half = Math.ceil(allSquadPlayers.length / 2);
      squadA = allSquadPlayers.slice(0, half);
      squadB = allSquadPlayers.slice(half);
    }
  } catch (err) {
    // continue to fallback
  }

  // 2. Fallback: extract from scorecard if Cricbuzz squads page didn't provide enough
  if (squadA.length === 0 && squadB.length === 0) {
    try {
      const sc = await fetchMatchScorecard(matchId);
      if (sc && sc.innings && sc.innings.length > 0) {
        const teamAName = matchRecord?.teamA || '';
        const teamBName = matchRecord?.teamB || '';

        sc.innings.forEach(inn => {
          const allPlayers = [
            ...inn.batting.map(b => typeof b.batsman === 'object' ? b.batsman : { name: b.batsman, role: 'Batter' }),
            ...(inn.didNotBat || []).map(p => typeof p === 'object' ? p : { name: p, role: 'Player' })
          ];

          if (teamAName && inn.teamName.toLowerCase().includes(teamAName.toLowerCase())) {
            squadA = allPlayers;
          } else if (teamBName && inn.teamName.toLowerCase().includes(teamBName.toLowerCase())) {
            squadB = allPlayers;
          } else if (squadA.length === 0) {
            squadA = allPlayers;
          } else if (squadB.length === 0) {
            squadB = allPlayers;
          }
        });
      }
    } catch (e) {}
  }

  const result = {
    matchId: String(matchId),
    teamA: matchRecord?.teamA || 'Team A',
    teamB: matchRecord?.teamB || 'Team B',
    squadA: squadA.length > 0 ? squadA : (matchRecord?.squadA || []),
    squadB: squadB.length > 0 ? squadB : (matchRecord?.squadB || [])
  };

  squadCache.set(matchId, { data: result, time: now });
  return result;
}

module.exports = {
  convertGmtToIst,
  fetchAllRealMatches,
  fetchMatchScorecard,
  fetchLiveTelemetry,
  fetchMatchSquads
};
