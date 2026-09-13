import React, { useEffect, useState } from 'react';
import { View, Image, FlatList } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { addVetVisitDocument, subscribeToVetVisits } from '../pets/vetVisitService';
import { pickAndProcessImage, ImageSource } from '../pets/imageUpload';
import { firestore } from '../firebase/config';
import { VetVisit } from '../types/vetVisit';
import { ScreenContainer, Button, ErrorText, MutedText } from '../components/ui';
import { radii, spacing } from '../theme/theme';

export function VetVisitDocumentsScreen({ route }: any) {
  const { petId, visitId } = route.params;
  const { household } = useHousehold();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visits, setVisits] = useState<VetVisit[]>([]);

  // Reuses the existing whole-collection listener (same pattern every other
  // screen in this codebase uses — see subscribeToVetVisits callers) rather
  // than adding a new single-document subscription just for this screen;
  // this is the only place documentUrls needs to be read back live.
  useEffect(() => {
    if (!household) return;
    return subscribeToVetVisits(firestore, household.id, petId, setVisits);
  }, [household, petId]);

  const documentUrls = visits.find((v) => v.id === visitId)?.documentUrls ?? [];

  const handleAdd = async (source: ImageSource) => {
    if (!household) return;
    setError(null);
    setUploading(true);
    try {
      const dataUri = await pickAndProcessImage(source);
      if (dataUri) {
        await addVetVisitDocument(firestore, household.id, petId, visitId, dataUri);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title={uploading ? 'Uploading...' : 'Take a photo'}
          onPress={() => handleAdd('camera')}
          loading={uploading}
          style={{ flex: 1 }}
        />
        <Button
          title="Choose from library"
          variant="outline"
          onPress={() => handleAdd('library')}
          disabled={uploading}
          style={{ flex: 1 }}
        />
      </View>
      {error && <ErrorText>{error}</ErrorText>}
      <FlatList
        data={documentUrls}
        keyExtractor={(_, index) => String(index)}
        numColumns={2}
        columnWrapperStyle={{ gap: spacing.sm }}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ flex: 1, aspectRatio: 1, borderRadius: radii.md }}
            resizeMode="cover"
          />
        )}
        ListEmptyComponent={<MutedText>No documents attached yet.</MutedText>}
      />
    </ScreenContainer>
  );
}
