import React, { useEffect, useState } from 'react';
import { View, Button, Text, Image, FlatList } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { useHousehold } from '../household/HouseholdContext';
import { addVetVisitDocument, subscribeToVetVisits } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';
import { VetVisit } from '../types/vetVisit';

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

  const handlePickAndUpload = async () => {
    if (!household) return;
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'] });
    if (result.canceled) return;

    setUploading(true);
    try {
      const localUri = result.assets[0].uri;
      const fileName = `${Date.now()}.jpg`;
      const storage = getStorage();
      const fileRef = ref(storage, `households/${household.id}/pets/${petId}/vetVisits/${visitId}/${fileName}`);
      await putFile(fileRef, localUri, { contentType: 'image/jpeg' });
      const downloadUrl = await getDownloadURL(fileRef);
      await addVetVisitDocument(firestore, household.id, petId, visitId, downloadUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12, flex: 1 }}>
      <Button title={uploading ? 'Uploading...' : 'Attach a photo'} onPress={handlePickAndUpload} disabled={uploading} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <FlatList
        data={documentUrls}
        keyExtractor={(url) => url}
        numColumns={2}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: 150, height: 150, margin: 4, borderRadius: 6 }}
            resizeMode="cover"
          />
        )}
        ListEmptyComponent={<Text>No documents attached yet.</Text>}
      />
    </View>
  );
}
