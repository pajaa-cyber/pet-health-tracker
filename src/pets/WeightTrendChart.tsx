import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { WeightLog } from '../types/weightLog';
import { MutedText } from '../components/ui';
import { spacing } from '../theme/theme';

const CHART_HEIGHT = 124;

export function WeightTrendChart({ logs, color }: { logs: WeightLog[]; color: string }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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
      {sorted.map((log, i) => {
        const barHeight = 26 + ((log.weight - min) / range) * 70;
        const selected = selectedIdx === i;
        return (
          <Pressable
            key={log.id}
            onPress={() => setSelectedIdx(selected ? null : i)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
          >
            {selected && (
              <Text style={{ fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.75)' }}>{log.weight} kg</Text>
            )}
            <View
              style={{
                width: '100%',
                height: barHeight,
                backgroundColor: selected ? '#FFFFFF' : color,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
              }}
            />
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>
              {new Date(log.date).toLocaleDateString(undefined, { month: 'short' })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
