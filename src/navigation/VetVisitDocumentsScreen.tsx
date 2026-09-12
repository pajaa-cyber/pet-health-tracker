import React, { useState } from 'react';
import { View, Button, Text } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { getStorage, ref, putFile, getDownloadURL } from '@react-native-firebase/storage';
import { useHousehold } from '../household/HouseholdContext';
import { addVetVisitDocument } from '../pets/vetVisitService';
import { firestore } from '../firebase/config';

export function VetVisitDocumentsScreen({ route }: any) {
  const { petId, visitId } = route.params;
  const { household } = useHousehold();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      await putFile(fileRef, localUri);
      const downloadUrl = await getDownloadURL(fileRef);
      await addVetVisitDocument(firestore, household.id, petId, visitId, downloadUrl);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ padding: 24, gap: 12 }}>
      <Button title={uploading ? 'Uploading...' : 'Attach a photo'} onPress={handlePickAndUpload} disabled={uploading} />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
    </View>
  );
}
