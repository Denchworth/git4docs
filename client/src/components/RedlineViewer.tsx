/**
 * Redline Viewer
 * Visual diff component showing changes between two versions.
 */

interface RedlineHunk {
  lines: Array<{ type: 'context' | 'addition' | 'deletion'; content: string }>;
}

interface RedlineChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  hunks: RedlineHunk[];
}

interface RedlineViewerProps {
  changes: RedlineChange[];
}

export default function RedlineViewer({ changes }: RedlineViewerProps) {
  if (changes.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        No changes between these versions.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {changes.map((change, i) => (
        <div key={i} className="border border-slate-200 rounded-lg overflow-hidden">
          <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center gap-3">
            <span className="font-mono text-sm text-slate-600">{change.path}</span>
            <ChangeTypeBadge type={change.type} />
          </div>
          <div className="font-mono text-sm overflow-x-auto">
            {change.hunks.map((hunk, hi) => (
              <div key={hi}>
                {hunk.lines.map((line, li) => (
                  <div
                    key={li}
                    className={`px-4 py-0.5 whitespace-pre-wrap ${
                      line.type === 'addition'
                        ? 'bg-green-50 text-green-800'
                        : line.type === 'deletion'
                          ? 'bg-red-50 text-red-800'
                          : 'text-slate-500'
                    }`}
                  >
                    <span className="inline-block w-5 text-slate-400 select-none mr-2">
                      {line.type === 'addition' ? '+' : line.type === 'deletion' ? '-' : ' '}
                    </span>
                    {line.content}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ChangeTypeBadge({ type }: { type: string }) {
  const colors = {
    added: 'bg-green-100 text-green-700',
    modified: 'bg-yellow-100 text-yellow-700',
    deleted: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[type as keyof typeof colors] || 'bg-slate-100'}`}>
      {type}
    </span>
  );
}
