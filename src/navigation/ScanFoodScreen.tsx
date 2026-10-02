import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToPets } from '../pets/petService';
import { pickImage } from '../pets/imageUpload';
import { findAllergenMatches } from '../pets/foodScan';
import { firestore } from '../firebase/config';
import { Pet } from '../types/pet';
import { ScreenContainer, RecordListHeader, Button, MutedText, ErrorText } from '../components/ui';
import { shell, text, spacing, colors, radii } from '../theme/theme';

// On-device OCR only (@react-native-ml-kit/text-recognition, Google ML Kit
// / Apple Vision under the hood) — the photo never leaves the phone. A
// full "read the ingredients/calories/protein and judge them" scanner
// needs an AI vision service, which this project can't safely add: Cloud
// Functions on the Spark (free) plan can't call non-Google APIs, and the
// Blaze plan needed for that is blocked by the owner's billing situation
// (same reason Cloud Storage is unusable — see CLAUDE.md). What's left —
// plain-text allergen matching against the pet's own Allergies field — is
// free, on-device, and still the single highest-value check for this use
// case.
export function ScanFoodScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [scannedText, setScannedText] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const handleScan = async (source: 'camera' | 'library') => {
    setError(null);
    setScannedText(null);
    setScanning(true);
    try {
      const uri = await pickImage(source);
      if (!uri) return;
      setPhotoUri(uri);
      const result = await TextRecognition.recognize(uri);
      setScannedText(result.text);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const matches = pet && scannedText != null ? findAllergenMatches(scannedText, pet.allergies || '') : [];

  return (
    <ScreenContainer noPadding style={{ flex: 1 }} background={shell.bg}>
      <RecordListHeader title="Scan food label" subtitle={`${pet?.name ?? 'Pet'} · allergen check`} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <MutedText>
          Reads the label's text on this device only — nothing is uploaded anywhere. Checks it against{' '}
          {pet?.name ?? 'this pet'}'s known allergies (a plain text match, not a substitute for reading the label
          yourself).
        </MutedText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Take photo" onPress={() => handleScan('camera')} loading={scanning} style={{ flex: 1 }} />
          <Button title="Choose from library" variant="outline" onPress={() => handleScan('library')} style={{ flex: 1 }} />
        </View>
        {error && <ErrorText>{error}</ErrorText>}
        {photoUri && (
          <Image source={{ uri: photoUri }} style={{ width: '100%', height: 200, borderRadius: radii.md }} resizeMode="contain" />
        )}
        {scannedText != null && (
          <>
            {matches.length > 0 ? (
              <View style={{ backgroundColor: '#FEE2E2', borderRadius: radii.md, padding: spacing.md, gap: spacing.xs }}>
                <Text style={{ fontWeight: '800', color: '#991B1B' }}>⚠️ Possible allergen match</Text>
                <Text style={{ color: '#991B1B' }}>
                  Found on the label: {matches.join(', ')} — {pet?.name ?? 'this pet'} has a known allergy listed for
                  this.
                </Text>
              </View>
            ) : (
              <View style={{ backgroundColor: '#DCFCE7', borderRadius: radii.md, padding: spacing.md, gap: spacing.xs }}>
                <Text style={{ fontWeight: '800', color: '#166534' }}>✅ No known allergens detected</Text>
                <Text style={{ color: '#166534' }}>
                  Nothing matching {pet?.name ?? 'this pet'}'s listed allergies was found in the scanned text.
                </Text>
              </View>
            )}
            <View style={{ gap: spacing.xs }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>Scanned text</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{scannedText || '(no text found)'}</Text>
            </View>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}
