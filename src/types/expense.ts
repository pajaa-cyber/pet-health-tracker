export type ExpenseCategory = 'food' | 'vet' | 'grooming' | 'insurance' | 'supplies' | 'other';

export interface Expense {
  id: string;
  petId: string;
  date: number; // epoch millis
  category: ExpenseCategory;
  amountCents: number; // integer cents, avoids float rounding in running totals
  note: string;
}
