import { useState, useEffect } from 'react';
import { listRequests } from '../api/client';

const STATUS_CONFIG = {
  'draft': { label: 'Draft', dot: 'bg-purple-400', bg: 'bg-purple-50 border-purple-200 text-purple-700' },
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

export default function Dashboard({ onNavigate, user }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

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

  const isReviewer = user?.isReviewer;

  const filtered = requests.filter((r) => {
    // Submitters only see their own entries
    if (!isReviewer && r.submitter_email && user?.email && r.submitter_email !== user.email) return false;
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
        <div className="font-serif text-lg text-text mb-0.5">Initiatives Register</div>

        <div className="flex gap-2.5 items-center flex-wrap py-4 border-b border-border">
          <div className="flex-1 min-w-[180px] max-w-[260px] relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted text-[0.78rem] pointer-events-none">⌕</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search entries…"
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
            <option value="draft">Draft</option>
            <option value="received-pending">Received, Pending Review</option>
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
                  <tr key={r.request_id} className="border-b border-border/60 hover:bg-cooley-red-light cursor-pointer transition-colors" onClick={() => onNavigate('triage', r.request_id)}>
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
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
