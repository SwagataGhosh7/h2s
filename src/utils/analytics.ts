import {
  BLUEPRINT_CONSTRAINTS,
  BudgetCategory,
  BudgetItem,
  EventPlan,
  GuestEntry,
  TimelineItem,
  TimelinePhase,
  VendorItem,
} from '../types';

export interface EventMetricsSummary {
  totalEstimated: number;
  totalActual: number;
  remainingBudget: number;
  varianceAmount: number;
  utilizationPct: number;
  completedTimeline: number;
  timelineCompletionPct: number;
  confirmedVendors: number;
  totalVendorsCount: number;
  confirmedGuestHeadcount: number;
  totalInvitedHeadcount: number;
  perGuestEstimatedSpend: number;
}

export interface CategoryAllocationStat {
  category: BudgetCategory;
  estimated: number;
  actual: number;
  variance: number;
  shareOfBudgetPct: number;
  itemCount: number;
}

/**
 * Computes real-time financial, timeline, vendor, and RSVP metrics for an active celebration.
 */
export function computeEventMetrics(
  budgetItems: BudgetItem[],
  timelineItems: TimelineItem[],
  vendors: VendorItem[],
  guests: GuestEntry[],
  totalBudgetLimit = 0,
  guestCountEstimate = 1
): EventMetricsSummary {
  let totalEstimated = 0;
  let totalActual = 0;

  for (let i = 0; i < budgetItems.length; i++) {
    totalEstimated += budgetItems[i].estimatedAmount;
    totalActual += budgetItems[i].actualAmount;
  }

  const safeLimit = Math.max(1, totalBudgetLimit);
  const utilizationPct = Math.round((totalEstimated / safeLimit) * 100);
  const remainingBudget = totalBudgetLimit - totalEstimated;
  const varianceAmount = totalActual - totalEstimated;

  let completedTimeline = 0;
  for (let i = 0; i < timelineItems.length; i++) {
    if (timelineItems[i].status === 'completed') {
      completedTimeline++;
    }
  }
  const timelineCompletionPct =
    timelineItems.length > 0 ? Math.round((completedTimeline / timelineItems.length) * 100) : 0;

  let confirmedVendors = 0;
  for (let i = 0; i < vendors.length; i++) {
    const status = vendors[i].contractStatus;
    if (status === 'confirmed' || status === 'contracted') {
      confirmedVendors++;
    }
  }

  let confirmedGuestHeadcount = 0;
  let totalInvitedHeadcount = 0;
  for (let i = 0; i < guests.length; i++) {
    const size = guests[i].partySize;
    totalInvitedHeadcount += size;
    if (guests[i].rsvpStatus === 'confirmed') {
      confirmedGuestHeadcount += size;
    }
  }

  const effectiveGuests = Math.max(1, confirmedGuestHeadcount || guestCountEstimate || 1);
  const perGuestEstimatedSpend = Math.round(totalEstimated / effectiveGuests);

  return {
    totalEstimated,
    totalActual,
    remainingBudget,
    varianceAmount,
    utilizationPct,
    completedTimeline,
    timelineCompletionPct,
    confirmedVendors,
    totalVendorsCount: vendors.length,
    confirmedGuestHeadcount,
    totalInvitedHeadcount,
    perGuestEstimatedSpend,
  };
}

const ALL_BUDGET_CATEGORIES: BudgetCategory[] = [
  'venue',
  'catering',
  'decor',
  'music',
  'attire',
  'logistics',
];

/**
 * Aggregates budget items by category in a single O(N) pass.
 */
export function computeCategoryBreakdown(
  budgetItems: BudgetItem[],
  totalBudgetLimit: number
): CategoryAllocationStat[] {
  const map = new Map<
    BudgetCategory,
    { estimated: number; actual: number; itemCount: number }
  >();

  for (const cat of ALL_BUDGET_CATEGORIES) {
    map.set(cat, { estimated: 0, actual: 0, itemCount: 0 });
  }

  for (let i = 0; i < budgetItems.length; i++) {
    const item = budgetItems[i];
    const entry = map.get(item.category);
    if (entry) {
      entry.estimated += item.estimatedAmount;
      entry.actual += item.actualAmount;
      entry.itemCount += 1;
    }
  }

  const safeLimit = Math.max(1, totalBudgetLimit);
  return ALL_BUDGET_CATEGORIES.map((category) => {
    const entry = map.get(category)!;
    return {
      category,
      estimated: entry.estimated,
      actual: entry.actual,
      variance: entry.actual - entry.estimated,
      shareOfBudgetPct: Math.round((entry.estimated / safeLimit) * 100),
      itemCount: entry.itemCount,
    };
  });
}

export function filterBudgetItems(
  budgetItems: BudgetItem[],
  filter: 'all' | BudgetCategory
): BudgetItem[] {
  if (filter === 'all') return budgetItems;
  return budgetItems.filter((b) => b.category === filter);
}

export function filterTimelineItems(
  timelineItems: TimelineItem[],
  filter: 'all' | TimelinePhase
): TimelineItem[] {
  if (filter === 'all') return timelineItems;
  return timelineItems.filter((t) => t.phase === filter);
}

export function filterVendors(vendors: VendorItem[], rawQuery: string): VendorItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return vendors;
  return vendors.filter(
    (v) =>
      v.vendorName.toLowerCase().includes(q) ||
      v.serviceType.toLowerCase().includes(q) ||
      v.deliverableNotes.toLowerCase().includes(q) ||
      v.contactPerson.toLowerCase().includes(q)
  );
}

export interface PortfolioSummaryStats {
  totalEventsCount: number;
  ownedEventsCount: number;
  collaboratingEventsCount: number;
  cumulativeBudgetUSD: number;
  cumulativeGuestsCount: number;
}

/**
 * Computes portfolio-wide executive metrics for the Planner Profile Dashboard.
 */
export function computePortfolioSummary(
  events: EventPlan[],
  userId: string
): PortfolioSummaryStats {
  let ownedEventsCount = 0;
  let collaboratingEventsCount = 0;
  let cumulativeBudgetUSD = 0;
  let cumulativeGuestsCount = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    if (ev.ownerId === userId) {
      ownedEventsCount++;
    } else {
      collaboratingEventsCount++;
    }
    cumulativeBudgetUSD += ev.totalBudgetLimit || 0;
    cumulativeGuestsCount += ev.guestCountEstimate || 0;
  }

  return {
    totalEventsCount: events.length,
    ownedEventsCount,
    collaboratingEventsCount,
    cumulativeBudgetUSD,
    cumulativeGuestsCount,
  };
}

/**
 * Validates whether an EventPlan creation payload satisfies all blueprint & Firestore security invariants.
 */
export function validateEventCreatePayload(
  id: string,
  authUid: string | null,
  emailVerified: boolean,
  payload: Record<string, unknown>
): { valid: boolean; reason?: string } {
  if (!authUid) {
    return { valid: false, reason: 'Unauthenticated request' };
  }
  if (!emailVerified) {
    return { valid: false, reason: 'Email not verified' };
  }
  if (!BLUEPRINT_CONSTRAINTS.ID_REGEX.test(id) || id.length > BLUEPRINT_CONSTRAINTS.MAX_ID_LEN) {
    return { valid: false, reason: 'Invalid document ID' };
  }

  const requiredKeys = [
    'title',
    'category',
    'eventDate',
    'location',
    'guestCountEstimate',
    'totalBudgetLimit',
    'styleBrief',
    'inviteCode',
    'status',
    'ownerId',
    'ownerName',
    'collaboratorUids',
    'createdAt',
    'updatedAt',
  ];
  const payloadKeys = Object.keys(payload);
  for (const reqKey of requiredKeys) {
    if (!payloadKeys.includes(reqKey)) {
      return { valid: false, reason: `Missing required field: ${reqKey}` };
    }
  }
  for (const key of payloadKeys) {
    if (!requiredKeys.includes(key)) {
      return { valid: false, reason: `Shadow field rejected: ${key}` };
    }
  }

  if (payload.ownerId !== authUid) {
    return { valid: false, reason: 'Identity spoofing: ownerId must match request.auth.uid' };
  }

  if (
    typeof payload.title !== 'string' ||
    payload.title.length < BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MIN ||
    payload.title.length > BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX
  ) {
    return { valid: false, reason: 'Invalid title length' };
  }

  if (
    !Array.isArray(payload.collaboratorUids) ||
    payload.collaboratorUids.length > BLUEPRINT_CONSTRAINTS.MAX_COLLABORATORS
  ) {
    return { valid: false, reason: 'collaboratorUids exceeds max length of 10' };
  }

  return { valid: true };
}
