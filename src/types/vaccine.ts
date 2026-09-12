export interface Vaccine {
  id: string;
  petId: string;
  name: string;
  dateGiven: number; // epoch millis
  nextDueDate: number | null; // epoch millis; null if not applicable
  vetName: string;
}
