import { useState, useEffect } from 'react';
import { listRequests, updateRequest, addNote, getNotes, listAttachments, deleteRequest } from '../api/client';
import { getUser } from '../auth';

const STATUS_CONFIG = {
  'received-pending': { label: 'Received, Pending Review', dot: 'bg-border-strong', bg: 'bg-surface-tertiary border-border-strong text-text-dim' },
  'under-review': { label: 'Under Review', dot: 'bg-orange-400', bg: 'bg-orange-50 border-orange-200 text-orange-800' },
  'accepted-discovery': { label: 'Accepted - In Discovery', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-300 text-amber-700' },
  'in-backlog': { label: 'In Backlog', dot: 'bg-blue-400', bg: 'bg-blue-50 border-blue-200 text-blue-800' },
  'active': { label: 'Active', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-300 text-blue-800' },
  'deferred': { label: 'Deferred', dot: 'bg-border-strong', bg: 'bg-surface-tertiary border-border-strong text-text-muted' },
};

const CRIT_CONFIG = {
  Emergency: 'bg-red-100 border-red-300 text-red-800',
  High: 'bg-amber-50 border-amber-300 text-amber-700',
  Medium: 'bg-surface-tertiary border-border-strong text-text-dim',
  Low: 'bg-green-50 border-green-300 text-green-800',
};

const STATUS_TRANSITIONS = {
  'received-pending': ['under-review'],
  'under-review': ['accepted-discovery', 'in-backlog', 'deferred'],
  'accepted-discovery': ['active', 'in-backlog', 'deferred'],
  'in-backlog': ['active', 'deferred'],
  'active': ['deferred'],
  'deferred': ['under-review'],
};

// Fallback for legacy/unknown statuses
const DEFAULT_TRANSITIONS = ['received-pending', 'under-review'];

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['received-pending'];
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[0.62rem] px-2 py-0.5 rounded-sm border ${cfg.bg}`}>
      <span className={`w-[5px] h-[5px] rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function CritBadge({ value }) {
  return (
    <span className={`inline-flex items-center font-mono text-[0.62rem] font-semibold px-2 py-0.5 rounded-sm border ${CRIT_CONFIG[value] || CRIT_CONFIG.Medium}`}>
      {value}
    </span>
  );
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function TriageModal({ request, onClose, onUpdated }) {
  const user = getUser();
  const [notes, setNotes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [assignedTo, setAssignedTo] = useState(request.assigned_to || '');
  const [promisedDate, setPromisedDate] = useState(request.promised_date || '');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadNotes();
    loadAttachments();
  }, []);

  async function loadNotes() {
    try {
      const data = await getNotes(request.request_id);
      setNotes(data.notes || []);
    } catch { /* ignore */ }
  }

  async function loadAttachments() {
    try {
      const data = await listAttachments(request.request_id);
      setAttachments(data.attachments || []);
    } catch { /* ignore */ }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleStatusChange(newStatus) {
    setSaving(true);
    try {
      await updateRequest(request.request_id, { status: newStatus });
      showToast(`Status → ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      onUpdated();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleAssign() {
    if (!assignedTo.trim()) return;
    setSaving(true);
    try {
      await updateRequest(request.request_id, { assigned_to: assignedTo.trim() });
      showToast(`Assigned to ${assignedTo.trim()}`);
      onUpdated();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleCritChange(crit) {
    setSaving(true);
    try {
      await updateRequest(request.request_id, { criticality: crit });
      showToast(`Criticality → ${crit}`);
      onUpdated();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handlePromisedDate() {
    if (!promisedDate) return;
    setSaving(true);
    try {
      await updateRequest(request.request_id, { promised_date: promisedDate });
      showToast(`Promised date set to ${formatDate(promisedDate)}`);
      onUpdated();
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${request.request_id}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteRequest(request.request_id);
      onClose();
      onUpdated();
    } catch (err) {
      showToast(`Error: ${err.message}`);
      setSaving(false);
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addNote(request.request_id, noteText.trim(), user?.name || user?.email || 'Unknown');
      setNoteText('');
      await loadNotes();
      showToast('Note added');
    } catch (err) {
      showToast(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const nextStatuses = STATUS_TRANSITIONS[request.status] || DEFAULT_TRANSITIONS;

  return (
    <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-[200] flex items-center justify-center p-8" onClick={onClose}>
      <div className="bg-white border border-border border-t-[3px] border-t-cooley-red rounded-cooley w-full max-w-[680px] max-h-[88vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <div className="font-mono text-[0.65rem] text-text-muted mb-1">{request.request_id}</div>
            <div className="font-serif text-lg text-text">{request.title || '(Untitled)'}</div>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text text-lg">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* All Request Details by Section */}
          {[
            {
              label: 'Summary', fields: [
                ['Status', <StatusBadge status={request.status} />],
                ['Criticality', request.criticality ? <CritBadge value={request.criticality} /> : null],
                ['Date Submitted', formatDate(request.created_at)],
                ['Need Date', formatDate(request.need_date)],
                ['Promised Date', formatDate(request.promised_date)],
                ['Assigned To', request.assigned_to],
              ],
            },
            {
              label: 'A1 · Requestor Information', fields: [
                ['Submitter', request.submitter],
                ['Submitter Email', request.submitter_email],
                ['Initiative Team / Department', request.team],
                ['Initiative POC', request.poc_name],
                ['Initiative POC Email', request.poc_email],
                ['Initiative Executive Sponsor', request.exec_sponsor],
              ],
            },
            {
              label: 'A2 · Request Details', fields: [
                ['Request Type', request.request_type],
                ['Application Type', request.app_type],
                ['Title', request.title],
                ['Description', request.description],
                ['Deliverables', request.deliverables],
              ],
            },
            {
              label: 'A3 · Business Context & Impact', fields: [
                ['Business Outcomes', request.business_outcomes],
                ['Business Criticality', request.criticality],
                ['Impact if Not Implemented', request.impact_if_not_done],
                ['Scale of Impact', request.impact_scale],
                ['Anticipated Need Date', formatDate(request.need_date)],
              ],
            },
            {
              label: 'A4 · Dependencies', fields: [
                ['Vendor Involved', request.vendor_involved],
                ['Vendor Name', request.vendor_name],
                ['System Dependencies', request.system_dependencies],
                ['Discovery Stakeholders', request.discovery_stakeholders],
              ],
            },
            {
              label: 'C1 · Environments', fields: [
                ['Environments Needed', request.environments_needed],
                ['Hosting Preference', request.hosting_preference],
                ['New AWS Account', request.new_aws_account],
                ['AWS Account Name', request.aws_account_name],
                ['AWS Region', request.aws_region],
              ],
            },
            {
              label: 'C2 · IAM', fields: [
                ['SSO Integration', request.sso_needed],
                ['Access Patterns', request.access_patterns],
              ],
            },
            {
              label: 'C3 · Architecture', fields: [
                ['Deployment Model', request.deployment_model],
                ['Compute Requirements', request.compute_needed],
                ['Database Requirements', request.database_needed],
                ['Storage Requirements', request.storage_needed],
              ],
            },
            {
              label: 'C4 · Network', fields: [
                ['Connectivity', request.connectivity_type],
                ['VPC Requirements', request.vpc_requirements],
              ],
            },
            {
              label: 'C5 · Security', fields: [
                ['Compliance Frameworks', request.compliance_frameworks],
                ['Data Classification', request.data_classification],
                ['Encryption', request.encryption_requirements],
              ],
            },
            {
              label: 'C6 · Comments', fields: [
                ['Additional Comments', request.additional_comments],
              ],
            },
          ]
            .filter((section) => section.fields.some(([, val]) => val && val !== '—'))
            .map((section) => (
              <div key={section.label}>
                <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-cooley-red mb-2 font-mono">{section.label}</div>
                <div className="bg-surface-secondary border border-border rounded-cooley p-3 flex flex-col gap-2">
                  {section.fields
                    .filter(([, val]) => val && val !== '—')
                    .map(([label, val]) => (
                      <div key={label}>
                        <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
                        <div className="text-[0.8rem] text-text-dim leading-relaxed">{typeof val === 'string' ? val : val}</div>
                      </div>
                    ))}
                </div>
              </div>
            ))}

          {/* ── Triage Actions ──────────────────────── */}
          <div className="border-t border-border pt-4">
            <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Triage Actions</div>

            {/* Status */}
            <div className="mb-4">
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-2">Status</div>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                  const isCurrent = request.status === key;
                  return (
                    <button
                      key={key}
                      onClick={() => !isCurrent && handleStatusChange(key)}
                      disabled={saving || isCurrent}
                      className={`text-[0.68rem] font-semibold px-3 py-1.5 rounded-cooley border transition-colors ${
                        isCurrent
                          ? 'bg-cooley-red text-white border-cooley-red cursor-default'
                          : 'text-text-dim bg-white border-border hover:border-cooley-red hover:text-cooley-red disabled:opacity-50'
                      }`}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assign To */}
            <div className="mb-4">
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-2">Assign to</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="e.g., J. Patel"
                  className="flex-1 bg-surface-secondary border border-border rounded-cooley text-[0.82rem] py-1.5 px-3 focus:outline-none focus:border-cooley-red"
                />
                <button
                  onClick={handleAssign}
                  disabled={saving || !assignedTo.trim()}
                  className="text-[0.74rem] font-semibold text-white bg-cooley-red rounded-cooley px-4 py-1.5 hover:bg-cooley-red-hover transition-colors disabled:opacity-50"
                >
                  Assign
                </button>
              </div>
              {request.assigned_to && (
                <div className="text-[0.68rem] text-text-muted mt-1 font-mono">Currently: {request.assigned_to}</div>
              )}
            </div>

            {/* Override Criticality */}
            <div className="mb-4">
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-2">Override Criticality</div>
              <div className="flex gap-2">
                {['Emergency', 'High', 'Medium', 'Low'].map((c) => (
                  <button
                    key={c}
                    onClick={() => handleCritChange(c)}
                    disabled={saving || request.criticality === c}
                    className={`text-[0.68rem] font-semibold px-2.5 py-1 rounded-sm border transition-colors disabled:opacity-30 ${CRIT_CONFIG[c]}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Promised Date */}
            <div className="mb-4">
              <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-2">Promised Date</div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={promisedDate}
                  onChange={(e) => setPromisedDate(e.target.value)}
                  className="flex-1 bg-surface-secondary border border-border rounded-cooley text-[0.82rem] py-1.5 px-3 focus:outline-none focus:border-cooley-red"
                />
                <button
                  onClick={handlePromisedDate}
                  disabled={saving || !promisedDate}
                  className="text-[0.74rem] font-semibold text-white bg-cooley-red rounded-cooley px-4 py-1.5 hover:bg-cooley-red-hover transition-colors disabled:opacity-50"
                >
                  Set
                </button>
              </div>
              {request.promised_date && (
                <div className="text-[0.68rem] text-text-muted mt-1 font-mono">Current: {formatDate(request.promised_date)}</div>
              )}
            </div>
          </div>

          {/* ── Attachments ─────────────────────────── */}
          {attachments.length > 0 && (
            <div className="border-t border-border pt-4">
              <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Attachments</div>
              <div className="flex flex-col gap-2">
                {attachments.map((a) => (
                  <div key={a.file_id} className="flex items-center gap-3 bg-surface-secondary border border-border rounded-cooley p-3">
                    <span className="text-lg">📎</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.82rem] text-text font-medium truncate">{a.filename}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="font-mono text-[0.6rem] text-text-muted">{a.category}</span>
                        <span className="font-mono text-[0.6rem] text-text-muted">{formatDate(a.uploaded_at)}</span>
                      </div>
                    </div>
                    {a.download_url ? (
                      <a
                        href={a.download_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[0.68rem] font-semibold text-cooley-red bg-cooley-red-light border border-cooley-red-mid rounded-cooley px-3 py-1.5 hover:bg-cooley-red hover:text-white transition-colors no-underline shrink-0"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-[0.68rem] text-text-muted italic shrink-0">No file</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Triage Notes ────────────────────────── */}
          <div className="border-t border-border pt-4">
            <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Triage Notes</div>

            <div className="flex gap-2 mb-3">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add an internal note…"
                rows={2}
                className="flex-1 bg-surface-secondary border border-border rounded-cooley text-[0.82rem] py-2 px-3 resize-none focus:outline-none focus:border-cooley-red"
              />
              <button
                onClick={handleAddNote}
                disabled={saving || !noteText.trim()}
                className="self-end text-[0.74rem] font-semibold text-white bg-cooley-red rounded-cooley px-4 py-2 hover:bg-cooley-red-hover transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>

            {notes.length === 0 ? (
              <div className="text-[0.78rem] text-text-muted italic">No notes yet.</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                {notes.map((n) => (
                  <div key={n.note_id} className="bg-surface-secondary border border-border rounded-cooley p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[0.65rem] font-semibold text-text-dim">{n.author}</span>
                      <span className="font-mono text-[0.6rem] text-text-muted">{formatDate(n.created_at)}</span>
                    </div>
                    <div className="text-[0.8rem] text-text-dim leading-relaxed">{n.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Delete */}
        <div className="px-5 pb-4 border-t border-border pt-4">
          <button
            onClick={handleDelete}
            disabled={saving}
            className="text-[0.72rem] font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-300 rounded-cooley px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            Delete Request
          </button>
        </div>

        {/* Toast inside modal */}
        {toast && (
          <div className="mx-5 mb-4 bg-semantic-green-bg border border-green-300 rounded-cooley px-3 py-2 text-[0.76rem] text-semantic-green flex items-center gap-2">
            <span>✓</span> {toast}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadRequests(); }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await listRequests();
      setRequests(data.requests || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleUpdated() {
    loadRequests();
    // Refresh the selected item too
    if (selected) {
      const fresh = requests.find((r) => r.request_id === selected.request_id);
      if (fresh) setSelected(fresh);
    }
  }

  const filtered = requests.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (search) {
      const hay = [r.request_id, r.title, r.team, r.poc_name, r.description].join(' ').toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const statCounts = {
    all: requests.length,
    'received-pending': requests.filter((r) => r.status === 'received-pending').length,
    'under-review': requests.filter((r) => r.status === 'under-review').length,
    'accepted-discovery': requests.filter((r) => r.status === 'accepted-discovery').length,
    'in-backlog': requests.filter((r) => r.status === 'in-backlog').length,
    'active': requests.filter((r) => r.status === 'active').length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      {/* Page Header */}
      <div className="bg-white border-b border-border py-6">
        <div className="max-w-[1380px] mx-auto px-8">
          <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-1">Request Pipeline</div>
          <div className="font-serif text-2xl text-text mb-0.5">Intake Dashboard</div>
          <div className="text-[0.8rem] text-text-muted">Architecture Review Board · Technology Infrastructure</div>

          <div className="grid grid-cols-6 gap-3 mt-6">
            {[
              { key: 'all', label: 'Total', sub: 'All requests', color: 'text-text', border: 'border-t-border' },
              { key: 'received-pending', label: 'Received', sub: 'Pending review', color: 'text-text-muted', border: 'border-t-border-strong' },
              { key: 'under-review', label: 'Under Review', sub: 'Being evaluated', color: 'text-orange-700', border: 'border-t-orange-400' },
              { key: 'accepted-discovery', label: 'Discovery', sub: 'Accepted, scoping', color: 'text-amber-600', border: 'border-t-amber-400' },
              { key: 'in-backlog', label: 'Backlog', sub: 'Queued for work', color: 'text-blue-700', border: 'border-t-blue-400' },
              { key: 'active', label: 'Active', sub: 'In progress', color: 'text-blue-700', border: 'border-t-blue-500' },
            ].map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key === 'all' ? '' : s.key)}
                className={`bg-white border border-border border-t-[3px] ${s.border} rounded-cooley p-3.5 text-left hover:-translate-y-px hover:shadow transition-all ${
                  (s.key === 'all' && !statusFilter) || statusFilter === s.key ? 'border-t-cooley-red shadow-sm' : ''
                }`}
              >
                <div className={`text-2xl font-bold leading-none mb-0.5 ${s.color}`}>{statCounts[s.key]}</div>
                <div className="text-[0.63rem] font-semibold uppercase tracking-wider text-text-muted">{s.label}</div>
                <div className="text-[0.7rem] text-text-dim mt-0.5">{s.sub}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="max-w-[1380px] mx-auto px-8 py-7">
        <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-1">All Requests</div>
        <div className="font-serif text-lg text-text mb-0.5">Request Register</div>

        <div className="flex gap-2.5 items-center flex-wrap py-4 border-b border-border">
          <div className="flex-1 min-w-[180px] max-w-[260px] relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[0.78rem] pointer-events-none">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search requests…"
              className="w-full bg-white border border-border rounded-cooley text-[0.78rem] py-1 px-3 pl-7 focus:outline-none focus:border-cooley-red"
            />
          </div>
          <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-text-muted">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-border rounded-cooley text-text-dim text-[0.76rem] py-1 px-2.5 focus:outline-none focus:border-cooley-red"
          >
            <option value="">All</option>
            <option value="received-pending">Received - Pending</option>
            <option value="under-review">Under Review</option>
            <option value="accepted-discovery">Accepted - In Discovery</option>
            <option value="in-backlog">In Backlog</option>
            <option value="active">Active</option>
            <option value="deferred">Deferred</option>
          </select>
          <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="text-[0.72rem] text-text-muted border border-border rounded-cooley px-2.5 py-1 hover:text-cooley-red hover:border-cooley-red-mid transition-colors">
            Reset
          </button>
          <span className="ml-auto font-mono text-[0.63rem] text-text-muted">{filtered.length} of {requests.length} requests</span>
        </div>

        <div className="bg-white border border-border rounded-cooley overflow-hidden mt-4">
          {loading ? (
            <div className="text-center py-12 text-text-muted text-[0.82rem]">Loading requests…</div>
          ) : error ? (
            <div className="text-center py-12 text-red-600 text-[0.82rem]">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-[0.82rem]">
              {requests.length === 0 ? 'No requests yet. Start a new intake to create one.' : 'No requests match the current filters.'}
            </div>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  {['ID', 'Request', 'Team', 'Type', 'Criticality', 'Status', 'Assigned', 'Submitted', 'Need Date', 'Promised', ''].map((h) => (
                    <th key={h} className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.request_id} className="border-b border-border/60 hover:bg-cooley-red-light cursor-pointer transition-colors" onClick={() => setSelected(r)}>
                    <td className="py-2.5 px-4 font-mono text-[0.68rem] text-text-muted whitespace-nowrap">{r.request_id}</td>
                    <td className="py-2.5 px-4">
                      <div className="text-[0.8rem] text-text font-medium max-w-[200px] truncate">{r.title || '(Untitled)'}</div>
                      <div className="text-[0.68rem] text-text-dim">{r.poc_name}</div>
                    </td>
                    <td className="py-2.5 px-4 text-[0.75rem] text-text-dim whitespace-nowrap max-w-[140px] truncate">{r.team || '—'}</td>
                    <td className="py-2.5 px-4 text-[0.72rem] text-text-dim">{r.request_type || '—'}</td>
                    <td className="py-2.5 px-4">{r.criticality ? <CritBadge value={r.criticality} /> : '—'}</td>
                    <td className="py-2.5 px-4"><StatusBadge status={r.status} /></td>
                    <td className="py-2.5 px-4 font-mono text-[0.68rem] text-text-muted whitespace-nowrap">{r.assigned_to || '—'}</td>
                    <td className="py-2.5 px-4 font-mono text-[0.68rem] text-text-muted whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="py-2.5 px-4 font-mono text-[0.68rem] text-text-muted whitespace-nowrap">{formatDate(r.need_date)}</td>
                    <td className="py-2.5 px-4 font-mono text-[0.68rem] text-text-muted whitespace-nowrap">{formatDate(r.promised_date)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button className="text-[0.68rem] font-medium text-cooley-red bg-cooley-red-light border border-cooley-red-mid rounded-cooley px-2 py-0.5 hover:bg-cooley-red-mid transition-colors">
                        Triage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selected && (
        <TriageModal
          request={selected}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
