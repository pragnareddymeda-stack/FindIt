import { describe, it, expect } from 'vitest';
import { tokenize, scoreMatch, rankMatches, dateScore, locationScore, keywordScore, WEIGHTS, MIN_SCORE } from '../src/services/matching.js';

const lost = (o = {}) => ({
  type: 'LOST', category: 'WALLETS_PURSES', title: 'Black leather wallet',
  description: 'Lost near the library entrance', location: 'Central library', dateOccurred: '2026-10-10', ...o,
});
const found = (o = {}) => ({
  type: 'FOUND', category: 'WALLETS_PURSES', title: 'Black leather wallet',
  description: 'Found near the library entrance', location: 'Central library', dateOccurred: '2026-10-10', ...o,
});

describe('weights', () => {
  it('sum to 1 and match the documented formula', () => {
    expect(WEIGHTS).toEqual({ category: 0.35, keywords: 0.35, date: 0.15, location: 0.15 });
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });
});

describe('tokenize', () => {
  it('lower-cases, drops stop words and punctuation, and strips plural s', () => {
    expect(tokenize('The Keys, and WALLETS!')).toEqual(['key', 'wallet']);
  });
  it('keeps words ending in ss and short words ending in s', () => {
    expect(tokenize('glass bus')).toEqual(['glass', 'bus']);
  });
  it('handles empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize(undefined)).toEqual([]);
  });
});

describe('scoreMatch', () => {
  it('gives 1.0 for the same item on the same day in the same place', () => {
    const r = scoreMatch(lost(), found());
    expect(r.score).toBe(1);
    expect(r.percent).toBe(100);
    expect(r.breakdown).toEqual({ category: 1, keywords: 1, date: 1, location: 1 });
  });

  it('loses exactly the category weight when only the category differs', () => {
    expect(scoreMatch(lost(), found({ category: 'OTHER' })).score).toBe(0.65);
  });

  it('scores completely different reports near zero', () => {
    const r = scoreMatch(lost(), found({ category: 'KEYS', title: 'Silver bicycle', description: 'Parked outside gym', location: 'Sports ground', dateOccurred: '2026-12-25' }));
    expect(r.score).toBe(0);
  });

  it('keeps every component and the total between 0 and 1', () => {
    const r = scoreMatch(lost(), found({ title: 'Wallet', description: 'brown', location: 'library block', dateOccurred: '2026-10-14' }));
    for (const v of [r.score, ...Object.values(r.breakdown)]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('is symmetric', () => {
    expect(scoreMatch(lost(), found({ title: 'Brown wallet' })).score).toBe(scoreMatch(found({ title: 'Brown wallet' }), lost()).score);
  });
});

describe('component scores', () => {
  it('date: linear decay over 14 days', () => {
    expect(dateScore(lost(), found({ dateOccurred: '2026-10-17' }))).toBeCloseTo(0.5);
    expect(dateScore(lost(), found({ dateOccurred: '2026-10-24' }))).toBe(0);
    expect(dateScore(lost(), found({ dateOccurred: '2027-01-01' }))).toBe(0);
  });
  it('date: an item found more than a day before it was lost cannot match', () => {
    expect(dateScore(lost(), found({ dateOccurred: '2026-10-05' }))).toBe(0);
    expect(dateScore(lost(), found({ dateOccurred: '2026-10-09' }))).toBeGreaterThan(0.9); // one day of slack
  });
  it('date: invalid dates score 0', () => {
    expect(dateScore(lost({ dateOccurred: 'nope' }), found())).toBe(0);
  });
  it('location: containment counts as a full match, otherwise word overlap', () => {
    expect(locationScore({ location: 'library' }, { location: 'Central Library' })).toBe(1);
    expect(locationScore({ location: 'Hostel B canteen' }, { location: 'Hostel A canteen' })).toBeGreaterThan(0);
    expect(locationScore({ location: 'Gym' }, { location: 'Cafeteria' })).toBe(0);
    expect(locationScore({ location: '' }, { location: 'Cafeteria' })).toBe(0);
  });
  it('keywords: partial overlap lands between 0 and 1', () => {
    const k = keywordScore(lost(), found({ title: 'Brown leather wallet', description: 'Found on a bench' }));
    expect(k).toBeGreaterThan(0);
    expect(k).toBeLessThan(1);
  });
});

describe('rankMatches', () => {
  const pool = [
    found({ title: 'Silver bicycle', category: 'OTHER', description: 'Parked at gym', location: 'Gym', dateOccurred: '2026-12-01' }),
    found({ title: 'Black wallet', description: 'Found near library' }),
    found({ title: 'Black leather wallet' }),
  ];

  it('sorts best first and drops weak matches', () => {
    const ranked = rankMatches(lost(), pool);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].candidate.title).toBe('Black leather wallet');
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked.every((m) => m.score >= MIN_SCORE)).toBe(true);
  });

  it('honours the limit', () => {
    expect(rankMatches(lost(), pool, { limit: 1 })).toHaveLength(1);
  });
});
