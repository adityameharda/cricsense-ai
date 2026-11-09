/**
 * Team name matching for CricSense questions.
 *
 * People write "Ind", "Aussies", "Proteas", "Kiwis", "WI" or "Perth" instead of
 * the full name stored on the match ("India", "Australia", "Perth Scorchers"...).
 * Aliases map those to the canonical national side; anything else (franchise,
 * domestic, associate sides) is matched on the distinctive words of its name.
 */

// canonical name (lower case, men's side) → nicknames / short codes people type
const ALIASES = {
  india: ['ind', 'india', 'indian', 'team india', 'men in blue', 'bharat'],
  australia: ['aus', 'australia', 'australian', 'aussie', 'aussies'],
  england: ['eng', 'england', 'english', 'three lions'],
  'south africa': ['sa', 'rsa', 'south africa', 'south african', 'proteas', 'saffers'],
  'new zealand': ['nz', 'new zealand', 'kiwi', 'kiwis', 'black caps', 'blackcaps'],
  pakistan: ['pak', 'pakistan', 'pakistani', 'men in green'],
  'sri lanka': ['sl', 'sri lanka', 'srilanka', 'lanka', 'lankan', 'lankans'],
  'west indies': ['wi', 'windies', 'west indies', 'caribbean'],
  afghanistan: ['afg', 'afghanistan', 'afghan', 'afghans'],
  bangladesh: ['ban', 'bd', 'bangladesh', 'bangla'],
  zimbabwe: ['zim', 'zimbabwe', 'chevrons'],
  ireland: ['ire', 'ireland', 'irish'],
  netherlands: ['ned', 'netherlands', 'dutch', 'holland'],
  scotland: ['sco', 'scotland', 'scots', 'scottish'],
  'united arab emirates': ['uae', 'united arab emirates', 'emirates'],
  nepal: ['nep', 'nepal'],
  'united states of america': ['usa', 'united states', 'america', 'american'],
  namibia: ['nam', 'namibia'],
  oman: ['oman'],
  canada: ['canada'],
};

// Women's sides have their own nicknames
const WOMEN_ALIASES = {
  'new zealand': ['white ferns'],
  australia: ['southern stars'],
};

// Words that appear in many team names and say nothing about which team is meant
const GENERIC_WORDS = new Set([
  'women', 'woman', 'team', 'club', 'cricket', 'united', 'city', 'super', 'kings', 'royal', 'royals',
  'xi', 'the', 'and', 'of', 'state', 'county', 'a', 'u19', 'under', 'east', 'west', 'north', 'south',
  'central', 'eastern', 'western', 'northern', 'southern', 'new',
]);

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasPhrase = (text, phrase) => new RegExp(`(^|[^a-z0-9])${escapeRe(phrase)}('s)?(?=$|[^a-z0-9])`, 'i').test(text);

const normalise = (s = '') => String(s).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
const isWomenTeam = (name = '') => /\bwomen\b/i.test(name);
const baseName = (name = '') => normalise(name).replace(/\bwomen\b/, '').replace(/\s+/g, ' ').trim();

/** Does the question say it's about women's cricket? ("India women", "IND-W", "indw") */
function mentionsWomen(query = '') {
  const q = normalise(query);
  if (/\b(women|womens|women's|ladies)\b/.test(q)) return true;
  // short code + w: "ind w", "ind-w", "indw", "aus w"
  const codes = Object.values(ALIASES).flat().filter((a) => a.length <= 3 && /^[a-z]+$/.test(a));
  if (codes.some((c) => new RegExp(`\\b${c}[ -]?w\\b`).test(q))) return true;
  return Object.values(WOMEN_ALIASES).flat().some((a) => hasPhrase(q, a));
}

/**
 * How strongly does the question name this team? 0 = not at all.
 * 3 = full name or a known alias, 2 = short code + "w" for a women's side,
 * 1 = a distinctive word of a franchise/domestic name ("perth" → Perth Scorchers).
 */
function teamMentionScore(query, teamName) {
  const q = normalise(query);
  const full = normalise(teamName);
  const base = baseName(teamName);
  if (!base) return 0;

  if (hasPhrase(q, full) || hasPhrase(q, base)) return 3;

  const aliases = [...(ALIASES[base] || [])];
  if (isWomenTeam(teamName)) aliases.push(...(WOMEN_ALIASES[base] || []));
  for (const a of aliases) {
    if (hasPhrase(q, a)) return 3;
    if (a.length <= 3 && new RegExp(`\\b${escapeRe(a)}[ -]?w\\b`).test(q)) return 3; // "ind-w"
  }

  // Distinctive words of other names: "perth", "scorchers", "mumbai"
  const words = base.split(/[\s-]+/).filter((w) => w.length >= 4 && !GENERIC_WORDS.has(w));
  if (words.some((w) => hasPhrase(q, w))) return 1;
  return 0;
}

/** Canonical national-team names mentioned in the question (used for the player directory). */
function teamsMentioned(query) {
  const q = normalise(query);
  return Object.entries(ALIASES)
    .filter(([, list]) => list.some((a) => hasPhrase(q, a)))
    .map(([name]) => name);
}

module.exports = { teamMentionScore, teamsMentioned, mentionsWomen, isWomenTeam, baseName, ALIASES };
