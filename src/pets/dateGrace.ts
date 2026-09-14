const MS_PER_MONTH = 30.44 * 24 * 60 * 60 * 1000; // average month length — this is an estimate by definition

export function monthsToApproxBirthDate(months: number, now: number): number {
  return Math.round(now - months * MS_PER_MONTH);
}
