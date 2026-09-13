import React, { useState } from 'react';
import { Pressable, Image, View, Text, ActivityIndicator, Alert } from 'react-native';
import { pickAndProcessImage, ImageSource } from '../../pets/imageUpload';
import { colors } from '../../theme/theme';

interface AvatarPickerProps {
  photoUri: string | null;
  onPicked: (dataUri: string) => void;
  size?: number;
  fallbackEmoji?: string;
}

export function AvatarPicker({ photoUri, onPicked, size = 96, fallbackEmoji = '🐾' }: AvatarPickerProps) {
  const [busy, setBusy] = useState(false);

  const handlePick = async (source: ImageSource) => {
    setBusy(true);
    try {
      const dataUri = await pickAndProcessImage(source);
      if (dataUri) onPicked(dataUri);
    } catch (e: any) {
      Alert.alert('Could not set photo', e.message);
    } finally {
      setBusy(false);
    }
  };

  const handlePress = () => {
    Alert.alert('Pet photo', undefined, [
      { text: 'Take Photo', onPress: () => handlePick('camera') },
      { text: 'Choose from Library', onPress: () => handlePick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable onPress={handlePress} disabled={busy} style={{ alignItems: 'center' }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceTint,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: colors.primaryLight,
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: size * 0.4 }}>{fallbackEmoji}</Text>
        )}
      </View>
      <Text style={{ fontSize: 12, color: colors.primary, marginTop: 4, fontWeight: '600' }}>
        {photoUri ? 'Change photo' : 'Add photo'}
      </Text>
    </Pressable>
  );
}
