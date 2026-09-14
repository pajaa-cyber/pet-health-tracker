import { monthsToApproxBirthDate } from '../src/pets/dateGrace';

describe('monthsToApproxBirthDate', () => {
  it('computes a birth date roughly N months before now', () => {
    const now = new Date('2026-09-14T00:00:00Z').getTime();
    const result = monthsToApproxBirthDate(12, now);
    const daysBack = (now - result) / (24 * 60 * 60 * 1000);
    expect(daysBack).toBeGreaterThan(360);
    expect(daysBack).toBeLessThan(370);
  });

  it('returns a value less than or equal to now for a positive age', () => {
    const now = Date.now();
    expect(monthsToApproxBirthDate(3, now)).toBeLessThanOrEqual(now);
  });

  it('returns exactly now for an age of 0 months', () => {
    const now = Date.now();
    expect(monthsToApproxBirthDate(0, now)).toBe(now);
  });
});
