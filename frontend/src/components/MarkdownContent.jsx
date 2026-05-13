import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

export default function MarkdownContent({ content, className = '' }) {
  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
