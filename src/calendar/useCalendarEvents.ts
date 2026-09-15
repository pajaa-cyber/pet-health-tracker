import { useEffect, useState } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToEvents } from './eventService';
import { firestore } from '../firebase/config';
import { CalendarEvent } from '../types/calendarEvent';

export function useCalendarEvents(): CalendarEvent[] {
  const { household } = useHousehold();
  const [events, setEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!household) return;
    return subscribeToEvents(firestore, household.id, setEvents);
  }, [household?.id]);

  return events;
}
