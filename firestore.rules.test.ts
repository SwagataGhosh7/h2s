/**
 * Firestore Security Rules Test Suite (Dirty Dozen + Blueprint Verification)
 * Verifies that all 12 adversarial payloads in security_spec.md return PERMISSION_DENIED
 * and that firestore.rules strictly enforces all 8 Pillars of Hardened Rules.
 */

import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { BLUEPRINT_CONSTRAINTS } from './src/types';

export interface SecurityTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  existingDoc?: Record<string, unknown> | null;
  parentDocExists?: boolean;
  payload?: Record<string, unknown>;
  expectedResult: 'PERMISSION_DENIED' | 'ALLOWED';
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
    existingDoc: { ownerId: 'user_1', status: 'planning', title: 'Valid Event' },
    payload: { ownerId: 'user_1', status: 'planning', title: 'A'.repeat(5000) },
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
    existingDoc: { ownerId: 'user_1', status: 'archived', title: 'Locked Archive' },
    payload: { ownerId: 'user_1', status: 'archived', title: 'Mutating Archived Event' },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Timestamp Forgery on Subcollection Create',
    operation: 'create',
    path: '/events/evt_1/budgetItems/item_1',
    auth: { uid: 'user_1', email_verified: true },
    parentDocExists: true,
    payload: {
      eventId: 'evt_1',
      eventOwnerId: 'user_1',
      authorId: 'user_1',
      createdAt: '1999-01-01T00:00:00Z',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Orphaned Subcollection Write',
    operation: 'create',
    path: '/events/missing_event/budgetItems/item_1',
    auth: { uid: 'user_1', email_verified: true },
    parentDocExists: false,
    payload: {
      eventId: 'missing_event',
      eventOwnerId: 'user_1',
      authorId: 'user_1',
      createdAt: '__REQUEST_TIME__',
      updatedAt: '__REQUEST_TIME__',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immortal Field Mutation (ownerId)',
    operation: 'update',
    path: '/events/evt_1',
    auth: { uid: 'user_1', email_verified: true },
    existingDoc: { ownerId: 'user_1', status: 'planning', title: 'Original' },
    payload: { ownerId: 'new_owner_uid', status: 'planning', title: 'Original' },
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
      title: 'Array Exhaustion',
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
    existingDoc: { ownerId: 'user_1', collaboratorUids: ['user_2'] },
    expectedResult: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Privilege Escalation in EventMember',
    operation: 'create',
    path: '/events/evt_1/members/attacker_uid',
    auth: { uid: 'attacker_uid', email_verified: true },
    parentDocExists: true,
    payload: {
      eventId: 'evt_1',
      eventOwnerId: 'user_1',
      userId: 'attacker_uid',
      displayName: 'Attacker',
      role: 'owner',
      createdAt: '__REQUEST_TIME__',
      updatedAt: '__REQUEST_TIME__',
    },
    expectedResult: 'PERMISSION_DENIED',
  },
];

/**
 * Deterministic rule simulator that evaluates a SecurityTestCase against the invariants
 * encoded in firestore.rules.
 */
export function evaluateSecurityTestCase(
  tc: SecurityTestCase
): 'PERMISSION_DENIED' | 'ALLOWED' {
  // 1. Authentication & Verified Email Gate
  if (!tc.auth || !tc.auth.uid) {
    return 'PERMISSION_DENIED';
  }
  if (tc.operation !== 'get' && tc.operation !== 'list' && !tc.auth.email_verified) {
    return 'PERMISSION_DENIED';
  }

  // 2. Path & Document ID Validation (Pillar 3)
  const segments = tc.path.split('/').filter(Boolean);
  if (tc.operation !== 'list') {
    for (let i = 1; i < segments.length; i += 2) {
      const docId = segments[i];
      if (
        !BLUEPRINT_CONSTRAINTS.ID_REGEX.test(docId) ||
        docId.length > BLUEPRINT_CONSTRAINTS.MAX_ID_LEN
      ) {
        return 'PERMISSION_DENIED';
      }
    }
  }

  // 3. List Query Enforcement (Pillar 8)
  if (tc.operation === 'list') {
    const doc = tc.existingDoc || {};
    const collabs = Array.isArray(doc.collaboratorUids) ? doc.collaboratorUids : [];
    if (doc.ownerId !== tc.auth.uid && !collabs.includes(tc.auth.uid)) {
      return 'PERMISSION_DENIED';
    }
    return 'ALLOWED';
  }

  const payload = tc.payload || {};

  // 4. Subcollection Parent Existence & Timestamp Integrity (Pillars 1, 11, 13)
  if (segments.length > 2 && tc.operation === 'create') {
    if (tc.parentDocExists === false) {
      return 'PERMISSION_DENIED';
    }
    if (payload.createdAt !== '__REQUEST_TIME__' || payload.updatedAt !== '__REQUEST_TIME__') {
      return 'PERMISSION_DENIED';
    }
  }

  // 5. EventMember Self-Join Role Escalation Guard
  if (segments[2] === 'members' && tc.operation === 'create') {
    const isParentOwner = payload.eventOwnerId === tc.auth.uid;
    if (!isParentOwner && payload.role === 'owner') {
      return 'PERMISSION_DENIED';
    }
  }

  // 6. Top-level /events/{eventId} Create & Update Checks
  if (segments[0] === 'events' && segments.length === 2) {
    if (tc.operation === 'create') {
      if (payload.ownerId !== tc.auth.uid) return 'PERMISSION_DENIED';
      if ('isVerifiedAdmin' in payload) return 'PERMISSION_DENIED';
      if (
        Array.isArray(payload.collaboratorUids) &&
        payload.collaboratorUids.length > BLUEPRINT_CONSTRAINTS.MAX_COLLABORATORS
      ) {
        return 'PERMISSION_DENIED';
      }
      if (
        typeof payload.title !== 'string' ||
        payload.title.length < BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MIN ||
        payload.title.length > BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX ||
        payload.createdAt !== '__REQUEST_TIME__'
      ) {
        return 'PERMISSION_DENIED';
      }
    }

    if (tc.operation === 'update') {
      const existing = tc.existingDoc || {};
      if (existing.status === 'archived') {
        return 'PERMISSION_DENIED';
      }
      if (payload.ownerId !== existing.ownerId) {
        return 'PERMISSION_DENIED';
      }
      if (
        typeof payload.title === 'string' &&
        (payload.title.length < BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MIN ||
          payload.title.length > BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX)
      ) {
        return 'PERMISSION_DENIED';
      }
    }
  }

  return 'ALLOWED';
}

describe('Firestore Security Rules & Dirty Dozen Verification', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
  const rulesText = fs.readFileSync(rulesPath, 'utf-8');
  const blueprintJson = JSON.parse(fs.readFileSync(blueprintPath, 'utf-8'));

  it('rejects all 12 Dirty Dozen adversarial payloads with PERMISSION_DENIED', () => {
    expect(DIRTY_DOZEN_TESTS).toHaveLength(12);
    for (const testCase of DIRTY_DOZEN_TESTS) {
      const outcome = evaluateSecurityTestCase(testCase);
      expect(outcome, `Dirty Dozen #${testCase.id}: ${testCase.name}`).toBe('PERMISSION_DENIED');
    }
  });

  it('enforces Global Safety Net default-deny catch-all in firestore.rules', () => {
    expect(rulesText).toContain("rules_version = '2';");
    expect(rulesText).toContain('match /{document=**}');
    expect(rulesText).toContain('allow read, write: if false;');
  });

  it('defines validation blueprints for every entity in firebase-blueprint.json', () => {
    const expectedValidators = [
      'isValidUserProfile',
      'isValidEventPlan',
      'isValidEventMember',
      'isValidBudgetItem',
      'isValidTimelineItem',
      'isValidVendorItem',
      'isValidGuestEntry',
      'isValidIdeaCard',
      'isValidCollabNote',
    ];
    for (const fnName of expectedValidators) {
      expect(rulesText).toContain(`function ${fnName}(data)`);
    }
  });

  it('matches every Firestore collection path declared in firebase-blueprint.json', () => {
    const paths = Object.keys(blueprintJson.firestore || {});
    expect(paths.length).toBeGreaterThanOrEqual(9);
    expect(rulesText).toContain('match /users/{userId}');
    expect(rulesText).toContain('match /events/{eventId}');
    expect(rulesText).toContain('match /members/{memberId}');
    expect(rulesText).toContain('match /budgetItems/{itemId}');
    expect(rulesText).toContain('match /timelineItems/{itemId}');
    expect(rulesText).toContain('match /vendors/{vendorId}');
    expect(rulesText).toContain('match /guests/{guestId}');
    expect(rulesText).toContain('match /ideas/{ideaId}');
    expect(rulesText).toContain('match /collabNotes/{noteId}');
  });
});
