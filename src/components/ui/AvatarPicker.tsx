import React, { useState } from 'react';
import { Pressable, Image, View, Text, ActivityIndicator, Alert } from 'react-native';
import { pickAndProcessImage, ImageSource } from '../../pets/imageUpload';
import { colors } from '../../theme/theme';

interface AvatarPickerProps {
  photoUri: string | null;
  onPicked: (dataUri: string) => void;
  size?: number;
  fallbackEmoji?: string;
  emojiSize?: number; // default size * 0.4 (today's behavior) — the wizard passes an explicit smaller size on its larger 116px circle
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed';
  // 'default': "Add/Change photo", 12px, captionColor (default colors.primary).
  // 'mono': "ADD/CHANGE PHOTO", uppercase, monospace, 9px, letter-spacing 1 —
  // the wizard's step-0 treatment. 'none': no caption at all — the hub's
  // hero avatar, which has its own "Mark remembered" affordance nearby and
  // doesn't need a second line of text under the avatar.
  caption?: 'default' | 'mono' | 'none';
  captionColor?: string;
}

export function AvatarPicker({
  photoUri, onPicked, size = 96, fallbackEmoji = '🐾', emojiSize,
  backgroundColor = colors.surfaceTint, borderColor = colors.primaryLight, borderWidth = 2, borderStyle = 'solid',
  caption = 'default', captionColor = colors.primary,
}: AvatarPickerProps) {
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
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          borderWidth,
          borderColor,
          borderStyle,
        }}
      >
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : photoUri ? (
          <Image source={{ uri: photoUri }} style={{ width: size, height: size }} resizeMode="cover" />
        ) : (
          <Text style={{ fontSize: emojiSize ?? size * 0.4 }}>{fallbackEmoji}</Text>
        )}
      </View>
      {caption === 'default' && (
        <Text style={{ fontSize: 12, color: captionColor, marginTop: 4, fontWeight: '600' }}>
          {photoUri ? 'Change photo' : 'Add photo'}
        </Text>
      )}
      {caption === 'mono' && (
        <Text style={{ fontSize: 9, color: captionColor, marginTop: 6, fontWeight: '700', letterSpacing: 1, fontFamily: 'monospace', textTransform: 'uppercase' }}>
          {photoUri ? 'Change photo' : 'Add photo'}
        </Text>
      )}
    </Pressable>
  );
}
