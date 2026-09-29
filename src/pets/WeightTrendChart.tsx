import React, { useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WeightLog } from '../types/weightLog';
import { MutedText } from '../components/ui';
import { spacing, colors } from '../theme/theme';
import { kgToDisplay, unitLabel, WeightUnit } from './units';

const CHART_HEIGHT = 124;

export function WeightTrendChart({
  logs, color, unit = 'kg',
  labelColor = 'rgba(255,255,255,0.45)',
  valueLabelColor = 'rgba(255,255,255,0.75)',
  selectedBarColor = '#FFFFFF',
  onDelete,
}: {
  logs: WeightLog[];
  color: string;
  unit?: WeightUnit;
  labelColor?: string;
  valueLabelColor?: string;
  selectedBarColor?: string;
  // Only shown for the selected bar — tap a bar to select it, then tap the
  // trash icon that appears next to its value to delete that one entry.
  onDelete?: (log: WeightLog) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (logs.length === 0) {
    return <MutedText>No weight entries yet.</MutedText>;
  }

  const sorted = [...logs].sort((a, b) => a.date - b.date);
  const weights = sorted.map((l) => kgToDisplay(l.weight, unit));
  const maxWeight = Math.max(...weights) || 1;
  // Proportional to the actual value from a zero baseline, not to the tight
  // min/max of just these entries — a 6% real weight change should look like
  // a 6% taller bar, not several times taller because it happened to be the
  // biggest swing in a short, close-together log.
  const MIN_BAR_HEIGHT = 12;
  const MAX_BAR_HEIGHT = 96;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_HEIGHT, gap: spacing.xs }}>
      {sorted.map((log, i) => {
        const displayWeight = kgToDisplay(log.weight, unit);
        const barHeight = Math.max(MIN_BAR_HEIGHT, (displayWeight / maxWeight) * MAX_BAR_HEIGHT);
        const selected = selectedIdx === i;
        return (
          <Pressable
            key={log.id}
            onPress={() => setSelectedIdx(selected ? null : i)}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}
          >
            {selected && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: valueLabelColor }}>
                  {displayWeight.toFixed(1)} {unitLabel(unit)}
                </Text>
                {onDelete && (
                  <Pressable
                    onPress={() => onDelete(log)}
                    accessibilityRole="button"
                    accessibilityLabel="Delete this weight entry"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons name="trash-outline" size={13} color={colors.danger} />
                  </Pressable>
                )}
              </View>
            )}
            <View
              style={{
                width: '100%',
                height: barHeight,
                backgroundColor: selected ? selectedBarColor : color,
                borderTopLeftRadius: 10,
                borderTopRightRadius: 10,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
              }}
            />
            <Text style={{ fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: labelColor, fontFamily: 'monospace' }}>
              {new Date(log.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
