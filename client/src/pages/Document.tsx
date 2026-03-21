import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import {
  getDocument, updateDocument, saveVersion, getVersionHistory, getRedline,
  createDraft, getDraftDocument, saveDraftVersion,
  submitChangeRequest, getDraftChanges, listCategories,
  listDocumentPdfs, getDocumentPdfUrl, listChangeRequests,
} from '../lib/api';
import DocumentEditor from '../components/DocumentEditor';
import RedlineViewer from '../components/RedlineViewer';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../lib/auth';
import { formatRevision } from '../../../src/shared/types';

type Tab = 'view' | 'edit' | 'pdf' | 'history' | 'redline';

export default function Document() {
  const { '*': encodedPath } = useParams();
  const docPath = encodedPath ? decodeURIComponent(encodedPath) : '';
  const [searchParams, setSearchParams] = useSearchParams();

  const { companySettings } = useAuth();

  // Draft mode
  const draftBranch = searchParams.get('draft') || '';
  const isDraft = !!draftBranch;

  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [versions, setVersions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>(draftBranch ? 'edit' : 'view');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Document metadata
  const [docTitle, setDocTitle] = useState('');
  const [revLabel, setRevLabel] = useState('');
  const [revDate, setRevDate] = useState('');
  const [categoryName, setCategoryName] = useState('');

  // PDF state
  const [pdfs, setPdfs] = useState<Array<{ path: string; filename: string; revision: string }>>([]);
  const [selectedPdf, setSelectedPdf] = useState('');
  const [loadingPdfs, setLoadingPdfs] = useState(false);

  // Redline state
  const [redlineFrom, setRedlineFrom] = useState('');
  const [redlineTo, setRedlineTo] = useState('');
  const [redlineData, setRedlineData] = useState<any>(null);
  const [loadingRedline, setLoadingRedline] = useState(false);

  // Draft actions
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [draftFromRev, setDraftFromRev] = useState<number | null>(null);
  const [lastDraftBranch, setLastDraftBranch] = useState('');
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Document lock state (locked when in_review)
  const [activeCR, setActiveCR] = useState<any>(null);

  // Track whether user has saved a version on this draft branch
  const [hasSavedVersion, setHasSavedVersion] = useState(false);

  // Cache draft content when viewing official so we can restore it
  const [cachedDraftContent, setCachedDraftContent] = useState<string | null>(null);
  const [cachedHasSavedVersion, setCachedHasSavedVersion] = useState(false);

  const hasChanges = content !== originalContent;

  const docId = docPath.split('/').pop()?.replace('.md', '') || '';
  const category = docPath.split('/')[0] || '';

  useEffect(() => {
    if (!docPath) return;
    // If returning to draft with cached content, skip reload
    if (isDraft && cachedDraftContent !== null) {
      setCachedDraftContent(null);
      return;
    }
    loadDocument();
    loadMeta();
    loadActiveCR();
    if (!isDraft) setHasSavedVersion(false);
  }, [docPath, draftBranch]);

  useEffect(() => {
    if (activeTab === 'history') loadVersions();
    if (activeTab === 'pdf') loadPdfs();
  }, [activeTab]);

  async function loadDocument() {
    setLoading(true);
    try {
      if (isDraft) {
        const doc = await getDraftDocument(draftBranch, docPath);
        setContent(doc.content);
        setOriginalContent(doc.content);
      } else {
        const doc = await getDocument(docPath);
        setContent(doc.content);
        setOriginalContent(doc.content);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMeta() {
    try {
      // Load version history to get rev info
      const { versions: vList } = await getVersionHistory(docPath);
      setVersions(vList);
      if (vList.length > 0) {
        const revIndex = vList.length - 1;
        setRevLabel(formatRevision(revIndex, companySettings.revision_format, companySettings.revision_start));
        setRevDate(new Date(vList[0].date).toLocaleDateString());
      }
      if (vList.length >= 2) {
        setRedlineFrom(vList[1].id);
        setRedlineTo(vList[0].id);
      }

      // Extract title from content or doc ID
      // docId is like "POL-001-information-security"
      const namePart = docId.replace(/^[A-Z]+-\d+-/, '');
      setDocTitle(namePart.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

      // Load category name
      try {
        const { categories } = await listCategories();
        const cat = categories.find((c: any) => c.prefix === category);
        if (cat) setCategoryName(cat.name);
      } catch {
        // Ignore
      }
    } catch (err) {
      console.error('Failed to load metadata:', err);
    }
  }

  async function loadActiveCR() {
    try {
      const { change_requests } = await listChangeRequests();
      const active = change_requests.find(
        (cr: any) => cr.document_path === docPath && !['merged', 'rejected'].includes(cr.status)
      );
      setActiveCR(active || null);
    } catch {
      // Ignore
    }
  }

  async function loadVersions() {
    try {
      const { versions } = await getVersionHistory(docPath);
      setVersions(versions);
      if (versions.length > 0) {
        const revIndex = versions.length - 1;
        setRevLabel(formatRevision(revIndex, companySettings.revision_format, companySettings.revision_start));
        setRevDate(new Date(versions[0].date).toLocaleDateString());
      }
      if (versions.length >= 2) {
        setRedlineFrom(versions[1].id);
        setRedlineTo(versions[0].id);
      }
    } catch (err) {
      console.error('Failed to load versions:', err);
    }
  }

  async function loadPdfs() {
    setLoadingPdfs(true);
    try {
      const { pdfs: pdfList } = await listDocumentPdfs(docId);
      setPdfs(pdfList);
      if (pdfList.length > 0 && !selectedPdf) {
        setSelectedPdf(pdfList[pdfList.length - 1].path);
      }
    } catch (err) {
      console.error('Failed to load PDFs:', err);
    } finally {
      setLoadingPdfs(false);
    }
  }

  async function handleSave() {
    if (!saveMessage.trim()) return;
    setSaving(true);
    try {
      if (isDraft) {
        await saveDraftVersion(draftBranch, docPath, saveMessage, content);
      } else {
        await updateDocument(docPath, content);
        await saveVersion(docPath, saveMessage);
      }
      setOriginalContent(content);
      setShowSaveDialog(false);
      setSaveMessage('');
      setHasSavedVersion(true);
      await loadVersions();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDraft() {
    setCreatingDraft(true);
    setError('');
    try {
      const { draft } = await createDraft(docPath, `Working draft for ${docId}`);
      setDraftFromRev(draft.from_revision || null);
      setActiveTab('edit');
      setSearchParams({ draft: draft.name });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingDraft(false);
    }
  }

  async function handleSubmitForReview() {
    if (!submitTitle.trim()) return;
    setSubmitting(true);
    try {
      if (hasChanges) {
        await saveDraftVersion(draftBranch, docPath, 'Pre-submission save', content);
        setOriginalContent(content);
      }

      await submitChangeRequest(
        submitTitle,
        submitDescription,
        draftBranch,
        category,
        docPath,
      );
      setShowSubmitDialog(false);
      setSearchParams({});
      setActiveTab('view');
      setLastDraftBranch('');
      await loadDocument();
      await loadMeta();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRedline() {
    if (isDraft) {
      setLoadingRedline(true);
      try {
        const { redline } = await getDraftChanges(draftBranch);
        setRedlineData(redline);
      } catch (err) {
        console.error('Failed to load redline:', err);
      } finally {
        setLoadingRedline(false);
      }
      return;
    }

    if (!redlineFrom || !redlineTo) return;
    setLoadingRedline(true);
    try {
      const { redline } = await getRedline(docPath, redlineFrom, redlineTo);
      setRedlineData(redline);
    } catch (err) {
      console.error('Failed to load redline:', err);
    } finally {
      setLoadingRedline(false);
    }
  }

  function handleExitDraft() {
    setLastDraftBranch(draftBranch);
    setCachedDraftContent(content);
    setCachedHasSavedVersion(hasSavedVersion);
    setActiveTab('view');
    setSearchParams({});
  }

  function handleReturnToDraft() {
    if (lastDraftBranch) {
      // Restore cached draft content immediately to avoid reload race conditions
      if (cachedDraftContent !== null) {
        setContent(cachedDraftContent);
        setOriginalContent(cachedDraftContent);
        setHasSavedVersion(cachedHasSavedVersion);
      }
      setActiveTab('edit');
      setSearchParams({ draft: lastDraftBranch });
    }
  }

  if (loading) {
    return <div className="text-slate-500">Loading document...</div>;
  }

  if (error && !content && loading === false) {
    return (
      <div className="text-center py-16">
        <p className="text-red-600">{error}</p>
        <Link to="/library" className="text-blue-500 mt-4 inline-block">Back to Library</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error banner (dismissible) */}
      {error && content && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600 text-sm font-medium">Dismiss</button>
        </div>
      )}

      {/* Document Lock Banner */}
      {!isDraft && activeCR && activeCR.status === 'in_review' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-blue-500">&#128274;</span>
              <span className="font-semibold text-blue-900">Document Locked — In Review</span>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              This document cannot be edited while the change request "{activeCR.title}" is being reviewed.
            </p>
          </div>
          <Link
            to={`/changes/${activeCR.id}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex-shrink-0"
          >
            View Change Request
          </Link>
        </div>
      )}

      {/* Changes Requested Banner */}
      {!isDraft && activeCR && activeCR.status === 'changes_requested' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-orange-500">&#8634;</span>
              <span className="font-semibold text-orange-900">Changes Requested</span>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              A reviewer has requested changes on "{activeCR.title}". The document is unlocked for editing.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              to={`/changes/${activeCR.id}`}
              className="border border-orange-300 text-orange-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors"
            >
              View Feedback
            </Link>
            <Link
              to={`/document/${docPath}?draft=${encodeURIComponent(activeCR.branch_name)}`}
              className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-700 transition-colors"
            >
              Edit Document
            </Link>
          </div>
        </div>
      )}

      {/* Return to Draft Banner */}
      {!isDraft && lastDraftBranch && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-blue-600">You have a working draft in progress.</p>
          <button
            onClick={handleReturnToDraft}
            className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
          >
            Return to Draft
          </button>
        </div>
      )}

      {/* Draft Banner */}
      {isDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-6 py-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="font-semibold text-amber-900">Working Draft</span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              You are editing a working draft{draftFromRev ? ` (from Rev ${formatRevision(draftFromRev - 1, companySettings.revision_format, companySettings.revision_start)})` : ''}. Changes are saved separately from the official version.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExitDraft}
              className="text-sm text-amber-700 hover:text-amber-900 font-medium"
            >
              View Official
            </button>
            <div className="relative group">
              <button
                onClick={() => {
                  setSubmitTitle(`Update ${docId}`);
                  setShowSubmitDialog(true);
                }}
                disabled={!hasSavedVersion}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Submit for Review
              </button>
              {!hasSavedVersion && (
                <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  Save a version before submitting for review
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Navigation header */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-3">
          <Link to="/library" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            <span>&larr;</span> Back
          </Link>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'edit' && hasChanges && (
            <span className="text-sm text-amber-600 font-medium">Unsaved changes</span>
          )}
          {!isDraft && !activeCR && (
            <button
              onClick={handleCreateDraft}
              disabled={creatingDraft}
              className="border border-blue-500 text-blue-500 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 disabled:opacity-50 transition-colors"
            >
              {creatingDraft ? 'Creating...' : 'Edit'}
            </button>
          )}
          {activeTab === 'edit' && (
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!hasChanges}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Save Version
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 pb-px">
        {([
          ...(!isDraft ? [{ id: 'view' as Tab, label: 'View' }] : []),
          ...(isDraft ? [{ id: 'edit' as Tab, label: 'Edit' }] : []),
          // { id: 'pdf' as Tab, label: 'PDF' },
          { id: 'history' as Tab, label: 'Revision History' },
          { id: 'redline' as Tab, label: isDraft ? 'Draft Redline' : 'Redline' },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              if (tab.id === 'history') loadVersions();
            }}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-blue-600 border border-slate-200 border-b-white -mb-px'
                : 'text-slate-500 hover:text-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'view' && (
        <div className="space-y-6">
          {/* Document cover header */}
          <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden">
            <div className="bg-slate-50 border-b-2 border-slate-200 px-8 py-5">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                {categoryName || category}
              </div>
              <h2 className="text-xl font-bold text-slate-800">{docTitle || docId}</h2>
            </div>
            <div className="grid grid-cols-4 divide-x-2 divide-slate-300">
              <div className="px-6 py-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Document ID</div>
                <div className="text-sm font-mono font-bold text-slate-800">{docId.split('-').slice(0, 2).join('-')}</div>
              </div>
              <div className="px-6 py-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Revision</div>
                <div className="text-sm font-mono font-bold text-blue-600">{revLabel || '-'}</div>
              </div>
              <div className="px-6 py-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Revision Date</div>
                <div className="text-sm font-medium text-slate-800">{revDate || '-'}</div>
              </div>
              <div className="px-6 py-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Status</div>
                <div className="text-sm">
                  <StatusBadge status={isDraft ? 'Working Draft' : 'Official'} />
                </div>
              </div>
            </div>
          </div>

          {/* Read-only document content */}
          <DocumentEditor
            content={content}
            editable={false}
          />
        </div>
      )}

      {activeTab === 'edit' && (
        <DocumentEditor
          content={content}
          onChange={setContent}
          editable={true}
        />
      )}

      {activeTab === 'pdf' && (
        <div className="space-y-4">
          {loadingPdfs ? (
            <div className="text-slate-500 text-sm">Loading PDFs...</div>
          ) : pdfs.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="text-slate-500 text-sm">No PDFs generated yet.</p>
              <p className="text-slate-400 text-xs mt-1">
                PDFs are automatically generated when a Change Request is approved.
              </p>
            </div>
          ) : (
            <>
              {/* Revision selector */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
                <label className="text-sm font-medium text-slate-600">Revision:</label>
                <div className="flex gap-2 flex-wrap">
                  {pdfs.map((pdf) => (
                    <button
                      key={pdf.path}
                      onClick={() => setSelectedPdf(pdf.path)}
                      className={`px-3 py-1.5 text-sm font-mono font-semibold rounded-lg border transition-colors ${
                        selectedPdf === pdf.path
                          ? 'bg-blue-50 border-blue-300 text-blue-600'
                          : 'border-slate-200 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Rev {pdf.revision}
                    </button>
                  ))}
                </div>
                {selectedPdf && (
                  <div className="ml-auto flex items-center gap-2">
                    <a
                      href={getDocumentPdfUrl(selectedPdf)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                    >
                      Open in new tab
                    </a>
                    <a
                      href={getDocumentPdfUrl(selectedPdf)}
                      download
                      className="text-xs text-slate-500 hover:text-slate-600 font-medium"
                    >
                      Download
                    </a>
                  </div>
                )}
              </div>

              {/* Embedded PDF viewer */}
              {selectedPdf && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" style={{ height: '80vh' }}>
                  <iframe
                    src={getDocumentPdfUrl(selectedPdf)}
                    className="w-full h-full border-0"
                    title="PDF Viewer"
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {versions.length === 0 ? (
            <div className="px-6 py-8 text-center text-slate-400 text-sm">No version history yet</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {versions.map((v, i) => {
                const revIndex = versions.length - 1 - i;
                const label = formatRevision(revIndex, companySettings.revision_format, companySettings.revision_start);
                return (
                  <div key={v.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-mono font-semibold text-blue-500 w-10 text-center">
                        {label}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{v.message}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {v.author.name} &middot; {new Date(v.date).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-slate-400">{v.id.slice(0, 8)}</span>
                      {i === 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'redline' && (
        <div className="space-y-4">
          {isDraft ? (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Comparing your Working Draft against the current Official Version.
                </p>
                <button
                  onClick={handleRedline}
                  disabled={loadingRedline}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {loadingRedline ? 'Loading...' : 'Generate Redline'}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">From version</label>
                  <select
                    value={redlineFrom}
                    onChange={(e) => setRedlineFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Select...</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id.slice(0, 8)} - {v.message}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">To version</label>
                  <select
                    value={redlineTo}
                    onChange={(e) => setRedlineTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">Select...</option>
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.id.slice(0, 8)} - {v.message}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleRedline}
                  disabled={!redlineFrom || !redlineTo || loadingRedline}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50 transition-colors"
                >
                  {loadingRedline ? 'Loading...' : 'Compare'}
                </button>
              </div>
            </div>
          )}

          {redlineData && <RedlineViewer changes={redlineData.changes} />}
        </div>
      )}

      {/* Save Version Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSaveDialog(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Save Version</h2>
            <p className="text-sm text-slate-500 mb-4">
              Describe what changed in this version. This becomes part of the permanent audit trail.
            </p>
            <textarea
              value={saveMessage}
              onChange={(e) => setSaveMessage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
              rows={3}
              placeholder="e.g., Updated scope section to include contractors"
              autoFocus
            />
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !saveMessage.trim()}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Version'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit for Review Dialog */}
      {showSubmitDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowSubmitDialog(false)}>
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Submit for Review</h2>
            <p className="text-sm text-slate-500 mb-4">
              Submit this Working Draft as a Change Request for approval.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  value={submitTitle}
                  onChange={(e) => setSubmitTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  placeholder="Brief description of the change"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Description (optional)</label>
                <textarea
                  value={submitDescription}
                  onChange={(e) => setSubmitDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                  rows={3}
                  placeholder="Why is this change needed?"
                />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button
                onClick={() => setShowSubmitDialog(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitForReview}
                disabled={submitting || !submitTitle.trim()}
                className="bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
