import React from 'react';
import { View } from 'react-native';
import { ScreenContainer, Title, Subtitle, BodyText, MutedText, ErrorText, Button, Card, Chip, TextField } from '../components/ui';
import { colors, spacing, radii, typography } from '../theme/theme';
import { PET_COLORS } from '../theme/petColors';

export function DevStyleGuideScreen() {
  return (
    <ScreenContainer scroll>
      <Title>Style Guide</Title>

      <Subtitle>Colours</Subtitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {Object.entries(colors).map(([name, value]) => (
          <View key={name} style={{ alignItems: 'center', gap: spacing.xs }}>
            <View style={{ width: 48, height: 48, borderRadius: radii.md, backgroundColor: value, borderWidth: 1, borderColor: colors.border }} />
            <MutedText>{name}</MutedText>
          </View>
        ))}
      </View>

      <Subtitle>Pet identity colours</Subtitle>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {PET_COLORS.map((c) => (
          <View key={c} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: c }} />
        ))}
      </View>

      <Subtitle>Typography</Subtitle>
      {Object.keys(typography).map((key) => (
        <BodyText key={key} style={(typography as any)[key]}>{key} — The quick brown fox</BodyText>
      ))}

      <Subtitle>Spacing</Subtitle>
      <View style={{ gap: spacing.xs }}>
        {Object.entries(spacing).map(([name, value]) => (
          <View key={name} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <MutedText style={{ width: 32 }}>{name}</MutedText>
            <View style={{ width: value, height: 12, backgroundColor: colors.primary }} />
          </View>
        ))}
      </View>

      <Subtitle>Components</Subtitle>
      <Card>
        <BodyText>Card</BodyText>
      </Card>
      <Button title="Primary button" onPress={() => {}} />
      <Button title="Accent button" variant="accent" onPress={() => {}} />
      <Button title="Outline button" variant="outline" onPress={() => {}} />
      <Button title="Danger button" variant="danger" onPress={() => {}} />
      <TextField label="Text field" placeholder="Placeholder text" />
      <Chip label="Chip" selected onPress={() => {}} />
      <Chip label="Chip" selected={false} onPress={() => {}} />
      <ErrorText>Error text example</ErrorText>
    </ScreenContainer>
  );
}
