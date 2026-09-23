import React, { useEffect, useState } from 'react';
import { FlatList, View, Share, Alert } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { useHousehold } from '../household/HouseholdContext';
import { removeMember, reconcileMemberCount } from '../household/householdService';
import { subscribeToSitterGrants, revokeSitterAccess } from '../sitters/sitterService';
import { firestore } from '../firebase/config';
import { FREE_HOUSEHOLD_MEMBERS, canAddHouseholdMember, householdMemberLimitMessage, isSubscriptionActive } from '../limits/limits';
import { HouseholdMember } from '../types/household';
import { SitterAccessGrant } from '../types/sitterAccess';
import { ScreenContainer, Card, Title, Subtitle, MutedText, Button } from '../components/ui';
import { spacing } from '../theme/theme';

export function HouseholdScreen({ navigation }: any) {
  const { user } = useAuth();
  const { household } = useHousehold();
  const [sitterGrants, setSitterGrants] = useState<SitterAccessGrant[]>([]);

  useEffect(() => {
    if (!household) return;
    reconcileMemberCount(firestore, household.inviteCode, household.members.length).catch(() => {
      // Best-effort — a failed reconcile just means the count stays stale
      // until the next successful attempt; not worth surfacing to the user.
    });
  }, [household?.id, household?.members.length]);

  useEffect(() => {
    if (!household) return;
    return subscribeToSitterGrants(firestore, household.id, setSitterGrants);
  }, [household?.id]);

  const activeSitterGrants = sitterGrants.filter((g) => !g.revoked && g.expiresAt > Date.now());

  const handleRevokeSitter = (grant: SitterAccessGrant) => {
    if (!household) return;
    Alert.alert(
      'Revoke sitter access',
      'This sitter will immediately lose access to the pets they were granted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            try {
              await revokeSitterAccess(firestore, household.id, grant.sitterUid);
            } catch (e: any) {
              Alert.alert('Could not revoke access', e.message);
            }
          },
        },
      ]
    );
  };

  const handleShare = () => {
    if (!household) return;
    Share.share({
      message: `Join our household on Pet Health Tracker! Use invite code: ${household.inviteCode}`,
    });
  };

  const handleRemove = (member: HouseholdMember) => {
    if (!household) return;
    Alert.alert(
      'Remove member',
      `Remove ${member.displayName} from this household? They can rejoin later if they still have the invite code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeMember(firestore, household.id, household.inviteCode, member, household.members.length - 1);
            } catch (e: any) {
              Alert.alert('Could not remove member', e.message);
            }
          },
        },
      ]
    );
  };

  const atLimit = household ? !canAddHouseholdMember(household) : false;

  return (
    <ScreenContainer style={{ flex: 1 }}>
      <Title>{household?.name ?? 'Household'}</Title>

      <Card style={{ gap: spacing.xs }}>
        <Subtitle>Invite code</Subtitle>
        <Title style={{ letterSpacing: 4 }}>{household?.inviteCode ?? '------'}</Title>
        <Button title="Share invite" onPress={handleShare} />
      </Card>

      {household && (
        <Card style={{ gap: spacing.xs }}>
          <Subtitle>
            {isSubscriptionActive(household)
              ? `Free trial — ${Math.max(0, Math.ceil(((household.trialEndsAt ?? 0) - Date.now()) / (24 * 60 * 60 * 1000)))} days left`
              : 'Trial ended'}
          </Subtitle>
        </Card>
      )}

      <MutedText>{household?.members.length ?? 0} of {FREE_HOUSEHOLD_MEMBERS} members</MutedText>
      {atLimit && <MutedText>{householdMemberLimitMessage()}</MutedText>}

      <FlatList
        data={household?.members ?? []}
        keyExtractor={(m) => m.userId}
        contentContainerStyle={{ gap: spacing.sm }}
        renderItem={({ item }) => (
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Subtitle>{item.displayName}{item.userId === user?.uid ? ' (You)' : ''}</Subtitle>
            {item.userId !== user?.uid && (
              <Button title="Remove" variant="outline" onPress={() => handleRemove(item)} />
            )}
          </Card>
        )}
      />

      {activeSitterGrants.length > 0 && (
        <>
          <Subtitle>Sitters</Subtitle>
          <FlatList
            data={activeSitterGrants}
            keyExtractor={(g) => g.sitterUid}
            contentContainerStyle={{ gap: spacing.sm }}
            renderItem={({ item }) => (
              <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Subtitle>{item.petIds.length} pet{item.petIds.length === 1 ? '' : 's'}</Subtitle>
                  <MutedText>Until {new Date(item.expiresAt).toLocaleDateString()}</MutedText>
                </View>
                <Button title="Revoke" variant="outline" onPress={() => handleRevokeSitter(item)} />
              </Card>
            )}
          />
        </>
      )}

      {__DEV__ && (
        <Button
          variant="outline"
          title="Developer: style guide"
          onPress={() => navigation.navigate('PetsTab', { screen: 'DevStyleGuide' })}
        />
      )}
    </ScreenContainer>
  );
}
