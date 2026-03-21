import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  listPlatformUsers, createPlatformUser,
  previewMatch, getCompanySettings, updateCompanySettings, listCategories, updateCategories,
  getPdfTemplates, updatePdfTemplates, uploadLogo,
} from '../lib/api';
import { formatRevision, CATEGORY_COLORS, DEFAULT_CATEGORY_COLORS } from '../../../src/shared/types';
import type { RevisionFormat, CategoryColor } from '../../../src/shared/types';

type AdminTab = 'settings' | 'categories' | 'pdf-templates' | 'platform-users' | 'preview-match';

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState<AdminTab>('settings');

  if (!user || user.type !== 'platform') return null;

  const companyId = user.company_id;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Administration</h1>

      <div className="flex gap-1 border-b border-slate-200 pb-px">
        {[
          { id: 'settings' as AdminTab, label: 'Settings' },
          { id: 'categories' as AdminTab, label: 'Categories' },
          { id: 'pdf-templates' as AdminTab, label: 'PDF Templates' },
          { id: 'platform-users' as AdminTab, label: 'Platform Users' },
          { id: 'preview-match' as AdminTab, label: 'Preview Match' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.id
                ? 'bg-white text-blue-600 border border-slate-200 border-b-white -mb-px'
                : 'text-slate-500 hover:text-slate-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'settings' && <SettingsPanel companyId={companyId} />}
      {tab === 'categories' && <CategoriesPanel />}
      {tab === 'pdf-templates' && <PdfTemplatesPanel />}
      {tab === 'platform-users' && <PlatformUsersPanel companyId={companyId} isOwner={user.role === 'owner'} />}
      {tab === 'preview-match' && <PreviewMatchPanel companyId={companyId} />}
    </div>
  );
}

// ============================================================
// CATEGORIES PANEL
// ============================================================

interface CategoryForm {
  prefix: string;
  name: string;
  description: string;
  color?: CategoryColor;
  workflow: string;
  numbering: string;
  review_cycle_months: number;
  roles: {
    viewer: { match: any };
    editor: { match: any };
    approver: { match: any };
    creator?: { match: any };
  };
}

function emptyCategory(): CategoryForm {
  return {
    prefix: '',
    name: '',
    description: '',
    color: 'gray',
    workflow: 'sop-review',
    numbering: 'sequential',
    review_cycle_months: 12,
    roles: {
      viewer: { match: { all: true } },
      editor: { match: { all: true } },
      approver: { match: { all: true } },
      creator: { match: { all: true } },
    },
  };
}

function CategoriesPanel() {
  const [categories, setCategories] = useState<CategoryForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CategoryForm>(emptyCategory());
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { categories } = await listCategories();
      setCategories(categories);
    } catch (err) {
      console.error('Failed to load categories:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(updated: CategoryForm[]) {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const { categories: saved } = await updateCategories(updated);
      setCategories(saved);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save categories');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(index: number) {
    setEditingIndex(index);
    setEditForm({ ...categories[index] });
    setShowAdd(false);
  }

  function startAdd() {
    setEditForm(emptyCategory());
    setShowAdd(true);
    setEditingIndex(null);
  }

  function cancelEdit() {
    setEditingIndex(null);
    setShowAdd(false);
  }

  async function saveEdit() {
    if (!editForm.prefix || !editForm.name) {
      setError('Prefix and name are required');
      return;
    }
    if (!/^[A-Z]{2,5}$/.test(editForm.prefix)) {
      setError('Prefix must be 2-5 uppercase letters');
      return;
    }

    let updated: CategoryForm[];
    if (showAdd) {
      // Check for duplicate prefix
      if (categories.some((c) => c.prefix === editForm.prefix)) {
        setError(`Category "${editForm.prefix}" already exists`);
        return;
      }
      updated = [...categories, editForm];
    } else if (editingIndex !== null) {
      updated = categories.map((c, i) => (i === editingIndex ? editForm : c));
    } else {
      return;
    }

    await handleSave(updated);
    setEditingIndex(null);
    setShowAdd(false);
  }

  async function handleDelete(index: number) {
    const cat = categories[index];
    if (!confirm(`Delete category "${cat.prefix} - ${cat.name}"? Existing documents in this category will not be removed.`)) return;
    const updated = categories.filter((_, i) => i !== index);
    await handleSave(updated);
  }

  if (loading) return <div className="text-slate-500">Loading categories...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Document categories define document types, numbering, and role-based access rules.
        </p>
        <button
          onClick={startAdd}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600"
        >
          + Add Category
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600 font-medium">Categories saved</p>}

      {/* Category list */}
      <div className="space-y-3">
        {categories.map((cat, index) => (
          <div key={cat.prefix} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            {editingIndex === index ? (
              <CategoryEditor
                form={editForm}
                onChange={setEditForm}
                onSave={saveEdit}
                onCancel={cancelEdit}
                saving={saving}
                isNew={false}
              />
            ) : (
              <div className="p-4 flex items-center gap-4">
                <div className="flex-shrink-0">
                  {(() => {
                    const c = CATEGORY_COLORS[cat.color || DEFAULT_CATEGORY_COLORS[cat.prefix] || 'gray'];
                    return (
                      <span className={`inline-flex items-center justify-center w-14 h-10 rounded-lg font-mono font-bold text-sm ${c.bg} ${c.text}`}>
                        {cat.prefix}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800 text-sm">{cat.name}</div>
                  <div className="text-xs text-slate-500 truncate">{cat.description}</div>
                </div>
                <div className="text-xs text-slate-400 flex gap-4">
                  <span>Workflow: {cat.workflow}</span>
                  <span>Review: {cat.review_cycle_months}mo</span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => startEdit(index)}
                    className="px-3 py-1.5 text-xs font-medium text-blue-500 hover:text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(index)}
                    className="px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add new category form */}
      {showAdd && (
        <div className="bg-white rounded-xl border-2 border-blue-200 overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <span className="text-sm font-semibold text-blue-600">New Category</span>
          </div>
          <CategoryEditor
            form={editForm}
            onChange={setEditForm}
            onSave={saveEdit}
            onCancel={cancelEdit}
            saving={saving}
            isNew={true}
          />
        </div>
      )}
    </div>
  );
}

function CategoryEditor({
  form,
  onChange,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  form: CategoryForm;
  onChange: (f: CategoryForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  isNew: boolean;
}) {
  function updateRole(role: 'viewer' | 'editor' | 'approver' | 'creator', json: string) {
    try {
      const match = JSON.parse(json);
      onChange({
        ...form,
        roles: {
          ...form.roles,
          [role]: { match },
        },
      });
    } catch {
      // Don't update on invalid JSON
    }
  }

  function getRoleJson(role: 'viewer' | 'editor' | 'approver' | 'creator'): string {
    const r = form.roles[role];
    return r ? JSON.stringify(r.match, null, 2) : '{ "all": true }';
  }

  return (
    <div className="p-4 space-y-4">
      {/* Row 1: Prefix, Name, Description */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Prefix</label>
          <input
            type="text"
            value={form.prefix}
            onChange={(e) => onChange({ ...form, prefix: e.target.value.toUpperCase() })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="POL"
            maxLength={5}
            disabled={!isNew}
          />
        </div>
        <div className="col-span-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => onChange({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Policy"
          />
        </div>
        <div className="col-span-6">
          <label className="block text-xs font-medium text-slate-500 mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Company-wide policies requiring executive approval"
          />
        </div>
      </div>

      {/* Row 2: Color */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">Color</label>
        <div className="flex gap-2">
          {(Object.keys(CATEGORY_COLORS) as CategoryColor[]).map((color) => {
            const c = CATEGORY_COLORS[color];
            const isSelected = (form.color || DEFAULT_CATEGORY_COLORS[form.prefix] || 'gray') === color;
            return (
              <button
                key={color}
                type="button"
                onClick={() => onChange({ ...form, color })}
                className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${c.bg} ${c.text} ${
                  isSelected ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : 'opacity-60 hover:opacity-100'
                }`}
                title={color}
              >
                {isSelected ? '\u2713' : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* Row 3: Workflow, Review Cycle */}
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-4">
          <label className="block text-xs font-medium text-slate-500 mb-1">Workflow</label>
          <input
            type="text"
            value={form.workflow}
            onChange={(e) => onChange({ ...form, workflow: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="sop-review"
          />
        </div>
        <div className="col-span-3">
          <label className="block text-xs font-medium text-slate-500 mb-1">Review Cycle (months)</label>
          <input
            type="number"
            value={form.review_cycle_months}
            onChange={(e) => onChange({ ...form, review_cycle_months: parseInt(e.target.value) || 12 })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            min={1}
          />
        </div>
      </div>

      {/* Row 3: Roles */}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-2">Role Match Rules</label>
        <div className="grid grid-cols-2 gap-3">
          {(['viewer', 'editor', 'creator', 'approver'] as const).map((role) => (
            <RoleMatchEditor
              key={role}
              role={role}
              value={getRoleJson(role)}
              onChange={(json) => updateRole(role, json)}
            />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
        >
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : isNew ? 'Add Category' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

function RoleMatchEditor({
  role,
  value,
  onChange,
}: {
  role: string;
  value: string;
  onChange: (json: string) => void;
}) {
  const [text, setText] = useState(value);
  const [valid, setValid] = useState(true);

  function handleChange(newText: string) {
    setText(newText);
    try {
      JSON.parse(newText);
      setValid(true);
      onChange(newText);
    } catch {
      setValid(false);
    }
  }

  const label = role === 'creator' ? 'Creator' : role.charAt(0).toUpperCase() + role.slice(1);
  const hint =
    role === 'viewer' ? 'Who can view documents' :
    role === 'editor' ? 'Who can edit documents' :
    role === 'creator' ? 'Who can create new documents' :
    'Who can approve changes';

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-600">{label}</span>
        <span className="text-xs text-slate-400">{hint}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        className={`w-full px-3 py-2 border rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 ${
          valid ? 'border-slate-200' : 'border-red-300 bg-red-50'
        }`}
        rows={3}
        spellCheck={false}
      />
    </div>
  );
}

// ============================================================
// PDF TEMPLATES PANEL
// ============================================================

const MERGE_FIELDS = [
  { field: '{{DOC_ID}}', desc: 'Document ID (e.g. POL-001)' },
  { field: '{{DOC_TITLE}}', desc: 'Document title' },
  { field: '{{CATEGORY}}', desc: 'Category name' },
  { field: '{{REVISION}}', desc: 'Revision label' },
  { field: '{{REVISION_DATE}}', desc: 'Date of revision' },
  { field: '{{EFFECTIVE_DATE}}', desc: 'Effective date' },
  { field: '{{APPROVED_BY}}', desc: 'Approver name' },
  { field: '{{COMPANY_NAME}}', desc: 'Company name' },
  { field: '{{PAGE_NUMBER}}', desc: 'Current page' },
  { field: '{{TOTAL_PAGES}}', desc: 'Total pages' },
];

function PdfTemplatesPanel() {
  const [headerHtml, setHeaderHtml] = useState('');
  const [footerHtml, setFooterHtml] = useState('');
  const [pageSize, setPageSize] = useState<'letter' | 'a4'>('letter');
  const [margins, setMargins] = useState({ top: '80px', bottom: '60px', left: '60px', right: '60px' });
  const [logoPath, setLogoPath] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { templates } = await getPdfTemplates();
      setHeaderHtml(templates.header_html || '');
      setFooterHtml(templates.footer_html || '');
      setPageSize(templates.page_size || 'letter');
      setMargins(templates.margins || { top: '80px', bottom: '60px', left: '60px', right: '60px' });
      setLogoPath(templates.logo_path);
    } catch (err) {
      console.error('Failed to load PDF templates:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await updatePdfTemplates({
        header_html: headerHtml,
        footer_html: footerHtml,
        page_size: pageSize,
        margins,
        ...(logoPath ? { logo_path: logoPath } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save templates');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        const { logo_path } = await uploadLogo(base64, file.name);
        setLogoPath(logo_path);
      } catch (err: any) {
        setError(err.message || 'Failed to upload logo');
      }
    };
    reader.readAsDataURL(file);
  }

  if (loading) return <div className="text-slate-500">Loading PDF templates...</div>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-500">
        Configure the header and footer that appear on generated PDF documents. Use merge fields to insert dynamic content.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600 font-medium">Templates saved</p>}

      {/* Merge fields reference */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
        <div className="text-xs font-medium text-slate-500 uppercase mb-2">Available Merge Fields</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {MERGE_FIELDS.map((mf) => (
            <div key={mf.field} className="flex items-center gap-2 text-xs">
              <code className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-mono text-blue-500">{mf.field}</code>
              <span className="text-slate-500">{mf.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Header template */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Header Template</h2>
        <p className="text-xs text-slate-500">HTML displayed at the top of every page. Use inline CSS for styling.</p>
        <textarea
          value={headerHtml}
          onChange={(e) => setHeaderHtml(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          rows={6}
          spellCheck={false}
        />
      </div>

      {/* Footer template */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Footer Template</h2>
        <p className="text-xs text-slate-500">HTML displayed at the bottom of every page.</p>
        <textarea
          value={footerHtml}
          onChange={(e) => setFooterHtml(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-400"
          rows={6}
          spellCheck={false}
        />
      </div>

      {/* Page settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Page Settings</h2>

        <div className="grid grid-cols-12 gap-4">
          {/* Page size */}
          <div className="col-span-4">
            <label className="block text-xs font-medium text-slate-500 mb-1">Page Size</label>
            <div className="flex gap-2">
              {(['letter', 'a4'] as const).map((size) => (
                <label
                  key={size}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                    pageSize === size ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="page_size"
                    checked={pageSize === size}
                    onChange={() => setPageSize(size)}
                    className="text-blue-500"
                  />
                  {size === 'letter' ? 'US Letter' : 'A4'}
                </label>
              ))}
            </div>
          </div>

          {/* Margins */}
          <div className="col-span-8">
            <label className="block text-xs font-medium text-slate-500 mb-1">Margins</label>
            <div className="grid grid-cols-4 gap-2">
              {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                <div key={side}>
                  <label className="block text-xs text-slate-400 mb-0.5 capitalize">{side}</label>
                  <input
                    type="text"
                    value={margins[side]}
                    onChange={(e) => setMargins({ ...margins, [side]: e.target.value })}
                    className="w-full px-2 py-1.5 border border-slate-200 rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Logo upload */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Company Logo</h2>
        <p className="text-xs text-slate-500">
          Upload a logo to use in PDF headers. PNG, JPG, or SVG format. Reference it in header HTML as an img tag.
        </p>
        <div className="flex items-center gap-4">
          {logoPath && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-mono">
                {logoPath}
              </span>
            </div>
          )}
          <label className="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {logoPath ? 'Replace Logo' : 'Upload Logo'}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.svg"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save Templates'}
        </button>
        {saved && <span className="text-sm text-green-600 font-medium">Templates saved</span>}
      </div>
    </div>
  );
}

// ============================================================
// SETTINGS PANEL
// ============================================================

function SettingsPanel({ companyId }: { companyId: string }) {
  const { refreshSettings } = useAuth();
  const [revisionFormat, setRevisionFormat] = useState<RevisionFormat>('number');
  const [revisionStart, setRevisionStart] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { company } = await getCompanySettings(companyId);
      setRevisionFormat(company.revision_format || 'number');
      setRevisionStart(company.revision_start ?? 1);
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await updateCompanySettings(companyId, {
        revision_format: revisionFormat,
        revision_start: revisionStart,
      });
      await refreshSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }

  const previewExamples = [0, 1, 2, 3, 4].map((i) =>
    formatRevision(i, revisionFormat, revisionStart)
  );

  if (loading) return <div className="text-slate-500">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-semibold text-slate-800 mb-4">Revision Numbering</h2>
        <p className="text-sm text-slate-500 mb-6">
          Choose how document revisions are labeled throughout the system.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-2">Format</label>
            <div className="space-y-2">
              {[
                { value: 'letter' as RevisionFormat, label: 'Letters', example: 'A, B, C, D, ...' },
                { value: 'number' as RevisionFormat, label: 'Numbers', example: '1, 2, 3, 4, ...' },
                { value: 'padded' as RevisionFormat, label: 'Padded Numbers', example: '01, 02, 03, 04, ...' },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    revisionFormat === opt.value
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="revision_format"
                    value={opt.value}
                    checked={revisionFormat === opt.value}
                    onChange={() => setRevisionFormat(opt.value)}
                    className="text-blue-500"
                  />
                  <div>
                    <div className="text-sm font-medium text-slate-800">{opt.label}</div>
                    <div className="text-xs text-slate-500">{opt.example}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {revisionFormat !== 'letter' && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-2">Start From</label>
              <div className="flex gap-3">
                {[0, 1].map((val) => (
                  <label
                    key={val}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                      revisionStart === val
                        ? 'border-blue-300 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="revision_start"
                      value={val}
                      checked={revisionStart === val}
                      onChange={() => setRevisionStart(val)}
                      className="text-blue-500"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      {revisionFormat === 'padded'
                        ? val.toString().padStart(2, '0')
                        : val}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="bg-slate-50 rounded-lg p-4">
            <div className="text-xs font-medium text-slate-500 uppercase mb-2">Preview</div>
            <div className="flex items-center gap-2">
              {previewExamples.map((label, i) => (
                <span key={i} className="inline-flex items-center justify-center w-10 h-8 rounded bg-white border border-slate-200 text-sm font-mono font-semibold text-blue-500">
                  {label}
                </span>
              ))}
              <span className="text-slate-400 text-sm">...</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              First 5 revisions shown. The first version of a document is Rev {previewExamples[0]}.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium">Settings saved</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PLATFORM USERS PANEL
// ============================================================

function PlatformUsersPanel({ companyId, isOwner }: { companyId: string; isOwner: boolean }) {
  const [users, setUsers] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [userId, setUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const { users } = await listPlatformUsers(companyId);
    setUsers(users);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      await createPlatformUser(companyId, userId);
      setShowAdd(false);
      setUserId('');
      await load();
    } catch (err: any) {
      setAddError(err.message || 'Failed to add admin');
    } finally { setAdding(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">
          Platform users manage git4docs configuration. Admins sign in via SSO.
        </p>
        {isOwner && (
          <button onClick={() => { setShowAdd(true); setAddError(''); setUserId(''); }} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600">
            + Add Admin
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
            <th className="px-6 py-3">Name</th><th className="px-6 py-3">Email</th><th className="px-6 py-3">Role</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id}><td className="px-6 py-4 text-sm">{u.name}</td><td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                <td className="px-6 py-4"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.role === 'owner' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{u.role}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Add Admin</h2>
            <p className="text-sm text-slate-500 mb-4">Enter the email of an existing document user to grant them admin access. They will sign in via SSO.</p>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">User ID (email)</label>
                <input type="email" value={userId} onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="user@company.com" required />
              </div>
              {addError && <p className="text-sm text-red-600">{addError}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
                <button type="submit" disabled={adding} className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50">
                  {adding ? 'Adding...' : 'Add Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PREVIEW MATCH PANEL
// ============================================================

function PreviewMatchPanel({ companyId }: { companyId: string }) {
  const [matchJson, setMatchJson] = useState('{\n  "all": true\n}');
  const [results, setResults] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleTest() {
    setError('');
    setLoading(true);
    try {
      const match = JSON.parse(matchJson);
      const data = await previewMatch(companyId, match);
      setResults(data.matched_users);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">
        Test match rules to see which users resolve. Useful when editing workflow YAML.
      </p>

      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <label className="block text-sm font-medium text-slate-600 mb-2">Match Rule (JSON)</label>
        <textarea
          value={matchJson}
          onChange={(e) => setMatchJson(e.target.value)}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          rows={6}
        />
        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
        <button
          onClick={handleTest}
          disabled={loading}
          className="mt-3 bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Testing...' : 'Test Match Rule'}
        </button>
      </div>

      {results !== null && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold mb-3">{results.length} user(s) matched</h3>
          {results.length === 0 ? (
            <p className="text-sm text-slate-500">No users match this rule.</p>
          ) : (
            <div className="space-y-2">
              {results.map((u: any) => (
                <div key={u.email} className="flex items-center gap-4 text-sm">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-slate-500">{u.email}</span>
                  <span className="text-slate-400">{u.department}</span>
                  <span className="text-slate-400">{u.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
