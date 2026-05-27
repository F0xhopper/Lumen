"use client";

import { cn } from "@/lib/utils";
import type { CitationResult } from "@/lib/api";

interface Props {
  citation: CitationResult;
  onNavigate: (urlPath: string) => void;
  className?: string;
}

export default function CitationChip({ citation, onNavigate, className }: Props) {
  const label = `ST ${citation.part_abbr} Q.${citation.question_n} A.${citation.article_n} — ${citation.section_label}`;

  return (
    <button
      onClick={() => onNavigate(citation.url_path)}
      title={`${citation.question_title}\n${citation.article_title}`}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded",
        "border border-border/60 bg-secondary/60 hover:bg-secondary hover:border-border",
        "text-[9px] font-mono text-foreground/60 hover:text-foreground/90",
        "transition-colors cursor-pointer align-baseline leading-none",
        className,
      )}
    >
      <span className="text-muted-foreground/40 font-sans">[</span>
      <span>{label}</span>
      <span className="text-muted-foreground/40 font-sans">]</span>
    </button>
  );
}

interface RefProps {
  refNum: string;
  citations: CitationResult[];
  onNavigate: (urlPath: string) => void;
}

export function InlineCitationRef({ refNum, citations, onNavigate }: RefProps) {
  const citation = citations.find((c) => c.ref === refNum);
  if (!citation) {
    return <sup className="text-[8px] text-muted-foreground/40">[{refNum}]</sup>;
  }

  return (
    <button
      onClick={() => onNavigate(citation.url_path)}
      title={`${citation.section_label} — ${citation.article_title}`}
      className={cn(
        "inline-flex items-center px-1 py-0 rounded",
        "border border-border/50 bg-secondary/50 hover:bg-secondary hover:border-border",
        "text-[8px] font-mono text-foreground/50 hover:text-foreground/80",
        "transition-colors cursor-pointer align-super leading-none mx-0.5",
      )}
    >
      [{refNum}]
    </button>
  );
}
