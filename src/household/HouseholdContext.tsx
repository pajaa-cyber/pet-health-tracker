import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { collection, doc, getDocs, onSnapshot } from '@react-native-firebase/firestore';
import { firestore } from '../firebase/config';
import { useAuth } from '../auth/AuthContext';
import { Household } from '../types/household';
import { Pet } from '../types/pet';
import { migrateVetVisitDocuments } from '../documents/migration';
import { startTrialIfNeeded } from './householdService';

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
    return onSnapshot(
      doc(firestore, 'users', user.uid),
      (snap) => {
        setHouseholdId(snap.exists() ? (snap.data() as { householdId: string }).householdId : null);
        if (!snap.exists()) setLoading(false);
      },
      // A live listener can start failing after it's already running (e.g.
      // permission-denied following a legitimate state change, or an
      // offline/cache error) — without this, the success callback above
      // simply stops firing and `loading`/`householdId` would be stuck at
      // whatever they last held, with no way for a consumer to notice.
      // Reset to a safe "no household known" state instead of leaving
      // stale data displayed under an error condition.
      () => {
        setHouseholdId(null);
        setLoading(false);
      }
    );
  }, [user]);

  // Step 2: once we know the household ID, listen to the household document
  // itself so `household` stays live (e.g. new members joining).
  useEffect(() => {
    if (!householdId) {
      setHousehold(null);
      return;
    }
    return onSnapshot(
      doc(firestore, 'households', householdId),
      (snap) => {
        setHousehold(snap.exists() ? (snap.data() as Household) : null);
        setLoading(false);
      },
      // Same reasoning as the users/{uid} listener above: e.g. a member
      // being removed from the household mid-listen would turn every
      // subsequent update into a permission-denied error rather than a
      // snapshot, so without this the UI would otherwise hang on stale
      // `household` data and `loading: true` forever.
      () => {
        setHousehold(null);
        setLoading(false);
      }
    );
  }, [householdId]);

  // Step 3: one-time migration of legacy VetVisit.documentUrls into the new
  // documents/pages collections (Plan 8 Task 2). Deliberately NOT a live
  // `onSnapshot` pets subscription — this context already fans out two
  // listeners (users/{uid}, households/{householdId}) and adding a third,
  // permanent one just to run a migration once would compound the listener
  // fan-out gap already tracked in NEXTSTEPS.md. A one-time `getDocs` read is
  // all this needs. `migratedHouseholdIdRef` stops it from re-running for the
  // same household within one app session (e.g. StrictMode double-invoke or
  // household doc updates re-firing this effect); migrateVetVisitDocuments's
  // own `documentsMigratedAt` check is what stops it from re-running across
  // sessions. Fire-and-forget: never awaited by render, errors just logged.
  const migratedHouseholdIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!household) return;
    if (migratedHouseholdIdRef.current === household.id) return;
    migratedHouseholdIdRef.current = household.id;

    getDocs(collection(firestore, 'households', household.id, 'pets'))
      .then((snap) => {
        const pets = snap.docs.map((d) => d.data() as Pet);
        return migrateVetVisitDocuments(firestore, household.id, pets);
      })
      .catch(console.error);
  }, [household]);

  // Sub-project A of Plan 9: start this household's 14-day trial the first
  // time it's ever seen with no trialStartedAt — covers both a brand-new
  // household (this fires within moments of createHousehold) and every
  // pre-existing household (this fires the next time any of its members
  // opens the app after this ships). Same fire-and-forget, ref-guarded
  // shape as the migration effect above; errors just logged, never blocks
  // rendering.
  const trialStartedHouseholdIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!household) return;
    if (household.trialStartedAt) return;
    if (trialStartedHouseholdIdRef.current === household.id) return;
    trialStartedHouseholdIdRef.current = household.id;

    startTrialIfNeeded(firestore, household.id, household).catch(console.error);
  }, [household]);

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
