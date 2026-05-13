import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const COLORS = ['gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink'];
const ICONS  = ['📁', '⭐', '🔥', '💡', '🎯', '📝', '🚀', '💼', '🎨'];

const COLOR_STYLES = {
  gray:   'bg-gray-100   dark:bg-gray-800   text-gray-600   dark:text-gray-400',
  red:    'bg-red-100    dark:bg-red-900/30  text-red-600    dark:text-red-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  amber:  'bg-amber-100  dark:bg-amber-900/30 text-amber-600  dark:text-amber-400',
  green:  'bg-green-100  dark:bg-green-900/30 text-green-600  dark:text-green-400',
  teal:   'bg-teal-100   dark:bg-teal-900/30  text-teal-600   dark:text-teal-400',
  blue:   'bg-blue-100   dark:bg-blue-900/30  text-blue-600   dark:text-blue-400',
  violet: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  pink:   'bg-pink-100   dark:bg-pink-900/30  text-pink-600   dark:text-pink-400',
};

const EMPTY_FORM = { name: '', color: 'blue', icon: '📁' };

function CollectionModal({ initial, onSave, onClose, saving }) {
  const { t } = useTranslation();
  const isEdit = !!initial?._id;
  const [form, setForm]   = useState(initial ?? EMPTY_FORM);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t('collections.name_required')); return; }
    onSave(form);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md card p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {isEdit ? t('collections.edit_collection') : t('collections.create_collection')}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              {t('collections.modal_name_label')}
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setError(''); }}
              maxLength={60}
              placeholder={t('collections.modal_name_placeholder')}
              className={`input-field ${error ? 'border-red-400 focus:ring-red-400' : ''}`}
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('collections.modal_icon_label')}
            </label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon: ic }))}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                    form.icon === ic
                      ? 'ring-2 ring-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-110'
                      : 'bg-gray-100 dark:bg-gray-800 hover:scale-105'
                  }`}
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('collections.modal_color_label')}
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c }))}
                  className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-all ${COLOR_STYLES[c]} ${
                    form.color === c ? 'ring-2 ring-offset-1 ring-primary-500 scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 py-2.5">
              {saving
                ? <><span className="spinner" /> {t('collections.modal_saving')}</>
                : isEdit ? t('collections.modal_save') : t('collections.modal_create')}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary py-2.5 px-5">
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Collections() {
  const { t } = useTranslation();
  const toast = useToast();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [modalOpen, setModalOpen]     = useState(false);
  const [editTarget, setEditTarget]   = useState(null);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState(null);

  const isMountedRef = useRef(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/collections')
      .then((r) => { if (isMountedRef.current) setCollections(r.data.collections); })
      .catch(() => { if (isMountedRef.current) toast.error(t('collections.toast_load_error')); })
      .finally(() => { if (isMountedRef.current) setLoading(false); });
  }, [toast, t]);

  useEffect(() => {
    isMountedRef.current = true;
    load();
    return () => { isMountedRef.current = false; };
  }, [load]);

  async function handleSave(formData) {
    setSaving(true);
    try {
      if (editTarget?._id) {
        const { data } = await api.patch(`/collections/${editTarget._id}`, formData);
        setCollections((prev) => prev.map((c) => c._id === data.collection._id ? data.collection : c));
        toast.success(t('collections.toast_updated'));
      } else {
        const { data } = await api.post('/collections', formData);
        setCollections((prev) => [data.collection, ...prev]);
        toast.success(t('collections.toast_created'));
      }
      setModalOpen(false);
      setEditTarget(null);
    } catch (err) {
      toast.error(err.message || t('collections.toast_save_error'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm(t('collections.delete_confirm'))) return;
    setDeletingId(id);
    try {
      await api.delete(`/collections/${id}`);
      setCollections((prev) => prev.filter((c) => c._id !== id));
      toast.success(t('collections.toast_deleted'));
    } catch (err) {
      toast.error(err.message || t('collections.toast_delete_error'));
    } finally {
      setDeletingId(null);
    }
  }

  function openCreate() { setEditTarget(null); setModalOpen(true); }
  function openEdit(col) { setEditTarget(col); setModalOpen(true); }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('collections.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">{t('collections.subtitle')}</p>
        </div>
        <button onClick={openCreate} className="btn-primary">{t('collections.new_collection')}</button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
              </div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : collections.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">📁</div>
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">{t('collections.empty_title')}</p>
          <p className="text-gray-400 text-sm mb-5">{t('collections.empty_subtitle')}</p>
          <button onClick={openCreate} className="btn-primary">{t('collections.create_first')}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {collections.map((col) => (
            <div key={col._id} className="card p-5 hover:shadow-md transition-shadow group">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${COLOR_STYLES[col.color] ?? COLOR_STYLES.gray}`}>
                    {col.icon ?? '📁'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-sm">{col.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {col.itemCount ?? 0} {col.itemCount === 1 ? t('collections.items_count_one') : t('collections.items_count_other')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openEdit(col)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition-colors text-sm"
                    title={t('common.edit')}
                  >✏️</button>
                  <button
                    onClick={() => handleDelete(col._id)}
                    disabled={deletingId === col._id}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400 transition-colors text-sm disabled:opacity-40"
                    title={t('common.delete')}
                  >
                    {deletingId === col._id ? <span className="spinner text-red-400" /> : '🗑️'}
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400">
                {t('collections.created_on')} {new Date(col.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <CollectionModal
          initial={editTarget ? { name: editTarget.name, color: editTarget.color ?? 'blue', icon: editTarget.icon ?? '📁', _id: editTarget._id } : EMPTY_FORM}
          onSave={handleSave}
          onClose={() => { setModalOpen(false); setEditTarget(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
