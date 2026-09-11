import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import * as fs from 'fs';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'pet-health-test',
    firestore: {
      host: 'localhost',
      port: 8080,
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('household security rules', () => {
  const seedHousehold = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'households', 'h1'), {
        id: 'h1',
        name: 'Test Household',
        members: [{ userId: 'user-1', displayName: 'Ana', joinedAt: 0 }],
        inviteCode: 'ABC123',
        createdAt: 0,
      });
    });
  };

  it('allows a member to read their household', async () => {
    await seedHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'households', 'h1')));
  });

  it('denies a non-member from reading the household', async () => {
    await seedHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1')));
  });

  it('denies unauthenticated reads', async () => {
    await seedHousehold();
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anonDb, 'households', 'h1')));
  });

  it('allows any authenticated user to create a household naming themselves as a member', async () => {
    const creatorDb = testEnv.authenticatedContext('user-3').firestore();
    await assertSucceeds(
      setDoc(doc(creatorDb, 'households', 'h2'), {
        id: 'h2',
        name: 'New Household',
        members: [{ userId: 'user-3', displayName: 'Marko', joinedAt: 0 }],
        inviteCode: 'ZZZ999',
        createdAt: 0,
      })
    );
  });

  it('allows a non-member to join by adding themselves via arrayUnion', async () => {
    await seedHousehold();
    const joinerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(
      updateDoc(doc(joinerDb, 'households', 'h1'), {
        members: arrayUnion({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
      })
    );
  });

  it('denies a non-member from replacing the members array to evict an existing member', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: [{ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }],
      })
    );
  });

  it('allows any authenticated user to read an invite-code lookup entry', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1' });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(getDoc(doc(someUserDb, 'inviteCodes', 'ABC123')));
  });

  it('denies creating an invite-code entry with extra fields', async () => {
    const creatorDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(creatorDb, 'inviteCodes', 'ZZZ999'), {
        householdId: 'h2',
        extra: 'not allowed',
      })
    );
  });
});
