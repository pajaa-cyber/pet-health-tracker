export interface VetVisit {
  id: string;
  petId: string;
  date: number; // epoch millis
  reason: string;
  notes: string;
  documentUrls: string[];
}
