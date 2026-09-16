import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Vet } from '../types/vet';

export type NewVetInput = Omit<Vet, 'id' | 'householdId'>;

export async function createVet(
  db: Firestore,
  householdId: string,
  input: NewVetInput
): Promise<Vet> {
  const docRef = doc(collection(db, 'households', householdId, 'vets'));
  const vet: Vet = { ...input, id: docRef.id, householdId };
  await setDoc(docRef, vet);
  return vet;
}

export function subscribeToVets(
  db: Firestore,
  householdId: string,
  callback: (vets: Vet[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'vets'),
    (snap) => callback(snap.docs.map((d) => d.data() as Vet)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToVets listener error', error);
      callback([]);
    }
  );
}

export async function updateVet(
  db: Firestore,
  householdId: string,
  vetId: string,
  updates: Partial<Vet>
): Promise<void> {
  await updateDoc(doc(db, 'households', householdId, 'vets', vetId), updates);
}
