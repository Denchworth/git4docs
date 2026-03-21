const statusColors: Record<string, string> = {
  Official: 'bg-green-100 text-green-800',
  'Draft In Progress': 'bg-yellow-100 text-yellow-800',
  'Under Review': 'bg-blue-100 text-blue-800',
  Approved: 'bg-emerald-100 text-emerald-800',
  'Returned for Revision': 'bg-orange-100 text-orange-800',
  'Needs Resolution': 'bg-red-100 text-red-800',
  Superseded: 'bg-slate-100 text-slate-500',
  Archived: 'bg-slate-100 text-slate-500',
  'Working Draft': 'bg-amber-100 text-amber-800',
  draft: 'bg-yellow-100 text-yellow-800',
  submitted: 'bg-blue-100 text-blue-800',
  in_review: 'bg-blue-100 text-blue-800',
  under_review: 'bg-blue-100 text-blue-800',
  changes_requested: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  merged: 'bg-purple-100 text-purple-800',
  approve: 'bg-green-100 text-green-800',
  reject: 'bg-red-100 text-red-800',
  request_changes: 'bg-orange-100 text-orange-800',
  pending: 'bg-slate-100 text-slate-500',
  dismissed: 'bg-slate-100 text-slate-500 line-through',
};

const statusLabels: Record<string, string> = {
  in_review: 'In Review',
  under_review: 'In Review',
  changes_requested: 'Changes Requested',
  request_changes: 'Requested Changes',
  merged: 'Complete',
};

export default function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status] || 'bg-slate-100 text-slate-500';
  const label = statusLabels[status] || status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {label}
    </span>
  );
}
