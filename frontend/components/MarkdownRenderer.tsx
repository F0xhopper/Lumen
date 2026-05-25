"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import type { CitationResult } from "@/lib/api";
import { InlineCitationRef } from "./CitationChip";

interface MarkdownRendererProps {
  content: string;
  citations?: CitationResult[];
  onNavigate?: (urlPath: string) => void;
}

// Sentinel we embed so ReactMarkdown passes it through as inline code.
// Chosen to be unambiguous and not appear in normal Aquinas text.
const CITE_SENTINEL = "§cite:";

/**
 * Preprocess the markdown string before handing it to ReactMarkdown.
 *
 * Converts both [N] and [[N]] citation refs into inline-code sentinels that
 * the custom `code` renderer below will turn into clickable CitationChip nodes.
 *
 * [N] style — what GPT-4.1 naturally produces when asked for numeric citations.
 * [[N]] style — double-bracket fallback.
 *
 * We only convert [N] when N matches a known citation ref to avoid clobbering
 * legitimate markdown like "[see above]".
 */
function preprocessCitations(content: string, citations: CitationResult[]): string {
  if (citations.length === 0) return content;
  const refs = new Set(citations.map((c) => c.ref));

  // Replace [[N]] (double bracket) — unambiguous, always convert
  let out = content.replace(/\[\[(\d+)\]\]/g, (_, n) =>
    refs.has(n) ? `\`${CITE_SENTINEL}${n}\`` : `[[${n}]]`
  );

  // Replace [N] (single bracket) only when N matches a citation ref
  // Negative lookbehind/lookahead to avoid matching markdown links [text](url)
  out = out.replace(/\[(\d+)\](?!\()/g, (full, n) =>
    refs.has(n) ? `\`${CITE_SENTINEL}${n}\`` : full
  );

  return out;
}

const ARTICLE_LINK_RE = /^\/(1|1-2|2-2|3)\/\d+\/\d+(#[\w-]+)?$/;

export default function MarkdownRenderer({
  content,
  citations = [],
  onNavigate,
}: MarkdownRendererProps) {
  const processed = preprocessCitations(content, citations);

  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className, children, ...props }) {
            // Intercept citation sentinels — never reach the block/inline code branch
            const text = String(children).trim();
            if (text.startsWith(CITE_SENTINEL) && onNavigate && citations.length > 0) {
              const refNum = text.slice(CITE_SENTINEL.length);
              return (
                <InlineCitationRef
                  refNum={refNum}
                  citations={citations}
                  onNavigate={onNavigate}
                />
              );
            }
            const isBlock = className?.includes("language-");
            return isBlock ? (
              <pre className="bg-muted p-4 rounded overflow-x-auto my-4">
                <code className={className} {...props}>{children}</code>
              </pre>
            ) : (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
                {children}
              </code>
            );
          },

          a({ children, href, ...props }) {
            if (!href) return <a {...props}>{children}</a>;
            if (ARTICLE_LINK_RE.test(href) && onNavigate) {
              return (
                <button
                  onClick={() => onNavigate(href)}
                  className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-border/50 bg-secondary/50 hover:bg-secondary text-[9px] font-mono text-foreground/60 hover:text-foreground/90 transition-colors align-baseline"
                >
                  {children}
                </button>
              );
            }
            if (href.startsWith("/") && !href.startsWith("//")) {
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
                <table className="w-full border-collapse" {...props}>{children}</table>
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
            return <ul className="list-disc list-inside mb-4 space-y-1" {...props}>{children}</ul>;
          },
          ol({ children, ...props }) {
            return <ol className="list-decimal list-inside mb-4 space-y-1" {...props}>{children}</ol>;
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
        {processed}
      </ReactMarkdown>
    </div>
  );
}
