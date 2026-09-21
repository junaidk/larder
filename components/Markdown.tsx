import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Render a piece of a recipe as markdown.
 *
 * This runs on the server, so the parser never reaches the browser. Raw HTML
 * is not enabled, so a recipe file holds text and markup only.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="font-serif leading-relaxed text-stone-700">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-stone-900 underline decoration-stone-300 underline-offset-2 hover:decoration-stone-600"
            >
              {children}
            </a>
          ),
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc pl-5 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal pl-5 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          h1: ({ children }) => <h3 className="mt-4 mb-2 font-medium first:mt-0">{children}</h3>,
          h2: ({ children }) => <h3 className="mt-4 mb-2 font-medium first:mt-0">{children}</h3>,
          h3: ({ children }) => (
            <h3 className="mt-4 mb-2 font-sans text-xs font-medium tracking-wide text-stone-500 uppercase first:mt-0">
              {children}
            </h3>
          ),
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-stone-200 pl-3 text-stone-600 italic last:mb-0">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded bg-stone-100 px-1 py-0.5 font-sans text-sm">{children}</code>
          ),
          hr: () => <hr className="my-4 border-stone-200" />,
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse font-sans text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-stone-300 px-2 py-1 text-left font-medium text-stone-600">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-stone-200 px-2 py-1 align-top">{children}</td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
