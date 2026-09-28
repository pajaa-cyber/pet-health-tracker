import { computeWeightTrend, computeWeightChangeOverDays } from '../src/pets/weightTrend';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('computeWeightTrend', () => {
  it('returns null with fewer than two entries', () => {
    expect(computeWeightTrend([])).toBeNull();
    expect(computeWeightTrend([{ date: 1, weight: 5 }])).toBeNull();
  });

  it('reports an upward trend as a positive percent', () => {
    const trend = computeWeightTrend([
      { date: 1, weight: 5 },
      { date: 2, weight: 5.21 },
    ]);
    expect(trend?.direction).toBe('up');
    expect(trend?.percent).toBeCloseTo(4.2, 1);
  });

  it('reports a downward trend as a negative percent', () => {
    const trend = computeWeightTrend([
      { date: 1, weight: 10 },
      { date: 2, weight: 9 },
    ]);
    expect(trend?.direction).toBe('down');
    expect(trend?.percent).toBeCloseTo(-10, 1);
  });

  it('treats a negligible change as flat', () => {
    const trend = computeWeightTrend([
      { date: 1, weight: 10 },
      { date: 2, weight: 10.001 },
    ]);
    expect(trend?.direction).toBe('flat');
  });

  it('compares the two most recent entries regardless of input order', () => {
    const trend = computeWeightTrend([
      { date: 3, weight: 6 },
      { date: 1, weight: 5 },
      { date: 2, weight: 5.5 },
    ]);
    // Most recent two by date are (2, 5.5) -> (3, 6)
    expect(trend?.percent).toBeCloseTo(((6 - 5.5) / 5.5) * 100, 5);
  });

  it('returns null rather than dividing by zero when the previous weight is zero', () => {
    expect(computeWeightTrend([{ date: 1, weight: 0 }, { date: 2, weight: 5 }])).toBeNull();
  });
});

describe('computeWeightChangeOverDays', () => {
  const now = 100 * DAY_MS;

  it('returns null with fewer than two entries', () => {
    expect(computeWeightChangeOverDays([], 30, now)).toBeNull();
    expect(computeWeightChangeOverDays([{ date: now, weight: 5 }], 30, now)).toBeNull();
  });

  it('compares against the most recent entry at or before the window start', () => {
    const logs = [
      { date: now - 40 * DAY_MS, weight: 28.3 },
      { date: now - 10 * DAY_MS, weight: 29.0 },
      { date: now, weight: 29.4 },
    ];
    const result = computeWeightChangeOverDays(logs, 30, now);
    expect(result?.currentKg).toBe(29.4);
    // reference = last entry <= (now - 30d) = the one at now-40d (28.3)
    expect(result?.deltaKg).toBeCloseTo(29.4 - 28.3, 5);
  });

  it('falls back to the oldest entry when logging is too sparse for the full window', () => {
    const logs = [
      { date: now - 5 * DAY_MS, weight: 10 },
      { date: now, weight: 10.5 },
    ];
    const result = computeWeightChangeOverDays(logs, 30, now);
    expect(result?.deltaKg).toBeCloseTo(0.5, 5);
  });
});
