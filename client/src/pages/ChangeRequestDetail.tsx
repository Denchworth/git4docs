import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getChangeRequest, approveChangeRequest, requestChanges as apiRequestChanges,
  rejectChangeRequest, resubmitChangeRequest,
  addReviewComment,
} from '../lib/api';
import StatusBadge from '../components/StatusBadge';
import RedlineViewer from '../components/RedlineViewer';
import { useAuth } from '../lib/auth';

export default function ChangeRequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [cr, setCR] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [unresolvedCount, setUnresolvedCount] = useState(0);
  const [reviewerStatus, setReviewerStatus] = useState<any[]>([]);
  const [redline, setRedline] = useState<any>(null);
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [acting, setActing] = useState(false);
  const [showRedline, setShowRedline] = useState(false);
  const [error, setError] = useState('');



  useEffect(() => {
    if (id) loadCR();
  }, [id]);

  async function loadCR() {
    try {
      const data = await getChangeRequest(id!);
      setCR(data.change_request);
      setActions(data.approval_actions);
      setComments(data.comments || []);
      setUnresolvedCount(data.unresolved_comment_count || 0);
      setReviewerStatus(data.reviewer_status || []);
      setRedline(data.redline);
      setWorkflow(data.workflow);
    } catch (err) {
      console.error('Failed to load change request:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove() {
    setActing(true);
    setError('');
    try {
      await approveChangeRequest(id!, comment || undefined);
      await loadCR();
      setComment('');
    } catch (err: any) {
      setError(err.message || 'Failed to approve');
    } finally {
      setActing(false);
    }
  }

  async function handleRequestChanges() {
    if (!comment.trim()) {
      setError('Please provide feedback when requesting changes.');
      return;
    }
    setActing(true);
    setError('');
    try {
      await apiRequestChanges(id!, comment);
      await loadCR();
      setComment('');
    } catch (err: any) {
      setError(err.message || 'Failed to request changes');
    } finally {
      setActing(false);
    }
  }

  async function handleReject() {
    if (!comment.trim()) {
      setError('Please provide a reason for rejection.');
      return;
    }
    setActing(true);
    setError('');
    try {
      await rejectChangeRequest(id!, comment);
      await loadCR();
      setComment('');
    } catch (err: any) {
      setError(err.message || 'Failed to reject');
    } finally {
      setActing(false);
    }
  }

  async function handleResubmit() {
    setActing(true);
    setError('');
    try {
      await resubmitChangeRequest(id!);
      await loadCR();
    } catch (err: any) {
      setError(err.message || 'Failed to resubmit');
    } finally {
      setActing(false);
    }
  }


  if (loading) return <div className="text-slate-500">Loading...</div>;
  if (!cr) return <div className="text-red-600">Change request not found</div>;

  const isAuthor = user?.email === cr.submitted_by_email;
  const canReview = cr.status === 'in_review';
  const approvedCount = reviewerStatus.filter((r: any) => r.status === 'approved').length;
  const totalReviewers = reviewerStatus.length;

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-sm font-medium">Dismiss</button>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Link to="/activity" className="text-slate-400 hover:text-slate-500">&larr;</Link>
        <h1 className="text-2xl font-bold text-slate-800">{cr.title}</h1>
        <StatusBadge status={cr.status} />
      </div>

      {/* Details */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase">Category</div>
            <div className="mt-1 text-sm font-mono">{cr.category}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase">Submitted By</div>
            <div className="mt-1 text-sm">{cr.submitted_by_name}</div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase">Submitted</div>
            <div className="mt-1 text-sm">
              {cr.submitted_at ? new Date(cr.submitted_at).toLocaleString() : '-'}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase">Document</div>
            <div className="mt-1 text-sm">
              {cr.document_path ? (
                <span className="text-slate-800">
                  {cr.document_path.split('/').pop()?.replace('.md', '')}
                </span>
              ) : '-'}
            </div>
          </div>
        </div>
        {cr.description && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-500 uppercase mb-1">Description</div>
            <p className="text-sm text-slate-600">{cr.description}</p>
          </div>
        )}
      </div>

      {/* Reviewer Status Panel */}
      {reviewerStatus.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Reviewers</h2>
            <span className="text-sm text-slate-500">
              {approvedCount} of {totalReviewers} approved
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {reviewerStatus.map((reviewer: any) => (
              <div key={reviewer.email} className="px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    reviewer.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-slate-100 text-slate-500'
                  }`}>
                    {reviewer.status === 'approved' ? '\u2713' : reviewer.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-800">{reviewer.name}</div>
                    <div className="text-xs text-slate-500">{reviewer.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {reviewer.status === 'approved' ? (
                    <>
                      <span className="text-xs text-green-600 font-medium">Approved</span>
                      {reviewer.commit_sha && (
                        <span className="text-xs font-mono text-slate-400" title={`Approved version: ${reviewer.commit_sha}`}>
                          @ {reviewer.commit_sha.slice(0, 7)}
                        </span>
                      )}
                      {reviewer.approved_at && (
                        <span className="text-xs text-slate-400">
                          {new Date(reviewer.approved_at).toLocaleDateString()}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval reset info */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-3">
        <p className="text-xs text-blue-700">
          All approvals reset when the document is modified. Each approval is tied to a specific document version.
        </p>
      </div>

      {/* Workflow Steps */}
      {workflow && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">Workflow: {workflow.name}</h2>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center gap-2">
              {workflow.steps.map((step: any, i: number) => {
                const isComplete = i < cr.current_step;
                const isCurrent = i === cr.current_step && (cr.status === 'in_review' || cr.status === 'changes_requested');
                return (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <div className={`w-8 h-0.5 ${isComplete ? 'bg-green-400' : 'bg-slate-200'}`} />}
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                      isComplete ? 'bg-green-50 text-green-700 border border-green-200' :
                      isCurrent ? 'bg-blue-50 text-blue-600 border border-blue-200' :
                      'bg-slate-50 text-slate-500 border border-slate-200'
                    }`}>
                      {isComplete && <span className="text-green-500">&#10003;</span>}
                      {isCurrent && <span className="w-2 h-2 rounded-full bg-blue-500"></span>}
                      <span className="font-medium">{step.description || step.action}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Status Banners */}
      {cr.status === 'merged' && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-green-600 text-lg">&#10003;</span>
              <span className="font-semibold text-green-800">Complete</span>
            </div>
            <p className="text-sm text-green-700 mt-1">
              All approval steps completed. Changes have been published to the official version.
            </p>
          </div>
          {cr.document_path && (
            <Link
              to={`/document/${cr.document_path}`}
              className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex-shrink-0"
            >
              View Document
            </Link>
          )}
        </div>
      )}

      {cr.status === 'rejected' && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-red-600 text-lg">&#10007;</span>
            <span className="font-semibold text-red-800">Change Request Rejected</span>
          </div>
          <p className="text-sm text-red-700 mt-1">
            This change request was rejected. See comments below for details.
          </p>
        </div>
      )}

      {cr.status === 'changes_requested' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-orange-600 text-lg">&#8634;</span>
            <span className="font-semibold text-orange-800">Changes Requested</span>
          </div>
          <p className="text-sm text-orange-700 mt-1">
            A reviewer has requested changes. The document is unlocked for editing.
            {isAuthor && ' Make your changes and resubmit when ready.'}
          </p>
          {isAuthor && (
            <div className="mt-3 flex items-center gap-3">
              {cr.document_path && (
                <Link
                  to={`/document/${cr.document_path}?draft=${encodeURIComponent(cr.branch_name)}`}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
                >
                  Edit Document
                </Link>
              )}
              <button
                onClick={handleResubmit}
                disabled={acting}
                className="border border-orange-600 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 disabled:opacity-50 transition-colors"
              >
                {acting ? 'Resubmitting...' : 'Resubmit for Review'}
              </button>
              {unresolvedCount > 0 && (
                <span className="text-sm text-orange-600">
                  {unresolvedCount} unresolved comment{unresolvedCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Redline toggle */}
      {redline && redline.changes && redline.changes.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowRedline(!showRedline)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <h2 className="font-semibold text-slate-800">
              Redline ({redline.changes.length} file{redline.changes.length !== 1 ? 's' : ''} changed)
            </h2>
            <span className="text-slate-400">{showRedline ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showRedline && (
            <div className="px-6 pb-6">
              <RedlineViewer changes={redline.changes} />
            </div>
          )}
        </div>
      )}

      {/* History — actions and comments merged chronologically */}
      {(() => {
        const items: { type: 'action' | 'comment'; date: string; data: any }[] = [
          ...actions.map((a) => ({ type: 'action' as const, date: a.acted_at, data: a })),
          ...comments.map((c) => ({ type: 'comment' as const, date: c.created_at, data: c })),
        ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">History</h2>
            </div>
            {items.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">No activity yet</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item) => {
                  if (item.type === 'action') {
                    const a = item.data;
                    return (
                      <div key={`action-${a.id}`} className={`px-6 py-3 ${a.dismissed ? 'bg-slate-50' : ''}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium ${a.dismissed ? 'text-slate-400' : ''}`}>{a.acted_by_name}</span>
                          <StatusBadge status={a.dismissed ? 'dismissed' : a.action} />
                          {a.commit_sha && (
                            <span className="text-xs font-mono text-slate-400" title={`Version: ${a.commit_sha}`}>
                              @ {a.commit_sha.slice(0, 7)}
                            </span>
                          )}
                        </div>
                        {a.dismissed && a.dismissed_reason && (
                          <p className="text-xs text-slate-400 mt-0.5 italic">
                            Dismissed: {a.dismissed_reason}
                          </p>
                        )}
                        {a.comments && (
                          <p className={`text-sm mt-1 ${a.dismissed ? 'text-slate-400' : 'text-slate-500'}`}>{a.comments}</p>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">{new Date(a.acted_at).toLocaleString()}</div>
                      </div>
                    );
                  } else {
                    const c = item.data;
                    return (
                      <div key={`comment-${c.id}`} className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{c.author_name}</span>
                          <span className="text-xs font-medium text-slate-500">commented</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1">{c.body}</p>
                        <div className="text-xs text-slate-400 mt-0.5">{new Date(c.created_at).toLocaleString()}</div>
                      </div>
                    );
                  }
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Reviewer Action panel */}
      {canReview && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-800 mb-4">Take Action</h2>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add comments (required for Request Changes and Reject)..."
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
            rows={3}
          />
          <div className="flex gap-3">
            <button
              onClick={handleApprove}
              disabled={acting}
              className="bg-green-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {acting ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={handleRequestChanges}
              disabled={acting}
              className="bg-orange-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              Request Changes
            </button>
            <button
              onClick={handleReject}
              disabled={acting}
              className="border border-red-300 text-red-600 px-6 py-2 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Reject
            </button>
            <button
              onClick={async () => {
                if (!comment.trim()) return;
                setActing(true);
                setError('');
                try {
                  await addReviewComment(id!, comment.trim());
                  setComment('');
                  await loadCR();
                } catch (err: any) {
                  setError(err.message || 'Failed to add comment');
                } finally {
                  setActing(false);
                }
              }}
              disabled={acting || !comment.trim()}
              className="border border-slate-200 text-slate-600 px-6 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Comment Only
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
