import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

// The one shared "make something shareable" mechanism for this whole
// feature: both a single Document's Share button (Task 7) and passport
// generation (Task 7) build an HTML string for their own content and pass
// it here. Entirely on-device — no server involved.
export async function buildAndSharePdf(html: string, fileName: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf', dialogTitle: fileName });
}
