/**
 * Match Timing & Entry Eligibility Helper
 * Rules:
 * 1. Contests can ONLY be created before match starts.
 * 2. Nobody can create a contest, join a contest, or submit a fantasy squad
 *    within 2 minutes of match start, or once the match has started / concluded.
 * 3. Returns message "Not applicable now..." if cutoff has passed.
 */

function checkMatchEntryEligibility(match) {
  if (!match) {
    return { eligible: false, error: 'Match not found.' };
  }

  // 1. Concluded matches
  if (match.matchEnded) {
    return {
      eligible: false,
      error: 'Not applicable now. Match has concluded. Contest creation and squad registration are closed.'
    };
  }

  // 2. Live / Started matches
  if (match.matchStarted) {
    return {
      eligible: false,
      error: 'Not applicable now. Contests and squad entries close before the match begins.'
    };
  }

  // 3. 2-minute deadline, using the real scheduled start time from Cricbuzz.
  // (A date-only value like "2026-11-10" is midnight UTC, not the start time, so it
  // is not used for the cutoff.)
  const matchTime = Number(match.startTime);
  if (Number.isFinite(matchTime) && matchTime > 1600000000000) {
    if (matchTime - Date.now() <= 2 * 60 * 1000) {
      return {
        eligible: false,
        error: 'Not applicable now. Contests and squad entries close 2 minutes before match start.'
      };
    }
  }

  return { eligible: true };
}

module.exports = { checkMatchEntryEligibility };
