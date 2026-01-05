"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github-dark.css";

interface MarkdownRendererProps {
  content: string;
}

export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          // Custom component for code blocks
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-4">
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code
                className="bg-muted px-1 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Custom component for links
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline"
                {...props}
              >
                {children}
              </a>
            );
          },
          // Custom component for tables
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto my-4">
                <table
                  className="w-full border-collapse border border-border"
                  {...props}
                >
                  {children}
                </table>
              </div>
            );
          },
          // Custom component for table headers
          th({ children, ...props }) {
            return (
              <th
                className="border border-border px-3 py-2 text-left bg-muted font-semibold"
                {...props}
              >
                {children}
              </th>
            );
          },
          // Custom component for table cells
          td({ children, ...props }) {
            return (
              <td
                className="border border-border px-3 py-2 text-left"
                {...props}
              >
                {children}
              </td>
            );
          },
          // Custom component for blockquotes
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-4 border-muted pl-4 italic my-4 text-muted-foreground"
                {...props}
              >
                {children}
              </blockquote>
            );
          },
          // Custom component for lists
          ul({ children, ...props }) {
            return (
              <ul className="list-disc list-inside mb-4 space-y-1" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol
                className="list-decimal list-inside mb-4 space-y-1"
                {...props}
              >
                {children}
              </ol>
            );
          },
          // Custom component for headings
          h1({ children, ...props }) {
            return (
              <h1
                className="text-2xl font-bold mb-4 mt-6 text-foreground"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2
                className="text-xl font-bold mb-3 mt-5 text-foreground"
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3
                className="text-lg font-bold mb-2 mt-4 text-foreground"
                {...props}
              >
                {children}
              </h3>
            );
          },
          // Custom component for paragraphs
          p({ children, ...props }) {
            return (
              <p className="mb-4 text-foreground" {...props}>
                {children}
              </p>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
