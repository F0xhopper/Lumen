"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            const isBlock = className?.includes("language-");
            return isBlock ? (
              <pre className="bg-muted p-4 rounded overflow-x-auto my-4">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },
          a({ children, href, ...props }) {
            const isInternal = href && href.startsWith("/") && !href.startsWith("//");
            if (isInternal) {
              return (
                <Link
                  href={href}
                  className="text-foreground/70 hover:text-foreground underline underline-offset-2 decoration-foreground/30"
                  {...(props as object)}
                >
                  {children}
                </Link>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                {children}
              </a>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-4">
                <table className="w-full border-collapse" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          th({ children, ...props }) {
            return (
              <th className="border border-border px-3 py-2 text-left bg-muted font-medium text-foreground/80" {...props}>
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="border border-border px-3 py-2 text-left text-foreground/80" {...props}>
                {children}
              </td>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-2 border-muted-foreground/40 pl-4 italic my-4 text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          ul({ children, ...props }) {
            return (
              <ul className="list-disc list-inside mb-4 space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="list-decimal list-inside mb-4 space-y-1" {...props}>
                {children}
              </ol>
            );
          },
          h1({ children, ...props }) {
            return <h1 className="text-xl font-semibold mb-4 mt-6 text-foreground tracking-tight" {...props}>{children}</h1>;
          },
          h2({ children, ...props }) {
            return <h2 className="text-base font-semibold mb-3 mt-5 text-foreground tracking-tight" {...props}>{children}</h2>;
          },
          h3({ children, ...props }) {
            return <h3 className="text-sm font-semibold mb-2 mt-4 text-foreground" {...props}>{children}</h3>;
          },
          p({ children, ...props }) {
            return <p className="mb-4 text-foreground/90 leading-7" {...props}>{children}</p>;
          },
          hr({ ...props }) {
            return <hr className="border-border my-6" {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
