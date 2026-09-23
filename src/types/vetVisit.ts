export interface VetVisit {
  id: string;
  petId: string;
  date: number; // epoch millis
  reason: string;
  notes: string;
  followUpDate: number | null; // "come back on/around this date" — null if none was set
}
