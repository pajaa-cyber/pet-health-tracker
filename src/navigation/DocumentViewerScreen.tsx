import React, { useEffect, useState } from 'react';
import { FlatList, View, Image, Dimensions, Pressable, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { subscribeToDocumentPages } from '../documents/documentService';
import { firestore } from '../firebase/config';
import { DocumentPage } from '../types/document';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function DocumentViewerScreen({ route, navigation }: any) {
  const { documentId } = route.params;
  const { household } = useHousehold();
  const [pages, setPages] = useState<DocumentPage[]>([]);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!household) return;
    return subscribeToDocumentPages(firestore, household.id, documentId, setPages);
  }, [household, documentId]);

  return (
    <View style={{ flex: 1, backgroundColor: '#000000' }}>
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={{ position: 'absolute', top: insets.top + 12, left: 16, zIndex: 1, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 16 }}>×</Text>
      </Pressable>
      <FlatList
        data={pages}
        keyExtractor={(p) => p.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <View style={{ width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' }}>
            <Image source={{ uri: item.photoUrl }} style={{ width: SCREEN_WIDTH, height: '80%' }} resizeMode="contain" />
          </View>
        )}
      />
    </View>
  );
}
