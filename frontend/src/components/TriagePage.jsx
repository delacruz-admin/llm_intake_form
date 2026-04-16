import { useState, useEffect } from 'react';
import { getRequest, updateRequest, addNote, getNotes, updateNote, deleteNote, listAttachments, deleteRequest, addAnnotation, getAnnotations, updateAnnotation, deleteAnnotation } from '../api/client';
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

const CRIT_ACTIVE = {
  Emergency: 'bg-red-600 border-red-700 text-white',
  High: 'bg-amber-500 border-amber-600 text-white',
  Medium: 'bg-gray-500 border-gray-600 text-white',
  Low: 'bg-green-600 border-green-700 text-white',
};

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

function Field({ label, value }) {
  if (!value || value === '—') return null;
  return (
    <div>
      <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted mb-0.5">{label}</div>
      <div className="text-[0.8rem] text-text-dim leading-relaxed">{value}</div>
    </div>
  );
}

function Section({ label, fields, annotations, onAddAnnotation, onEditAnnotation, onDeleteAnnotation }) {
  const filled = fields.filter(([, val]) => val && val !== '—');
  if (filled.length === 0) return null;
  return (
    <div className="mb-5">
      <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-cooley-red mb-2 font-mono">{label}</div>
      <div className="bg-white border border-border rounded-cooley p-4 flex flex-col gap-3">
        {filled.map(([lbl, val]) => {
          const fieldKey = lbl.toLowerCase().replace(/[^a-z0-9]+/g, '_');
          const fieldAnnotations = annotations.filter((a) => a.field_name === fieldKey);
          return (
            <AnnotatedField
              key={lbl}
              label={lbl}
              fieldKey={fieldKey}
              value={val}
              annotations={fieldAnnotations}
              onAdd={onAddAnnotation}
              onEdit={onEditAnnotation}
              onDelete={onDeleteAnnotation}
            />
          );
        })}
      </div>
    </div>
  );
}

function AnnotatedField({ label, fieldKey, value, annotations, onAdd, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');

  function handleSubmit() {
    if (!text.trim()) return;
    onAdd(fieldKey, text.trim());
    setText('');
    setOpen(false);
  }

  function startEdit(a) {
    setEditingId(a.annotation_id);
    setEditText(a.text);
  }

  function handleSaveEdit(a) {
    if (!editText.trim()) return;
    onEdit(a.sk, editText.trim());
    setEditingId(null);
    setEditText('');
  }

  function handleDeleteAnnotation(a) {
    if (!window.confirm('Delete this annotation?')) return;
    onDelete(a.sk);
  }

  return (
    <div>
      <div className="flex items-start gap-2 group">
        <div className="flex-1">
          <div className="text-[0.58rem] font-semibold uppercase tracking-wider text-text-muted mb-0.5">{label}</div>
          <div className="text-[0.8rem] text-text-dim leading-relaxed">{value}</div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className={`shrink-0 mt-1 text-[0.58rem] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-cooley border transition-all ${
            annotations.length > 0
              ? 'bg-amber-100 border-amber-300 text-amber-700'
              : 'bg-surface-tertiary border-border text-text-muted opacity-0 group-hover:opacity-100'
          }`}
        >
          Add Annotation
        </button>
      </div>

      {/* Existing annotations */}
      {annotations.length > 0 && (
        <div className="ml-0 mt-1.5 flex flex-col gap-1">
          {annotations.map((a) => (
            <div key={a.annotation_id} className="bg-amber-50 border border-amber-200 rounded-cooley px-3 py-1.5 text-[0.75rem] group/annot">
              {editingId === a.annotation_id ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(a)}
                    className="flex-1 bg-white border border-amber-300 rounded-cooley text-[0.75rem] py-1 px-2 focus:outline-none focus:border-amber-500"
                    autoFocus
                  />
                  <button onClick={() => handleSaveEdit(a)} className="text-[0.65rem] font-semibold text-white bg-amber-500 rounded-cooley px-2 py-1 hover:bg-amber-600">Save</button>
                  <button onClick={() => setEditingId(null)} className="text-[0.65rem] text-text-muted hover:text-text px-1">✕</button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono text-[0.6rem] font-semibold text-amber-700">{a.author}</span>
                      <span className="font-mono text-[0.6rem] text-amber-500 ml-2">{formatDate(a.created_at)}</span>
                      {a.edited_at && <span className="font-mono text-[0.55rem] text-amber-400 ml-1">(edited)</span>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/annot:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(a)} className="text-[0.6rem] text-amber-600 hover:text-amber-800 px-1" title="Edit">✎</button>
                      <button onClick={() => handleDeleteAnnotation(a)} className="text-[0.6rem] text-red-400 hover:text-red-600 px-1" title="Delete">✕</button>
                    </div>
                  </div>
                  <div className="text-amber-900 mt-0.5">{a.text}</div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add annotation input */}
      {open && (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Add annotation…"
            className="flex-1 bg-surface-secondary border border-border rounded-cooley text-[0.78rem] py-1.5 px-3 focus:outline-none focus:border-amber-400"
            autoFocus
          />
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="text-[0.68rem] font-semibold text-white bg-amber-500 rounded-cooley px-3 py-1.5 hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setOpen(false); setText(''); }}
            className="text-[0.68rem] text-text-muted hover:text-text transition-colors px-1"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(note.text);

  function handleSave() {
    if (!editText.trim()) return;
    onEdit(note.sk, editText.trim());
    setEditing(false);
  }

  return (
    <div className="bg-surface-secondary border border-border rounded-cooley p-3 group/note">
      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={2}
            className="bg-white border border-border rounded-cooley text-[0.8rem] py-1.5 px-2.5 resize-none focus:outline-none focus:border-cooley-red"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(false)} className="text-[0.65rem] text-text-muted hover:text-text px-2 py-1">Cancel</button>
            <button onClick={handleSave} className="text-[0.65rem] font-semibold text-white bg-cooley-red rounded-cooley px-3 py-1 hover:bg-cooley-red-hover">Save</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <div>
              <span className="font-mono text-[0.65rem] font-semibold text-text-dim">{note.author}</span>
              <span className="font-mono text-[0.6rem] text-text-muted ml-2">{formatDate(note.created_at)}</span>
              {note.edited_at && <span className="font-mono text-[0.55rem] text-text-muted ml-1">(edited)</span>}
            </div>
            <div className="flex gap-1 opacity-0 group-hover/note:opacity-100 transition-opacity">
              <button onClick={() => setEditing(true)} className="text-[0.6rem] text-text-muted hover:text-cooley-red px-1" title="Edit">✎</button>
              <button onClick={() => onDelete(note.sk)} className="text-[0.6rem] text-text-muted hover:text-red-600 px-1" title="Delete">✕</button>
            </div>
          </div>
          <div className="text-[0.8rem] text-text-dim leading-relaxed">{note.text}</div>
        </>
      )}
    </div>
  );
}

export default function TriagePage({ requestId, onNavigate }) {
  const user = getUser();
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [annotations, setAnnotations] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [promisedDate, setPromisedDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    loadAll();
  }, [requestId]);

  async function loadAll() {
    setLoading(true);
    try {
      const [reqData, notesData, attachData, annotData] = await Promise.all([
        getRequest(requestId),
        getNotes(requestId),
        listAttachments(requestId),
        getAnnotations(requestId),
      ]);
      setRequest(reqData);
      setAssignedTo(reqData.assigned_to || '');
      setPromisedDate(reqData.promised_date || '');
      setNotes(notesData.notes || []);
      setAttachments(attachData.attachments || []);
      setAnnotations(annotData.annotations || []);
    } catch (err) {
      showToast(`Error loading: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  async function handleStatusChange(newStatus) {
    setSaving(true);
    try {
      await updateRequest(requestId, { status: newStatus });
      showToast(`Status → ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      await loadAll();
    } catch (err) { showToast(`Error: ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleAssign() {
    if (!assignedTo.trim()) return;
    setSaving(true);
    try {
      await updateRequest(requestId, { assigned_to: assignedTo.trim() });
      showToast(`Assigned to ${assignedTo.trim()}`);
      await loadAll();
    } catch (err) { showToast(`Error: ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleCritChange(crit) {
    setSaving(true);
    try {
      await updateRequest(requestId, { criticality: crit });
      showToast(`Criticality → ${crit}`);
      await loadAll();
    } catch (err) { showToast(`Error: ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handlePromisedDate() {
    if (!promisedDate) return;
    setSaving(true);
    try {
      await updateRequest(requestId, { promised_date: promisedDate });
      showToast(`Promised date set`);
      await loadAll();
    } catch (err) { showToast(`Error: ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      await addNote(requestId, noteText.trim(), user?.name || user?.email || 'Unknown');
      setNoteText('');
      const data = await getNotes(requestId);
      setNotes(data.notes || []);
      showToast('Note added');
    } catch (err) { showToast(`Error: ${err.message}`); }
    finally { setSaving(false); }
  }

  async function handleEditNote(sk, text) {
    try {
      await updateNote(requestId, sk, text);
      const data = await getNotes(requestId);
      setNotes(data.notes || []);
      showToast('Note updated');
    } catch (err) { showToast(`Error: ${err.message}`); }
  }

  async function handleDeleteNote(sk) {
    if (!window.confirm('Delete this note?')) return;
    try {
      await deleteNote(requestId, sk);
      const data = await getNotes(requestId);
      setNotes(data.notes || []);
      showToast('Note deleted');
    } catch (err) { showToast(`Error: ${err.message}`); }
  }

  async function handleAddAnnotation(fieldName, text) {
    try {
      await addAnnotation(requestId, fieldName, text, user?.name || user?.email || 'Unknown');
      const data = await getAnnotations(requestId);
      setAnnotations(data.annotations || []);
      showToast('Annotation added');
    } catch (err) { showToast(`Error: ${err.message}`); }
  }

  async function handleEditAnnotation(sk, text) {
    try {
      await updateAnnotation(requestId, sk, text);
      const data = await getAnnotations(requestId);
      setAnnotations(data.annotations || []);
      showToast('Annotation updated');
    } catch (err) { showToast(`Error: ${err.message}`); }
  }

  async function handleDeleteAnnotation(sk) {
    try {
      await deleteAnnotation(requestId, sk);
      const data = await getAnnotations(requestId);
      setAnnotations(data.annotations || []);
      showToast('Annotation deleted');
    } catch (err) { showToast(`Error: ${err.message}`); }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete ${requestId}? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await deleteRequest(requestId);
      onNavigate('dashboard');
    } catch (err) {
      showToast(`Error: ${err.message}`);
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-secondary">
        <p className="text-text-muted font-mono text-sm">Loading request…</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface-secondary">
        <p className="text-text-muted text-sm">Request not found.</p>
      </div>
    );
  }

  const r = request;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface-secondary">
      {/* Page Header */}
      <div className="bg-white border-b border-border py-5 shrink-0">
        <div className="max-w-[1380px] mx-auto px-8">
          <button onClick={() => onNavigate('dashboard')} className="text-[0.72rem] text-cooley-red hover:underline mb-2 inline-block">← Back to Dashboard</button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[0.65rem] text-text-muted mb-1">{r.request_id}</div>
              <div className="font-serif text-xl text-text">{r.title || '(Untitled)'}</div>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={r.status} />
                {r.criticality && <CritBadge value={r.criticality} />}
                <span className="font-mono text-[0.65rem] text-text-muted">Submitted {formatDate(r.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout — each column scrolls independently */}
      <div className="max-w-[1380px] mx-auto px-8 py-6 grid grid-cols-[1fr_380px] gap-6 flex-1 min-h-0">

        {/* LEFT — Request Details (scrollable) */}
        <div className="overflow-y-scroll min-h-0 pr-2">
          <Section label="Summary" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Status', <StatusBadge status={r.status} />],
            ['Criticality', r.criticality ? <CritBadge value={r.criticality} /> : null],
            ['Date Submitted', formatDate(r.created_at)],
            ['Need Date', formatDate(r.need_date)],
            ['Promised Date', formatDate(r.promised_date)],
            ['Assigned To', r.assigned_to],
          ]} />

          <Section label="A1 · Requestor Information" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Submitter', r.submitter],
            ['Submitter Email', r.submitter_email],
            ['Initiative Team / Department', r.team],
            ['Initiative POC', r.poc_name],
            ['Initiative POC Email', r.poc_email],
            ['Initiative Executive Sponsor', r.exec_sponsor],
          ]} />

          <Section label="A2 · Request Details" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Request Type', r.request_type],
            ['Application Type', r.app_type],
            ['Title', r.title],
            ['Description', r.description],
            ['Deliverables', r.deliverables],
          ]} />

          <Section label="A3 · Business Context & Impact" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Business Outcomes', r.business_outcomes],
            ['Business Criticality', r.criticality],
            ['Impact if Not Implemented', r.impact_if_not_done],
            ['Scale of Impact', r.impact_scale],
            ['Anticipated Need Date', formatDate(r.need_date)],
          ]} />

          <Section label="A4 · Dependencies" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Vendor Involved', r.vendor_involved],
            ['Vendor Name', r.vendor_name],
            ['System Dependencies', r.system_dependencies],
            ['Discovery Stakeholders', r.discovery_stakeholders],
          ]} />

          <Section label="C1 · Environments" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Environments Needed', r.environments_needed],
            ['Hosting Preference', r.hosting_preference],
            ['New AWS Account', r.new_aws_account],
            ['AWS Account Name', r.aws_account_name],
            ['AWS Region', r.aws_region],
          ]} />

          <Section label="C2 · IAM" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['SSO Integration', r.sso_needed],
            ['Access Patterns', r.access_patterns],
          ]} />

          <Section label="C3 · Architecture" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Deployment Model', r.deployment_model],
            ['Compute Requirements', r.compute_needed],
            ['Database Requirements', r.database_needed],
            ['Storage Requirements', r.storage_needed],
          ]} />

          <Section label="C4 · Network" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Connectivity', r.connectivity_type],
            ['VPC Requirements', r.vpc_requirements],
          ]} />

          <Section label="C5 · Security" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Compliance Frameworks', r.compliance_frameworks],
            ['Data Classification', r.data_classification],
            ['Encryption', r.encryption_requirements],
          ]} />

          <Section label="C6 · Comments" annotations={annotations} onAddAnnotation={handleAddAnnotation} onEditAnnotation={handleEditAnnotation} onDeleteAnnotation={handleDeleteAnnotation} fields={[
            ['Additional Comments', r.additional_comments],
          ]} />
        </div>

        {/* RIGHT — Triage Actions (scrollable) */}
        <div className="overflow-y-scroll min-h-0 pl-2">
          {/* Status */}
          <div className="bg-white border border-border rounded-cooley p-4 mb-4">
            <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Status</div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const isCurrent = r.status === key;
                return (
                  <button
                    key={key}
                    onClick={() => !isCurrent && handleStatusChange(key)}
                    disabled={saving || isCurrent}
                    className={`text-[0.72rem] font-semibold px-3 py-2 rounded-cooley border text-left transition-colors ${
                      isCurrent
                        ? 'bg-cooley-red text-white border-cooley-red'
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
          <div className="bg-white border border-border rounded-cooley p-4 mb-4">
            <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Assign To</div>
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
                className="text-[0.72rem] font-semibold text-white bg-cooley-red rounded-cooley px-3 py-1.5 hover:bg-cooley-red-hover transition-colors disabled:opacity-50"
              >
                Set
              </button>
            </div>
            {r.assigned_to && <div className="text-[0.68rem] text-text-muted mt-1.5 font-mono">Current: {r.assigned_to}</div>}
          </div>

          {/* Criticality */}
          <div className="bg-white border border-border rounded-cooley p-4 mb-4">
            <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Criticality</div>
            <div className="flex gap-2 flex-wrap">
              {['Low', 'Medium', 'High', 'Emergency'].map((c) => (
                <button
                  key={c}
                  onClick={() => handleCritChange(c)}
                  disabled={saving || r.criticality === c}
                  className={`text-[0.68rem] font-semibold px-3 py-1.5 rounded-cooley border transition-colors ${
                    r.criticality === c
                      ? CRIT_ACTIVE[c]
                      : `disabled:opacity-30 ${CRIT_CONFIG[c]}`
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Promised Date */}
          <div className="bg-white border border-border rounded-cooley p-4 mb-4">
            <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Promised Date</div>
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
                className="text-[0.72rem] font-semibold text-white bg-cooley-red rounded-cooley px-3 py-1.5 hover:bg-cooley-red-hover transition-colors disabled:opacity-50"
              >
                Set
              </button>
            </div>
            {r.promised_date && <div className="text-[0.68rem] text-text-muted mt-1.5 font-mono">Current: {formatDate(r.promised_date)}</div>}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="bg-white border border-border rounded-cooley p-4 mb-4">
              <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-3">Attachments</div>
              <div className="flex flex-col gap-2">
                {attachments.map((a) => (
                  <div key={a.file_id} className="flex items-center gap-2 bg-surface-secondary border border-border rounded-cooley p-2.5">
                    <span>📎</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.78rem] text-text font-medium truncate">{a.filename}</div>
                      <div className="font-mono text-[0.6rem] text-text-muted">{a.category} · {formatDate(a.uploaded_at)}</div>
                    </div>
                    {a.download_url ? (
                      <a href={a.download_url} target="_blank" rel="noopener noreferrer"
                        className="text-[0.65rem] font-semibold text-cooley-red bg-cooley-red-light border border-cooley-red-mid rounded-cooley px-2 py-1 hover:bg-cooley-red hover:text-white transition-colors no-underline shrink-0">
                        Download
                      </a>
                    ) : <span className="text-[0.65rem] text-text-muted italic">No file</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white border border-border rounded-cooley p-4 mb-4">
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
                className="self-end text-[0.72rem] font-semibold text-white bg-cooley-red rounded-cooley px-3 py-2 hover:bg-cooley-red-hover transition-colors disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {notes.length === 0 ? (
              <div className="text-[0.78rem] text-text-muted italic">No notes yet.</div>
            ) : (
              <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                {notes.map((n) => (
                  <NoteCard key={n.note_id} note={n} onEdit={handleEditNote} onDelete={handleDeleteNote} />
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <div className="bg-white border border-border rounded-cooley p-4">
            <button
              onClick={handleDelete}
              disabled={saving}
              className="text-[0.72rem] font-medium text-red-600 hover:text-white hover:bg-red-600 border border-red-300 rounded-cooley px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              Delete Request
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-white border border-border border-l-[3px] border-l-semantic-green rounded-cooley px-4 py-2.5 text-[0.76rem] text-text-dim flex items-center gap-2 shadow-lg z-50">
          <span className="text-semantic-green">✓</span> {toast}
        </div>
      )}
    </div>
  );
}
