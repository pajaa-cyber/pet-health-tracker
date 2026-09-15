import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { CalendarEvent, EventType } from '../types/calendarEvent';

export async function createEvent(
  db: Firestore,
  householdId: string,
  petIds: string[],
  type: EventType,
  title: string,
  notes: string,
  date: number
): Promise<CalendarEvent> {
  const docRef = doc(collection(db, 'households', householdId, 'events'));
  const event: CalendarEvent = { id: docRef.id, householdId, petIds, type, title, notes, date, status: 'upcoming' };
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
