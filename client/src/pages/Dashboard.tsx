import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyReviews, listCategories, getPendingAcknowledgments, acknowledgeChange } from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import RedlineViewer from '../components/RedlineViewer';

import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLORS } from '../../../src/shared/types';
import type { CategoryColor } from '../../../src/shared/types';

type SortField = 'title' | 'category' | 'status' | 'date';
type SortDir = 'asc' | 'desc';

export default function Dashboard() {

  const [yourTurn, setYourTurn] = useState<any[]>([]);
  const [submitted, setSubmitted] = useState<any[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<any[]>([]);
  const [ackExpanded, setAckExpanded] = useState<string | null>(null);
  const [ackRedline, setAckRedline] = useState<any>(null);
  const [loadingRedline, setLoadingRedline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Record<string, CategoryColor>>({});
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    async function load() {
      try {
        const [reviews, catData, ackData] = await Promise.all([getMyReviews(), listCategories(), getPendingAcknowledgments()]);
        setYourTurn(reviews.your_turn);
        setSubmitted(reviews.submitted || []);
        setAcknowledgments(ackData.acknowledgments || []);
        const colorMap: Record<string, CategoryColor> = {};
        for (const c of catData.categories) {
          colorMap[c.prefix] = c.color || DEFAULT_CATEGORY_COLORS[c.prefix] || 'gray';
        }
        setCategories(colorMap);
      } catch (err) {
        console.error('Failed to load my work:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
  }

  const sortedSubmitted = [...submitted].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'title': cmp = (a.title || '').localeCompare(b.title || ''); break;
      case 'category': cmp = (a.category || '').localeCompare(b.category || ''); break;
      case 'status': cmp = (a.status || '').localeCompare(b.status || ''); break;
      case 'date': {
        const da = a.submitted_at || a.created_at || '';
        const db2 = b.submitted_at || b.created_at || '';
        cmp = da.localeCompare(db2);
        break;
      }
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  if (loading) {
    return <div className="text-slate-500">Loading...</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-slate-800">My Work</h1>

      {/* Your Turn to Review */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Your Turn to Review ({yourTurn.length})</h2>
        </div>
        {yourTurn.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">Nothing needs your review right now</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {yourTurn.map((cr) => (
              <Link
                key={cr.id}
                to={`/changes/${cr.id}`}
                className="px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">{cr.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {cr.submitted_by_name} &middot; {cr.category}
                    {cr.created_at && <> &middot; {new Date(cr.created_at).toLocaleDateString()}</>}
                  </div>
                </div>
                <StatusBadge status={cr.status} />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Changes to Acknowledge */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Changes to Acknowledge ({acknowledgments.length})</h2>
        </div>
        {acknowledgments.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">You have no changes to acknowledge</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {acknowledgments.map((ack) => (
              <div key={ack.id}>
                <div className="px-6 py-3 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800">{ack.cr_title}</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      {ack.document_path?.split('/').pop()?.replace('.md', '')}
                      {ack.created_at && <> &middot; {new Date(ack.created_at).toLocaleDateString()}</>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        if (ackExpanded === ack.id) {
                          setAckExpanded(null);
                          setAckRedline(null);
                        } else {
                          setAckExpanded(ack.id);
                          setLoadingRedline(true);
                          try {
                            const cr = await (await fetch(`/api/change-requests/${ack.change_request_id}`, {
                              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
                            })).json();
                            setAckRedline(cr.redline);
                          } catch {
                            setAckRedline(null);
                          } finally {
                            setLoadingRedline(false);
                          }
                        }
                      }}
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
                      {ackExpanded === ack.id ? 'Hide Redline' : 'View Redline'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await acknowledgeChange(ack.id);
                          setAcknowledgments((prev) => prev.filter((a) => a.id !== ack.id));
                          if (ackExpanded === ack.id) {
                            setAckExpanded(null);
                            setAckRedline(null);
                          }
                        } catch (err) {
                          console.error('Failed to acknowledge:', err);
                        }
                      }}
                      className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-blue-600 transition-colors"
                    >
                      Acknowledge
                    </button>
                  </div>
                </div>
                {ackExpanded === ack.id && (
                  <div className="px-6 pb-4">
                    {loadingRedline ? (
                      <div className="text-sm text-slate-400">Loading redline...</div>
                    ) : ackRedline?.changes?.length > 0 ? (
                      <RedlineViewer changes={ackRedline.changes} />
                    ) : (
                      <div className="text-sm text-slate-400">No redline available for this change.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Revisions you Submitted */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Revisions you Submitted ({submitted.length})</h2>
        </div>
        {submitted.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-400 text-sm">You haven't submitted any revisions yet</div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {([
                  { field: 'title' as SortField, label: 'Title', center: false },
                  { field: 'category' as SortField, label: 'Category', center: true },
                  { field: 'status' as SortField, label: 'Status', center: true },
                  { field: 'date' as SortField, label: 'Date', center: true },
                ]).map(({ field, label, center }) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className={`px-6 py-3 text-xs font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-600 select-none ${center ? 'text-center' : ''}`}
                  >
                    {label} {sortField === field && (sortDir === 'asc' ? '\u25B2' : '\u25BC')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedSubmitted.map((cr) => (
                <tr key={cr.id} className="hover:bg-slate-50">
                  <td className="px-6 py-3">
                    <Link to={`/changes/${cr.id}`} className="text-slate-800 hover:text-slate-600 font-medium">
                      {cr.title}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-center">
                    {(() => {
                      const colorKey = categories[cr.category] || DEFAULT_CATEGORY_COLORS[cr.category] || 'gray';
                      const c = CATEGORY_COLORS[colorKey];
                      return <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${c.bg} ${c.text}`}>{cr.category}</span>;
                    })()}
                  </td>
                  <td className="px-6 py-3 whitespace-nowrap text-center">
                    <StatusBadge status={cr.status === 'merged' ? 'approved' : cr.status} />
                  </td>
                  <td className="px-6 py-3 text-xs text-slate-500 whitespace-nowrap text-center">
                    {cr.submitted_at ? new Date(cr.submitted_at).toLocaleDateString() : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
