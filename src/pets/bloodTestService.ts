import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { BloodTest, BloodMarkerResult } from '../types/bloodTest';

export async function createBloodTest(
  db: Firestore,
  householdId: string,
  petId: string,
  testDate: number,
  laboratory: string,
  results: BloodMarkerResult[]
): Promise<BloodTest> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'bloodTests'));
  const bloodTest: BloodTest = { id: docRef.id, petId, testDate, laboratory, results };
  await setDoc(docRef, bloodTest);
  return bloodTest;
}

export function subscribeToBloodTests(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (bloodTests: BloodTest[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'bloodTests'),
    (snap) => callback(snap.docs.map((d) => d.data() as BloodTest)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToBloodTests listener error', error);
      callback([]);
    }
  );
}

export async function deleteBloodTest(
  db: Firestore,
  householdId: string,
  petId: string,
  bloodTestId: string
): Promise<void> {
  await deleteDoc(doc(db, 'households', householdId, 'pets', petId, 'bloodTests', bloodTestId));
}
