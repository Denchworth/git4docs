import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listDocuments, createDocument, getDocumentPermissions, listCategories } from '../lib/api';
import { useAuth } from '../lib/auth';
import { formatRevision, CATEGORY_COLORS, DEFAULT_CATEGORY_COLORS } from '../../../src/shared/types';
import type { CategoryColor } from '../../../src/shared/types';


interface CategoryInfo {
  prefix: string;
  name: string;
  color?: CategoryColor;
}

export default function Library() {
  const { companySettings } = useAuth();
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [permissions, setPermissions] = useState<Record<string, { can_create: boolean }>>({});
  const [categories, setCategories] = useState<CategoryInfo[]>([]);

  const activeCategory = searchParams.get('category') || 'All';

  useEffect(() => {
    loadCategories();
    loadPermissions();
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [activeCategory]);

  async function loadCategories() {
    try {
      const { categories } = await listCategories();
      setCategories(categories.map((c: any) => ({ prefix: c.prefix, name: c.name, color: c.color })));
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  async function loadPermissions() {
    try {
      const { permissions } = await getDocumentPermissions();
      setPermissions(permissions);
    } catch (err) {
      console.error('Failed to load permissions:', err);
    }
  }

  async function loadDocuments() {
    setLoading(true);
    try {
      const cat = activeCategory === 'All' ? undefined : activeCategory;
      const { documents } = await listDocuments(cat);
      setDocuments(documents);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleNewDocument(category: string) {
    setNewCategory(category);
    setNewTitle('');
    setCreateError('');
    setShowCreate(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      await createDocument(newCategory, newTitle);
      setShowCreate(false);
      setNewTitle('');
      await loadDocuments();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create document');
    } finally {
      setCreating(false);
    }
  }

  function getRevisionLabel(versionCount: number): string {
    if (!versionCount || versionCount <= 0) return '-';
    const index = versionCount - 1;
    return formatRevision(index, companySettings.revision_format, companySettings.revision_start);
  }

  const canCreateInActive = activeCategory !== 'All' && permissions[activeCategory]?.can_create;
  const canCreateInAny = Object.values(permissions).some((p) => p.can_create);
  const creatableCategories = categories.filter((c) => permissions[c.prefix]?.can_create);
  const firstCreatable = creatableCategories[0]?.prefix || '';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Document Library</h1>

      {/* Category tabs with inline New Document button */}
      <div className="flex items-center gap-1 border-b border-slate-200 pb-px">
        <button
          onClick={() => setSearchParams({})}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
            activeCategory === 'All'
              ? 'bg-white text-blue-600 border border-slate-200 border-b-white -mb-px'
              : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat.prefix}
            onClick={() => setSearchParams({ category: cat.prefix })}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeCategory === cat.prefix
                ? 'bg-white text-blue-600 border border-slate-200 border-b-white -mb-px'
                : 'text-slate-500 hover:text-slate-600'
            }`}
          >
            {cat.prefix}
          </button>
        ))}
        <div className="ml-auto">
          {activeCategory === 'All' ? (
            canCreateInAny && (
              <button
                onClick={() => handleNewDocument(firstCreatable)}
                className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                + New Document
              </button>
            )
          ) : (
            canCreateInActive && (
              <button
                onClick={() => handleNewDocument(activeCategory)}
                className="bg-blue-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                + New {activeCategory}
              </button>
            )
          )}
        </div>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="text-slate-500">Loading documents...</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-lg">No documents yet</p>
          <p className="text-sm mt-1">Create your first document to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-3">Document</th>
                <th className="px-6 py-3">Category</th>
                <th className="px-6 py-3 text-center">Rev</th>
                <th className="px-6 py-3 text-center">Last Modified</th>
                <th className="px-6 py-3 text-center">Modified By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <tr key={doc.path} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      to={`/document/${encodeURIComponent(doc.path)}`}
                      className="text-slate-800 hover:text-slate-600 font-medium text-sm"
                    >
                      {doc.document_id}
                    </Link>
                    <div className="text-xs text-slate-400 mt-0.5">{doc.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const catInfo = categories.find((c) => c.prefix === doc.category);
                      const colorKey = catInfo?.color || DEFAULT_CATEGORY_COLORS[doc.category] || 'gray';
                      const c = CATEGORY_COLORS[colorKey];
                      return (
                        <>
                          <span className={`text-xs font-mono px-2 py-0.5 rounded font-semibold ${c.bg} ${c.text}`}>{doc.category}</span>
                          {catInfo?.name && <span className={`ml-1.5 text-[10px] font-medium ${c.text} opacity-70`}>{catInfo.name.toUpperCase()}</span>}
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm font-mono font-medium text-slate-600">
                      {getRevisionLabel(doc.version_count)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 text-center">
                    {new Date(doc.last_modified).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 text-center">{doc.last_modified_by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create dialog */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">New Document</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              {activeCategory === 'All' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {creatableCategories.map((cat) => (
                      <option key={cat.prefix} value={cat.prefix}>
                        {cat.prefix} - {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Category</label>
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 font-mono">
                    {newCategory}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Information Security"
                  required
                />
              </div>
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
