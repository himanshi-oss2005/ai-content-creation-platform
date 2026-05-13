import { useState, useEffect, useRef } from 'react';
import { usePromptHistory } from '../hooks/usePromptHistory';
import { Link, useSearchParams, useLocation } from 'react-router-dom';
import { contentApi } from '../api/content';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { downloadTxt, downloadPdf } from '../utils/export';
import MarkdownContent from '../components/MarkdownContent';
import {
  CONTENT_TYPES, TONES, LENGTHS, LANGUAGES,
  typeIcon, typeLabel, typePlaceholder,
} from '../utils/contentTypes';

const SKELETON_WIDTHS = ['100%', '90%', '100%', '75%', '100%', '85%', '60%'];

export default function Generator() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { history: promptHistory, save: savePrompt } = usePromptHistory();
  const [showSuggestions, setShowSuggestions] = useState(false);

  // ── Form state ──────────────────────────────────────────────────────────────
  // Seed from router state (from Templates page) or URL query param
  const tplState = location.state?.fromTemplate ? location.state : null;

  const [type,     setType]     = useState(tplState?.type     || searchParams.get('type') || 'blog');
  const [tone,     setTone]     = useState(tplState?.tone     || 'professional');
  const [length,   setLength]   = useState(tplState?.length   || 'medium');
  const [language, setLanguage] = useState(tplState?.language || 'English');
  const [prompt,   setPrompt]   = useState(tplState?.prompt   || '');
  const [keywords, setKeywords] = useState(tplState?.keywords || '');
  const [wordCount, setWordCount] = useState('');
  const [touched,  setTouched]  = useState(false);

  // Show a one-time banner when arriving from a template
  const [templateBanner, setTemplateBanner] = useState(!!tplState);

  // ── Output state ────────────────────────────────────────────────────────────
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [fromCache, setFromCache] = useState(false);
  const [genSource, setGenSource] = useState(null); // 'AI' | 'MOCK' | 'FALLBACK' | 'CACHE'
  const [genTime,   setGenTime]   = useState(null);
  const [recent,   setRecent]   = useState([]);
  const [copied,   setCopied]   = useState(false);
  const activeRef = useRef(true);

  // ── Tone comparison state ────────────────────────────────────────────────────
  const [compareMode,     setCompareMode]     = useState(false);
  const [compareTones,    setCompareTones]    = useState(['professional', 'casual']);
  const [compareResults,  setCompareResults]  = useState(null);
  const [copiedVariant,   setCopiedVariant]   = useState(null);

  // ── Credit state ────────────────────────────────────────────────────────────
  const dailyLimit  = user?.role === 'premium' ? 100 : 10;
  const creditsLeft = Math.max(0, dailyLimit - (user?.creditsUsedToday ?? 0));
  const creditPct   = Math.round(((user?.creditsUsedToday ?? 0) / dailyLimit) * 100);
  const creditBarColor = creditPct > 80 ? 'bg-red-500' : creditPct > 50 ? 'bg-amber-500' : 'bg-primary-500';

  const promptValid   = prompt.length >= 5 && prompt.length <= 500;
  const wordCountValid = wordCount === '' || (Number.isInteger(+wordCount) && +wordCount >= 10 && +wordCount <= 5000);
  const languageValid  = language.trim().length >= 2 && language.trim().length <= 30 && /^[a-zA-Z\s-]+$/.test(language.trim());

  // Parse keywords string → array (trim, dedupe, max 10)
  const keywordsArray = [...new Set(
    keywords.split(',').map((k) => k.trim()).filter(Boolean)
  )].slice(0, 10);

  useEffect(() => {
    activeRef.current = true;

    contentApi.getHistory({ limit: 6 })
      .then((r) => { if (activeRef.current) setRecent(r.items); })
      .catch(() => {})
      .finally(() => { /* noop */ });

    return () => { activeRef.current = false; };
  }, []);

  function toggleCompareTone(toneValue) {
    setCompareTones((prev) =>
      prev.includes(toneValue)
        ? prev.length > 2 ? prev.filter((t) => t !== toneValue) : prev
        : prev.length < 3 ? [...prev, toneValue] : prev
    );
  }

  async function handleToneCompare() {
    setTouched(true);
    if (!promptValid || !languageValid || !wordCountValid || loading) return;
    if (creditsLeft < compareTones.length) {
      toast.warning(`⚡ Need ${compareTones.length} credits for tone comparison. Upgrade to Premium!`);
      return;
    }
    setLoading(true);
    setCompareResults(null);
    try {
      const res = await contentApi.generateToneComparison({
        type, tones: compareTones, prompt, length, language, keywords: keywordsArray,
        ...(wordCount !== '' && { wordCount: +wordCount }),
      });
      savePrompt(prompt);
      setCompareResults(res.variants);
      setRecent((prev) => [...res.variants, ...prev].slice(0, 6));
      await refreshUser();
      toast.success(`${compareTones.length} tone variants generated! ✨`);
    } catch (err) {
      toast.error(err.message || 'Tone comparison failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectVariant(selected) {
    const rejected = compareResults.filter((v) => v._id !== selected._id);
    try {
      await contentApi.selectABVariant({ selectedId: selected._id, rejectedId: rejected[0]._id });
      if (rejected[1]) await contentApi.delete(rejected[1]._id);
      setResult(selected);
      setCompareResults(null);
      setCompareMode(false);
      toast.success('Variant selected and saved! ⭐');
    } catch (err) {
      toast.error('Failed to save selection.');
    }
  }

  async function handleGenerate() {
    setTouched(true);
    if (!promptValid || !languageValid || !wordCountValid || loading) return;

    if (creditsLeft === 0) {
      toast.warning('⚡ No credits remaining today. Upgrade to Premium for more!');
      return;
    }

    setLoading(true);
    try {
      const res = await contentApi.generate({
        type, tone, prompt, length, language,
        keywords: keywordsArray,
        ...(wordCount !== '' && { wordCount: +wordCount }),
      });
      savePrompt(prompt);
      setResult(res.content);
      setFromCache(res.fromCache ?? false);
      setGenSource(res.source ?? (res.fromCache ? 'CACHE' : 'AI'));
      setGenTime(res.generationTime ?? null);
      setRecent((prev) => [res.content, ...prev.filter((i) => i._id !== res.content._id).slice(0, 5)]);
      await refreshUser();

      if (res.fromCache) {
        toast.info('⚡ Returned from cache — no credit used!');
      } else {
        toast.success('Content generated! ✨');
      }

      if (res.creditWarning) {
        toast.warning(`⚡ You've used 80% of your daily credits (${res.creditsRemaining} remaining). Upgrade for more!`);
      }
    } catch (err) {
      if (err.message?.includes('429') || err.message?.toLowerCase().includes('limit')) {
        toast.warning('Daily credit limit reached. Upgrade to Premium!');
      } else {
        toast.error(err.message || 'Generation failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRegenerate() {
    if (!result || loading) return;
    if (creditsLeft === 0) {
      toast.warning('⚡ No credits remaining today. Upgrade to Premium for more!');
      return;
    }
    setLoading(true);
    try {
      const res = await contentApi.regenerate({ contentId: result._id, tone, length });
      setResult(res.content);
      setFromCache(false);
      setGenSource(res.source ?? 'AI');
      setGenTime(res.generationTime ?? null);
      setRecent((prev) => [res.content, ...prev.filter((i) => i._id !== res.content._id).slice(0, 5)]);
      await refreshUser();
      toast.success('Content regenerated! ✨');
    } catch (err) {
      toast.error(err.message || 'Regeneration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function copyToClipboard() {
    if (!result) return;
    navigator.clipboard.writeText(result.output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success('Copied to clipboard!');
    }).catch(() => toast.error('Copy failed.'));
  }

  function handleExportTxt() {
    downloadTxt(result);
    toast.success('Downloaded as TXT!');
  }

  function handleExportPdf() {
    downloadPdf(result);
    toast.success('Opening print dialog for PDF...');
  }

  function loadPrevious(item) {
    setResult(item);
    setType(item.type);
    setTone(item.tone);
    if (item.length)   setLength(item.length);
    if (item.language) setLanguage(item.language);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Content Generator</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-0.5 text-sm">
          Generate high-quality content in seconds with AI
        </p>
      </div>

      {/* Template applied banner */}
      {templateBanner && (
        <div className="mb-5 flex items-center gap-3 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl animate-fade-in">
          <span className="text-primary-600 dark:text-primary-400 text-lg shrink-0">📋</span>
          <p className="text-sm text-primary-700 dark:text-primary-300 font-medium flex-1">
            Template applied — review the prompt below and hit Generate.
          </p>
          <button
            onClick={() => setTemplateBanner(false)}
            className="text-primary-400 hover:text-primary-600 transition-colors shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-6 ${
        compareResults ? '' : 'lg:grid-cols-[1fr_1.1fr]'
      }`}>

        {/* ── Input Panel ── */}
        <div className="card p-5 sm:p-6 space-y-5">

          {/* Content Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Content Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CONTENT_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 sm:p-3 rounded-xl border-2 transition-all duration-150 text-sm font-medium ${
                    type === t.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <span className="text-xl">{t.icon}</span>
                  <span className="text-xs leading-tight text-center">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Tone
            </label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
                    tone === t.value
                      ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20 text-accent-700 dark:text-accent-300 shadow-sm'
                      : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Length + Language — side by side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Length */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Length
              </label>
              <div className="flex gap-2">
                {LENGTHS.map((l) => (
                  <button
                    key={l.value}
                    type="button"
                    onClick={() => setLength(l.value)}
                    title={l.desc}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl border-2 text-xs font-semibold transition-all duration-150 ${
                      length === l.value
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <span className="text-base">{l.icon}</span>
                    <span>{l.label}</span>
                    <span className="text-gray-400 font-normal text-[10px]">{l.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Language */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Language
              </label>
              <input
                list="language-list"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                placeholder="e.g. English, French…"
                className={`input-field py-2.5 text-sm ${
                  touched && !languageValid ? 'border-red-400 focus:ring-red-400' : ''
                }`}
              />
              <datalist id="language-list">
                {LANGUAGES.map((l) => <option key={l} value={l} />)}
              </datalist>
              {touched && !languageValid && (
                <p className="text-red-500 text-xs mt-1">⚠️ Enter a valid language name (letters only, 2–30 chars)</p>
              )}
            </div>
          </div>

          {/* Word Count */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Word Count
              <span className="ml-1.5 text-xs font-normal text-gray-400">(optional — overrides length preset)</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="10"
                max="5000"
                value={wordCount}
                onChange={(e) => setWordCount(e.target.value)}
                placeholder="e.g. 300"
                className={`input-field text-sm py-2.5 pr-16 ${
                  touched && !wordCountValid ? 'border-red-400 focus:ring-red-400' : ''
                } ${wordCount !== '' ? 'border-primary-400 dark:border-primary-500' : ''}`}
              />
              {wordCount !== '' && (
                <button
                  type="button"
                  onClick={() => setWordCount('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1.5 py-0.5 rounded"
                >
                  ✕ clear
                </button>
              )}
            </div>
            {touched && !wordCountValid && (
              <p className="text-red-500 text-xs mt-1">⚠️ Word count must be between 10 and 5000</p>
            )}
            {wordCount !== '' && wordCountValid && (
              <p className="text-primary-500 text-xs mt-1">✓ Length preset overridden — targeting ~{wordCount} words</p>
            )}
          </div>

          {/* Keywords */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Keywords
              <span className="ml-1.5 text-xs font-normal text-gray-400">(optional, comma-separated)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="e.g. productivity, remote work, AI tools"
              className="input-field text-sm py-2.5"
            />
            {keywordsArray.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {keywordsArray.map((kw) => (
                  <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full text-xs font-medium">
                    🏷️ {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Prompt */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Your Prompt
              </label>
              <span className={`text-xs font-medium ${
                prompt.length > 450 ? 'text-red-500' : prompt.length > 350 ? 'text-amber-500' : 'text-gray-400'
              }`}>
                {prompt.length}/500
              </span>
            </div>
            <textarea
              rows={4}
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder={typePlaceholder(type)}
              className="input-field resize-none text-sm leading-relaxed"
            />
            {showSuggestions && (() => {
              const q = prompt.trim().toLowerCase();
              const suggestions = q
                ? promptHistory.filter((p) => p.toLowerCase().includes(q) && p !== prompt)
                : promptHistory;
              return suggestions.length > 0 ? (
                <ul className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
                  {suggestions.slice(0, 5).map((s, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onMouseDown={() => { setPrompt(s); setShowSuggestions(false); }}
                        className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-2"
                      >
                        <span className="text-gray-400 shrink-0">🕐</span>
                        <span className="truncate">{s}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null;
            })()}
            {touched && !promptValid && (
              <p className="text-red-500 text-xs mt-1.5">⚠️ Prompt must be 5–500 characters</p>
            )}
          </div>

          {/* Compare mode toggle */}
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => { setCompareMode((v) => !v); setCompareResults(null); }}
              className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                compareMode ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform duration-200 ${
                compareMode ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Compare Tones</span>
            {compareMode && (
              <span className="ml-auto text-xs text-gray-400">Select 2–3 tones to compare</span>
            )}
          </div>

          {/* Tone multi-select for compare mode */}
          {compareMode && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tones to Compare
                <span className="ml-1.5 text-xs font-normal text-gray-400">({compareTones.length}/3 selected)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => {
                  const active = compareTones.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => toggleCompareTone(t.value)}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-150 ${
                        active
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 shadow-sm'
                          : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                      }`}
                    >
                      {t.emoji} {t.label}
                      {active && <span className="ml-1 text-primary-400">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Credit bar */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span className="text-amber-500">⚡</span>
              <span>{compareMode ? `${compareTones.length} credits per compare` : '1 credit per generation'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${creditBarColor}`}
                  style={{ width: `${creditPct}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {creditsLeft} left
              </span>
            </div>
          </div>

          <button
            onClick={compareMode ? handleToneCompare : handleGenerate}
            disabled={loading}
            className="btn-primary w-full py-3 text-base"
          >
            {loading ? (
              <><span className="spinner" /><span>{compareMode ? 'Comparing...' : 'Generating...'}</span></>
            ) : creditsLeft === 0 ? (
              <span>🚫 No credits — <Link to="/pricing" className="underline">Upgrade</Link></span>
            ) : compareMode ? (
              <span>🎨 Compare {compareTones.length} Tones</span>
            ) : (
              <span>✨ Generate Content</span>
            )}
          </button>
        </div>

        {/* ── Output Panel ── */}
        <div className={`card p-5 sm:p-6 flex flex-col min-h-[460px] ${
          compareResults ? 'lg:col-span-2' : ''
        }`}>
          <div className="flex items-start justify-between mb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-semibold text-gray-900 dark:text-white">Generated Content</h2>
              {fromCache && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-semibold">
                  ⚡ Cached
                </span>
              )}
              {!fromCache && genSource === 'AI' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full text-xs font-semibold">
                  🤖 AI Generated
                </span>
              )}
              {!fromCache && (genSource === 'FALLBACK' || genSource === 'MOCK') && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-semibold">
                  ⚙️ Fallback Generated
                </span>
              )}
              {genTime != null && !fromCache && (
                <span className="text-xs text-gray-400">{(genTime / 1000).toFixed(1)}s</span>
              )}
            </div>
            {result && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-400">{result.wordCount} words</span>
                <button onClick={copyToClipboard} className="btn-secondary text-xs py-1.5 px-2.5">
                  {copied ? '✅ Copied!' : '📋 Copy'}
                </button>
                <button onClick={handleExportTxt} className="btn-secondary text-xs py-1.5 px-2.5">
                  📄 TXT
                </button>
                <button onClick={handleExportPdf} className="btn-secondary text-xs py-1.5 px-2.5">
                  📑 PDF
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="btn-secondary text-xs py-1.5 px-2.5"
                >
                  🔄 Redo
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex-1 space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
              {SKELETON_WIDTHS.map((w, i) => (
                <div
                  key={i}
                  className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"
                  style={{ width: w }}
                />
              ))}
            </div>
          ) : compareResults ? (
            <div className="flex-1 flex flex-col">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Pick the tone that works best — the others will be discarded.
              </p>
              <div className={`grid gap-4 flex-1 ${
                compareResults.length === 3 ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'
              }`}>
                {compareResults.map((variant) => {
                  const toneObj = TONES.find((t) => t.value === variant.tone);
                  return (
                    <div key={variant._id} className="flex flex-col border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden hover:border-primary-400 dark:hover:border-primary-500 transition-colors">
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          {toneObj?.emoji} {toneObj?.label ?? variant.tone}
                        </span>
                        <span className="text-xs text-gray-400">{variant.wordCount} words</span>
                      </div>
                      <div className="flex-1 overflow-auto p-3 bg-white dark:bg-gray-900 max-h-64">
                        <MarkdownContent content={variant.output} className="text-xs" />
                      </div>
                      <div className="flex gap-2 p-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(variant.output);
                            setCopiedVariant(variant._id);
                            setTimeout(() => setCopiedVariant(null), 2000);
                            toast.success('Copied!');
                          }}
                          className="btn-secondary text-xs py-1 px-2 flex-1"
                        >
                          {copiedVariant === variant._id ? '✅ Copied' : '📋 Copy'}
                        </button>
                        <button
                          onClick={() => handleSelectVariant(variant)}
                          className="btn-primary text-xs py-1 px-2 flex-1"
                        >
                          ✅ Use This
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : result ? (
            <div className="flex-1 flex flex-col">
              {/* Fallback warning banner */}
              {(genSource === 'FALLBACK' || genSource === 'MOCK') && (
                <div className="flex items-start gap-2 mb-3 px-3 py-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400">
                  <span className="mt-0.5 shrink-0">⚠️</span>
                  <span>AI service unavailable — showing a structured basic result. Check your API key or try again later.</span>
                </div>
              )}
              {/* Tags row */}
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg text-xs font-semibold">
                  {typeIcon(result.type)} {typeLabel(result.type)}
                </span>
                <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium capitalize">
                  {result.tone}
                </span>
                {result.length && (
                  <span className="inline-flex items-center px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium capitalize">
                    {result.targetWordCount ? `~${result.targetWordCount} words target` : result.length}
                  </span>
                )}
                {result.language && result.language !== 'English' && (
                  <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium">
                    🌐 {result.language}
                  </span>
                )}
                {result.keywords?.length > 0 && (
                  <span className="inline-flex items-center px-2.5 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium">
                    🏷️ {result.keywords.length} keywords
                  </span>
                )}
              </div>

              <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                <MarkdownContent content={result.output} className="text-sm" />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-10 px-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-accent-100 dark:from-primary-900/30 dark:to-accent-900/30 rounded-2xl flex items-center justify-center text-3xl mb-4">
                ✨
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">Ready to generate</p>
              <p className="text-gray-400 dark:text-gray-500 text-sm">
                Choose a type, set your options, write your prompt, and hit Generate.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Recent generations */}
      {recent.length > 0 && (
        <div className="mt-6 card p-5 sm:p-6">
          <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Recent Generations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recent.map((item) => (
              <button
                key={item._id}
                onClick={() => loadPrevious(item)}
                className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-xl transition-all duration-150 text-left group border border-transparent hover:border-primary-200 dark:hover:border-primary-800"
              >
                <span className="text-xl mt-0.5 group-hover:scale-110 transition-transform">
                  {typeIcon(item.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                    {item.prompt}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.wordCount} words · {typeLabel(item.type)}
                    {item.language && item.language !== 'English' && ` · ${item.language}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
