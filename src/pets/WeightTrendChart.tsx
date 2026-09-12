import React from 'react';
import { View, Text } from 'react-native';
import { WeightLog } from '../types/weightLog';

const CHART_HEIGHT = 120;

export function WeightTrendChart({ logs }: { logs: WeightLog[] }) {
  if (logs.length === 0) {
    return <Text>No weight entries yet.</Text>;
  }

  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const weights = sorted.map((l) => l.weight);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: 4 }}>
      {sorted.map((log) => {
        const barHeight = 8 + ((log.weight - min) / range) * (CHART_HEIGHT - 8);
        return (
          <View key={log.id} style={{ alignItems: 'center' }}>
            <View style={{ width: 12, height: barHeight, backgroundColor: '#4a90d9' }} />
            <Text style={{ fontSize: 8 }}>{log.weight}</Text>
          </View>
        );
      })}
    </View>
  );
}
