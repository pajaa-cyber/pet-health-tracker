import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  type Firestore,
  type Unsubscribe,
} from '@react-native-firebase/firestore';
import { Expense, ExpenseCategory } from '../types/expense';

export async function createExpense(
  db: Firestore,
  householdId: string,
  petId: string,
  date: number,
  category: ExpenseCategory,
  amountCents: number,
  note: string
): Promise<Expense> {
  const docRef = doc(collection(db, 'households', householdId, 'pets', petId, 'expenses'));
  const expense: Expense = { id: docRef.id, petId, date, category, amountCents, note };
  await setDoc(docRef, expense);
  return expense;
}

export function subscribeToExpenses(
  db: Firestore,
  householdId: string,
  petId: string,
  callback: (expenses: Expense[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'households', householdId, 'pets', petId, 'expenses'),
    (snap) => callback(snap.docs.map((d) => d.data() as Expense)),
    // See subscribeToPets in petService.ts for the rationale — a listener
    // error must not leave the screen stuck on stale/empty data silently.
    (error) => {
      console.error('subscribeToExpenses listener error', error);
      callback([]);
    }
  );
}
