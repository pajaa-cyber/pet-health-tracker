import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, setDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
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
        // memberIds is what every membership check in firestore.rules now
        // reads (`request.auth.uid in memberIds`) — the previous
        // members.filter(...) spelling was not valid rules syntax. It must
        // mirror `members` exactly, the way householdService.ts writes it.
        memberIds: ['user-1'],
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
        // `allow create` now checks `request.auth.uid in
        // request.resource.data.memberIds` (was the invalid members.filter
        // spelling), so the creator must name themselves here.
        memberIds: ['user-3'],
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
        // Mirrors joinHousehold()'s real write shape — isJoining() requires
        // members AND memberIds to each grow by exactly one in the same
        // update, so omitting this would now (correctly) fail the join.
        memberIds: arrayUnion('user-2'),
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
        // Included so every OTHER clause of isJoining() passes and the
        // denial is attributable to the joinCodeUsed mismatch specifically,
        // not to a missing memberIds update.
        memberIds: arrayUnion('user-2'),
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
        // As above: keeps the memberIds clauses satisfied so the denial is
        // attributable to the absent joinCodeUsed specifically.
        memberIds: arrayUnion('user-2'),
      })
    );
  });

  // Regression test for the isMember/isJoining short-circuit: an existing
  // member's own update must never require joinCodeUsed. allow update is
  // `isMember(resource.data) || isJoining(resource.data)` — this confirms
  // the isMember branch alone is sufficient and isJoining (which would
  // reject a missing joinCodeUsed, and now also a missing memberIds update)
  // is never forced to evaluate. isMember itself changed in the
  // final-review fix wave — it now reads `request.auth.uid in
  // resource.data.memberIds` — so this test depends on seedHousehold()
  // carrying memberIds: ['user-1']; without it isMember could not evaluate
  // true and this write would be denied.
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
        // The attack is a wholesale replacement of BOTH arrays, evicting
        // user-1 from each. Denied by the size(new) == size(old) + 1 checks
        // (each array shrinks to 1 where 2 is required) before hasAll is
        // ever reached — same clause as before this change.
        memberIds: ['user-2'],
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
  //
  // memberIds is deliberately submitted HONESTLY here (['user-1','user-2'])
  // for the same isolation reason: it makes all four memberIds clauses pass
  // so the ONLY clause that can produce the denial is
  // members.hasAll(oldMembers). If a bogus memberIds were sent instead, the
  // write would be denied by the new memberIds checks and this test would
  // silently stop exercising members.hasAll at all. The attack shape is
  // still meaningful in its own right: a code-holding joiner trying to
  // erase the existing member's entry from the member-object array while
  // keeping the ID array honest — and it is still denied.
  it('denies a non-member join write that is correctly sized but fabricates a replacement for the existing member', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: [
          { userId: 'fake-user-1', displayName: 'Imposter', joinedAt: 0 },
          { userId: 'user-2', displayName: 'Marko', joinedAt: 0 },
        ],
        memberIds: ['user-1', 'user-2'],
        joinCodeUsed: 'ABC123',
      })
    );
  });

  // The memberIds counterpart of the hasAll hijack test above, and the
  // reason it matters most: memberIds is the array every membership check
  // in firestore.rules and storage.rules actually authorizes against, so an
  // eviction there is a real access revocation, not a display glitch. Here
  // `members` is submitted honestly (correct size, hasAll passes) while
  // memberIds is correctly sized but drops user-1 in favour of a fabricated
  // ID — so the denial is attributable to memberIds.hasAll(old) alone.
  it('denies a join write whose memberIds array is correctly sized but evicts the existing member ID', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: [
          { userId: 'user-1', displayName: 'Ana', joinedAt: 0 },
          { userId: 'user-2', displayName: 'Marko', joinedAt: 0 },
        ],
        memberIds: ['fake-user-1', 'user-2'],
        joinCodeUsed: 'ABC123',
      })
    );
  });

  // Direct coverage for the clause that REPLACED the invalid
  // `members.filter(m => m.userId == request.auth.uid).size() == 1` check:
  // `request.auth.uid in request.resource.data.memberIds`. Everything else
  // about this write is legitimate (both arrays grow by exactly one, both
  // hasAll the originals, correct invite code, no smuggled fields) — the
  // single defect is that the added member is a THIRD PARTY, not the
  // requester. Without this clause a code-holder could enrol arbitrary
  // other accounts into the household, so this must be denied.
  it('denies a join write that adds someone other than the requester', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        members: [
          { userId: 'user-1', displayName: 'Ana', joinedAt: 0 },
          { userId: 'user-3', displayName: 'Victim', joinedAt: 0 },
        ],
        memberIds: ['user-1', 'user-3'],
        joinCodeUsed: 'ABC123',
      })
    );
  });

  // Positive control for the new memberIds machinery, written with raw
  // arrays instead of arrayUnion so the exact resulting document shape is
  // asserted rather than delegated to a server-side transform. This test
  // fails if memberIds is dropped from the diff-scope allowlist, if either
  // size/hasAll pair is wrong, or if the `uid in memberIds` clause is
  // omitted in a way that changes the legitimate path — i.e. it is the test
  // that would break had memberIds been forgotten or mis-specified.
  it('allows a non-member to join with explicit (non-arrayUnion) members and memberIds arrays', async () => {
    await seedHousehold();
    const joinerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(
      updateDoc(doc(joinerDb, 'households', 'h1'), {
        members: [
          { userId: 'user-1', displayName: 'Ana', joinedAt: 0 },
          { userId: 'user-2', displayName: 'Marko', joinedAt: 0 },
        ],
        memberIds: ['user-1', 'user-2'],
        joinCodeUsed: 'ABC123',
      })
    );
  });

  // Regression test for finding 2: isJoining() must not let a join write
  // smuggle changes to fields other than `members`/`memberIds`/
  // `joinCodeUsed` in the same update. joinCodeUsed is set correctly here,
  // and memberIds is updated correctly (it is now a legitimate join-write
  // field and is in the allowlist), so the denial is attributable to the
  // smuggled `name` field failing the
  // diff().affectedKeys().hasOnly(['members', 'memberIds', 'joinCodeUsed'])
  // check, not to a missing/wrong invite code or a missing memberIds update.
  it('denies a non-member join write that also smuggles a change to another field', async () => {
    await seedHousehold();
    const attackerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(attackerDb, 'households', 'h1'), {
        name: 'Hijacked Household Name',
        members: arrayUnion({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
        memberIds: arrayUnion('user-2'),
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

  it('allows creating an invite-code entry with householdId and memberCount', async () => {
    const creatorDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(creatorDb, 'inviteCodes', 'ZZZ999'), { householdId: 'h2', memberCount: 1 })
    );
  });

  it("allows any signed-in user to update an invite code's memberCount via increment()", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1', memberCount: 1 });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(
      updateDoc(doc(someUserDb, 'inviteCodes', 'ABC123'), { memberCount: increment(1) })
    );
  });

  it('allows incrementing memberCount on an invite code that predates the field', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1' });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertSucceeds(
      updateDoc(doc(someUserDb, 'inviteCodes', 'ABC123'), { memberCount: increment(1) })
    );
  });

  it('denies an unauthenticated memberCount update', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1', memberCount: 1 });
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(
      updateDoc(doc(anonDb, 'inviteCodes', 'ABC123'), { memberCount: increment(1) })
    );
  });

  it('denies repointing an invite code at a different household via a memberCount update', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1', memberCount: 1 });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(someUserDb, 'inviteCodes', 'ABC123'), { householdId: 'h-hijacked', memberCount: 2 })
    );
  });

  it('denies a negative memberCount update', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1', memberCount: 1 });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(someUserDb, 'inviteCodes', 'ABC123'), { memberCount: -1 })
    );
  });

  it('denies a non-integer memberCount update', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'inviteCodes', 'ABC123'), { householdId: 'h1', memberCount: 1 });
    });
    const someUserDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(someUserDb, 'inviteCodes', 'ABC123'), { memberCount: 'three' })
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

  it('lets a removed member overwrite their stale household pointer', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      // user-1's pointer still names h1, but h1's memberIds no longer
      // includes them (they were removed, or never actually re-added after
      // seedHousehold — either way, the rule only cares about the CURRENT
      // memberIds of the household the stale pointer names).
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
      await setDoc(doc(context.firestore(), 'households', 'h1'), {
        id: 'h1', name: 'Test Household',
        members: [{ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }],
        memberIds: ['user-2'],
        inviteCode: 'ABC123', createdAt: 0,
      });
    });
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h2' })
    );
  });

  it('still denies a current member from overwriting their own pointer', async () => {
    await seedHousehold(); // user-1 is a member of h1
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
    });
    const userDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(userDb, 'users', 'user-1'), { householdId: 'h2' })
    );
  });

  it('allows a member to remove another member from the household', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1'), {
        id: 'h1', name: 'Test Household',
        members: [
          { userId: 'user-1', displayName: 'Ana', joinedAt: 0 },
          { userId: 'user-2', displayName: 'Marko', joinedAt: 0 },
        ],
        memberIds: ['user-1', 'user-2'],
        inviteCode: 'ABC123', createdAt: 0,
      });
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1'), {
        members: arrayRemove({ userId: 'user-2', displayName: 'Marko', joinedAt: 0 }),
        memberIds: arrayRemove('user-2'),
      })
    );
  });

  it('denies a user from reading someone else\'s household pointer', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users', 'user-1'), { householdId: 'h1' });
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'users', 'user-1')));
  });

  // Duplicates seedHousehold's body rather than reusing it (kept as-is from
  // Plan 2); both must carry memberIds, since isHouseholdMember() resolves
  // membership for every pet subcollection via
  // `request.auth.uid in get(.../households/h1).data.memberIds`.
  const seedPetHousehold = async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1'), {
        id: 'h1',
        name: 'Test Household',
        members: [{ userId: 'user-1', displayName: 'Ana', joinedAt: 0 }],
        memberIds: ['user-1'],
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
        id: 'pet-1', householdId: 'h1', name: 'Rex', species: 'dog', speciesOther: null,
        breed: 'Labrador', birthDate: 0, birthDatePrecision: 'exact', approximateAgeMonths: null,
        arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#EF4444',
        sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
        microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
        customFields: [], status: 'active',
      })
    );
  });

  it('denies a non-member from creating a pet in someone else\'s household', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1'), {
        id: 'pet-1', householdId: 'h1', name: 'Rex', species: 'dog', speciesOther: null,
        breed: 'Labrador', birthDate: 0, birthDatePrecision: 'exact', approximateAgeMonths: null,
        arrivalDate: null, arrivalDatePrecision: null, photoUrl: null, colorKey: '#EF4444',
        sex: 'unknown', neutered: null, colorMarkings: '', livingEnvironment: null,
        microchipProvider: '', microchipNumber: '', microchipDate: null, microchipRegistry: '',
        customFields: [], status: 'active',
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

  it('allows a household member to create a medication', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        id: 'med-1', petId: 'pet-1', name: 'Amoxicillin', dosage: '250mg',
        schedule: { timesPerDay: 2, intervalDays: 1 }, startDate: 0, endDate: null, log: [],
      })
    );
  });

  it('allows a household member to log a medication dose', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        id: 'med-1', petId: 'pet-1', name: 'Amoxicillin', dosage: '250mg',
        schedule: { timesPerDay: 2, intervalDays: 1 }, startDate: 0, endDate: null, log: [],
      });
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        log: arrayUnion({ givenBy: 'user-1', givenAt: 0 }),
      })
    );
  });

  it('denies a non-member from logging a medication dose', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        id: 'med-1', petId: 'pet-1', name: 'Amoxicillin', dosage: '250mg',
        schedule: { timesPerDay: 2, intervalDays: 1 }, startDate: 0, endDate: null, log: [],
      });
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'medications', 'med-1'), {
        log: arrayUnion({ givenBy: 'user-2', givenAt: 0 }),
      })
    );
  });

  it('allows a household member to create a weight log entry', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'weightLogs', 'weight-1'), {
        id: 'weight-1', petId: 'pet-1', date: 0, weight: 12.5,
      })
    );
  });

  it('denies a non-member from creating a weight log entry', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'weightLogs', 'weight-1'), {
        id: 'weight-1', petId: 'pet-1', date: 0, weight: 12.5,
      })
    );
  });

  it('allows a household member to create an expense', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'expenses', 'expense-1'), {
        id: 'expense-1', petId: 'pet-1', date: 0, category: 'vet', amountCents: 5000, note: 'Checkup',
      })
    );
  });

  it('denies a non-member from creating an expense', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'expenses', 'expense-1'), {
        id: 'expense-1', petId: 'pet-1', date: 0, category: 'vet', amountCents: 5000, note: 'Checkup',
      })
    );
  });

  it('allows a household member to create a vet visit', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'pets', 'pet-1', 'vetVisits', 'visit-1'), {
        id: 'visit-1', petId: 'pet-1', date: 0, reason: 'Checkup', notes: 'Fine', documentUrls: [], followUpDate: null,
      })
    );
  });

  it('denies a non-member from creating a vet visit', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'pets', 'pet-1', 'vetVisits', 'visit-1'), {
        id: 'visit-1', petId: 'pet-1', date: 0, reason: 'Checkup', notes: 'Fine', documentUrls: [], followUpDate: null,
      })
    );
  });

  // events is household-level (not nested under pets) — a single calendar
  // entry can span multiple pets via petIds. seedPetHousehold is reused
  // even though it doesn't seed a pet doc; events don't need one.
  const validEvent = {
    id: 'evt-1', householdId: 'h1', petIds: ['pet-1'], type: 'grooming',
    title: 'Bath', notes: '', date: 0, status: 'upcoming',
  };

  it('allows a household member to create an event', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'events', 'evt-1'), validEvent)
    );
  });

  it('denies a non-member from creating an event', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'events', 'evt-1'), validEvent)
    );
  });

  it('allows a household member to read an event', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'events', 'evt-1'), validEvent);
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'households', 'h1', 'events', 'evt-1')));
  });

  it('denies a non-member from reading an event', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'events', 'evt-1'), validEvent);
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1', 'events', 'evt-1')));
  });

  it('allows a household member to update an event, e.g. to mark it completed', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'events', 'evt-1'), validEvent);
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1', 'events', 'evt-1'), { status: 'completed' })
    );
  });

  it('denies a non-member from updating an event', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'events', 'evt-1'), validEvent);
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      updateDoc(doc(strangerDb, 'households', 'h1', 'events', 'evt-1'), { status: 'completed' })
    );
  });

  it('allows a household member to delete an event', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'events', 'evt-1'), validEvent);
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(deleteDoc(doc(memberDb, 'households', 'h1', 'events', 'evt-1')));
  });

  it('denies a non-member from deleting an event', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'events', 'evt-1'), validEvent);
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(deleteDoc(doc(strangerDb, 'households', 'h1', 'events', 'evt-1')));
  });

  // vets is household-level (not nested under pets), matching events'
  // precedent — a clinic can serve multiple pets in the household via petIds.
  const validVet = {
    id: 'vet-1', householdId: 'h1', clinicName: 'Riverside Vet Clinic', doctorName: 'Dr. Novak',
    address: '12 River Rd', phone: '555-0100', openingHours: 'Mon-Fri 9am-6pm',
    speciality: 'General practice', isEmergency24h: false, notes: '', petIds: ['pet-1'],
  };

  it('allows a member to create a vet', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(
      setDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1'), validVet)
    );
  });

  it('denies a non-member from creating a vet', async () => {
    await seedPetHousehold();
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(
      setDoc(doc(strangerDb, 'households', 'h1', 'vets', 'vet-1'), validVet)
    );
  });

  it('denies creating a vet with a field outside the allowlist', async () => {
    await seedPetHousehold();
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertFails(
      setDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1'), { ...validVet, vetIdOnVisit: 'sneaky' })
    );
  });

  it('allows a member to read and update a vet', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'vets', 'vet-1'), validVet);
    });
    const memberDb = testEnv.authenticatedContext('user-1').firestore();
    await assertSucceeds(getDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1')));
    await assertSucceeds(
      updateDoc(doc(memberDb, 'households', 'h1', 'vets', 'vet-1'), { clinicName: 'Renamed Clinic' })
    );
  });

  it('denies a non-member from reading a vet', async () => {
    await seedPetHousehold();
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'households', 'h1', 'vets', 'vet-1'), validVet);
    });
    const strangerDb = testEnv.authenticatedContext('user-2').firestore();
    await assertFails(getDoc(doc(strangerDb, 'households', 'h1', 'vets', 'vet-1')));
  });
});
