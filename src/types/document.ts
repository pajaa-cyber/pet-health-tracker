export interface Document {
  id: string;
  householdId: string;
  petId: string;
  title: string;
  category: string; // free-ish label: "Vaccination booklet", "Lab result", "Other" — not a rigid enum
  date: number; // epoch millis — when the document is *from*, not when it was scanned
  sourceVisitId: string | null; // set only for documents created by the vet-visit migration (Task 2)
  pageCount: number; // denormalized so DocumentListScreen can show "12 pages" without a subcollection read per card
  createdAt: number;
}

export interface DocumentPage {
  id: string;
  order: number; // 0-based, display/share order
  photoUrl: string; // same data-URI scheme as Pet.photoUrl and the old VetVisit.documentUrls entries
}
