import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

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
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Pressable
        onPress={() => setShow(true)}
        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#e5e7eb' }}
      >
        <Text>
          {label}: {value != null ? new Date(value).toLocaleDateString() : 'Not set'}
        </Text>
      </Pressable>
      {onClear && value != null && (
        <Pressable onPress={onClear} style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: '#dc2626' }}>Clear</Text>
        </Pressable>
      )}
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
