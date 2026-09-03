/**
 * Converts any GMT/UTC date or status string to Indian Standard Time (IST)
 * E.g., "Match starts at Sep 01, 12:00 GMT" -> "Match starts at Sep 01, 5:30 PM IST"
 * E.g., "Starts Tomorrow at 19:30 GMT • Toss in 18 hrs" -> "Starts Tomorrow at 1:00 AM IST • Toss in 18 hrs"
 */
export function formatToIST(text) {
  if (!text || typeof text !== 'string') return text || '';

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

export function formatDateDisplay(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr || '';
  // Convert "2026-09-02" or ISO dates to "2 Sep 2026"
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.slice(0, 10).split('-');
    const y = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${mNames[mIdx] || parts[1]} ${y}`;
  }
  return formatToIST(dateStr);
}

