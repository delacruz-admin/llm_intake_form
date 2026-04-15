import { useState } from 'react';
import { submitRequest } from '../api/client';

const SECTIONS = [
  {
    id: 'A1',
    icon: '👤',
    label: 'A1 · Requestor Information',
    fields: [
      { key: 'team', label: 'Team / Department' },
      { key: 'poc_name', label: 'Primary POC' },
      { key: 'poc_email', label: 'POC Email' },
      { key: 'exec_sponsor', label: 'Executive Sponsor' },
    ],
  },
  {
    id: 'A2',
    icon: '📋',
    label: 'A2 · Request Details',
    fields: [
      { key: 'request_type', label: 'Request Type' },
      { key: 'app_type', label: 'Application Type' },
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
    ],
  },
  {
    id: 'A3',
    icon: '💼',
    label: 'A3 · Business Context & Impact',
    fields: [
      { key: 'business_outcomes', label: 'Business Outcomes' },
      { key: 'criticality', label: 'Business Criticality' },
      { key: 'impact_if_not_done', label: 'Impact if Not Implemented' },
      { key: 'need_date', label: 'Anticipated Need Date' },
    ],
  },
  {
    id: 'A4',
    icon: '🔗',
    label: 'A4 · Dependencies & Stakeholders',
    fields: [
      { key: 'vendor_name', label: 'Vendor / Third Party' },
      { key: 'discovery_stakeholders', label: 'Discovery Stakeholders' },
    ],
  },
];

const ALL_FIELD_KEYS = SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

function CriticalityPill({ value }) {
  const styles = {
    Emergency: 'bg-red-100 border-red-300 text-red-800',
    High: 'bg-amber-50 border-amber-300 text-amber-700',
    Medium: 'bg-surface-tertiary border-border-strong text-text-dim',
    Low: 'bg-semantic-green-bg border-green-300 text-semantic-green',
  };
  return (
    <span className={`inline-block text-[0.63rem] font-semibold px-2 py-0.5 rounded-sm border ${styles[value] || styles.Medium}`}>
      {value}
    </span>
  );
}

export default function PreviewPanel({ fields, sessionId }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [toast, setToast] = useState('');

  const filledCount = ALL_FIELD_KEYS.filter((k) => fields[k]).length;
  const pct = Math.round((filledCount / ALL_FIELD_KEYS.length) * 100);
  const ready = pct >= 85;

  function isSectionComplete(section) {
    return section.fields.every((f) => fields[f.key]);
  }

  function isSectionActive(section) {
    return section.fields.some((f) => fields[f.key]) && !isSectionComplete(section);
  }

  async function handleSubmit() {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    try {
      const data = await submitRequest(sessionId);
      setSubmitted(data.request_id);
      setToast('Intake submitted to ARB queue. Triage within 3 business days.');
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setToast(`Error: ${err.message}`);
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-surface-secondary overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-border bg-white shrink-0">
        <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-0.5">
          Intake Preview
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="font-serif text-[0.92rem] text-text">Part A — Required Intake</div>
          <div className="font-mono text-[0.6rem] text-text-muted bg-surface-tertiary px-2 py-0.5 rounded-sm border border-border">
            {submitted || 'ARB-DRAFT'}
          </div>
        </div>
        <div className="flex items-center gap-2.5 mt-2.5">
          <div className="flex-1 h-0.5 bg-surface-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-cooley-red rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <div className="font-mono text-[0.63rem] text-cooley-red min-w-[26px] text-right">{pct}%</div>
        </div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-auto p-3.5 flex flex-col gap-2.5">
        {SECTIONS.map((section) => {
          const complete = isSectionComplete(section);
          const active = isSectionActive(section);
          return (
            <div
              key={section.id}
              className={`bg-white border border-border rounded-cooley overflow-hidden transition-colors ${
                complete ? 'border-l-[3px] border-l-semantic-green' : active ? 'border-l-[3px] border-l-cooley-red' : ''
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border">
                <span className="text-[0.76rem]">{section.icon}</span>
                <span className="text-[0.63rem] font-semibold uppercase tracking-wider text-text-dim flex-1 font-mono">
                  {section.label}
                </span>
                {complete && (
                  <span className="text-[0.63rem] font-semibold text-semantic-green">✓ Complete</span>
                )}
              </div>
              <div className="px-3 py-2.5 flex flex-col gap-1.5">
                {section.fields.map((f) => (
                  <div key={f.key}>
                    <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted leading-tight">
                      {f.label}
                    </div>
                    <div
                      className={`text-[0.78rem] min-h-[16px] ${
                        fields[f.key] ? 'text-text' : 'text-text-muted italic'
                      }`}
                    >
                      {f.key === 'criticality' && fields[f.key] ? (
                        <CriticalityPill value={fields[f.key]} />
                      ) : (
                        fields[f.key] || '—'
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit */}
      <div className="px-3.5 py-3 border-t border-border bg-white shrink-0">
        <button
          onClick={handleSubmit}
          disabled={!ready || submitting || !!submitted}
          className={`w-full py-2.5 rounded-cooley text-[0.76rem] font-semibold transition-all ${
            ready && !submitted
              ? 'bg-cooley-red text-white hover:bg-cooley-red-hover cursor-pointer'
              : 'bg-cooley-red text-white opacity-30 cursor-not-allowed'
          }`}
        >
          {submitted ? `Submitted: ${submitted}` : submitting ? 'Submitting…' : 'Submit to ARB Queue'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-white border border-border border-l-[3px] border-l-semantic-green rounded-cooley px-4 py-2.5 text-[0.76rem] text-text-dim flex items-center gap-2 shadow-lg z-50 animate-in">
          <span className="text-semantic-green">✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
