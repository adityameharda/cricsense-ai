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

  // 3. 2-Minute Deadline cutoff check
  if (match.dateTimeGMT || match.date) {
    const timeStr = match.dateTimeGMT || match.date;
    const matchTime = new Date(timeStr).getTime();

    // Check if matchTime is a valid future timestamp
    if (!isNaN(matchTime) && matchTime > 1600000000000) {
      const now = Date.now();
      const diffMs = matchTime - now;

      // If scheduled start time is in the past or within 2 minutes (120,000 ms)
      if (diffMs <= 2 * 60 * 1000 && diffMs > -6 * 60 * 60 * 1000) {
        return {
          eligible: false,
          error: 'Not applicable now. Contests and squad entries close 2 minutes before match start.'
        };
      }
    }
  }

  return { eligible: true };
}

module.exports = { checkMatchEntryEligibility };
