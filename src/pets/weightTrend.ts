// Percentage change is unit-agnostic — it's a ratio, so this works directly
// on the canonical kg values with no display-unit conversion needed.
export interface WeightTrend {
  percent: number; // signed, e.g. 4.2 or -3.1
  direction: 'up' | 'down' | 'flat';
}

// Compares the two most recent entries ("since your last weigh-in") rather
// than a fixed day window — weight logging is sporadic and manual here, so
// a fixed window (e.g. "last 30 days") could easily land on zero or one
// entry for an owner who logs every few months.
export function computeWeightTrend(logs: { date: number; weight: number }[]): WeightTrend | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const previous = sorted[sorted.length - 2].weight;
  const latest = sorted[sorted.length - 1].weight;
  if (previous === 0) return null;
  const percent = ((latest - previous) / previous) * 100;
  const direction = Math.abs(percent) < 0.05 ? 'flat' : percent > 0 ? 'up' : 'down';
  return { percent, direction };
}

export interface WeightWindowChange {
  currentKg: number;
  deltaKg: number; // signed, current minus the reference point
  referenceDate: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

// For the vet-prep report's "29.4 kg, +1.1 kg / 30 days" line — a fixed
// window makes sense there (a vet reads it as "change over the last
// month"), unlike the dashboard trend above. Reference point is the most
// recent log AT OR BEFORE the window start; if logging is too sparse for
// anything that old, falls back to the very first log on record rather
// than returning nothing.
export function computeWeightChangeOverDays(
  logs: { date: number; weight: number }[],
  days: number,
  now: number
): WeightWindowChange | null {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const current = sorted[sorted.length - 1];
  const cutoff = now - days * DAY_MS;
  const reference = [...sorted].reverse().find((l) => l.date <= cutoff) ?? sorted[0];
  if (reference === current) return null;
  return { currentKg: current.weight, deltaKg: current.weight - reference.weight, referenceDate: reference.date };
}
