import {
  collection,
  doc,
  setDoc,
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
    (snap) => callback(snap.docs.map((d) => d.data() as Vaccine))
  );
}
