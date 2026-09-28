import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { CalendarEvent, EventType, EventStatus } from '../types/calendarEvent';

// status defaults to 'upcoming' (the AddEventScreen wizard's case) — the
// Preventive Care quick-log grid is the one caller that passes 'completed'
// directly, since tapping one of those buttons means "just did this now."
export async function createEvent(
  db: Firestore,
  householdId: string,
  petIds: string[],
  type: EventType,
  title: string,
  notes: string,
  date: number,
  status: EventStatus = 'upcoming'
): Promise<CalendarEvent> {
  const docRef = doc(collection(db, 'households', householdId, 'events'));
  const event: CalendarEvent = { id: docRef.id, householdId, petIds, type, title, notes, date, status };
  await setDoc(docRef, event);
  return event;
}

export function subscribeToEvents(
  db: Firestore,
  householdId: string,
  callback: (events: CalendarEvent[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'events'),
    (snap) => callback(snap.docs.map((d) => d.data() as CalendarEvent)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToEvents listener error', error);
      callback([]);
    }
  );
}

export async function updateEvent(
  db: Firestore,
  householdId: string,
  eventId: string,
  updates: Partial<CalendarEvent>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'events', eventId), updates);
}

export async function deleteEvent(db: Firestore, householdId: string, eventId: string): Promise<void> {
  await deleteDoc(doc(db, 'households', householdId, 'events', eventId));
}
