import { useState } from 'react';
import { markDone, skip } from '../reminders/reminderActions';
import { updateEvent } from './eventService';
import { CalendarEntry } from './calendarEntries';
import { firestore } from '../firebase/config';
import type { Household } from '../types/household';

// Extracted from CalendarScreen and DayDetailScreen, which previously
// duplicated this exact set of handlers verbatim. Pulled out now because
// this plan adds a new "toggle skip" path (Bring back) to both screens —
// writing it once and sharing avoids the same new logic being written
// twice and drifting apart, the same risk the duplication already carried
// for the pre-existing handlers (flagged as a known gap in CLAUDE.md).
export function useCalendarEntryActions(household: Household | null, userId: string | null, navigation: any) {
  const [error, setError] = useState<string | null>(null);

  const handleDone = async (entry: CalendarEntry) => {
    if (!household) {
      setError('No household');
      return;
    }
    setError(null);
    try {
      if (entry.reminder) {
        if (!userId) {
          setError('Not signed in');
          return;
        }
        await markDone(firestore, household.id, entry.reminder, userId);
      } else if (entry.event) {
        await updateEvent(firestore, household.id, entry.event.id, { status: entry.completed ? 'upcoming' : 'completed' });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleSkip = async (entry: CalendarEntry) => {
    if (!household) {
      setError('No household');
      return;
    }
    setError(null);
    try {
      if (entry.reminder) {
        if (!userId) {
          setError('Not signed in');
          return;
        }
        await skip(firestore, household.id, entry.reminder, userId);
      } else if (entry.event) {
        await updateEvent(firestore, household.id, entry.event.id, { status: entry.skipped ? 'upcoming' : 'skipped' });
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleEdit = (entry: CalendarEntry) => {
    if (!entry.event) return;
    navigation.navigate('EditEvent', { eventId: entry.event.id });
  };

  return { handleDone, handleSkip, handleEdit, error };
}
