import { useEffect } from 'react';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToDocumentPages } from '../documents/documentService';
import { firestore } from '../firebase/config';
import { buildAndSharePdf } from '../documents/pdfService';

// No UI of its own — subscribes just long enough to get this one document's
// pages, builds a quick multi-page PDF from them, hands it to the share
// sheet, then goes back. Reuses the exact same buildAndSharePdf helper the
// passport uses (this plan's spec: "one make-something-shareable mechanism
// for the whole feature, not two").
export function ShareDocumentScreen({ route, navigation }: any) {
  const { documentId } = route.params;
  const { household } = useHousehold();

  useEffect(() => {
    if (!household) return;
    const unsubscribe = subscribeToDocumentPages(firestore, household.id, documentId, async (pages) => {
      unsubscribe();
      if (pages.length === 0) { navigation.goBack(); return; }
      const html = `<html><body>${pages.map((p) => `<img src="${p.photoUrl}" style="width:100%;page-break-after:always;" />`).join('')}</body></html>`;
      try {
        await buildAndSharePdf(html, 'Document.pdf');
      } finally {
        navigation.goBack();
      }
    });
  }, [household, documentId]);

  return null;
}
