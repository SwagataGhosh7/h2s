import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  BudgetItem,
  EventPlan,
  GuestEntry,
  TimelineItem,
  VendorItem,
} from '../types';

export type PdfExportScope = 'combined' | 'budget_only' | 'timeline_only';

export interface PdfPresentationOptions {
  scope: PdfExportScope;
  preparedFor: string;
  executiveMemo: string;
  includeVendorSummary: boolean;
  aiAuditSummary?: string;
}

const CATEGORY_DISPLAY: Record<string, string> = {
  wedding: 'Wedding Celebration',
  birthday: 'Milestone Birthday',
  community: 'Community & Civic Gathering',
};

const PHASE_DISPLAY: Record<string, string> = {
  pre_event: 'Pre-Event Preparation',
  setup: 'Site Load-In & Setup',
  ceremony_main: 'Main Ceremony / Program',
  reception: 'Culinary & Reception',
  wrap_up: 'Strike & Wrap-Up',
};

const PAYMENT_DISPLAY: Record<string, string> = {
  planned: 'Planned',
  deposit_paid: 'Deposit Paid',
  paid_in_full: 'Paid in Full',
};

const TIMELINE_STATUS_DISPLAY: Record<string, string> = {
  upcoming: 'Upcoming',
  in_progress: 'In Progress',
  completed: 'Completed',
};

export function generateClientPresentationPdf(
  event: EventPlan,
  budgetItems: BudgetItem[],
  timelineItems: TimelineItem[],
  vendors: VendorItem[],
  guests: GuestEntry[],
  options: PdfPresentationOptions
): string {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 44;
  const contentWidth = pageWidth - marginX * 2;
  let cursorY = 48;

  // Computed financial and operational totals
  const totalEstimated = budgetItems.reduce((sum, b) => sum + b.estimatedAmount, 0);
  const totalActual = budgetItems.reduce((sum, b) => sum + b.actualAmount, 0);
  const remainingVariance = event.totalBudgetLimit - totalEstimated;
  const utilizationPct = Math.round(
    (totalEstimated / Math.max(1, event.totalBudgetLimit)) * 100
  );
  const completedCues = timelineItems.filter((t) => t.status === 'completed').length;
  const confirmedGuests = guests
    .filter((g) => g.rsvpStatus === 'confirmed')
    .reduce((sum, g) => sum + g.partySize, 0);

  // ===========================================================================
  // 1. Editorial Header Banner
  // ===========================================================================
  doc.setFillColor(28, 25, 23); // Stone-900 (#1C1917)
  doc.rect(0, 0, pageWidth, 118, 'F');

  doc.setFont('times', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(214, 206, 191);
  const scopeLabel =
    options.scope === 'combined'
      ? 'ATELIER VELA  ·  CLIENT PRESENTATION DOSSIER'
      : options.scope === 'budget_only'
      ? 'ATELIER VELA  ·  BUDGET LEDGER PRESENTATION'
      : 'ATELIER VELA  ·  CHRONOLOGICAL RUN-OF-SHOW DOSSIER';
  doc.text(scopeLabel, marginX, 36);

  const exportDateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
  doc.text(`Issued ${exportDateStr}`, pageWidth - marginX, 36, { align: 'right' });

  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(250, 248, 245);
  doc.text(event.title.slice(0, 62), marginX, 68);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(214, 206, 191);
  const subtitleLine = `${
    CATEGORY_DISPLAY[event.category] || event.category
  }   ·   Date: ${event.eventDate}   ·   Venue: ${event.location}`;
  doc.text(subtitleLine.slice(0, 95), marginX, 92);

  cursorY = 140;

  // ===========================================================================
  // 2. Client Metadata & Executive Summary Box
  // ===========================================================================
  doc.setFillColor(245, 242, 235);
  doc.setDrawColor(214, 211, 209);
  doc.roundedRect(marginX, cursorY, contentWidth, 68, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(87, 83, 78);
  doc.text('PREPARED FOR', marginX + 14, cursorY + 18);
  doc.text('LEAD PRODUCER', marginX + 190, cursorY + 18);
  doc.text('WORKSPACE REFERENCE', marginX + 360, cursorY + 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(28, 25, 23);
  doc.text((options.preparedFor || 'Client & Host Stakeholders').slice(0, 32), marginX + 14, cursorY + 33);
  doc.text((event.ownerName || 'Atelier Vela Studio').slice(0, 28), marginX + 190, cursorY + 33);
  doc.text(`${event.inviteCode} (${event.status.toUpperCase()})`, marginX + 360, cursorY + 33);

  const briefText = (options.executiveMemo || event.styleBrief || '').trim();
  if (briefText) {
    doc.setFont('times', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(68, 64, 60);
    const wrappedBrief = doc.splitTextToSize(`"${briefText}"`, contentWidth - 28);
    doc.text(wrappedBrief.slice(0, 2), marginX + 14, cursorY + 51);
  }

  cursorY += 84;

  // ===========================================================================
  // 3. 4-Column Executive KPI Strip
  // ===========================================================================
  const kpiWidth = (contentWidth - 18) / 4;
  const kpiCards = [
    {
      label: 'Target Budget Limit',
      value: `$${event.totalBudgetLimit.toLocaleString()}`,
      sub: `${utilizationPct}% allocated`,
    },
    {
      label: 'Estimated vs Paid',
      value: `$${totalEstimated.toLocaleString()}`,
      sub: `$${totalActual.toLocaleString()} settled`,
    },
    {
      label: 'Budget Variance',
      value: `${remainingVariance >= 0 ? '+' : '-'}$${Math.abs(remainingVariance).toLocaleString()}`,
      sub: remainingVariance >= 0 ? 'Under target cap' : 'Over target cap',
    },
    {
      label: 'Run of Show & Guests',
      value: `${completedCues}/${timelineItems.length} Cues`,
      sub: `${confirmedGuests}/${event.guestCountEstimate} guests RSVP'd`,
    },
  ];

  kpiCards.forEach((kpi, idx) => {
    const x = marginX + idx * (kpiWidth + 6);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(225, 222, 216);
    doc.roundedRect(x, cursorY, kpiWidth, 54, 4, 4, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(kpi.label, x + 10, cursorY + 16);

    doc.setFont('courier', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(28, 25, 23);
    doc.text(kpi.value, x + 10, cursorY + 33);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(120, 113, 108);
    doc.text(kpi.sub, x + 10, cursorY + 46);
  });

  cursorY += 72;

  // ===========================================================================
  // 4. Section A: Itemized Budget Ledger Table
  // ===========================================================================
  if (options.scope === 'combined' || options.scope === 'budget_only') {
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(28, 25, 23);
    doc.text('01. Celebration Budget Ledger & Financial Commitments', marginX, cursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 113, 108);
    doc.text(
      `Total Target Cap: $${event.totalBudgetLimit.toLocaleString()}   ·   Allocated: $${totalEstimated.toLocaleString()}   ·   Paid to Date: $${totalActual.toLocaleString()}`,
      marginX,
      cursorY + 14
    );

    const budgetRows =
      budgetItems.length > 0
        ? budgetItems.map((item) => [
            item.title,
            item.category.toUpperCase(),
            `$${item.estimatedAmount.toLocaleString()}`,
            `$${item.actualAmount.toLocaleString()}`,
            PAYMENT_DISPLAY[item.paymentStatus] || item.paymentStatus,
            item.notes || '—',
          ])
        : [['No budget items logged yet', '—', '$0', '$0', 'Planned', '—']];

    // Append a summary footer row
    budgetRows.push([
      'TOTAL LEDGER COMMITMENT',
      `${budgetItems.length} LINES`,
      `$${totalEstimated.toLocaleString()}`,
      `$${totalActual.toLocaleString()}`,
      `${utilizationPct}% OF CAP`,
      remainingVariance >= 0
        ? `$${remainingVariance.toLocaleString()} remaining`
        : `$${Math.abs(remainingVariance).toLocaleString()} over cap`,
    ]);

    autoTable(doc, {
      startY: cursorY + 22,
      margin: { left: marginX, right: marginX },
      head: [
        [
          'Expense Line Item',
          'Category',
          'Estimated (USD)',
          'Paid / Committed',
          'Payment State',
          'Notes & Terms',
        ],
      ],
      body: budgetRows,
      theme: 'grid',
      headStyles: {
        fillColor: [28, 25, 23],
        textColor: [250, 248, 245],
        fontSize: 8.5,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [41, 37, 36],
        cellPadding: 6,
      },
      alternateRowStyles: {
        fillColor: [250, 248, 245],
      },
      columnStyles: {
        0: { cellWidth: 135, fontStyle: 'bold' },
        1: { cellWidth: 62 },
        2: { cellWidth: 72, halign: 'right', font: 'courier' },
        3: { cellWidth: 72, halign: 'right', font: 'courier' },
        4: { cellWidth: 68 },
        5: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.row.index === budgetRows.length - 1) {
          data.cell.styles.fillColor = [238, 234, 226];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY + 120) + 26;

    if (options.aiAuditSummary) {
      if (cursorY > pageHeight - 100) {
        doc.addPage();
        cursorY = 48;
      }
      doc.setFillColor(250, 248, 245);
      doc.setDrawColor(214, 211, 209);
      const splitAudit = doc.splitTextToSize(
        `Gemini Financial Controller Note: ${options.aiAuditSummary}`,
        contentWidth - 24
      );
      const boxHeight = Math.max(36, splitAudit.length * 12 + 16);
      doc.roundedRect(marginX, cursorY - 6, contentWidth, boxHeight, 4, 4, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(68, 64, 60);
      doc.text(splitAudit, marginX + 12, cursorY + 10);
      cursorY += boxHeight + 18;
    }
  }

  // ===========================================================================
  // 5. Section B: Chronological Run-of-Show Timeline Table
  // ===========================================================================
  if (options.scope === 'combined' || options.scope === 'timeline_only') {
    if (cursorY > pageHeight - 150) {
      doc.addPage();
      cursorY = 48;
    }

    const sectionNumber = options.scope === 'combined' ? '02.' : '01.';
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(28, 25, 23);
    doc.text(
      `${sectionNumber} Chronological Run-of-Show & Production Cue Sheet`,
      marginX,
      cursorY
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(120, 113, 108);
    doc.text(
      `Event Date: ${event.eventDate}   ·   Venue: ${event.location}   ·   Verified Cues: ${completedCues} of ${timelineItems.length}`,
      marginX,
      cursorY + 14
    );

    const sortedTimeline = [...timelineItems].sort((a, b) =>
      a.timeSlot.localeCompare(b.timeSlot)
    );

    const timelineRows =
      sortedTimeline.length > 0
        ? sortedTimeline.map((cue) => [
            cue.timeSlot,
            cue.title,
            PHASE_DISPLAY[cue.phase] || cue.phase,
            cue.leadPerson,
            TIMELINE_STATUS_DISPLAY[cue.status] || cue.status,
            cue.notes || '—',
          ])
        : [['TBD', 'No production cues scheduled yet', '—', '—', 'Upcoming', '—']];

    autoTable(doc, {
      startY: cursorY + 22,
      margin: { left: marginX, right: marginX },
      head: [
        [
          'Time Slot',
          'Cue / Milestone Title',
          'Production Phase',
          'Lead Responsibility',
          'Cue Status',
          'Staging & Technical Notes',
        ],
      ],
      body: timelineRows,
      theme: 'grid',
      headStyles: {
        fillColor: [28, 25, 23],
        textColor: [250, 248, 245],
        fontSize: 8.5,
        fontStyle: 'bold',
        cellPadding: 6,
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [41, 37, 36],
        cellPadding: 6,
      },
      alternateRowStyles: {
        fillColor: [250, 248, 245],
      },
      columnStyles: {
        0: { cellWidth: 54, font: 'courier', fontStyle: 'bold' },
        1: { cellWidth: 125, fontStyle: 'bold' },
        2: { cellWidth: 92 },
        3: { cellWidth: 85 },
        4: { cellWidth: 62 },
        5: { cellWidth: 'auto' },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cursorY = ((doc as any).lastAutoTable?.finalY || cursorY + 120) + 26;
  }

  // ===========================================================================
  // 6. Optional Vendor Roster Appendix (if enabled)
  // ===========================================================================
  if (options.includeVendorSummary && vendors.length > 0) {
    if (cursorY > pageHeight - 130) {
      doc.addPage();
      cursorY = 48;
    }

    doc.setFont('times', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(28, 25, 23);
    doc.text('Appendix: Contracted & Shortlisted Vendor Roster', marginX, cursorY);

    autoTable(doc, {
      startY: cursorY + 12,
      margin: { left: marginX, right: marginX },
      head: [['Partner Studio', 'Discipline', 'Contact Lead', 'Quoted Fee', 'Contract Stage', 'Deliverables']],
      body: vendors.map((v) => [
        v.vendorName,
        v.serviceType.replace(/_/g, ' ').toUpperCase(),
        v.contactPerson || '—',
        `$${v.quotedPrice.toLocaleString()}`,
        v.contractStatus.toUpperCase(),
        v.deliverableNotes || '—',
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [68, 64, 60],
        textColor: [250, 248, 245],
        fontSize: 8,
        fontStyle: 'bold',
        cellPadding: 5,
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [41, 37, 36],
        cellPadding: 5,
      },
      columnStyles: {
        3: { halign: 'right', font: 'courier' },
      },
    });
  }

  // ===========================================================================
  // 7. Page Footers & Page Numbers
  // ===========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(214, 211, 209);
    doc.line(marginX, pageHeight - 34, pageWidth - marginX, pageHeight - 34);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 113, 108);
    doc.text(
      `Atelier Vela Celebration & Event Planning Studio  ·  ${event.title}`,
      marginX,
      pageHeight - 20
    );
    doc.text(`Page ${p} of ${totalPages}`, pageWidth - marginX, pageHeight - 20, {
      align: 'right',
    });
  }

  const safeSlug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40);
  const scopeSlug =
    options.scope === 'combined'
      ? 'client-dossier'
      : options.scope === 'budget_only'
      ? 'budget-ledger'
      : 'run-of-show';
  const filename = `${safeSlug || 'celebration'}-${scopeSlug}.pdf`;

  doc.save(filename);
  return filename;
}
