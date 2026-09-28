import { lastDoneByType, formatLastDone } from '../src/pets/preventiveCare';
import { CalendarEvent } from '../src/types/calendarEvent';

const DAY_MS = 24 * 60 * 60 * 1000;

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'e1', householdId: 'h1', petIds: ['pet-1'], type: 'teeth', title: 'Teeth', notes: '',
  date: 1000, status: 'completed',
  ...overrides,
});

describe('lastDoneByType', () => {
  it('returns the most recent completed date per type', () => {
    const events = [
      event({ id: 'e1', type: 'teeth', date: 1000 }),
      event({ id: 'e2', type: 'teeth', date: 2000 }),
      event({ id: 'e3', type: 'bath', date: 500 }),
    ];
    const result = lastDoneByType(events, 'pet-1');
    expect(result.teeth).toBe(2000);
    expect(result.bath).toBe(500);
  });

  it('ignores events for a different pet', () => {
    const events = [event({ petIds: ['other-pet'], date: 5000 })];
    expect(lastDoneByType(events, 'pet-1').teeth).toBeUndefined();
  });

  it('ignores events that are not completed', () => {
    const events = [event({ status: 'upcoming', date: 5000 })];
    expect(lastDoneByType(events, 'pet-1').teeth).toBeUndefined();
  });

  it('ignores event types outside the preventive-care list', () => {
    const events = [event({ type: 'medical', date: 5000 })];
    expect(Object.keys(lastDoneByType(events, 'pet-1'))).toHaveLength(0);
  });

  it('covers a pet with joint events (multiple petIds)', () => {
    const events = [event({ petIds: ['pet-1', 'pet-2'], date: 3000 })];
    expect(lastDoneByType(events, 'pet-1').teeth).toBe(3000);
    expect(lastDoneByType(events, 'pet-2').teeth).toBe(3000);
  });
});

describe('formatLastDone', () => {
  const now = 10 * DAY_MS;

  it('returns "Not logged yet" for undefined', () => {
    expect(formatLastDone(undefined, now)).toBe('Not logged yet');
  });

  it('returns "Today" for the same day', () => {
    expect(formatLastDone(now, now)).toBe('Today');
  });

  it('returns "Yesterday" for exactly one day ago', () => {
    expect(formatLastDone(now - DAY_MS, now)).toBe('Yesterday');
  });

  it('returns "Nd ago" for further back', () => {
    expect(formatLastDone(now - 5 * DAY_MS, now)).toBe('5d ago');
  });
});
