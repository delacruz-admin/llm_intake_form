import { useState } from 'react';
import { submitRequest } from '../api/client';

const SECTIONS = [
  {
    id: 'A1', icon: '👤', label: 'A1 · Requestor Information',
    fields: [
      { key: 'submitter', label: 'Submitter' },
      { key: 'submitter_email', label: 'Submitter Email' },
      { key: 'team', label: 'Initiative Team / Department' },
      { key: 'poc_name', label: 'Initiative POC' },
      { key: 'poc_email', label: 'Initiative POC Email' },
      { key: 'exec_sponsor', label: 'Initiative Executive Sponsor' },
    ],
  },
  {
    id: 'A2', icon: '📋', label: 'A2 · Request Details',
    fields: [
      { key: 'request_type', label: 'Request Type' },
      { key: 'app_type', label: 'Application Type' },
      { key: 'title', label: 'Title' },
      { key: 'description', label: 'Description' },
      { key: 'deliverables', label: 'Deliverables' },
    ],
  },
  {
    id: 'A3', icon: '💼', label: 'A3 · Business Context & Impact',
    fields: [
      { key: 'business_outcomes', label: 'Business Outcomes' },
      { key: 'criticality', label: 'Business Criticality' },
      { key: 'impact_if_not_done', label: 'Impact if Not Implemented' },
      { key: 'impact_scale', label: 'Scale of Impact' },
      { key: 'need_date', label: 'Anticipated Need Date' },
    ],
  },
  {
    id: 'A4', icon: '🔗', label: 'A4 · Dependencies',
    fields: [
      { key: 'vendor_involved', label: 'Vendor Involved' },
      { key: 'vendor_name', label: 'Vendor Name' },
      { key: 'system_dependencies', label: 'System Dependencies' },
      { key: 'discovery_stakeholders', label: 'Discovery Stakeholders' },
    ],
  },
  {
    id: 'B', icon: '📎', label: 'B · Attachments',
    fields: [
      { key: '_attachment_logical_diagram', label: 'Logical Diagram (required)' },
      { key: '_attachment_vendor_docs', label: 'Vendor Documents (optional)' },
    ],
  },
  {
    id: 'C1', icon: '🌐', label: 'C1 · Environments',
    fields: [
      { key: 'environments_needed', label: 'Environments' },
      { key: 'hosting_preference', label: 'Hosting Preference' },
      { key: 'new_aws_account', label: 'New AWS Account' },
      { key: 'aws_account_name', label: 'AWS Account Name' },
      { key: 'aws_region', label: 'AWS Region' },
    ],
  },
  {
    id: 'C2', icon: '🔑', label: 'C2 · IAM',
    fields: [
      { key: 'sso_needed', label: 'SSO Integration' },
      { key: 'access_patterns', label: 'Access Patterns' },
    ],
  },
  {
    id: 'C3', icon: '🏗️', label: 'C3 · Architecture',
    fields: [
      { key: 'deployment_model', label: 'Deployment Model' },
      { key: 'compute_needed', label: 'Compute Requirements' },
      { key: 'database_needed', label: 'Database Requirements' },
      { key: 'storage_needed', label: 'Storage Requirements' },
    ],
  },
  {
    id: 'C4', icon: '🔌', label: 'C4 · Network',
    fields: [
      { key: 'connectivity_type', label: 'Connectivity' },
      { key: 'vpc_requirements', label: 'VPC Requirements' },
    ],
  },
  {
    id: 'C5', icon: '🛡️', label: 'C5 · Security',
    fields: [
      { key: 'compliance_frameworks', label: 'Compliance Frameworks' },
      { key: 'data_classification', label: 'Data Classification' },
      { key: 'encryption_requirements', label: 'Encryption' },
    ],
  },
  {
    id: 'C6', icon: '💬', label: 'C6 · Comments',
    fields: [
      { key: 'additional_comments', label: 'Additional Comments' },
    ],
  },
];

const REQUIRED_KEYS = [
  'team', 'poc_name', 'poc_email', 'exec_sponsor',
  'request_type', 'app_type', 'title', 'description',
  'business_outcomes', 'criticality', 'impact_if_not_done', 'need_date',
  'discovery_stakeholders',
];

function CriticalityPill({ value }) {
  const styles = {
    Emergency: 'bg-red-100 border-red-300 text-red-800',
    High: 'bg-amber-50 border-amber-300 text-amber-700',
    Medium: 'bg-surface-tertiary border-border-strong text-text-dim',
    Low: 'bg-green-50 border-green-300 text-green-800',
  };
  return (
    <span className={`inline-block text-[0.63rem] font-semibold px-2 py-0.5 rounded-sm border ${styles[value] || styles.Medium}`}>
      {value}
    </span>
  );
}

function CollapsibleSection({ section, fields, complete, active, isOptional, hasData, filledCount }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`bg-white border border-border rounded-cooley overflow-hidden transition-colors shrink-0 ${
        complete ? 'border-l-[3px] border-l-semantic-green' : active ? 'border-l-[3px] border-l-cooley-red' : ''
      }`}
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border hover:bg-surface-tertiary transition-colors text-left"
      >
        <span className={`text-[0.5rem] text-text-muted transition-transform ${collapsed ? '-rotate-90' : ''}`}>▼</span>
        <span className="text-[0.76rem]">{section.icon}</span>
        <span className="text-[0.63rem] font-semibold uppercase tracking-wider text-text-dim flex-1 font-mono">
          {section.label}
        </span>
        {filledCount > 0 && (
          <span className="text-[0.55rem] font-mono text-text-muted">{filledCount}/{section.fields.length}</span>
        )}
        {isOptional && (
          <span className="text-[0.55rem] font-mono text-text-muted bg-surface-tertiary px-1.5 py-0.5 rounded-sm border border-border">OPT</span>
        )}
        {complete && (
          <span className="text-[0.63rem] font-semibold text-semantic-green">✓</span>
        )}
      </button>
      {!collapsed && (
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          {section.fields.map((f) => (
            <div key={f.key}>
              <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted leading-tight">
                {f.label}
              </div>
              <div className={`text-[0.78rem] min-h-[16px] ${fields[f.key] ? 'text-text' : 'text-text-muted italic'}`}>
                {f.key === 'criticality' && fields[f.key] ? (
                  <CriticalityPill value={fields[f.key]} />
                ) : (
                  fields[f.key] || '—'
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PreviewPanel({ fields, sessionId }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [toast, setToast] = useState('');

  const filledRequired = REQUIRED_KEYS.filter((k) => fields[k]).length;
  const pct = Math.round((filledRequired / REQUIRED_KEYS.length) * 100);
  const ready = pct >= 85;

  function isSectionComplete(section) {
    // Attachment and optional sections don't block completion
    if (section.id.startsWith('B') || section.id.startsWith('C')) return false;
    return section.fields.every((f) => fields[f.key]);
  }

  function isSectionActive(section) {
    return section.fields.some((f) => fields[f.key]) && !isSectionComplete(section);
  }

  function hasAnyData(section) {
    return section.fields.some((f) => fields[f.key]);
  }

  async function handleSubmit() {
    if (!sessionId || submitting) return;
    setSubmitting(true);
    try {
      const data = await submitRequest(sessionId, fields.submitter || '', fields.submitter_email || '');
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
          <div className="font-serif text-[0.92rem] text-text">Technology Infrastructure Request</div>
          <div className="font-mono text-[0.6rem] text-text-muted bg-surface-tertiary px-2 py-0.5 rounded-sm border border-border">
            {submitted || 'SUBMISSION PROGRESS'}
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
        <div className="text-[0.6rem] text-text-muted mt-1">Part A required fields: {filledRequired}/{REQUIRED_KEYS.length}</div>
      </div>

      {/* Sections */}
      <div className="flex-1 overflow-y-scroll p-3.5 flex flex-col gap-2.5 min-h-0">
        {SECTIONS.map((section) => {
          const complete = isSectionComplete(section);
          const active = isSectionActive(section);
          const isOptional = section.id.startsWith('B') || section.id.startsWith('C');
          const hasData = hasAnyData(section);
          const filledCount = section.fields.filter((f) => fields[f.key]).length;
          return (
            <CollapsibleSection
              key={section.id}
              section={section}
              fields={fields}
              complete={complete}
              active={active}
              isOptional={isOptional}
              hasData={hasData}
              filledCount={filledCount}
            />
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

      {toast && (
        <div className="fixed bottom-6 right-6 bg-white border border-border border-l-[3px] border-l-semantic-green rounded-cooley px-4 py-2.5 text-[0.76rem] text-text-dim flex items-center gap-2 shadow-lg z-50">
          <span className="text-semantic-green">✓</span>
          {toast}
        </div>
      )}
    </div>
  );
}
