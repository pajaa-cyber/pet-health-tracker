import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { WeightLog } from '../types/weightLog';

export async function createWeightLog(
  db: Firestore,
  householdId: string,
  petId: string,
  date: number,
  weight: number
): Promise<WeightLog> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'weightLogs'));
  const log: WeightLog = { id: docRef.id, petId, date, weight };
  await setDoc(docRef, log);
  return log;
}

export function subscribeToWeightLogs(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (logs: WeightLog[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'weightLogs'),
    (snap) => callback(snap.docs.map((d) => d.data() as WeightLog)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToWeightLogs listener error', error);
      callback([]);
    }
  );
}

export async function deleteWeightLog(
  db: Firestore,
  householdId: string,
  petId: string,
  weightLogId: string
): Promise<void> {
  await deleteDoc(doc(db, 'households', householdId, 'pets', petId, 'weightLogs', weightLogId));
}
