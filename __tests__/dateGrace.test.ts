import { monthsToApproxBirthDate, formatGracefulDate, formatArrivalDate, formatPetAge } from '../src/pets/dateGrace';

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

describe('formatGracefulDate', () => {
  const date = new Date('2026-01-15T00:00:00').getTime();

  it('formats an exact date plainly', () => {
    expect(formatGracefulDate(date, 'exact', null)).toBe(new Date(date).toLocaleDateString());
  });

  it('prefixes a rough date with "Roughly"', () => {
    expect(formatGracefulDate(date, 'roughly', null)).toBe(`Roughly ${new Date(date).toLocaleDateString()}`);
  });

  it('renders an approximate age in years and months', () => {
    expect(formatGracefulDate(null, 'approxAge', 14)).toBe('~1 yr 2 mo old');
  });

  it('renders an approximate age under a year as months only', () => {
    expect(formatGracefulDate(null, 'approxAge', 6)).toBe('~6 mo old');
  });

  it("returns \"Don't know\" for precision unknown", () => {
    expect(formatGracefulDate(null, 'unknown', null)).toBe("Don't know");
  });

  it("returns \"Don't know\" for a null precision", () => {
    expect(formatGracefulDate(null, null, null)).toBe("Don't know");
  });
});

describe('formatArrivalDate', () => {
  const date = new Date('2026-01-15T00:00:00').getTime();

  it('returns "Not set" when the question was skipped entirely', () => {
    expect(formatArrivalDate(null, null)).toBe('Not set');
  });

  it("returns \"Don't know\" when answered as unknown", () => {
    expect(formatArrivalDate(null, 'unknown')).toBe("Don't know");
  });

  it('formats an exact date plainly', () => {
    expect(formatArrivalDate(date, 'exact')).toBe(new Date(date).toLocaleDateString());
  });

  it('prefixes a rough date with "Roughly"', () => {
    expect(formatArrivalDate(date, 'roughly')).toBe(`Roughly ${new Date(date).toLocaleDateString()}`);
  });
});

describe('formatPetAge', () => {
  const DAY_MS = 24 * 60 * 60 * 1000;

  it('shows whole years once at least a year old', () => {
    const now = Date.now();
    const birthDate = now - 3 * 365.25 * DAY_MS;
    expect(formatPetAge(birthDate, now)).toBe('3 yr');
  });

  // The bug this guards against: a pet born this year used to show "0 yr",
  // which reads like a placeholder or an error rather than an age.
  it('shows months, not "0 yr", for a pet under a year old', () => {
    const now = Date.now();
    const birthDate = now - 2 * 30.44 * DAY_MS;
    expect(formatPetAge(birthDate, now)).toBe('2 mo');
  });

  it('never shows a negative month count for a birth date at/after now', () => {
    const now = Date.now();
    expect(formatPetAge(now, now)).toBe('0 mo');
    expect(formatPetAge(now + DAY_MS, now)).toBe('0 mo');
  });
});
