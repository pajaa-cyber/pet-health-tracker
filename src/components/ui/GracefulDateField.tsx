import React from 'react';
import { View } from 'react-native';
import { DateField } from '../DateField';
import { TextField } from './TextField';
import { Chip } from './Chip';
import { MutedText } from './Typography';
import { spacing } from '../../theme/theme';
import { monthsToApproxBirthDate } from '../../pets/dateGrace';
import type { DatePrecision } from '../../types/pet';

const PRECISION_LABEL: Record<DatePrecision, string> = {
  exact: 'Exact date',
  roughly: 'I know roughly when',
  approxAge: 'I only know an approximate age',
  unknown: "I don't know",
};

const PRECISION_REASSURANCE: Record<DatePrecision, string> = {
  exact: '',
  roughly: 'A rough guess is completely fine.',
  approxAge: "We'll estimate a date from the age you give — you can change it later.",
  unknown: "That's okay — you can add this anytime from the pet's profile.",
};

interface GracefulDateFieldProps {
  label: string;
  explanation?: string;
  options: DatePrecision[];
  precision: DatePrecision | null;
  date: number | null;
  approximateAgeMonths: number | null;
  onChange: (result: { precision: DatePrecision; date: number | null; approximateAgeMonths: number | null }) => void;
  // Wizard-only: recolours the label/explanation text and the precision
  // Chip row for a coloured step background. undefined = today's exact
  // light styling, used by every non-wizard caller.
  tint?: string;
}

export function GracefulDateField({
  label, explanation, options, precision, date, approximateAgeMonths, onChange, tint,
}: GracefulDateFieldProps) {
  const selectPrecision = (p: DatePrecision) => {
    if (p === 'exact' || p === 'roughly') {
      onChange({ precision: p, date: date ?? Date.now(), approximateAgeMonths: null });
    } else if (p === 'approxAge') {
      onChange({ precision: p, date: null, approximateAgeMonths: approximateAgeMonths ?? 0 });
    } else {
      onChange({ precision: p, date: null, approximateAgeMonths: null });
    }
  };

  const labelStyle = tint ? { color: 'rgba(255,255,255,0.85)' } : undefined;

  return (
    <View style={{ gap: spacing.sm }}>
      <MutedText style={[{ fontWeight: '600' as const }, labelStyle]}>{label}</MutedText>
      {explanation && <MutedText style={labelStyle}>{explanation}</MutedText>}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {options.map((p) => (
          <Chip
            key={p}
            label={PRECISION_LABEL[p]}
            selected={precision === p}
            onPress={() => selectPrecision(p)}
            selectedBg={tint ? '#FFFFFF' : undefined}
            selectedColor={tint}
            unselectedBg={tint ? 'rgba(255,255,255,0.18)' : undefined}
            unselectedColor={tint ? '#FFFFFF' : undefined}
          />
        ))}
      </View>
      {precision && PRECISION_REASSURANCE[precision] && <MutedText style={labelStyle}>{PRECISION_REASSURANCE[precision]}</MutedText>}
      {(precision === 'exact' || precision === 'roughly') && (
        <DateField
          label={precision === 'exact' ? 'Date' : 'Approximate date'}
          value={date}
          onChange={(v) => onChange({ precision, date: v, approximateAgeMonths: null })}
        />
      )}
      {precision === 'approxAge' && (
        <TextField
          label="Approximate age, in months"
          keyboardType="number-pad"
          value={approximateAgeMonths != null ? String(approximateAgeMonths) : ''}
          onChangeText={(t) => {
            const months = Math.max(0, parseInt(t, 10) || 0);
            onChange({
              precision: 'approxAge',
              date: monthsToApproxBirthDate(months, Date.now()),
              approximateAgeMonths: months,
            });
          }}
        />
      )}
    </View>
  );
}
