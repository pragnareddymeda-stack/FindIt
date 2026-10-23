/**
 * Rule-based, explainable matching. No AI.
 *
 * score = 0.35 * category + 0.35 * keywords + 0.15 * date + 0.15 * location   (each component is 0..1)
 *
 * category : 1 if the categories are equal, otherwise 0.
 * keywords : Dice coefficient of the title+description word sets: 2|A and B| / (|A| + |B|).
 *            Words are lower-cased, stop words are dropped and a trailing plural "s" is removed.
 * date     : 1 on the same day, falling linearly to 0 at 14 days apart. A FOUND date that is more
 *            than 1 day before the LOST date scores 0 (an item cannot be found before it was lost).
 * location : 1 if one location contains the other (e.g. "library" and "Central library"),
 *            otherwise the Dice coefficient of the location word sets.
 *
 * A score is a hint, not proof of ownership. Matches never approve a claim.
 */

export const WEIGHTS = { category: 0.35, keywords: 0.35, date: 0.15, location: 0.15 };
export const MATCH_DATE_WINDOW_DAYS = 14;
export const MIN_SCORE = 0.4;
export const MAX_MATCHES = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'near', 'my', 'it', 'is', 'was',
  'were', 'this', 'that', 'found', 'lost', 'from', 'by', 'has', 'have', 'had', 'be', 'been', 'left', 'some',
  'there', 'their', 'his', 'her', 'its', 'are', 'am', 'me', 'we', 'you', 'around', 'inside', 'outside',
]);

export function tokenize(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
    .map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
}

function dice(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const x of A) if (B.has(x)) shared += 1;
  return (2 * shared) / (A.size + B.size);
}

export function categoryScore(a, b) {
  return a.category === b.category ? 1 : 0;
}

export function keywordScore(a, b) {
  return dice(tokenize(`${a.title} ${a.description}`), tokenize(`${b.title} ${b.description}`));
}

export function locationScore(a, b) {
  const la = String(a.location || '').toLowerCase().trim();
  const lb = String(b.location || '').toLowerCase().trim();
  if (!la || !lb) return 0;
  if (la.includes(lb) || lb.includes(la)) return 1;
  return dice(tokenize(la), tokenize(lb));
}

export function dateScore(a, b) {
  const ta = new Date(a.dateOccurred).getTime();
  const tb = new Date(b.dateOccurred).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return 0;
  const lost = a.type === 'LOST' ? ta : b.type === 'LOST' ? tb : null;
  const found = a.type === 'FOUND' ? ta : b.type === 'FOUND' ? tb : null;
  if (lost !== null && found !== null && found < lost - DAY_MS) return 0;
  const days = Math.abs(ta - tb) / DAY_MS;
  return Math.max(0, 1 - days / MATCH_DATE_WINDOW_DAYS);
}

const round2 = (n) => Math.round(n * 100) / 100;

export function scoreMatch(a, b) {
  const parts = {
    category: categoryScore(a, b),
    keywords: keywordScore(a, b),
    date: dateScore(a, b),
    location: locationScore(a, b),
  };
  const total =
    WEIGHTS.category * parts.category +
    WEIGHTS.keywords * parts.keywords +
    WEIGHTS.date * parts.date +
    WEIGHTS.location * parts.location;
  const score = round2(Math.min(1, Math.max(0, total)));
  return {
    score,
    percent: Math.round(score * 100),
    breakdown: {
      category: round2(parts.category),
      keywords: round2(parts.keywords),
      date: round2(parts.date),
      location: round2(parts.location),
    },
  };
}

/** Scores candidates against `source`, drops weak ones, returns the best first. */
export function rankMatches(source, candidates, { minScore = MIN_SCORE, limit = MAX_MATCHES } = {}) {
  return candidates
    .map((candidate) => ({ candidate, ...scoreMatch(source, candidate) }))
    .filter((m) => m.score >= minScore)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
