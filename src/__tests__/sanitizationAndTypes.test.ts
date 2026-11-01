import { describe, expect, it } from 'vitest';
import {
  BLUEPRINT_CONSTRAINTS,
  generateSafeId,
  sanitizeCollaborators,
  sanitizeNumber,
  sanitizeString,
} from '../types';

describe('Data Sanitization & Blueprint Constraint Guards', () => {
  describe('sanitizeString', () => {
    it('trims leading/trailing whitespace and respects maxLength', () => {
      expect(sanitizeString('  Villa Solis Courtyard  ', 50)).toBe('Villa Solis Courtyard');
      expect(sanitizeString('A'.repeat(200), BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX)).toHaveLength(
        BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX
      );
    });

    it('falls back to provided default when input is empty or non-string', () => {
      expect(sanitizeString('   ', 40, 'Untitled Celebration')).toBe('Untitled Celebration');
      expect(sanitizeString(null, 40, 'Default Value')).toBe('Default Value');
      expect(sanitizeString(undefined, 10, '123456789012345')).toBe('1234567890');
    });
  });

  describe('sanitizeNumber', () => {
    it('clamps numeric values within [min, max] and rounds to integer', () => {
      expect(sanitizeNumber(48500.7, 0, 100000)).toBe(48501);
      expect(sanitizeNumber(-500, 0, 100000)).toBe(0);
      expect(sanitizeNumber(999999, 0, 50000)).toBe(50000);
    });

    it('returns fallback when value is NaN or non-numeric', () => {
      expect(sanitizeNumber('not-a-number', 0, 1000, 250)).toBe(250);
      expect(sanitizeNumber(NaN, 10, 500, 50)).toBe(50);
    });
  });

  describe('sanitizeCollaborators', () => {
    it('filters invalid IDs and caps array length at MAX_COLLABORATORS (10)', () => {
      const raw = [
        'valid_uid_1',
        'valid-uid-2',
        'bad$uid!injection',
        '',
        123,
        ...Array.from({ length: 15 }, (_, i) => `user_collab_${i}`),
      ];
      const result = sanitizeCollaborators(raw);
      expect(result).toHaveLength(BLUEPRINT_CONSTRAINTS.MAX_COLLABORATORS);
      expect(result[0]).toBe('valid_uid_1');
      expect(result[1]).toBe('valid-uid-2');
      expect(result.every((id) => BLUEPRINT_CONSTRAINTS.ID_REGEX.test(id))).toBe(true);
    });

    it('returns empty array for non-array input', () => {
      expect(sanitizeCollaborators(null)).toEqual([]);
      expect(sanitizeCollaborators('user_1')).toEqual([]);
    });
  });

  describe('generateSafeId', () => {
    it('produces collision-resistant IDs matching Firestore ID_REGEX', () => {
      const id1 = generateSafeId('evt');
      const id2 = generateSafeId('evt');
      expect(id1).not.toBe(id2);
      expect(id1.startsWith('evt_')).toBe(true);
      expect(BLUEPRINT_CONSTRAINTS.ID_REGEX.test(id1)).toBe(true);
      expect(id1.length).toBeLessThanOrEqual(BLUEPRINT_CONSTRAINTS.MAX_ID_LEN);
    });
  });
});
