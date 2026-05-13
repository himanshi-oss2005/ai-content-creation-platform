import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { contentApi } from '../api/content';
import { useToast } from '../context/ToastContext';
import { downloadTxt, downloadPdf, downloadBulkBlob } from '../utils/export';
import { typeIcon, typeLabel, CONTENT_TYPES } from '../utils/contentTypes';
import MarkdownContent from '../components/MarkdownContent';

function SkeletonItem() {
  return (
    <div className="card p-5 space-y-3">
      <div className="flex gap-3">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2 animate-pulse" />
        </div>
      </div>
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" />
    </div>
  );
}

export default function History() {
  const toast = useToast();

  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [pages, setPages]             = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [expanded, setExpanded]       = useState(null);
  const [showFavorites, setShowFavorites] = useState(false);
  const [search, setSearch]           = useState('');
  const [typeFilter, setTypeFilter]   = useState('');
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');
  const [selected, setSelected]       = useState(new Set());
  const [exporting, setExporting]     = useState(false);
  const searchTimer = useRef(null);

  const [shareLoading, setShareLoading] = useState(null);
  const activeRef = useRef(true);

  // useCallback so the function identity is stable and useEffect deps are correct
  const loadHistory = useCallback((page = 1) => {
    if (!activeRef.current) return;

    setLoading(true);
    setCurrentPage(page);
    contentApi.getHistory({
      page,
      limit: 8,
      type:      typeFilter || undefined,
      search:    search    || undefined,
      favorites: showFavorites || undefined,
      dateFrom:  dateFrom  || undefined,
      dateTo:    dateTo    || undefined,
    }).then((res) => {
      if (!activeRef.current) return;
      setItems(res.items);
      setTotal(res.total);
      setPages(res.pages);
    }).catch(() => {
      if (activeRef.current) toast.error('Failed to load history.');
    }).finally(() => { if (activeRef.current) setLoading(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeFilter, showFavorites, search, dateFrom, dateTo]);

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
      clearTimeout(searchTimer.current);
    };
  }, []);

  // Re-fetch when filters change
  useEffect(() => {
    loadHistory(1);
  }, [loadHistory]);

  function onSearchChange(val) {
    setSearch(val);
    clearTimeout(searchTimer.current);
    // Debounce: wait 400 ms after the user stops typing
    searchTimer.current = setTimeout(() => {
      // Trigger via state change — loadHistory will re-run via useEffect
      setCurrentPage(1);
    }, 400);
  }

  const pageNumbers = useMemo(() =>
    Array.from({ length: pages }, (_, i) => i + 1).filter(
      (p) => p === 1 || p === pages || Math.abs(p - currentPage) <= 1
    ),
    [pages, currentPage]
  );

  function toggleExpand(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  function toggleSelect(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i._id))
    );
  }

  async function handleBulkExport(format) {
    if (!selected.size) return;
    setExporting(true);
    try {
      const blob = await contentApi.bulkExport([...selected], format);
      downloadBulkBlob(blob, format);
      toast.success(`Exported ${selected.size} item${selected.size !== 1 ? 's' : ''} as ${format.toUpperCase()}`);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  function toggleFavorite(item) {
    contentApi.toggleFavorite(item._id).then((res) => {
      setItems((prev) =>
        prev
          .map((i) => (i._id === item._id ? { ...i, isFavorite: res.isFavorite } : i))
          .filter((i) => !(showFavorites && !i.isFavorite))
      );
      toast.info(res.isFavorite ? '⭐ Added to favorites' : 'Removed from favorites');
    }).catch(() => toast.error('Could not update favorite.'));
  }

  function shareContent(item) {
    setShareLoading(item._id);
    contentApi.toggleShare(item._id).then((res) => {
      setItems((prev) => prev.map((i) =>
        i._id === item._id ? { ...i, isPublic: res.isPublic, shareToken: res.shareToken } : i
      ));
      if (res.isPublic) {
        const link = `${window.location.origin}/share/${res.shareToken}`;
        navigator.clipboard.writeText(link)
          .then(() => toast.success('🔗 Share link copied to clipboard!'))
          .catch(() => toast.info(`Share link: ${link}`));
      } else {
        toast.info('🔒 Content is now private');
      }
    }).catch(() => toast.error('Could not update share status.'))
      .finally(() => setShareLoading(null));
  }

  function copy(item) {
    navigator.clipboard.writeText(item.output)
      .then(() => toast.success('Copied to clipboard!'))
      .catch(() => toast.error('Copy failed — please select and copy manually.'));
  }

  function confirmDelete(item) {
    if (!confirm(`Delete this ${typeLabel(item.type)}? This cannot be undone.`)) return;
    contentApi.delete(item._id).then(() => {
      setItems((prev) => prev.filter((i) => i._id !== item._id));
      setTotal((t) => t - 1);
      toast.success('Deleted successfully');
    }).catch(() => toast.error('Delete failed. Please try again.'));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Content History</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
            {total} total generation{total !== 1 ? 's' : ''}
          </p>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">{selected.size} selected</span>
            <button
              onClick={() => handleBulkExport('zip')}
              disabled={exporting}
              className="btn-secondary py-2 px-3 text-sm flex items-center gap-1.5 disabled:opacity-50"
              title="Export selected as ZIP of TXT files"
            >
              🗜️ ZIP
            </button>
            <button
              onClick={() => handleBulkExport('pdf')}
              disabled={exporting}
              className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5 disabled:opacity-50"
              title="Export selected as combined PDF"
            >
              {exporting ? '⏳' : '📑'} PDF
            </button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors px-1"
              title="Clear selection"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search prompts or content..."
            className="input-field pl-9 py-2 text-sm"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="input-field w-auto py-2 text-sm"
        >
          <option value="">All Types</option>
          {CONTENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
          ))}
        </select>

        <button
          onClick={() => setShowFavorites((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
            showFavorites
              ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
          }`}
        >
          ⭐ Favorites
        </button>

        {/* Date range */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="input-field w-auto py-2 text-sm"
            title="From date"
          />
          <span className="text-gray-400 text-sm">→</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="input-field w-auto py-2 text-sm"
            title="To date"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
              title="Clear date filter"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map((i) => <SkeletonItem key={i} />)}</div>
      ) : items.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="text-5xl mb-4">{showFavorites ? '⭐' : '📭'}</div>
          <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {showFavorites ? 'No favorites yet' : 'No content found'}
          </p>
          <p className="text-gray-400 text-sm">
            {showFavorites ? 'Star content to save it here' : 'Try adjusting your search or filters'}
          </p>
        </div>
      ) : (
        <>
          {/* Select-all bar */}
          <div className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={items.length > 0 && selected.size === items.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded accent-primary-600 cursor-pointer"
              title="Select all on this page"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {selected.size === items.length && items.length > 0 ? 'Deselect all' : 'Select all on page'}
            </span>
          </div>

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item._id} className={`card p-5 hover:shadow-md transition-shadow animate-fade-in ${
                selected.has(item._id) ? 'ring-2 ring-primary-500 dark:ring-primary-400' : ''
              }`}>
                <div className="flex items-start gap-3">

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selected.has(item._id)}
                    onChange={() => toggleSelect(item._id)}
                    className="mt-1 w-4 h-4 rounded accent-primary-600 shrink-0 cursor-pointer"
                    title="Select for bulk export"
                  />

                  {/* Type icon */}
                  <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl shrink-0">
                    {typeIcon(item.type)}
                  </div>

                  {/* Meta + preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                        {typeLabel(item.type)}
                      </span>
                      <span className="text-gray-200 dark:text-gray-700">·</span>
                      <span className="text-xs text-gray-400 capitalize">{item.tone}</span>
                      <span className="text-gray-200 dark:text-gray-700">·</span>
                      <span className="text-xs text-gray-400">{item.wordCount} words</span>
                      <span className="text-gray-200 dark:text-gray-700">·</span>
                      <span className="text-xs text-gray-400">
                        {new Date(item.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5 leading-snug">
                      {item.prompt}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {item.output}
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <button
                      onClick={() => shareContent(item)}
                      disabled={shareLoading === item._id}
                      title={item.isPublic ? 'Disable sharing' : 'Share — copy public link'}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-base ${
                        item.isPublic
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-600'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      {shareLoading === item._id ? '⏳' : item.isPublic ? '🔗' : '🔐'}
                    </button>
                    <button
                      onClick={() => toggleFavorite(item)}
                      title={item.isFavorite ? 'Remove favorite' : 'Add to favorites'}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
                    >
                      {item.isFavorite ? '⭐' : '☆'}
                    </button>
                    <button
                      onClick={() => copy(item)}
                      title="Copy to clipboard"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => downloadTxt(item)}
                      title="Download as TXT"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
                    >
                      📄
                    </button>
                    <button
                      onClick={() => downloadPdf(item)}
                      title="Export as PDF"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-base"
                    >
                      📑
                    </button>
                    <button
                      onClick={() => confirmDelete(item)}
                      title="Delete"
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-base"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Expandable full output */}
                {expanded === item._id && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 animate-fade-in">
                    <MarkdownContent content={item.output} className="text-sm" />
                  </div>
                )}
                <button
                  onClick={() => toggleExpand(item._id)}
                  className="mt-2.5 text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                >
                  {expanded === item._id ? '▲ Show less' : '▼ Show full content'}
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button
                onClick={() => loadHistory(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn-secondary py-2 px-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <div className="flex items-center gap-1">
                {pageNumbers.map((p) => (
                  <button
                    key={p}
                    onClick={() => loadHistory(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      p === currentPage
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadHistory(currentPage + 1)}
                disabled={currentPage === pages}
                className="btn-secondary py-2 px-4 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
