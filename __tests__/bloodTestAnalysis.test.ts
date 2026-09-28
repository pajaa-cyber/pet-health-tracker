import {
  computeMarkerStatus,
  summarizeBloodTest,
  notableResults,
  generateVetQuestions,
  markerTrend,
  describeTrend,
} from '../src/pets/bloodTestAnalysis';
import { BloodMarkerResult, BloodTest } from '../src/types/bloodTest';

const result = (overrides: Partial<BloodMarkerResult> = {}): BloodMarkerResult => ({
  marker: 'ALT', value: 145, unit: 'U/L', referenceLow: 10, referenceHigh: 100,
  ...overrides,
});

describe('computeMarkerStatus', () => {
  it('is "high" when the value is above the reference range', () => {
    expect(computeMarkerStatus(result({ value: 145, referenceLow: 10, referenceHigh: 100 }))).toBe('high');
  });

  it('is "low" when the value is below the reference range', () => {
    expect(computeMarkerStatus(result({ value: 5, referenceLow: 10, referenceHigh: 100 }))).toBe('low');
  });

  it('is "normal" when the value is within range, inclusive of the boundaries', () => {
    expect(computeMarkerStatus(result({ value: 50, referenceLow: 10, referenceHigh: 100 }))).toBe('normal');
    expect(computeMarkerStatus(result({ value: 10, referenceLow: 10, referenceHigh: 100 }))).toBe('normal');
    expect(computeMarkerStatus(result({ value: 100, referenceLow: 10, referenceHigh: 100 }))).toBe('normal');
  });

  it('is "unknown" ("not interpreted") when no reference range was entered', () => {
    expect(computeMarkerStatus(result({ referenceLow: null, referenceHigh: null }))).toBe('unknown');
  });
});

describe('summarizeBloodTest', () => {
  it('counts each status bucket', () => {
    const results = [
      result({ marker: 'ALT', value: 145, referenceLow: 10, referenceHigh: 100 }), // high
      result({ marker: 'WBC', value: 12.2, referenceLow: 5.5, referenceHigh: 16.9 }), // normal
      result({ marker: 'Unknown Thing', value: 1, referenceLow: null, referenceHigh: null }), // unknown
    ];
    expect(summarizeBloodTest(results)).toEqual({ total: 3, high: 1, low: 0, normal: 1, unknown: 1 });
  });
});

describe('notableResults', () => {
  it('returns only high/low results, in original order', () => {
    const results = [
      result({ marker: 'Normal One', value: 50, referenceLow: 10, referenceHigh: 100 }),
      result({ marker: 'High One', value: 200, referenceLow: 10, referenceHigh: 100 }),
      result({ marker: 'Low One', value: 1, referenceLow: 10, referenceHigh: 100 }),
    ];
    expect(notableResults(results).map((r) => r.marker)).toEqual(['High One', 'Low One']);
  });
});

describe('generateVetQuestions', () => {
  it('returns no questions when nothing is abnormal', () => {
    expect(generateVetQuestions([result({ value: 50, referenceLow: 10, referenceHigh: 100 })])).toEqual([]);
  });

  it('generates generic, non-diagnostic questions for an abnormal marker', () => {
    const questions = generateVetQuestions([result({ marker: 'ALT', value: 145, referenceLow: 10, referenceHigh: 100 })]);
    expect(questions.some((q) => q.includes('ALT'))).toBe(true);
    expect(questions.join(' ')).not.toMatch(/disease|liver damage|diagnos/i);
  });
});

describe('markerTrend', () => {
  const test = (testDate: number, value: number): BloodTest => ({
    id: `t${testDate}`, petId: 'pet-1', testDate, laboratory: 'Lab',
    results: [result({ marker: 'alt', value, referenceLow: 10, referenceHigh: 100 })],
  });

  it('collects one marker\'s values across tests, oldest first, matched case-insensitively', () => {
    const tests = [test(300, 118), test(100, 82), test(200, 101)];
    const trend = markerTrend(tests, 'ALT');
    expect(trend.map((p) => p.value)).toEqual([82, 101, 118]);
  });

  it('ignores tests that don\'t include the requested marker', () => {
    const withOther: BloodTest = { id: 'x', petId: 'pet-1', testDate: 400, laboratory: 'Lab', results: [result({ marker: 'WBC', value: 10 })] };
    const trend = markerTrend([test(100, 82), withOther], 'ALT');
    expect(trend).toHaveLength(1);
  });
});

describe('describeTrend', () => {
  it('returns "insufficient data" with fewer than two points', () => {
    expect(describeTrend([])).toBe('insufficient data');
    expect(describeTrend([{ testDate: 1, value: 10, status: 'normal' }])).toBe('insufficient data');
  });

  it('returns "increased" when the last value is meaningfully higher than the first', () => {
    const points = [{ testDate: 1, value: 82, status: 'normal' as const }, { testDate: 2, value: 145, status: 'high' as const }];
    expect(describeTrend(points)).toBe('increased');
  });

  it('returns "decreased" when the last value is meaningfully lower than the first', () => {
    const points = [{ testDate: 1, value: 145, status: 'high' as const }, { testDate: 2, value: 82, status: 'normal' as const }];
    expect(describeTrend(points)).toBe('decreased');
  });

  it('returns "stable" for a small change', () => {
    const points = [{ testDate: 1, value: 100, status: 'normal' as const }, { testDate: 2, value: 102, status: 'normal' as const }];
    expect(describeTrend(points)).toBe('stable');
  });
});
