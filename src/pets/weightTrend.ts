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
