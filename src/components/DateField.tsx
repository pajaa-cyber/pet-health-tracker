import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, radii, spacing } from '../theme/theme';

interface DateFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number) => void;
  // Only optional date fields (e.g. Vaccine.nextDueDate, Medication.endDate)
  // pass this — it's what shows the "Clear" action.
  onClear?: () => void;
}

export function DateField({ label, value, onChange, onClear }: DateFieldProps) {
  const [show, setShow] = useState(false);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          onPress={() => setShow(true)}
          style={{
            flex: 1,
            minHeight: 48,
            justifyContent: 'center',
            paddingHorizontal: spacing.md,
            borderRadius: radii.md,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Text style={{ fontSize: 16, color: value != null ? colors.text : colors.textMuted }}>
            {value != null ? new Date(value).toLocaleDateString() : 'Not set'}
          </Text>
        </Pressable>
        {onClear && value != null && (
          <Pressable onPress={onClear} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.sm }}>
            <Text style={{ color: colors.danger, fontWeight: '600' }}>Clear</Text>
          </Pressable>
        )}
      </View>
      {show && (
        <DateTimePicker
          value={value != null ? new Date(value) : new Date()}
          mode="date"
          display="default"
          onValueChange={(_event, selectedDate) => {
            setShow(false);
            if (selectedDate) onChange(selectedDate.getTime());
          }}
          onDismiss={() => setShow(false)}
        />
      )}
    </View>
  );
}
