import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, onSnapshot } from '@react-native-firebase/firestore';
import { firestore } from '../firebase/config';
import { useAuth } from '../auth/AuthContext';
import { Household } from '../types/household';

interface HouseholdContextValue {
  household: Household | null;
  loading: boolean;
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1: resolve the signed-in user's household via the users/{uid}
  // pointer (a single-document get/listen, not a query — see
  // firestore.rules and householdService.ts for why a query can't work
  // here).
  useEffect(() => {
    if (!user) {
      setHouseholdId(null);
      setHousehold(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(doc(firestore, 'users', user.uid), (snap) => {
      setHouseholdId(snap.exists() ? (snap.data() as { householdId: string }).householdId : null);
      if (!snap.exists()) setLoading(false);
    });
  }, [user]);

  // Step 2: once we know the household ID, listen to the household document
  // itself so `household` stays live (e.g. new members joining).
  useEffect(() => {
    if (!householdId) {
      setHousehold(null);
      return;
    }
    return onSnapshot(doc(firestore, 'households', householdId), (snap) => {
      setHousehold(snap.exists() ? (snap.data() as Household) : null);
      setLoading(false);
    });
  }, [householdId]);

  return (
    <HouseholdContext.Provider value={{ household, loading }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error('useHousehold must be used within HouseholdProvider');
  return ctx;
}
