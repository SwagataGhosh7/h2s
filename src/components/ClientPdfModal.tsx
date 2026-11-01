import React, { useState } from 'react';
import { Download, FileText, X, Check } from 'lucide-react';
import {
  BudgetItem,
  EventPlan,
  GuestEntry,
  TimelineItem,
  VendorItem,
} from '../types';
import {
  generateClientPresentationPdf,
  PdfExportScope,
} from '../utils/pdfExport';

interface ClientPdfModalProps {
  isOpen: boolean;
  initialScope: PdfExportScope;
  onClose: () => void;
  event: EventPlan;
  budgetItems: BudgetItem[];
  timelineItems: TimelineItem[];
  vendors: VendorItem[];
  guests: GuestEntry[];
  aiAuditSummary?: string;
  onExportSuccess: (filename: string, scope: PdfExportScope) => void;
}

export const ClientPdfModal: React.FC<ClientPdfModalProps> = ({
  isOpen,
  initialScope,
  onClose,
  event,
  budgetItems,
  timelineItems,
  vendors,
  guests,
  aiAuditSummary,
  onExportSuccess,
}) => {
  const [scope, setScope] = useState<PdfExportScope>(initialScope);
  const [preparedFor, setPreparedFor] = useState(
    `${event.title.split('—')[0].trim()} & Stakeholders`
  );
  const [executiveMemo, setExecutiveMemo] = useState(event.styleBrief || '');
  const [includeVendorSummary, setIncludeVendorSummary] = useState(true);
  const [includeAiAudit, setIncludeAiAudit] = useState(Boolean(aiAuditSummary));
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const totalEstimated = budgetItems.reduce((sum, b) => sum + b.estimatedAmount, 0);
  const totalActual = budgetItems.reduce((sum, b) => sum + b.actualAmount, 0);
  const utilizationPct = Math.round(
    (totalEstimated / Math.max(1, event.totalBudgetLimit)) * 100
  );
  const completedCues = timelineItems.filter((t) => t.status === 'completed').length;

  const handleDownloadPdf = () => {
    setExporting(true);
    try {
      const filename = generateClientPresentationPdf(
        event,
        budgetItems,
        timelineItems,
        vendors,
        guests,
        {
          scope,
          preparedFor,
          executiveMemo,
          includeVendorSummary,
          aiAuditSummary: includeAiAudit ? aiAuditSummary : undefined,
        }
      );
      onExportSuccess(filename, scope);
      onClose();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
      <div className="bg-white border border-stone-200 rounded-xl max-w-4xl w-full shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-stone-800" />
            <h2 className="font-display text-lg text-stone-900">
              Export Client Presentation PDF Report
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body: Configuration + Live Dossier Preview */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 5 Columns: Export Controls */}
          <div className="lg:col-span-5 space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-stone-800 block">
                Report Scope
              </label>
              <div className="space-y-1.5">
                {(
                  [
                    {
                      id: 'combined',
                      label: 'Full Client Dossier (Budget + Run of Show)',
                      desc: 'Complete financial ledger and chronological cue sheet.',
                    },
                    {
                      id: 'budget_only',
                      label: 'Budget Ledger Only',
                      desc: 'Itemized allocations, paid commitments, and variance summary.',
                    },
                    {
                      id: 'timeline_only',
                      label: 'Run of Show Only',
                      desc: 'Chronological production schedule, lead responsibilities, and notes.',
                    },
                  ] as { id: PdfExportScope; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScope(opt.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      scope === opt.id
                        ? 'bg-stone-900 text-stone-50 border-stone-900'
                        : 'bg-[#FAF8F5] text-stone-800 border-stone-200 hover:border-stone-400'
                    }`}
                  >
                    <div className="text-xs font-semibold">{opt.label}</div>
                    <div
                      className={`text-[11px] mt-0.5 ${
                        scope === opt.id ? 'text-stone-300' : 'text-stone-500'
                      }`}
                    >
                      {opt.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-800 block">
                Prepared For (Client / Stakeholder Line)
              </label>
              <input
                type="text"
                value={preparedFor}
                onChange={(e) => setPreparedFor(e.target.value)}
                placeholder="e.g. Clara & Julian / Executive Committee"
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-800 block">
                Executive Cover Memo / Style Note
              </label>
              <textarea
                rows={3}
                value={executiveMemo}
                onChange={(e) => setExecutiveMemo(e.target.value)}
                placeholder="Brief note printed at the top of the client presentation..."
                className="w-full px-3 py-2 text-xs bg-[#FAF8F5] border border-stone-300 rounded-lg focus:outline-none focus:border-stone-900 leading-relaxed"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeVendorSummary}
                  onChange={(e) => setIncludeVendorSummary(e.target.checked)}
                  className="rounded border-stone-300"
                />
                <span>Include Contracted Vendor Appendix ({vendors.length} vendors)</span>
              </label>

              {aiAuditSummary && (
                <label className="flex items-center gap-2 text-xs text-stone-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAiAudit}
                    onChange={(e) => setIncludeAiAudit(e.target.checked)}
                    className="rounded border-stone-300"
                  />
                  <span>Include Gemini Financial Audit Synthesis</span>
                </label>
              )}
            </div>
          </div>

          {/* Right 7 Columns: Live Document Sheet Preview */}
          <div className="lg:col-span-7 bg-[#F5F2EB] border border-stone-300 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>Live PDF Layout Preview (US Letter · Vector Tables)</span>
              <span className="font-mono tabular-nums">
                {scope === 'combined'
                  ? `${budgetItems.length} Budget Lines · ${timelineItems.length} Cues`
                  : scope === 'budget_only'
                  ? `${budgetItems.length} Budget Lines`
                  : `${timelineItems.length} Production Cues`}
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-lg overflow-hidden shadow-2xs text-xs">
              {/* Preview Dark Header */}
              <div className="bg-stone-900 text-stone-50 p-4 space-y-1">
                <div className="text-[10px] tracking-wider text-stone-300 uppercase">
                  Atelier Vela · Client Presentation Dossier
                </div>
                <div className="font-display text-base font-semibold">{event.title}</div>
                <div className="text-[11px] text-stone-300">
                  Prepared for {preparedFor || 'Client Stakeholders'} · {event.eventDate} ·{' '}
                  {event.location}
                </div>
              </div>

              <div className="p-4 space-y-4">
                {executiveMemo && (
                  <p className="text-[11px] italic text-stone-600 bg-[#FAF8F5] p-2.5 rounded border border-stone-200">
                    “{executiveMemo}”
                  </p>
                )}

                {/* Preview KPI Row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded border border-stone-200 bg-[#FAF8F5]">
                    <div className="text-[10px] text-stone-500">Allocated / Cap</div>
                    <div className="font-mono tabular-nums font-semibold text-stone-900">
                      ${totalEstimated.toLocaleString()} / ${event.totalBudgetLimit.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-2 rounded border border-stone-200 bg-[#FAF8F5]">
                    <div className="text-[10px] text-stone-500">Paid to Date</div>
                    <div className="font-mono tabular-nums font-semibold text-stone-900">
                      ${totalActual.toLocaleString()} ({utilizationPct}%)
                    </div>
                  </div>
                  <div className="p-2 rounded border border-stone-200 bg-[#FAF8F5]">
                    <div className="text-[10px] text-stone-500">Run of Show</div>
                    <div className="font-mono tabular-nums font-semibold text-stone-900">
                      {completedCues}/{timelineItems.length} Cues Ready
                    </div>
                  </div>
                </div>

                {/* Preview Budget Table Snippet */}
                {(scope === 'combined' || scope === 'budget_only') && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-stone-800">
                      Budget Ledger ({budgetItems.length} line items)
                    </div>
                    <div className="border border-stone-200 rounded overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-stone-100 text-stone-600">
                          <tr>
                            <th className="py-1.5 px-2.5">Item</th>
                            <th className="py-1.5 px-2 text-right">Estimated</th>
                            <th className="py-1.5 px-2 text-right">Paid</th>
                            <th className="py-1.5 px-2.5">State</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {budgetItems.slice(0, 4).map((b) => (
                            <tr key={b.id}>
                              <td className="py-1.5 px-2.5 font-medium truncate max-w-[160px]">
                                {b.title}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                                ${b.estimatedAmount.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono tabular-nums">
                                ${b.actualAmount.toLocaleString()}
                              </td>
                              <td className="py-1.5 px-2.5 capitalize">
                                {b.paymentStatus.replace(/_/g, ' ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {budgetItems.length > 4 && (
                        <div className="px-2.5 py-1 text-[10px] text-stone-500 bg-stone-50 border-t border-stone-200">
                          + {budgetItems.length - 4} additional budget lines included in PDF
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Preview Run of Show Table Snippet */}
                {(scope === 'combined' || scope === 'timeline_only') && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-stone-800">
                      Run of Show Schedule ({timelineItems.length} cues)
                    </div>
                    <div className="border border-stone-200 rounded overflow-hidden">
                      <table className="w-full text-left text-[11px]">
                        <thead className="bg-stone-100 text-stone-600">
                          <tr>
                            <th className="py-1.5 px-2.5">Time</th>
                            <th className="py-1.5 px-2">Cue</th>
                            <th className="py-1.5 px-2">Lead</th>
                            <th className="py-1.5 px-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-200">
                          {timelineItems.slice(0, 4).map((t) => (
                            <tr key={t.id}>
                              <td className="py-1.5 px-2.5 font-mono tabular-nums font-semibold">
                                {t.timeSlot}
                              </td>
                              <td className="py-1.5 px-2 font-medium truncate max-w-[160px]">
                                {t.title}
                              </td>
                              <td className="py-1.5 px-2 truncate max-w-[110px]">
                                {t.leadPerson}
                              </td>
                              <td className="py-1.5 px-2.5 capitalize">
                                {t.status.replace(/_/g, ' ')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {timelineItems.length > 4 && (
                        <div className="px-2.5 py-1 text-[10px] text-stone-500 bg-stone-50 border-t border-stone-200">
                          + {timelineItems.length - 4} additional cues included in PDF
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-stone-200 bg-[#FAF8F5] flex items-center justify-between">
          <div className="text-xs text-stone-500">
            Generates a formatted, vector-table PDF file ready for client email or print.
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-200/70 rounded-lg hover:bg-stone-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={handleDownloadPdf}
              className="px-5 py-2 text-xs font-medium text-stone-50 bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Generating PDF...' : 'Download Client PDF (.pdf)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
