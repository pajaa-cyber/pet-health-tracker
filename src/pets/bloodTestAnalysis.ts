import { BloodTest, BloodMarkerResult } from '../types/bloodTest';
import { lookupBloodMarker } from './bloodMarkerGlossary';

// Layered by design, per the owner's own spec — never collapse "the number
// is above the reference range" into a medical conclusion:
//   1. OCR/manual entry -> raw marker/value/unit/range (AddBloodTestScreen)
//   2. Owner confirms what was entered (manual entry IS this layer here —
//      no auto-extraction from a photo without a human checking it first)
//   3. computeMarkerStatus() — mechanical reference-range comparison only
//   4. bloodMarkerGlossary.ts — what the marker generally is, unconditional
//      on whether this result is high/low/normal
//   5. generateVetQuestions() — generic templated prompts, never a verdict

export type MarkerStatus = 'high' | 'low' | 'normal' | 'unknown';

// Layer 3. A marker with no reference range entered can't be judged at
// all — 'unknown' ("not interpreted"), never guessed at from the value alone.
export function computeMarkerStatus(result: BloodMarkerResult): MarkerStatus {
  if (result.referenceLow == null || result.referenceHigh == null) return 'unknown';
  if (result.value > result.referenceHigh) return 'high';
  if (result.value < result.referenceLow) return 'low';
  return 'normal';
}

export interface BloodTestSummary {
  total: number;
  high: number;
  low: number;
  normal: number;
  unknown: number;
}

export function summarizeBloodTest(results: BloodMarkerResult[]): BloodTestSummary {
  const summary: BloodTestSummary = { total: results.length, high: 0, low: 0, normal: 0, unknown: 0 };
  for (const r of results) {
    summary[computeMarkerStatus(r)]++;
  }
  return summary;
}

// "Notable results" — the out-of-range ones only, original order kept.
export function notableResults(results: BloodMarkerResult[]): BloodMarkerResult[] {
  return results.filter((r) => {
    const status = computeMarkerStatus(r);
    return status === 'high' || status === 'low';
  });
}

// Layer 5 — generic, templated follow-up prompts for the owner to bring to
// a vet. Never states or implies a diagnosis; the wording stays the same
// regardless of which marker or how far out of range it is.
export function generateVetQuestions(results: BloodMarkerResult[]): string[] {
  const abnormal = notableResults(results);
  const questions: string[] = [];
  for (const r of abnormal) {
    const status = computeMarkerStatus(r);
    const label = lookupBloodMarker(r.marker)?.name ?? r.marker;
    questions.push(`Is the ${label} ${status === 'high' ? 'elevation' : 'low value'} clinically significant?`);
    questions.push(`Should ${label} be rechecked?`);
  }
  if (abnormal.length > 0) {
    questions.push('Are any medications or recent symptoms relevant to these results?');
  }
  return questions;
}

export interface MarkerTrendPoint {
  testDate: number;
  value: number;
  status: MarkerStatus;
}

// One marker's value across every one of this pet's recorded blood tests,
// oldest first. Matched case-insensitively so "ALT" and "alt" entered on
// different visits count as the same marker.
export function markerTrend(tests: BloodTest[], marker: string): MarkerTrendPoint[] {
  const target = marker.trim().toLowerCase();
  const points: MarkerTrendPoint[] = [];
  for (const t of tests) {
    for (const r of t.results) {
      if (r.marker.trim().toLowerCase() === target) {
        points.push({ testDate: t.testDate, value: r.value, status: computeMarkerStatus(r) });
      }
    }
  }
  return points.sort((a, b) => a.testDate - b.testDate);
}

export type TrendDirection = 'increased' | 'decreased' | 'stable' | 'insufficient data';

// A plain statement about the numbers only ("ALT has increased across the
// recorded tests") — deliberately not a clinical claim. Compares only the
// first and last recorded points, not every step between, so one noisy
// middle reading doesn't flip the headline.
export function describeTrend(points: MarkerTrendPoint[]): TrendDirection {
  if (points.length < 2) return 'insufficient data';
  const first = points[0].value;
  const last = points[points.length - 1].value;
  if (first === 0) return last === 0 ? 'stable' : 'increased';
  const percentChange = ((last - first) / Math.abs(first)) * 100;
  if (Math.abs(percentChange) < 5) return 'stable';
  return percentChange > 0 ? 'increased' : 'decreased';
}
