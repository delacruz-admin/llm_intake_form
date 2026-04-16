import { useState, useRef } from 'react';
import { submitRequest, saveDraft, updateDraft, getUploadUrl, uploadFileToS3, listAttachments } from '../api/client';

const SECTIONS = [
  {
    id: 'A1', icon: '👤', label: 'A1 · Requestor Information',
    fields: [
      { key: 'submitter', label: 'Submitter' },
      { key: 'submitter_email', label: 'Submitter Email' },
      { key: 'team', label: 'Initiative Team / Department', hint: 'e.g., Data Science & Engineering' },
      { key: 'poc_name', label: 'Initiative POC', hint: 'Full name of the primary point of contact' },
      { key: 'poc_email', label: 'Initiative POC Email', hint: 'name@cooley.com' },
      { key: 'exec_sponsor', label: 'Initiative Executive Sponsor', hint: 'Full name of the executive sponsor' },
    ],
  },
  {
    id: 'A2', icon: '📋', label: 'A2 · Request Details',
    fields: [
      { key: 'request_type', label: 'Request Type', hint: 'New Service, Enhancement, Advisory, or Compliance' },
      { key: 'app_type', label: 'Application Type', hint: 'Full Stack, Web, API, Microservice, ETL, ML Workload, Batch, Other' },
      { key: 'title', label: 'Title', hint: 'Short, clear summary of the request' },
      { key: 'description', label: 'Description', hint: 'Full context including key components and services' },
      { key: 'deliverables', label: 'Deliverables', hint: 'List of expected deliverables' },
    ],
  },
  {
    id: 'A3', icon: '💼', label: 'A3 · Business Context & Impact',
    fields: [
      { key: 'business_outcomes', label: 'Business Outcomes', hint: 'What problem are you solving, and for whom?' },
      { key: 'criticality', label: 'Business Criticality', hint: 'Emergency, High, Medium, or Low' },
      { key: 'impact_if_not_done', label: 'Impact if Not Implemented', hint: 'What happens if this request is not fulfilled?' },
      { key: 'impact_scale', label: 'Scale of Impact', hint: 'Single-Team, Multi-Team, or Firm-Wide' },
      { key: 'need_date', label: 'Anticipated Need Date', hint: 'YYYY-MM-DD' },
    ],
  },
  {
    id: 'A4', icon: '🔗', label: 'A4 · Dependencies',
    fields: [
      { key: 'vendor_involved', label: 'Vendor Involved', hint: 'Yes or No' },
      { key: 'vendor_name', label: 'Vendor Name', hint: 'Name of third-party vendor, if any' },
      { key: 'system_dependencies', label: 'System Dependencies', hint: 'Upstream or downstream system dependencies' },
      { key: 'discovery_stakeholders', label: 'Discovery Stakeholders', hint: 'Names (and vendor emails if applicable)' },
    ],
  },
  {
    id: 'B', icon: '📎', label: 'B · Attachments',
    isUploadSection: true,
    fields: [],
    uploadCategories: [
      { key: 'logical-diagram', label: 'Logical Diagram', required: true },
      { key: 'vendor-doc', label: 'Vendor Documents', required: false },
      { key: 'other', label: 'Other Artifacts', required: false },
    ],
  },
  {
    id: 'C1', icon: '🌐', label: 'C1 · Environments',
    fields: [
      { key: 'environments_needed', label: 'Environments', hint: 'RPE, DEV, UAT, PRD' },
      { key: 'hosting_preference', label: 'Hosting Preference', hint: 'Colo, AWS, Azure, or Other' },
      { key: 'new_aws_account', label: 'New AWS Account', hint: 'Yes or No' },
      { key: 'aws_account_name', label: 'AWS Account Name', hint: 'e.g., cooley-dse-nonprod' },
      { key: 'aws_region', label: 'AWS Region', hint: 'e.g., us-east-1' },
    ],
  },
  {
    id: 'C2', icon: '🔑', label: 'C2 · IAM',
    fields: [
      { key: 'sso_needed', label: 'SSO Integration', hint: 'Yes or No' },
      { key: 'access_patterns', label: 'Access Patterns', hint: 'Which teams need what type of access?' },
    ],
  },
  {
    id: 'C3', icon: '🏗️', label: 'C3 · Architecture',
    fields: [
      { key: 'deployment_model', label: 'Deployment Model', hint: 'Serverless, Containers, VMs, AI/ML, Managed services, etc.' },
      { key: 'compute_needed', label: 'Compute Requirements', hint: 'EC2, ECS, Lambda, SageMaker, etc.' },
      { key: 'database_needed', label: 'Database Requirements', hint: 'Aurora, RDS, DynamoDB, Redshift, etc.' },
      { key: 'storage_needed', label: 'Storage Requirements', hint: 'EBS, EFS, S3, etc.' },
    ],
  },
  {
    id: 'C4', icon: '🔌', label: 'C4 · Network',
    fields: [
      { key: 'connectivity_type', label: 'Connectivity', hint: 'Public Internet, Private Link/VPN, Isolated, On-Prem' },
      { key: 'vpc_requirements', label: 'VPC Requirements', hint: 'Shared, Existing, or New' },
    ],
  },
  {
    id: 'C5', icon: '🛡️', label: 'C5 · Security',
    fields: [
      { key: 'compliance_frameworks', label: 'Compliance Frameworks', hint: 'PCI, SOC2, GDPR, FedRAMP, or None' },
      { key: 'data_classification', label: 'Data Classification', hint: 'Public, Internal, Confidential, or Restricted' },
      { key: 'encryption_requirements', label: 'Encryption', hint: 'At rest, in transit, key management approach' },
    ],
  },
  {
    id: 'C6', icon: '💬', label: 'C6 · Comments',
    fields: [
      { key: 'additional_comments', label: 'Additional Comments', hint: 'Anything that doesn\'t fit the sections above' },
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

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function AttachmentSection({ section, sessionId, complete, active, isOptional }) {
  const [manualToggle, setManualToggle] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [uploading, setUploading] = useState('');
  const fileInputRefs = useRef({});

  const isExpanded = manualToggle !== null ? manualToggle : false;

  function handleToggle() {
    setManualToggle(isExpanded ? false : true);
  }

  // Load attachments when session exists
  useState(() => {
    if (sessionId) {
      listAttachments(sessionId)
        .then((data) => setAttachments(data.attachments || []))
        .catch(() => {});
    }
  });

  async function handleUpload(category, e) {
    const file = e.target.files?.[0];
    if (!file || !sessionId) return;
    setUploading(category);
    try {
      const data = await getUploadUrl(sessionId, file.name, file.type || 'application/octet-stream', category);
      await uploadFileToS3(data.upload_url, file);
      // Refresh attachments list
      const updated = await listAttachments(sessionId);
      setAttachments(updated.attachments || []);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading('');
      if (fileInputRefs.current[category]) fileInputRefs.current[category].value = '';
    }
  }

  const getFilesForCategory = (cat) => attachments.filter((a) => a.category === cat);

  return (
    <div className={`bg-white border border-border rounded-cooley overflow-hidden transition-colors shrink-0 ${
      active ? 'border-l-[3px] border-l-cooley-red' : ''
    }`}>
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border hover:bg-surface-tertiary transition-colors text-left"
      >
        <span className={`text-[0.5rem] text-text-muted transition-transform ${!isExpanded ? '-rotate-90' : ''}`}>▼</span>
        <span className="text-[0.76rem]">{section.icon}</span>
        <span className="text-[0.63rem] font-semibold uppercase tracking-wider text-text-dim flex-1 font-mono">
          {section.label}
        </span>
        {attachments.length > 0 && (
          <span className="text-[0.55rem] font-mono text-text-muted">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
        )}
        <span className="text-[0.55rem] font-mono text-text-muted bg-surface-tertiary px-1.5 py-0.5 rounded-sm border border-border">OPT</span>
      </button>
      {isExpanded && (
        <div className="px-3 py-2.5 flex flex-col gap-3">
          {section.uploadCategories.map((cat) => {
            const files = getFilesForCategory(cat.key);
            return (
              <div key={cat.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted">
                    {cat.label} {cat.required ? <span className="text-cooley-red">*</span> : <span className="text-text-muted">(optional)</span>}
                  </div>
                  <label className={`text-[0.65rem] font-semibold px-2.5 py-1 rounded-cooley border cursor-pointer transition-colors ${
                    uploading === cat.key
                      ? 'bg-surface-tertiary border-border text-text-muted'
                      : 'bg-cooley-red-light border-cooley-red-mid text-cooley-red hover:bg-cooley-red hover:text-white'
                  }`}>
                    <input
                      type="file"
                      ref={(el) => { fileInputRefs.current[cat.key] = el; }}
                      onChange={(e) => handleUpload(cat.key, e)}
                      className="hidden"
                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.svg,.pptx,.xlsx,.txt,.drawio,.vsdx"
                      disabled={uploading === cat.key || !sessionId}
                    />
                    {uploading === cat.key ? 'Uploading…' : '+ Upload'}
                  </label>
                </div>
                {files.length > 0 ? (
                  <div className="flex flex-col gap-1">
                    {files.map((f) => (
                      <div key={f.file_id} className="flex items-center gap-2 bg-surface-secondary border border-border rounded-cooley px-2.5 py-1.5">
                        <span className="text-[0.75rem]">📎</span>
                        <span className="text-[0.75rem] text-text truncate flex-1">{f.filename}</span>
                        <span className="text-[0.58rem] font-mono text-text-muted shrink-0">{formatDate(f.uploaded_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[0.72rem] text-text-muted italic">No files uploaded</div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EditableField({ fieldKey, label, value, onSave, hint }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  // Sync draft when value changes from chat
  const prevValue = useState(value)[0];
  if (value !== prevValue && !editing) {
    // handled via key prop or effect
  }

  function startEdit() {
    setDraft(value);
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      onSave(fieldKey, trimmed || '');
    }
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') {
      setDraft(value);
      setEditing(false);
    }
  }

  // Submitter/email fields are auto-filled and shouldn't be editable
  const readOnly = fieldKey === 'submitter' || fieldKey === 'submitter_email';

  if (editing && !readOnly) {
    return (
      <div>
        <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted leading-tight mb-0.5">
          {label}
        </div>
        {value.length > 60 || fieldKey === 'description' || fieldKey === 'deliverables' || fieldKey === 'business_outcomes' || fieldKey === 'impact_if_not_done' || fieldKey === 'additional_comments' ? (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder={hint || ''}
            className="w-full bg-white border border-cooley-red rounded-cooley text-[0.78rem] py-1 px-2 resize-none focus:outline-none placeholder:text-text-muted/50"
            autoFocus
          />
        ) : (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            placeholder={hint || ''}
            className="w-full bg-white border border-cooley-red rounded-cooley text-[0.78rem] py-1 px-2 focus:outline-none placeholder:text-text-muted/50"
            autoFocus
          />
        )}
      </div>
    );
  }

  return (
    <div
      onClick={readOnly ? undefined : startEdit}
      className={readOnly ? '' : 'cursor-text group/field'}
    >
      <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted leading-tight">
        {label}
      </div>
      <div className={`text-[0.78rem] min-h-[16px] rounded px-0.5 -mx-0.5 transition-colors ${
        readOnly ? '' : 'group-hover/field:bg-cooley-red-light'
      } ${value ? 'text-text' : 'text-text-muted/40 italic'}`}>
        {fieldKey === 'criticality' && value ? (
          <CriticalityPill value={value} />
        ) : (
          value || hint || '—'
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({ section, fields, complete, active, isOptional, hasData, filledCount, onFieldUpdate }) {
  const [manualToggle, setManualToggle] = useState(null);

  // Auto-expand the active section, collapse others. Manual toggle overrides.
  const isExpanded = manualToggle !== null ? manualToggle : active || (filledCount > 0 && !complete && section.id.startsWith('A'));

  function handleToggle() {
    setManualToggle(isExpanded ? false : true);
  }

  return (
    <div
      className={`bg-white border border-border rounded-cooley overflow-hidden transition-colors shrink-0 ${
        complete ? 'border-l-[3px] border-l-semantic-green' : active ? 'border-l-[3px] border-l-cooley-red' : ''
      }`}
    >
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-surface-secondary border-b border-border hover:bg-surface-tertiary transition-colors text-left"
      >
        <span className={`text-[0.5rem] text-text-muted transition-transform ${!isExpanded ? '-rotate-90' : ''}`}>▼</span>
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
      {isExpanded && (
        <div className="px-3 py-2.5 flex flex-col gap-1.5">
          {section.fields.map((f) => (
            <EditableField
              key={f.key}
              fieldKey={f.key}
              label={f.label}
              value={fields[f.key] || ''}
              hint={f.hint}
              onSave={onFieldUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PreviewPanel({ fields, sessionId, onFieldUpdate, draftId, onDraftSaved }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [currentDraftId, setCurrentDraftId] = useState(draftId || null);
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

  async function handleSaveDraft() {
    if (!sessionId || savingDraft) return;
    setSavingDraft(true);
    try {
      if (currentDraftId) {
        await updateDraft(currentDraftId, fields);
        setToast(`Draft updated: ${currentDraftId}`);
      } else {
        const data = await saveDraft(sessionId, fields, fields.submitter || '', fields.submitter_email || '');
        setCurrentDraftId(data.request_id);
        if (onDraftSaved) onDraftSaved(data.request_id);
        setToast(`Draft saved: ${data.request_id}`);
      }
      setTimeout(() => setToast(''), 3000);
    } catch (err) {
      setToast(`Error: ${err.message}`);
      setTimeout(() => setToast(''), 4000);
    } finally {
      setSavingDraft(false);
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

          if (section.isUploadSection) {
            return (
              <AttachmentSection
                key={section.id}
                section={section}
                sessionId={sessionId}
                complete={false}
                active={false}
                isOptional={true}
              />
            );
          }

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
              onFieldUpdate={onFieldUpdate}
            />
          );
        })}
      </div>

      {/* Actions */}
      <div className="px-3.5 py-3 border-t border-border bg-white shrink-0 flex flex-col gap-2">
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
        {!submitted && (
          <button
            onClick={handleSaveDraft}
            disabled={savingDraft || !sessionId}
            className="w-full py-2 rounded-cooley text-[0.72rem] font-semibold text-text-dim bg-white border border-border hover:border-cooley-red hover:text-cooley-red transition-colors disabled:opacity-50"
          >
            {savingDraft ? 'Saving…' : currentDraftId ? `Update Draft (${currentDraftId})` : 'Save as Draft'}
          </button>
        )}
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
