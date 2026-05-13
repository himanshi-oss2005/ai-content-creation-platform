import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { templateApi } from '../api/content';
import { useToast } from '../context/ToastContext';
import { CONTENT_TYPES, TONES, LENGTHS, typeIcon, typeLabel } from '../utils/contentTypes';

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE_LABELS = Object.fromEntries(TONES.map((t) => [t.value, `${t.emoji} ${t.label}`]));
const LENGTH_LABELS = Object.fromEntries(LENGTHS.map((l) => [l.value, `${l.icon} ${l.label}`]));

const TYPE_COLORS = {
  blog:                'bg-blue-50   dark:bg-blue-900/20   text-blue-700   dark:text-blue-300   border-blue-100   dark:border-blue-800',
  ad:                  'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 border-orange-100 dark:border-orange-800',
  caption:             'bg-pink-50   dark:bg-pink-900/20   text-pink-700   dark:text-pink-300   border-pink-100   dark:border-pink-800',
  product_description: 'bg-green-50  dark:bg-green-900/20  text-green-700  dark:text-green-300  border-green-100  dark:border-green-800',
  email:               'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800',
  tagline:             'bg-amber-50  dark:bg-amber-900/20  text-amber-700  dark:text-amber-300  border-amber-100  dark:border-amber-800',
};

const EMPTY_FORM = {
  name: '', description: '', type: 'blog', tone: 'professional',
  length: 'medium', prompt: '',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${TYPE_COLORS[type] ?? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
      {typeIcon(type)} {typeLabel(type)}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5" />
      <div className="flex gap-2 pt-1">
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-20" />
        <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-lg w-16" />
      </div>
    </div>
  );
}

/** Single template card — used for both system and custom templates */
function TemplateCard({ template, isSystem, onUse, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await onDelete(template._id);
    setDeleting(false);
  }

  return (
    <div className="card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug truncate">
              {template.name}
            </h3>
            {isSystem && (
              <span className="inline-flex items-center px-1.5 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded text-[10px] font-bold uppercase tracking-wide shrink-0">
                System
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
              {template.description}
            </p>
          )}
        </div>
        <TypeBadge type={template.type} />
      </div>

      {/* Prompt preview */}
      <div className="px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 font-mono">
          {template.prompt}
        </p>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-400">
        <span>{TONE_LABELS[template.tone] ?? template.tone}</span>
        <span className="text-gray-200 dark:text-gray-700">·</span>
        <span>{LENGTH_LABELS[template.length] ?? template.length}</span>
        {template.usageCount > 0 && (
          <>
            <span className="text-gray-200 dark:text-gray-700">·</span>
            <span>Used {template.usageCount}×</span>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onUse(template)}
          className="btn-primary text-xs py-1.5 px-3 flex-1"
        >
          ✨ Use Template
        </button>
        {!isSystem && (
          <>
            <button
              onClick={() => onEdit(template)}
              className="btn-secondary text-xs py-1.5 px-3"
              title="Edit template"
            >
              ✏️ Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors disabled:opacity-40"
              title="Delete template"
            >
              {deleting ? <span className="spinner text-red-400" /> : '🗑️'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Create / Edit modal */
function TemplateModal({ initial, onSave, onClose, saving }) {
  const isEdit = !!initial?._id;
  const [form, setForm] = useState(initial ?? EMPTY_FORM);
  const [errors, setErrors] = useState({});

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: '' }));
  }

  function validate() {
    const e = {};
    if (!form.name.trim())   e.name   = 'Name is required';
    if (!form.prompt.trim()) e.prompt = 'Prompt is required';
    if (form.prompt.length > 500) e.prompt = 'Prompt must be under 500 characters';
    if (form.name.length > 100)   e.name   = 'Name must be under 100 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg card p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? '✏️ Edit Template' : '➕ New Template'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Template Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. SEO Blog Post"
              className="input-field text-sm"
              maxLength={100}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Description
              <span className="ml-1 text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="Short description of what this template does"
              className="input-field text-sm"
              maxLength={300}
            />
          </div>

          {/* Type + Tone row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Content Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.type}
                onChange={(e) => set('type', e.target.value)}
                className="input-field text-sm py-2.5"
              >
                {CONTENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.icon} {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Tone
              </label>
              <select
                value={form.tone}
                onChange={(e) => set('tone', e.target.value)}
                className="input-field text-sm py-2.5"
              >
                {TONES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.emoji} {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Length */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Default Length
            </label>
            <div className="flex gap-2">
              {LENGTHS.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => set('length', l.value)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                    form.length === l.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                  }`}
                >
                  <span className="text-base">{l.icon}</span>
                  <span>{l.label}</span>
                  <span className="text-[10px] text-gray-400 font-normal">{l.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Prompt Template <span className="text-red-500">*</span>
              </label>
              <span className={`text-xs font-medium ${
                form.prompt.length > 450 ? 'text-red-500' : form.prompt.length > 350 ? 'text-amber-500' : 'text-gray-400'
              }`}>
                {form.prompt.length}/500
              </span>
            </div>
            <textarea
              rows={4}
              value={form.prompt}
              onChange={(e) => set('prompt', e.target.value)}
              placeholder="Write your prompt here. Use {topic} or {product} as placeholders that users can fill in."
              className="input-field resize-none text-sm leading-relaxed"
              maxLength={500}
            />
            {errors.prompt && <p className="text-red-500 text-xs mt-1">{errors.prompt}</p>}
            <p className="text-xs text-gray-400 mt-1.5">
              💡 Tip: Use <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{topic}'}</code> or{' '}
              <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">{'{product}'}</code> as placeholders.
            </p>
          </div>

          {/* Footer buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex-1 py-2.5"
            >
              {saving ? <><span className="spinner" /> Saving...</> : isEdit ? '💾 Save Changes' : '➕ Create Template'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-2.5 px-5"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Templates() {
  const navigate = useNavigate();
  const toast    = useToast();

  const [system,  setSystem]  = useState([]);
  const [custom,  setCustom]  = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);  // null = create, object = edit
  const [saving,      setSaving]      = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState('');
  const [tab,        setTab]        = useState('all'); // 'all' | 'system' | 'custom'

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadTemplates = useCallback(() => {
    setLoading(true);
    templateApi.list()
      .then(({ system: s, custom: c }) => { setSystem(s); setCustom(c); })
      .catch(() => toast.error('Failed to load templates.'))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filteredSystem = system.filter((t) => !typeFilter || t.type === typeFilter);
  const filteredCustom = custom.filter((t) => !typeFilter || t.type === typeFilter);

  const visibleSystem = tab !== 'custom' ? filteredSystem : [];
  const visibleCustom = tab !== 'system' ? filteredCustom : [];

  // ── Use template → navigate to Generator with pre-filled state ──────────────
  async function handleUse(template) {
    // Fire-and-forget usage counter increment
    templateApi.use(template._id).catch(() => {});

    // Navigate to Generator, passing template fields as router state
    navigate('/generate', {
      state: {
        fromTemplate: true,
        type:     template.type,
        tone:     template.tone,
        length:   template.length   ?? 'medium',
        language: template.language ?? 'English',
        keywords: (template.keywords ?? []).join(', '),
        prompt:   template.prompt,
      },
    });
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  function openCreate() {
    setEditTarget(null);
    setModalOpen(true);
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function openEdit(template) {
    setEditTarget(template);
    setModalOpen(true);
  }

  // ── Save (create or update) ─────────────────────────────────────────────────
  async function handleSave(formData) {
    setSaving(true);
    try {
      if (editTarget?._id) {
        const { template } = await templateApi.update(editTarget._id, formData);
        setCustom((prev) => prev.map((t) => (t._id === template._id ? template : t)));
        toast.success('Template updated!');
      } else {
        const { template } = await templateApi.create(formData);
        setCustom((prev) => [template, ...prev]);
        toast.success('Template created!');
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(err.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id) {
    try {
      await templateApi.delete(id);
      setCustom((prev) => prev.filter((t) => t._id !== id));
      toast.success('Template deleted.');
    } catch (err) {
      toast.error(err.message || 'Delete failed.');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const totalVisible = visibleSystem.length + visibleCustom.length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Prompt Templates</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
            Ready-made prompts to jumpstart your content generation
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary shrink-0">
          ➕ New Template
        </button>
      </div>

      {/* Filter bar */}
      <div className="card p-3 sm:p-4 mb-6 flex flex-wrap items-center gap-3">
        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          {[
            { key: 'all',    label: `All (${system.length + custom.length})` },
            { key: 'system', label: `System (${system.length})` },
            { key: 'custom', label: `My Templates (${custom.length})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                tab === key
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input-field w-auto py-2 text-sm ml-auto"
        >
          <option value="">All Types</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : totalVisible === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📋</div>
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {typeFilter ? 'No templates for this type' : tab === 'custom' ? 'No custom templates yet' : 'No templates found'}
          </p>
          <p className="text-gray-400 text-sm mb-5">
            {tab === 'custom'
              ? 'Create your first template to reuse prompts across generations.'
              : 'Try a different filter.'}
          </p>
          {tab === 'custom' && (
            <button onClick={openCreate} className="btn-primary">
              ➕ Create First Template
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {/* System templates section */}
          {visibleSystem.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  System Templates
                </h2>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {visibleSystem.length}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleSystem.map((t) => (
                  <TemplateCard
                    key={t._id}
                    template={t}
                    isSystem
                    onUse={handleUse}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Custom templates section */}
          {visibleCustom.length > 0 && (
            <section>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white">
                  My Templates
                </h2>
                <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">
                  {visibleCustom.length}
                </span>
                <div className="flex-1 h-px bg-gray-100 dark:bg-gray-800" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleCustom.map((t) => (
                  <TemplateCard
                    key={t._id}
                    template={t}
                    isSystem={false}
                    onUse={handleUse}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <TemplateModal
          initial={editTarget
            ? {
                name:        editTarget.name,
                description: editTarget.description ?? '',
                type:        editTarget.type,
                tone:        editTarget.tone,
                length:      editTarget.length ?? 'medium',
                prompt:      editTarget.prompt,
                _id:         editTarget._id,
              }
            : EMPTY_FORM
          }
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
          saving={saving}
        />
      )}
    </div>
  );
}
