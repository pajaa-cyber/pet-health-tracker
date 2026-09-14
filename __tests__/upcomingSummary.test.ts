import { getNextDue } from '../src/pets/upcomingSummary';
import { Vaccine } from '../src/types/vaccine';

const vax = (id: string, nextDueDate: number | null): Vaccine => ({
  id, petId: 'pet-1', name: `Vaccine ${id}`, dateGiven: 0, nextDueDate, vetName: '',
});

describe('getNextDue', () => {
  it('returns null when there are no vaccines', () => {
    expect(getNextDue([], 1000)).toBeNull();
  });

  it('returns null when no vaccine has a nextDueDate', () => {
    expect(getNextDue([vax('a', null)], 1000)).toBeNull();
  });

  it('returns the nearest upcoming due date as not overdue', () => {
    const result = getNextDue([vax('a', 2000), vax('b', 1500)], 1000);
    expect(result).toEqual({ label: 'Vaccine b due', overdue: false });
  });

  it('flags a past due date as overdue', () => {
    const result = getNextDue([vax('a', 500)], 1000);
    expect(result).toEqual({ label: 'Vaccine a overdue', overdue: true });
  });

  it('prefers the nearest date even when it is overdue and another is upcoming', () => {
    const result = getNextDue([vax('a', 500), vax('b', 2000)], 1000);
    expect(result).toEqual({ label: 'Vaccine a overdue', overdue: true });
  });
});
