import React, { useEffect, useState } from 'react';
import { FlatList, View, Text, Image, Pressable } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToDocuments, subscribeToDocumentPages } from '../documents/documentService';
import { subscribeToPets } from '../pets/petService';
import { firestore } from '../firebase/config';
import { Document } from '../types/document';
import { Pet } from '../types/pet';
import { petColor } from '../theme/petColors';
import { ScreenContainer, RecordListHeader, DashedAddButton, GuidedEmptyState } from '../components/ui';
import { shell, text, spacing } from '../theme/theme';

export function DocumentListScreen({ route, navigation }: any) {
  const { petId } = route.params;
  const { household } = useHousehold();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pets, setPets] = useState<Pet[]>([]);
  const pet = pets.find((p) => p.id === petId);

  useEffect(() => {
    if (!household) return;
    return subscribeToDocuments(firestore, household.id, petId, setDocuments);
  }, [household, petId]);

  useEffect(() => {
    if (!household) return;
    return subscribeToPets(firestore, household.id, setPets);
  }, [household]);

  const rail = pet ? petColor(pet) : shell.control;

  return (
    <ScreenContainer style={{ flex: 1, padding: 0 }} background={shell.bg}>
      <RecordListHeader
        title="Documents"
        subtitle={`${pet?.name ?? 'Pet'} · ${documents.length} ${documents.length === 1 ? 'document' : 'documents'}`}
        onBack={() => navigation.goBack()}
      />
      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.sm, flexGrow: 1 }}
        renderItem={({ item }) => (
          <View style={{ flexDirection: 'row', borderRadius: 18, backgroundColor: shell.card, overflow: 'hidden' }}>
            <Pressable
              onPress={() => navigation.navigate('DocumentViewer', { documentId: item.id })}
              style={{ flex: 1, flexDirection: 'row' }}
            >
              <View style={{ width: 6, backgroundColor: rail }} />
              <DocumentThumbnail householdId={household!.id} documentId={item.id} />
              <View style={{ flex: 1, padding: 14, gap: 2, justifyContent: 'center' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>{item.title}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>{item.category}</Text>
                <Text style={{ fontSize: 12, fontWeight: '600', color: text.secondary }}>
                  {new Date(item.date).toLocaleDateString()} · {item.pageCount} {item.pageCount === 1 ? 'page' : 'pages'}
                </Text>
              </View>
            </Pressable>
            <Pressable
              onPress={() => navigation.navigate('ShareDocument', { documentId: item.id })}
              accessibilityRole="button"
              accessibilityLabel={`Share ${item.title}`}
              style={{ padding: 14, justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 18 }}>↗️</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <GuidedEmptyState
            emoji="📄"
            title="No documents yet"
            message="Photograph a vaccination booklet, lab result, or anything else worth keeping — several pages at once, grouped as one document."
            actionLabel="Add a document"
            onAction={() => navigation.navigate('AddDocument', { petId })}
            variant="dark"
          />
        }
      />
      <View style={{ padding: spacing.md, paddingTop: 0 }}>
        <DashedAddButton label="Add a document" onPress={() => navigation.navigate('AddDocument', { petId })} />
      </View>
    </ScreenContainer>
  );
}

// A small inline component so each card can independently subscribe to just
// its first page (order 0) for a thumbnail, without DocumentListScreen
// itself fanning out N page-subcollection listeners for N documents up
// front — only the documents actually rendered get a listener, and each is
// torn down when its card unmounts.
function DocumentThumbnail({ householdId, documentId }: { householdId: string; documentId: string }) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToDocumentPages(firestore, householdId, documentId, (pages) => {
      setThumbnailUrl(pages[0]?.photoUrl ?? null);
    });
  }, [householdId, documentId]);

  if (!thumbnailUrl) return <View style={{ width: 64, backgroundColor: shell.control }} />;
  return <Image source={{ uri: thumbnailUrl }} style={{ width: 64, height: '100%' }} resizeMode="cover" />;
}
