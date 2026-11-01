import { describe, expect, it } from 'vitest';
import {
  computeCategoryBreakdown,
  computeEventMetrics,
  computePortfolioSummary,
  filterBudgetItems,
  filterTimelineItems,
  filterVendors,
  validateEventCreatePayload,
} from '../utils/analytics';
import { BudgetItem, EventPlan, GuestEntry, TimelineItem, VendorItem } from '../types';

const mockBudgetItems: BudgetItem[] = [
  {
    id: 'b1',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    title: 'Limestone Courtyard Exclusive Hire',
    category: 'venue',
    estimatedAmount: 15000,
    actualAmount: 15000,
    paymentStatus: 'paid_in_full',
    notes: 'Includes ceremony and reception spaces',
    collaboratorUids: [],
  },
  {
    id: 'b2',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    title: 'Seasonal Harvest Family-Style Supper',
    category: 'catering',
    estimatedAmount: 18000,
    actualAmount: 19200,
    paymentStatus: 'deposit_paid',
    notes: '110 guests + wine pairing',
    collaboratorUids: [],
  },
  {
    id: 'b3',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    title: 'Architectural Floral & Beeswax Candlelight',
    category: 'decor',
    estimatedAmount: 7000,
    actualAmount: 6500,
    paymentStatus: 'planned',
    notes: 'Local botanicals',
    collaboratorUids: [],
  },
];

const mockTimelineItems: TimelineItem[] = [
  {
    id: 't1',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    timeSlot: '15:00',
    title: 'Sound & Floral Load-In',
    phase: 'setup',
    leadPerson: 'Production Lead',
    status: 'completed',
    notes: 'Courtyard access via North Gate',
    collaboratorUids: [],
  },
  {
    id: 't2',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    timeSlot: '17:30',
    title: 'Courtyard Vows & String Quartet Processional',
    phase: 'ceremony_main',
    leadPerson: 'Clara & Julian',
    status: 'upcoming',
    notes: 'Acoustic setup',
    collaboratorUids: [],
  },
];

const mockVendors: VendorItem[] = [
  {
    id: 'v1',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    vendorName: 'Atelier Flora Sonoma',
    serviceType: 'floral_decor',
    contractStatus: 'confirmed',
    quotedPrice: 6500,
    contactPerson: 'Elena Rostova',
    deliverableNotes: 'Suspended olive branches and beeswax tapers',
    collaboratorUids: [],
  },
  {
    id: 'v2',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    vendorName: 'Solis Acoustic Quartet',
    serviceType: 'entertainment',
    contractStatus: 'shortlisted',
    quotedPrice: 2800,
    contactPerson: 'Marcus Vance',
    deliverableNotes: '90-minute ceremony + aperitif performance',
    collaboratorUids: [],
  },
];

const mockGuests: GuestEntry[] = [
  {
    id: 'g1',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    guestName: 'Avery & Liam Sterling',
    partySize: 2,
    rsvpStatus: 'confirmed',
    tableGroup: 'Table 01',
    dietaryNotes: 'Gluten-free',
    collaboratorUids: [],
  },
  {
    id: 'g2',
    eventId: 'evt_1',
    eventOwnerId: 'u1',
    authorId: 'u1',
    guestName: 'Dr. Priya Nair',
    partySize: 3,
    rsvpStatus: 'invited',
    tableGroup: 'Table 02',
    dietaryNotes: 'Vegetarian',
    collaboratorUids: [],
  },
];

describe('Celebration Analytics, Filtering & Portfolio Aggregations', () => {
  it('computes accurate financial, timeline, vendor, and RSVP metrics', () => {
    const metrics = computeEventMetrics(
      mockBudgetItems,
      mockTimelineItems,
      mockVendors,
      mockGuests,
      50000,
      100
    );

    expect(metrics.totalEstimated).toBe(40000);
    expect(metrics.totalActual).toBe(40700);
    expect(metrics.remainingBudget).toBe(10000);
    expect(metrics.varianceAmount).toBe(700);
    expect(metrics.utilizationPct).toBe(80);
    expect(metrics.completedTimeline).toBe(1);
    expect(metrics.timelineCompletionPct).toBe(50);
    expect(metrics.confirmedVendors).toBe(1);
    expect(metrics.totalVendorsCount).toBe(2);
    expect(metrics.confirmedGuestHeadcount).toBe(2);
    expect(metrics.totalInvitedHeadcount).toBe(5);
  });

  it('aggregates budget breakdown across all 6 studio categories in O(N)', () => {
    const breakdown = computeCategoryBreakdown(mockBudgetItems, 50000);
    expect(breakdown).toHaveLength(6);

    const venueRow = breakdown.find((r) => r.category === 'venue')!;
    expect(venueRow.estimated).toBe(15000);
    expect(venueRow.actual).toBe(15000);
    expect(venueRow.shareOfBudgetPct).toBe(30);

    const cateringRow = breakdown.find((r) => r.category === 'catering')!;
    expect(cateringRow.variance).toBe(1200);
  });

  it('filters budget items, timeline cues, and vendors accurately', () => {
    expect(filterBudgetItems(mockBudgetItems, 'all')).toHaveLength(3);
    expect(filterBudgetItems(mockBudgetItems, 'catering')).toHaveLength(1);

    expect(filterTimelineItems(mockTimelineItems, 'all')).toHaveLength(2);
    expect(filterTimelineItems(mockTimelineItems, 'setup')).toHaveLength(1);

    expect(filterVendors(mockVendors, '')).toHaveLength(2);
    expect(filterVendors(mockVendors, 'beeswax')).toHaveLength(1);
    expect(filterVendors(mockVendors, 'Elena')).toHaveLength(1);
  });

  it('computes portfolio-wide statistics for Planner Profile Dashboard', () => {
    const events: EventPlan[] = [
      {
        id: 'evt_1',
        title: 'Sonoma Courtyard Wedding',
        category: 'wedding',
        eventDate: '2027-06-19',
        location: 'Sonoma, CA',
        guestCountEstimate: 110,
        totalBudgetLimit: 48000,
        styleBrief: 'Minimalist limestone courtyard',
        inviteCode: 'VELA-1001',
        status: 'planning',
        ownerId: 'user_planner',
        ownerName: 'Lead Planner',
        collaboratorUids: [],
      },
      {
        id: 'evt_2',
        title: 'Civic Botanical Gala',
        category: 'community',
        eventDate: '2027-09-10',
        location: 'San Francisco Conservatory',
        guestCountEstimate: 240,
        totalBudgetLimit: 62000,
        styleBrief: 'Zero-waste botanical gala',
        inviteCode: 'VELA-2002',
        status: 'planning',
        ownerId: 'other_host',
        ownerName: 'Host Partner',
        collaboratorUids: ['user_planner'],
      },
    ];

    const summary = computePortfolioSummary(events, 'user_planner');
    expect(summary.totalEventsCount).toBe(2);
    expect(summary.ownedEventsCount).toBe(1);
    expect(summary.collaboratingEventsCount).toBe(1);
    expect(summary.cumulativeBudgetUSD).toBe(110000);
    expect(summary.cumulativeGuestsCount).toBe(350);
  });

  it('validates EventPlan creation payloads against schema and security invariants', () => {
    const validPayload = {
      title: 'Clara & Julian Wedding',
      category: 'wedding',
      eventDate: '2027-06-19',
      location: 'Sonoma',
      guestCountEstimate: 110,
      totalBudgetLimit: 48000,
      styleBrief: 'Warm minimalism',
      inviteCode: 'VELA-1234',
      status: 'planning',
      ownerId: 'user_1',
      ownerName: 'Clara',
      collaboratorUids: [],
      createdAt: 'NOW',
      updatedAt: 'NOW',
    };

    expect(validateEventCreatePayload('evt_valid_1', 'user_1', true, validPayload).valid).toBe(
      true
    );
    expect(
      validateEventCreatePayload('evt_valid_1', 'attacker_uid', true, validPayload).valid
    ).toBe(false);
    expect(
      validateEventCreatePayload('evt_valid_1', 'user_1', true, {
        ...validPayload,
        shadowAdmin: true,
      }).valid
    ).toBe(false);
  });
});
