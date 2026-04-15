import { useState, useEffect } from 'react';
import { listRequests } from '../api/client';

const STATUS_CONFIG = {
  submitted: { label: 'Submitted', dot: 'bg-border-strong', bg: 'bg-surface-tertiary border-border-strong text-text-dim' },
  'in-triage': { label: 'In Triage', dot: 'bg-orange-400', bg: 'bg-orange-50 border-orange-200 text-orange-800' },
  'in-discovery': { label: 'In Discovery', dot: 'bg-amber-400', bg: 'bg-amber-50 border-amber-300 text-amber-700' },
  'in-backlog': { label: 'In Backlog', dot: 'bg-blue-400', bg: 'bg-blue-50 border-blue-200 text-blue-800' },
  'in-progress': { label: 'In Progress', dot: 'bg-blue-500', bg: 'bg-blue-50 border-blue-300 text-blue-800' },
  complete: { label: 'Complete', dot: 'bg-green-500', bg: 'bg-green-50 border-green-300 text-green-800' },
};

const CRIT_CONFIG = {
  Emergency: 'bg-red-100 border-red-300 text-red-800',
  High: 'bg-amber-50 border-amber-300 text-amber-700',
  Medium: 'bg-surface-tertiary border-border-strong text-text-dim',
  Low: 'bg-green-50 border-green-300 text-green-800',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.submitted;
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

export default function Dashboard({ onNavigate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadRequests();
  }, []);

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
    submitted: requests.filter((r) => r.status === 'submitted').length,
    'in-triage': requests.filter((r) => r.status === 'in-triage').length,
    'in-discovery': requests.filter((r) => r.status === 'in-discovery').length,
    'in-progress': requests.filter((r) => r.status === 'in-progress').length,
    complete: requests.filter((r) => r.status === 'complete').length,
  };

  return (
    <div className="flex-1 overflow-y-auto bg-surface-secondary">
      {/* Page Header */}
      <div className="bg-white border-b border-border py-6">
        <div className="max-w-[1380px] mx-auto px-8">
          <div className="text-[0.63rem] font-semibold uppercase tracking-widest text-cooley-red mb-1">Request Pipeline</div>
          <div className="font-serif text-2xl text-text mb-0.5">Intake Dashboard</div>
          <div className="text-[0.8rem] text-text-muted">Architecture Review Board · Technology Infrastructure</div>

          {/* Stat Cards */}
          <div className="grid grid-cols-6 gap-3 mt-6">
            {[
              { key: 'all', label: 'Total', sub: 'All requests', color: 'text-text', border: 'border-t-border' },
              { key: 'submitted', label: 'Submitted', sub: 'Awaiting triage', color: 'text-text-muted', border: 'border-t-border-strong' },
              { key: 'in-triage', label: 'In Triage', sub: 'Under review', color: 'text-orange-700', border: 'border-t-orange-400' },
              { key: 'in-discovery', label: 'Discovery', sub: 'Active scoping', color: 'text-amber-600', border: 'border-t-amber-400' },
              { key: 'in-progress', label: 'In Progress', sub: 'Actively working', color: 'text-blue-700', border: 'border-t-blue-500' },
              { key: 'complete', label: 'Complete', sub: 'Delivered', color: 'text-green-700', border: 'border-t-green-500' },
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

        {/* Filters */}
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
            <option value="submitted">Submitted</option>
            <option value="in-triage">In Triage</option>
            <option value="in-discovery">In Discovery</option>
            <option value="in-progress">In Progress</option>
            <option value="complete">Complete</option>
          </select>
          <button onClick={() => { setSearch(''); setStatusFilter(''); }} className="text-[0.72rem] text-text-muted border border-border rounded-cooley px-2.5 py-1 hover:text-cooley-red hover:border-cooley-red-mid transition-colors">
            Reset
          </button>
          <span className="ml-auto font-mono text-[0.63rem] text-text-muted">{filtered.length} of {requests.length} requests</span>
        </div>

        {/* Table */}
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
                  <th className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">ID</th>
                  <th className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">Request</th>
                  <th className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">Team</th>
                  <th className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">Type</th>
                  <th className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">Criticality</th>
                  <th className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">Status</th>
                  <th className="bg-surface-secondary py-2 px-4 text-left font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border">Need Date</th>
                  <th className="bg-surface-secondary py-2 px-4 text-right font-mono text-[0.62rem] uppercase tracking-wider text-text-muted border-b border-border"></th>
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
                    <td className="py-2.5 px-4 font-mono text-[0.68rem] text-text-muted whitespace-nowrap">{formatDate(r.need_date)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button className="text-[0.68rem] font-medium text-cooley-red bg-cooley-red-light border border-cooley-red-mid rounded-cooley px-2 py-0.5 hover:bg-cooley-red-mid transition-colors">
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-sm z-[200] flex items-center justify-center p-8" onClick={() => setSelected(null)}>
          <div className="bg-white border border-border border-t-[3px] border-t-cooley-red rounded-cooley w-full max-w-[600px] max-h-[82vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between p-5 border-b border-border">
              <div>
                <div className="font-mono text-[0.65rem] text-text-muted mb-1">{selected.request_id}</div>
                <div className="font-serif text-lg text-text">{selected.title || '(Untitled)'}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text text-lg">✕</button>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Status</div>
                  <StatusBadge status={selected.status} />
                </div>
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Criticality</div>
                  {selected.criticality ? <CritBadge value={selected.criticality} /> : <span className="text-[0.82rem] text-text-dim">—</span>}
                </div>
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Team</div>
                  <div className="text-[0.82rem] text-text font-semibold">{selected.team || '—'}</div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">POC</div>
                  <div className="text-[0.82rem] text-text-dim">{selected.poc_name || '—'}</div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Request Type</div>
                  <div className="text-[0.82rem] text-text-dim">{selected.request_type || '—'}</div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">App Type</div>
                  <div className="text-[0.82rem] text-text-dim">{selected.app_type || '—'}</div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Need Date</div>
                  <div className="text-[0.82rem] text-text-dim">{formatDate(selected.need_date)}</div>
                </div>
                <div>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Submitted</div>
                  <div className="text-[0.82rem] text-text-dim">{formatDate(selected.created_at)}</div>
                </div>
              </div>
              {selected.description && (
                <>
                  <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Description</div>
                  <div className="bg-surface-secondary border border-border rounded-cooley p-3 text-[0.8rem] text-text-dim leading-relaxed mb-4">{selected.description}</div>
                </>
              )}
              {selected.business_outcomes && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Business Outcomes</div>
                    <div className="text-[0.82rem] text-text-dim">{selected.business_outcomes}</div>
                  </div>
                  <div>
                    <div className="text-[0.6rem] font-semibold uppercase tracking-wider text-text-muted mb-1">Vendor</div>
                    <div className="text-[0.82rem] text-text-dim">{selected.vendor_name || 'None'}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
