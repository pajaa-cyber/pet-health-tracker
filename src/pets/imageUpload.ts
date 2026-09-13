import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export type ImageSource = 'camera' | 'library';

// Firebase Storage requires the Blaze (pay-as-you-go) billing plan as of
// the Sept 2024 policy change, which in turn requires a Google Cloud
// billing account with tax/business info this project's owner (a personal,
// non-organization account) cannot supply. Firestore itself has no such
// requirement, so photos are stored as compressed base64 data URIs directly
// on the Firestore document (Pet.photoUrl, VetVisit.documentUrls) instead
// of as Storage objects — same string-typed fields, no rules/type changes
// needed. The tradeoff is Firestore's 1 MiB per-document limit: resizing to
// 640px wide + 0.5 JPEG compression keeps a typical photo to roughly
// 30-100KB, so one pet photo is a non-issue, and a vet visit can hold
// several document photos (they all live in the same document's
// documentUrls array) before approaching the limit.
export async function pickAndProcessImage(source: ImageSource): Promise<string | null> {
  const localUri = await pickImage(source);
  if (!localUri) return null;

  const result = await manipulateAsync(localUri, [{ resize: { width: 640 } }], {
    compress: 0.5,
    format: SaveFormat.JPEG,
    base64: true,
  });
  if (!result.base64) throw new Error('Could not process the image.');
  return `data:image/jpeg;base64,${result.base64}`;
}

async function pickImage(source: ImageSource): Promise<string | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) throw new Error('Camera permission was not granted.');
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
    return result.canceled ? null : result.assets[0].uri;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
  return result.canceled ? null : result.assets[0].uri;
}
