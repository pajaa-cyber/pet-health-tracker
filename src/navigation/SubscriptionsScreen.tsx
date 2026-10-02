import React from 'react';
import { View, Text } from 'react-native';
import { useHousehold } from '../household/HouseholdContext';
import { isSubscriptionActive } from '../limits/limits';
import { ScreenContainer, RecordListHeader } from '../components/ui';
import { shell, text, spacing, radii } from '../theme/theme';

export function SubscriptionsScreen({ navigation }: any) {
  const { household } = useHousehold();
  const active = household ? isSubscriptionActive(household) : false;
  const daysLeft = household
    ? Math.max(0, Math.ceil(((household.trialEndsAt ?? 0) - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return (
    <ScreenContainer noPadding background={shell.bg}>
      <RecordListHeader title="Subscriptions" onBack={() => navigation.goBack()} />
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <View style={{ borderRadius: radii.lg, backgroundColor: shell.card, padding: 16, gap: 4 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: text.primary }}>
            {active ? `Free trial — ${daysLeft} days left` : 'Trial ended'}
          </Text>
          <Text style={{ fontSize: 13, color: text.secondary }}>
            Paid plans aren't available yet — everything is free while this is being built.
          </Text>
        </View>
        <View style={{ borderRadius: radii.lg, backgroundColor: shell.card, padding: 16 }}>
          <Text style={{ fontSize: 13, color: text.secondary }}>
            When paid plans launch, you'll be able to manage your subscription here.
          </Text>
        </View>
      </View>
    </ScreenContainer>
  );
}
