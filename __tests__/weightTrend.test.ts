import { computeWeightTrend } from '../src/pets/weightTrend';

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
