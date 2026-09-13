import React from 'react';
import { View } from 'react-native';
import { WeightLog } from '../types/weightLog';
import { MutedText } from '../components/ui';
import { colors, radii, spacing } from '../theme/theme';

const CHART_HEIGHT = 120;

export function WeightTrendChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return <MutedText>No weight entries yet.</MutedText>;
  }

  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const weights = sorted.map((l) => l.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: spacing.xs }}>
      {sorted.map((log) => {
        const barHeight = 8 + ((log.weight - min) / range) * (CHART_HEIGHT - 8);
        return (
          <View key={log.id} style={{ alignItems: 'center', gap: spacing.xs }}>
            <View
              style={{
                width: 14,
                height: barHeight,
                backgroundColor: colors.primary,
                borderRadius: radii.sm,
              }}
            />
            <MutedText style={{ fontSize: 10 }}>{log.weight}</MutedText>
          </View>
        );
      })}
    </View>
  );
}
