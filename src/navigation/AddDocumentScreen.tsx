import React, { useEffect, useState } from 'react';
import { View, Image, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { pickAndProcessImage } from '../pets/imageUpload';
import { createDocument, subscribeToDocuments } from '../documents/documentService';
import { canAddDocumentPage, documentPhotoLimitMessage } from '../limits/limits';
import { firestore } from '../firebase/config';
import { DateField } from '../components/DateField';
import { Document } from '../types/document';
import { ScreenContainer, TextField, Button, ErrorText, MutedText } from '../components/ui';
import { spacing, radii } from '../theme/theme';

export function AddDocumentScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState(Date.now());
  const [pageUrls, setPageUrls] = useState<string[]>([]);
  const [existingDocuments, setExistingDocuments] = useState<Document[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!household) return;
    return subscribeToDocuments(firestore, household.id, petId, setExistingDocuments);
  }, [household, petId]);

  const petPageCountSoFar = existingDocuments.reduce((sum, d) => sum + d.pageCount, 0);

  const handleCapture = async (source: 'camera' | 'library') => {
    if (!canAddDocumentPage(petPageCountSoFar + pageUrls.length)) {
      setError(documentPhotoLimitMessage());
      return;
    }
    setError(null);
    setCapturing(true);
    try {
      const uri = await pickAndProcessImage(source);
      if (uri) setPageUrls((prev) => [...prev, uri]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setCapturing(false);
    }
  };

  const removePage = (index: number) => {
    setPageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!household) return;
    if (pageUrls.length === 0) {
      setError('Add at least one page before saving.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createDocument(firestore, household.id, petId, title.trim() || 'Untitled document', category.trim() || 'Other', date, pageUrls);
      navigation.goBack();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenContainer scroll>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button title="Take a photo" onPress={() => handleCapture('camera')} loading={capturing} style={{ flex: 1 }} />
        <Button title="Choose from library" onPress={() => handleCapture('library')} loading={capturing} variant="outline" style={{ flex: 1 }} />
      </View>

      {pageUrls.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {pageUrls.map((uri, index) => (
            <View key={index} style={{ width: 72, height: 72 }}>
              <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: radii.md }} resizeMode="cover" />
              <Pressable
                onPress={() => removePage(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remove page ${index + 1}`}
                style={{ position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center' }}
              >
                <MutedText style={{ color: '#FFFFFF', fontSize: 12 }}>×</MutedText>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <TextField label="Title" placeholder="e.g. Rabies vaccination booklet" value={title} onChangeText={setTitle} />
      <TextField label="Category" placeholder="e.g. Vaccination booklet, Lab result" value={category} onChangeText={setCategory} />
      <DateField label="Document date" value={date} onChange={setDate} />

      {error && <ErrorText>{error}</ErrorText>}
      <Button title={`Save document (${pageUrls.length} ${pageUrls.length === 1 ? 'page' : 'pages'})`} onPress={handleSave} loading={saving} disabled={pageUrls.length === 0} />
    </ScreenContainer>
  );
}
