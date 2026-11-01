/**
 * Firestore Security Rules Test Specification (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Event Creation',
    operation: 'create',
    path: '/events/evt_spoof',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: { ownerId: 'victim_uid', title: 'Spoofed Event' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/events/evt_unverified',
    auth: { uid: 'user_1', email_verified: false },
    payload: { ownerId: 'user_1', title: 'Unverified Event' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Create',
    operation: 'create',
    path: '/events/evt_shadow',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Shadow Event', isVerifiedAdmin: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Value Poisoning on Update',
    operation: 'update',
    path: '/events/evt_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { title: 'A'.repeat(5000) },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'ID Poisoning Attack',
    operation: 'create',
    path: '/events/invalid$id!with*chars',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'user_1', title: 'Bad ID' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Terminal State Bypass on Archived Event',
    operation: 'update',
    path: '/events/evt_archived',
    auth: { uid: 'user_1', email_verified: true },
    payload: { title: 'Mutating Archived Event' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Subcollection Create',
    operation: 'create',
    path: '/events/evt_1/budgetItems/item_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Orphaned Subcollection Write',
    operation: 'create',
    path: '/events/missing_event/budgetItems/item_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { eventId: 'missing_event', authorId: 'user_1' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immortal Field Mutation (ownerId)',
    operation: 'update',
    path: '/events/evt_1',
    auth: { uid: 'user_1', email_verified: true },
    payload: { ownerId: 'new_owner_uid' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Unbounded Array Exhaustion (collaboratorUids > 10)',
    operation: 'create',
    path: '/events/evt_array',
    auth: { uid: 'user_1', email_verified: true },
    payload: {
      ownerId: 'user_1',
      collaboratorUids: Array.from({ length: 15 }, (_, i) => `u_${i}`),
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Unauthorized List Scraping',
    operation: 'list',
    path: '/events',
    auth: { uid: 'unrelated_stranger', email_verified: true },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Privilege Escalation in EventMember',
    operation: 'create',
    path: '/events/evt_1/members/attacker_uid',
    auth: { uid: 'attacker_uid', email_verified: true },
    payload: { userId: 'attacker_uid', role: 'owner' },
    expectedResult: 'PERMISSION_DENIED',
  },
];
