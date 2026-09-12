import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
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

  // Regression test for fix round 3 (joinCodeUsed): a non-member join
  // write that supplies the household's ACTUAL invite code alongside a
  // correctly-shaped members array is the legitimate join path and must
  // still succeed now that joinCodeUsed is a required field — it's easy
  // to accidentally break this happy path while adding a new required
  // check.
  it('allows a non-member to join by adding themselves via arrayUnion, with the correct joinCodeUsed', async () => {
    await seedHousehold();
    const joinerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(
      updateDoc(doc(joinerDb, 'households', 'h1'), {
        members: arrayUnion({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
        joinCodeUsed: 'ABC123',
      })
    );
  });

  // Regression test for fix round 3 (joinCodeUsed): this is the actual gap
  // that round closed. Before this fix, `isJoining()` never checked invite
  // -code possession at all — anyone who knew a household's document ID
  // could join via arrayUnion with zero knowledge of its real invite code.
  // This submits an otherwise-perfectly-valid join write (correct size,
  // hasAll, self-count all pass) but with a joinCodeUsed that does not
  // match the household's actual stored inviteCode, and must be denied.
  it('denies a non-member join write with a joinCodeUsed that does not match the household\'s actual invite code', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: arrayUnion({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
        joinCodeUsed: 'WRONGC',
      })
    );
  });

  // Same gap, the "field omitted entirely" variant — this is exactly the
  // shape of the original attack described in the plan's progress log: a
  // bare arrayUnion join write with no invite-code proof at all.
  it('denies a non-member join write with joinCodeUsed omitted entirely', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: arrayUnion({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
      })
    );
  });

  // Regression test for the isMember/isJoining short-circuit: an existing
  // member's own update must never require joinCodeUsed. allow update is
  // `isMember(resource.data) || isJoining(resource.data)` — this confirms
  // the isMember branch alone is sufficient and isJoining (which would
  // reject a missing joinCodeUsed) is never forced to evaluate.
  it('allows an existing member to update the household with no joinCodeUsed field', async () => {
    await seedHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1'), {
        name: 'Renamed Household',
      })
    );
  });

  it('denies a non-member from replacing the members array to evict an existing member', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: [{ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }],
        joinCodeUsed: 'ABC123',
      })
    );
  });

  // Regression test for finding 6: the test above submits a same-size
  // array, which the size(new) == size(old) + 1 check alone already
  // rejects — it never actually reaches hasAll(). This test submits the
  // CORRECT size (old size + 1) while fabricating a substitute for the
  // existing member and appending the requester, so size and
  // self-presence both pass and only hasAll(old members) can catch it.
  // joinCodeUsed is set to the household's real invite code so this test
  // keeps isolating hasAll() specifically — without a correct code here,
  // this write would now also be denied by the (unrelated) joinCodeUsed
  // check added in fix round 3, which would defeat the point of this test.
  it('denies a non-member join write that is correctly sized but fabricates a replacement for the existing member', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: [
          { userId: 'fake-user-1', displayName: 'Imposter', joinedAt: 0 },
          { userId: 'user-2', displayName: 'Marko', joinedAt: 0 },
        ],
        joinCodeUsed: 'ABC123',
      })
    );
  });

  // Regression test for finding 2: isJoining() must not let a join write
  // smuggle changes to fields other than `members`/`joinCodeUsed` in the
  // same update. joinCodeUsed is set correctly here so the denial is
  // attributable to the smuggled `name` field failing the
  // diff().affectedKeys().hasOnly(['members', 'joinCodeUsed']) check, not
  // to a missing/wrong invite code.
  it('denies a non-member join write that also smuggles a change to another field', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        name: 'Hijacked Household Name',
        members: arrayUnion({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
        joinCodeUsed: 'ABC123',
      })
    );
  });

  it('allows any authenticated user to get a single invite-code lookup entry by known code', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1' });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(getDoc(doc(someUserDb, 'inviteCodes', 'ABC123')));
  });

  // Regression test for finding 1 (Critical): `allow read` (get + list
  // combined) on inviteCodes let any signed-in user dump the entire
  // collection via a collection-level query, discovering every
  // code -> householdId mapping and joining any household with zero
  // knowledge of its actual invite code. The rules now expose `get` only.
  it('denies a non-member from listing/querying the entire inviteCodes collection', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1' });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDocs(collection(someUserDb, 'inviteCodes')));
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

  it('allows a user to create their own users/{uid} household pointer', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h1' })
    );
  });

  it('denies a user from creating a household pointer for someone else', async () => {
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(userDb, 'users', 'user-2'), { householdId: 'h1' })
    );
  });

  it('denies overwriting an existing users/{uid} pointer', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
    });
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h2' })
    );
  });

  it('denies a user from reading someone else\'s household pointer', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'users', 'user-1')));
  });

  const seedPetHousehold = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1'), {
        id: 'h1',
        name: 'Test Household',
        members: [{ userId: 'user-1', displayName: 'Ana', joinedAt: 0 }],
        inviteCode: 'ABC123',
        createdAt: 0,
      });
    });
  };

  it('allows a household member to create a pet', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1',
        householdId: 'h1',
        name: 'Rex',
        species: 'dog',
        breed: 'Labrador',
        birthDate: 0,
        photoUrl: null,
      })
    );
  });

  it('denies a non-member from creating a pet in someone else\'s household', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1',
        householdId: 'h1',
        name: 'Rex',
        species: 'dog',
        breed: 'Labrador',
        birthDate: 0,
        photoUrl: null,
      })
    );
  });

  it('denies a non-member from reading a pet', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1', householdId: 'h1', name: 'Rex', species: 'dog', breed: 'Labrador', birthDate: 0, photoUrl: null,
      });
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1')));
  });

  it('allows a household member to create a vaccine record for their pet', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'vaccines', 'vax-1'), {
        id: 'vax-1', petId: 'pet-1', name: 'Rabies', dateGiven: 0, nextDueDate: 1000, vetName: 'Dr. Smith',
      })
    );
  });

  it('denies a non-member from creating a vaccine record', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'vaccines', 'vax-1'), {
        id: 'vax-1', petId: 'pet-1', name: 'Rabies', dateGiven: 0, nextDueDate: 1000, vetName: 'Dr. Smith',
      })
    );
  });
});
