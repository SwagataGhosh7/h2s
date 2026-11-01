import { describe, expect, it } from 'vitest';
import { CURATED_PRESETS } from '../sampleTemplates';
import { BLUEPRINT_CONSTRAINTS, EventCategory } from '../types';
import { generateClientPresentationPdf } from '../utils/pdfExport';

describe('Curated Event Presets & Client Presentation PDF Export Engine', () => {
  const categories: EventCategory[] = ['wedding', 'birthday', 'community'];

  it.each(categories)(
    'validates %s preset against blueprint schema and budget calibration',
    (category) => {
      const preset = CURATED_PRESETS[category];
      expect(preset.category).toBe(category);
      expect(preset.title.length).toBeGreaterThanOrEqual(BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MIN);
      expect(preset.title.length).toBeLessThanOrEqual(BLUEPRINT_CONSTRAINTS.EVENT_TITLE_MAX);
      expect(preset.location.length).toBeLessThanOrEqual(BLUEPRINT_CONSTRAINTS.LOCATION_MAX);
      expect(preset.styleBrief.length).toBeLessThanOrEqual(BLUEPRINT_CONSTRAINTS.STYLE_BRIEF_MAX);

      expect(preset.budgetItems.length).toBeGreaterThanOrEqual(3);
      const sumEstimated = preset.budgetItems.reduce((acc, b) => acc + b.estimatedAmount, 0);
      expect(sumEstimated).toBeGreaterThan(0);
      expect(sumEstimated).toBeLessThanOrEqual(preset.totalBudgetLimit * 1.15);

      expect(preset.timelineItems.length).toBeGreaterThanOrEqual(3);
      expect(preset.vendors.length).toBeGreaterThanOrEqual(2);
      expect(preset.guests.length).toBeGreaterThanOrEqual(2);
      expect(preset.ideas.length).toBeGreaterThanOrEqual(2);
    }
  );

  it('generates sanitized filenames for combined, budget_only, and timeline_only PDF scopes', () => {
    const preset = CURATED_PRESETS.wedding;
    const mockEvent = {
      id: 'evt_pdf_test',
      title: preset.title,
      category: preset.category,
      eventDate: preset.eventDate,
      location: preset.location,
      guestCountEstimate: preset.guestCountEstimate,
      totalBudgetLimit: preset.totalBudgetLimit,
      styleBrief: preset.styleBrief,
      inviteCode: 'VELA-8899',
      status: 'planning' as const,
      ownerId: 'u_owner',
      ownerName: 'Lead Planner',
      collaboratorUids: [],
    };

    const budgetItems = preset.budgetItems.map((b, idx) => ({
      ...b,
      id: `b_${idx}`,
      eventId: mockEvent.id,
      eventOwnerId: mockEvent.ownerId,
      authorId: mockEvent.ownerId,
      collaboratorUids: [],
    }));

    const timelineItems = preset.timelineItems.map((t, idx) => ({
      ...t,
      id: `t_${idx}`,
      eventId: mockEvent.id,
      eventOwnerId: mockEvent.ownerId,
      authorId: mockEvent.ownerId,
      collaboratorUids: [],
    }));

    const vendors = preset.vendors.map((v, idx) => ({
      ...v,
      id: `v_${idx}`,
      eventId: mockEvent.id,
      eventOwnerId: mockEvent.ownerId,
      authorId: mockEvent.ownerId,
      collaboratorUids: [],
    }));

    const guests = preset.guests.map((g, idx) => ({
      ...g,
      id: `g_${idx}`,
      eventId: mockEvent.id,
      eventOwnerId: mockEvent.ownerId,
      authorId: mockEvent.ownerId,
      collaboratorUids: [],
    }));

    const combinedFile = generateClientPresentationPdf(
      mockEvent,
      budgetItems,
      timelineItems,
      vendors,
      guests,
      {
        scope: 'combined',
        preparedFor: 'Clara & Julian',
        executiveMemo: preset.styleBrief,
        includeVendorSummary: true,
        aiAuditSummary: 'Budget allocation is well-balanced across culinary and venue pillars.',
      }
    );
    expect(combinedFile).toContain('client-dossier');
    expect(combinedFile.endsWith('.pdf')).toBe(true);

    const budgetFile = generateClientPresentationPdf(
      mockEvent,
      budgetItems,
      timelineItems,
      vendors,
      guests,
      {
        scope: 'budget_only',
        preparedFor: 'Clara & Julian',
        executiveMemo: preset.styleBrief,
        includeVendorSummary: false,
      }
    );
    expect(budgetFile).toContain('budget-ledger');

    const timelineFile = generateClientPresentationPdf(
      mockEvent,
      budgetItems,
      timelineItems,
      vendors,
      guests,
      {
        scope: 'timeline_only',
        preparedFor: 'Clara & Julian',
        executiveMemo: preset.styleBrief,
        includeVendorSummary: false,
      }
    );
    expect(timelineFile).toContain('run-of-show');
  });
});
