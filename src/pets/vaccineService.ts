import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Vaccine } from '../types/vaccine';

export async function createVaccine(
  db: Firestore,
  householdId: string,
  petId: string,
  name: string,
  dateGiven: number,
  nextDueDate: number | null,
  vetName: string
): Promise<Vaccine> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'vaccines'));
  const vaccine: Vaccine = { id: docRef.id, petId, name, dateGiven, nextDueDate, vetName };
  await setDoc(docRef, vaccine);
  return vaccine;
}

export function subscribeToVaccines(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (vaccines: Vaccine[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'vaccines'),
    (snap) => callback(snap.docs.map((d) => d.data() as Vaccine)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToVaccines listener error', error);
      callback([]);
    }
  );
}

export async function updateVaccine(
  db: Firestore,
  householdId: string,
  petId: string,
  vaccineId: string,
  updates: Partial<Vaccine>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'pets', petId, 'vaccines', vaccineId), updates);
}
