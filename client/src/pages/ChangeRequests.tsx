import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listChangeRequests, getVersionHistory } from '../lib/api';
import StatusBadge from '../components/StatusBadge';

export default function ChangeRequests() {
  const [requests, setRequests] = useState<any[]>([]);
  const [recentVersions, setRecentVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  async function loadData() {
    setLoading(true);
    try {
      const [crData, versionData] = await Promise.all([
        listChangeRequests(statusFilter || undefined),
        getVersionHistory(),
      ]);
      setRequests(crData.change_requests);
      setRecentVersions(versionData.versions);
    } catch (err) {
      console.error('Failed to load activity:', err);
    } finally {
      setLoading(false);
    }
  }

  const statuses = ['', 'draft', 'in_review', 'changes_requested', 'approved', 'rejected', 'merged'];
  const statusLabels: Record<string, string> = {
    draft: 'Draft',
    in_review: 'In Review',
    changes_requested: 'Changes Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    merged: 'Complete',
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Activity</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Change Requests */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Change Requests</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">All Statuses</option>
              {statuses.filter(Boolean).map((s) => (
                <option key={s} value={s}>{statusLabels[s] || s}</option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : requests.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 text-center py-12 text-slate-400">
              <p className="text-sm">No change requests</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="divide-y divide-slate-100">
                {requests.map((cr) => (
                  <Link
                    key={cr.id}
                    to={`/changes/${cr.id}`}
                    className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors block"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-800">{cr.title}</div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {cr.submitted_by_name} &middot; {cr.category}
                        {cr.submitted_at && <> &middot; {new Date(cr.submitted_at).toLocaleDateString()}</>}
                      </div>
                    </div>
                    <StatusBadge status={cr.status === 'merged' ? 'approved' : cr.status} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* All Activity */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-800">All Activity</h2>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {loading ? (
              <div className="px-6 py-8 text-slate-500">Loading...</div>
            ) : recentVersions.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-400 text-sm">No recent activity</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentVersions.map((v, i) => (
                  <div key={i} className="px-6 py-3">
                    <div className="text-sm text-slate-800">{v.message}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {v.author.name} &middot; {new Date(v.date).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
