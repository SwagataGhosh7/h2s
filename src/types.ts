import { Timestamp } from 'firebase/firestore';

export type EventCategory = 'wedding' | 'birthday' | 'community';
export type EventStatus = 'planning' | 'locked' | 'archived';

export interface EventPlan {
  id: string;
  title: string;
  category: EventCategory;
  eventDate: string;
  location: string;
  guestCountEstimate: number;
  totalBudgetLimit: number;
  styleBrief: string;
  inviteCode: string;
  status: EventStatus;
  ownerId: string;
  ownerName: string;
  collaboratorUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type MemberRole = 'owner' | 'planner' | 'guest';

export interface EventMember {
  id: string;
  eventId: string;
  eventOwnerId: string;
  userId: string;
  displayName: string;
  role: MemberRole;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type BudgetCategory = 'venue' | 'catering' | 'decor' | 'music' | 'attire' | 'logistics';
export type PaymentStatus = 'planned' | 'deposit_paid' | 'paid_in_full';

export interface BudgetItem {
  id: string;
  eventId: string;
  eventOwnerId: string;
  authorId: string;
  title: string;
  category: BudgetCategory;
  estimatedAmount: number;
  actualAmount: number;
  paymentStatus: PaymentStatus;
  notes: string;
  collaboratorUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type TimelinePhase = 'pre_event' | 'setup' | 'ceremony_main' | 'reception' | 'wrap_up';
export type TimelineStatus = 'upcoming' | 'in_progress' | 'completed';

export interface TimelineItem {
  id: string;
  eventId: string;
  eventOwnerId: string;
  authorId: string;
  timeSlot: string;
  title: string;
  phase: TimelinePhase;
  leadPerson: string;
  status: TimelineStatus;
  notes: string;
  collaboratorUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type VendorServiceType =
  | 'venue'
  | 'catering'
  | 'floral_decor'
  | 'photography'
  | 'entertainment'
  | 'rentals';
export type VendorContractStatus = 'researching' | 'shortlisted' | 'contracted' | 'confirmed';

export interface VendorItem {
  id: string;
  eventId: string;
  eventOwnerId: string;
  authorId: string;
  vendorName: string;
  serviceType: VendorServiceType;
  contractStatus: VendorContractStatus;
  quotedPrice: number;
  contactPerson: string;
  deliverableNotes: string;
  collaboratorUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type RsvpStatus = 'confirmed' | 'invited' | 'declined';

export interface GuestEntry {
  id: string;
  eventId: string;
  eventOwnerId: string;
  authorId: string;
  guestName: string;
  partySize: number;
  rsvpStatus: RsvpStatus;
  tableGroup: string;
  dietaryNotes: string;
  collaboratorUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type IdeaPillar =
  | 'atmosphere'
  | 'culinary'
  | 'guest_experience'
  | 'floral_lighting'
  | 'music_ritual';

export interface IdeaCard {
  id: string;
  eventId: string;
  eventOwnerId: string;
  authorId: string;
  authorName: string;
  title: string;
  pillar: IdeaPillar;
  description: string;
  estimatedCostImpact: string;
  votesCount: number;
  collaboratorUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type CollabTopicTag = 'general' | 'budget' | 'timeline' | 'vendors' | 'rsvp';

export interface CollabNote {
  id: string;
  eventId: string;
  eventOwnerId: string;
  authorId: string;
  authorName: string;
  authorRole: MemberRole;
  message: string;
  topicTag: CollabTopicTag;
  collaboratorUids: string[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface LiveParticipant {
  userId: string;
  displayName: string;
  role: string;
  activeTab: string;
}

export interface ActivityPulse {
  id: string;
  actorName: string;
  summary: string;
  timestamp: string;
}

// Validation constants synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_CONSTRAINTS = {
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  MAX_ID_LEN: 128,
  MAX_COLLABORATORS: 10,
  EVENT_TITLE_MIN: 2,
  EVENT_TITLE_MAX: 120,
  LOCATION_MIN: 2,
  LOCATION_MAX: 140,
  STYLE_BRIEF_MAX: 600,
  INVITE_CODE_MIN: 4,
  INVITE_CODE_MAX: 32,
  OWNER_NAME_MAX: 80,
  BUDGET_TITLE_MAX: 120,
  BUDGET_NOTES_MAX: 300,
  TIMELINE_SLOT_MAX: 60,
  TIMELINE_TITLE_MAX: 140,
  TIMELINE_LEAD_MAX: 80,
  TIMELINE_NOTES_MAX: 300,
  VENDOR_NAME_MAX: 120,
  VENDOR_CONTACT_MAX: 80,
  VENDOR_NOTES_MAX: 350,
  GUEST_NAME_MAX: 100,
  GUEST_TABLE_MAX: 60,
  GUEST_DIETARY_MAX: 160,
  IDEA_TITLE_MAX: 120,
  IDEA_DESC_MAX: 500,
  IDEA_COST_MAX: 80,
  COLLAB_MSG_MAX: 400,
} as const;

export function sanitizeString(val: unknown, maxLen: number, fallback = ''): string {
  const s = typeof val === 'string' ? val.trim() : '';
  const result = s.length > 0 ? s.slice(0, maxLen) : fallback.slice(0, maxLen);
  return result;
}

export function sanitizeNumber(val: unknown, min: number, max: number, fallback = 0): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function sanitizeCollaborators(uids: unknown): string[] {
  if (!Array.isArray(uids)) return [];
  return uids
    .filter((u): u is string => typeof u === 'string' && BLUEPRINT_CONSTRAINTS.ID_REGEX.test(u))
    .slice(0, BLUEPRINT_CONSTRAINTS.MAX_COLLABORATORS);
}

export function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 10);
  const ts = Date.now().toString(36);
  return `${prefix}_${ts}_${rand}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}
