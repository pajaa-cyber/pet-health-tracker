import React from 'react';
import { Text, TextProps } from 'react-native';
import { typography, colors } from '../../theme/theme';

export function Title(props: TextProps) {
  return <Text {...props} style={[typography.h1, props.style]} />;
}

export function Subtitle(props: TextProps) {
  return <Text {...props} style={[typography.h3, props.style]} />;
}

export function BodyText(props: TextProps) {
  return <Text {...props} style={[typography.body, props.style]} />;
}

export function MutedText(props: TextProps) {
  return <Text {...props} style={[typography.bodyMuted, props.style]} />;
}

export function ErrorText(props: TextProps) {
  return <Text {...props} style={[{ color: colors.danger, fontSize: 14, fontWeight: '600' as const }, props.style]} />;
}
