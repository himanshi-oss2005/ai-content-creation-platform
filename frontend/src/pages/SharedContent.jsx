import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contentApi } from '../api/content';
import { typeIcon, typeLabel } from '../utils/contentTypes';
import MarkdownContent from '../components/MarkdownContent';

export default function SharedContent() {
  const { token } = useParams();
  const [content, setContent] = useState(null);
  const [error, setError]     = useState(null);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    contentApi.getShared(token)
      .then((res) => setContent(res.content))
      .catch(() => setError('This content is not available or is no longer public.'));
  }, [token]);

  function copy() {
    navigator.clipboard.writeText(content.output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (error) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="card p-10 text-center max-w-md">
        <div className="text-5xl mb-4">🔒</div>
        <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">{error}</p>
        <Link to="/" className="text-sm text-primary-600 dark:text-primary-400 hover:underline">
          Go to WriteGen AI
        </Link>
      </div>
    </div>
  );

  if (!content) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
      <div className="text-gray-400 animate-pulse">Loading…</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        {/* Brand header */}
        <div className="text-center mb-8">
          <Link to="/" className="text-xl font-bold text-primary-600 dark:text-primary-400">
            ✍️ WriteGen AI
          </Link>
          <p className="text-xs text-gray-400 mt-1">Shared content — read only</p>
        </div>

        <div className="card p-6">
          {/* Meta */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xl shrink-0">
              {typeIcon(content.type)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wide text-primary-600 dark:text-primary-400">
                  {typeLabel(content.type)}
                </span>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-400 capitalize">{content.tone}</span>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span className="text-xs text-gray-400">{content.wordCount} words</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(content.createdAt).toLocaleDateString('en-US', {
                  month: 'long', day: 'numeric', year: 'numeric',
                })}
              </p>
            </div>
          </div>

          {/* Prompt */}
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 pb-4 border-b border-gray-100 dark:border-gray-800">
            {content.prompt}
          </p>

          {/* Output */}
          <MarkdownContent content={content.output} className="text-sm" />

          {/* Copy button */}
          <div className="mt-5 flex justify-end">
            <button
              onClick={copy}
              className="btn-secondary py-2 px-4 text-sm flex items-center gap-2"
            >
              {copied ? '✅ Copied!' : '📋 Copy content'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Create your own AI content at{' '}
          <Link to="/" className="text-primary-600 dark:text-primary-400 hover:underline">
            WriteGen AI
          </Link>
        </p>
      </div>
    </div>
  );
}
