import type { ArrivalPrecision, DatePrecision } from '../types/pet';

const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000; // average month length — this is an estimate by definition

export function monthsToApproxBirthDate(months: number, now: number): number {
  return Math.round(now - months * MS_PER_MONTH);
}

// Read-only counterpart to GracefulDateField's input UI — same four
// precisions, phrased for display rather than editing (AddPetScreen's
// Review step and PetHomeScreen's About card both format birth date
// this way, so the wording only lives here once).
export function formatGracefulDate(
  date: number | null,
  precision: DatePrecision | null,
  approximateAgeMonths: number | null
): string {
  if (precision == null || precision === 'unknown') return "Don't know";
  if (precision === 'approxAge') {
    if (approximateAgeMonths == null) return "Don't know";
    const years = Math.floor(approximateAgeMonths / 12);
    const months = approximateAgeMonths % 12;
    const parts: string[] = [];
    if (years > 0) parts.push(`${years} yr${years === 1 ? '' : 's'}`);
    if (months > 0 || parts.length === 0) parts.push(`${months} mo`);
    return `~${parts.join(' ')} old`;
  }
  if (date == null) return "Don't know";
  const formatted = new Date(date).toLocaleDateString();
  return precision === 'roughly' ? `Roughly ${formatted}` : formatted;
}

// Arrival date's precision has no approxAge option and, unlike birth date,
// can be null — meaning the question was skipped entirely, which reads
// differently from "answered: don't know" (precision === 'unknown').
export function formatArrivalDate(date: number | null, precision: ArrivalPrecision | null): string {
  if (precision == null) return 'Not set';
  if (precision === 'unknown') return "Don't know";
  if (date == null) return "Don't know";
  const formatted = new Date(date).toLocaleDateString();
  return precision === 'roughly' ? `Roughly ${formatted}` : formatted;
}
