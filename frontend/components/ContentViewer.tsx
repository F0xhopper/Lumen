"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import type { SelectedNode } from "@/lib/summa-full";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────────

interface SectionItem { n: number; text: string }

interface Article {
  part_abbr: string;
  question_n: number;
  question_title: string;
  article_n: number;
  article_title: string;
  body: string;
  sed_contra: string | null;
  respondeo: string | null;
  objections: SectionItem[];
  replies: SectionItem[];
  source_url: string | null;
}

interface Passage {
  rank: number;
  text: string;
  score: number;
  part_abbr: string;
  question_n: number;
  article_n: number;
  question_title: string;
  article_title: string;
  section: string;
  section_label: string;
  url_fragment: string;
  article_url: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function sectionBadgeClass(section: string): string {
  if (section === "respondeo")   return "text-foreground/70 border-foreground/20";
  if (section === "sed_contra")  return "text-foreground/50 border-foreground/15";
  if (section.startsWith("objection")) return "text-muted-foreground/60 border-border";
  if (section.startsWith("reply"))     return "text-muted-foreground/50 border-border";
  return "text-muted-foreground/40 border-border";
}

function buildQuestionQuery(s: SelectedNode): string {
  return `${s.partAbbr} Q.${s.questionN} "${s.questionTitle}" — what are the main questions and conclusions?`;
}

// ── Article view (structured sections with anchors) ────────────────────────────

const LABEL_RE = /^(Objection \d+\.|Reply to Objection \d+\.|On the contrary[,.]?|I answer that[,.]?)\s*/i;
const QUOTE_RE = /("(?:[^"\\]|\\.)*")/g;

function renderWithQuotes(text: string): React.ReactNode {
  const parts = text.split(QUOTE_RE);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        QUOTE_RE.test(part) ? (
          <span key={i} className="dark:text-amber-100/60 text-amber-900/60 italic">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
}

function renderWithBoldLabel(text: string): React.ReactNode {
  const m = LABEL_RE.exec(text);
  const body = m ? text.slice(m[0].length) : text;
  return (
    <>
      {m && <><strong className="font-semibold text-foreground/90">{m[1]}</strong>{" "}</>}
      {renderWithQuotes(body)}
    </>
  );
}

function SectionBlock({
  id, text, className,
}: {
  id: string; text: string; className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6", className)}>
      <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/82 whitespace-pre-wrap">
        {renderWithBoldLabel(text)}
      </p>
    </section>
  );
}

function ArticleView({ article }: { article: Article }) {
  const hasStructure = article.respondeo || article.sed_contra ||
    article.objections.length > 0 || article.replies.length > 0;

  if (!hasStructure) {
    return (
      <div className="max-w-prose">
        <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/82 whitespace-pre-wrap">
          {article.body}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-prose space-y-9">
      {article.objections.map((obj) => (
        <SectionBlock key={obj.n} id={`objection-${obj.n}`} text={obj.text} />
      ))}

      {article.sed_contra && (
        <>
          <div className="h-px bg-border/25" />
          <SectionBlock id="sed-contra" text={article.sed_contra} />
        </>
      )}

      {article.respondeo && (
        <>
          <div className="h-px bg-border/25" />
          <SectionBlock
            id="respondeo"
            text={article.respondeo}
            className="bg-foreground/[0.02] -mx-4 px-4 py-4 rounded"
          />
        </>
      )}

      {article.replies.length > 0 && (
        <>
          <div className="h-px bg-border/25" />
          {article.replies.map((rep) => (
            <SectionBlock key={rep.n} id={`reply-${rep.n}`} text={rep.text} />
          ))}
        </>
      )}
    </div>
  );
}

// ── Passage list (search + question mode) ─────────────────────────────────────

function PassageList({ passages }: { passages: Passage[] }) {
  return (
    <div className="space-y-8 max-w-prose">
      {passages.map((p) => {
        const href = p.article_url
          ? `${p.article_url}#${p.url_fragment}`
          : null;
        const loc = `${p.part_abbr} Q.${p.question_n} A.${p.article_n}`;

        return (
          <article key={p.rank}>
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground/30">[{p.rank}]</span>
                {href ? (
                  <Link
                    href={href}
                    className="font-inter text-[9px] tracking-wide text-muted-foreground/50 hover:text-foreground/70 transition-colors"
                  >
                    {loc}
                  </Link>
                ) : (
                  <span className="font-inter text-[9px] tracking-wide text-muted-foreground/50">{loc}</span>
                )}
                {p.section_label && (
                  <span className={cn(
                    "font-inter text-[8px] tracking-[0.1em] uppercase px-1.5 py-0.5 border rounded",
                    sectionBadgeClass(p.section)
                  )}>
                    {p.section_label}
                  </span>
                )}
              </div>
            </div>

            <div className="h-px bg-border/30 mb-4" />

            <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/80 whitespace-pre-wrap">
              {p.text}
            </p>

            {href && (
              <Link
                href={href}
                className="inline-block mt-3 font-inter text-[8.5px] tracking-widest uppercase text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              >
                View in context →
              </Link>
            )}
          </article>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ContentViewer({
  selected,
  searchQuery,
}: {
  selected: SelectedNode | null;
  searchQuery: string;
}) {
  const pathname = usePathname();
  const [article, setArticle] = useState<Article | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isArticleMode = Boolean(selected?.articleN !== undefined && !searchQuery.trim());
  const isSearchMode  = Boolean(searchQuery.trim());
  const isQuestionMode = Boolean(selected && selected.articleN === undefined && !searchQuery.trim());

  // Scroll to hash section after article loads
  useEffect(() => {
    if (!article) return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }, [article]);

  // Fetch structured article when article is selected
  useEffect(() => {
    if (!isArticleMode || !selected) {
      setArticle(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    // Map partAbbr → part_id for the API call
    const ABBR_TO_ID: Record<string, string> = {
      "ST I":    "prima-pars",
      "ST I-II": "prima-secundae",
      "ST II-II":"secunda-secundae",
      "ST III":  "tertia-pars",
    };
    const partId = ABBR_TO_ID[selected.partAbbr] ?? selected.partId;

    fetch(`/api/article?part_id=${partId}&question_n=${selected.questionN}&article_n=${selected.articleN}`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled) { setArticle(data); setIsLoading(false); } })
      .catch(() => {
        if (!cancelled) { setError("Could not load article. Is the backend running?"); setIsLoading(false); }
      });

    return () => { cancelled = true; };
  }, [isArticleMode, selected?.partId, selected?.questionN, selected?.articleN]);

  // Fetch passages for search or question mode
  useEffect(() => {
    if (isArticleMode) { setPassages([]); return; }

    const query = isSearchMode
      ? searchQuery.trim()
      : isQuestionMode && selected
      ? buildQuestionQuery(selected)
      : null;

    if (!query) { setPassages([]); setError(null); return; }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPassages([]);

    fetch(`/api/passages?query=${encodeURIComponent(query)}&top_k=8`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled) { setPassages(Array.isArray(data) ? data : []); setIsLoading(false); } })
      .catch(() => {
        if (!cancelled) { setError("Could not retrieve passages. Is the backend running?"); setIsLoading(false); }
      });

    return () => { cancelled = true; };
  }, [isArticleMode, isSearchMode, isQuestionMode, searchQuery, selected?.partId, selected?.questionN]);

  // ── Welcome ──────────────────────────────────────────────────────────────────
  if (!selected && !searchQuery) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-8">
        <p className="font-cardo italic text-[26px] text-muted-foreground/20 tracking-wide leading-tight">
          Summa Theologica
        </p>
        <p className="font-cardo italic text-[13px] text-muted-foreground/20">
          Sancti Thomæ de Aquino
        </p>
        <p className="font-inter text-[10px] text-muted-foreground/25 tracking-widest uppercase mt-3">
          Select a question or search above
        </p>
      </div>
    );
  }

  // ── Header ───────────────────────────────────────────────────────────────────
  const renderHeader = () => {
    if (isSearchMode) return (
      <>
        <p className="font-inter text-[9px] tracking-widest uppercase text-muted-foreground/50 mb-1">
          Search results
        </p>
        <p className="font-cardo italic text-[15px] text-foreground/75 leading-snug">{searchQuery}</p>
      </>
    );
    if (!selected) return null;
    return (
      <>
        <p className="font-inter text-[9px] font-mono tracking-widest text-muted-foreground/50 mb-1.5">
          {selected.partAbbr} · Q.{selected.questionN}
          {selected.articleN !== undefined && ` · A.${selected.articleN}`}
        </p>
        <h1 className="font-cardo text-[16px] text-foreground/85 leading-snug">
          {isArticleMode && article ? article.article_title : selected.questionTitle}
        </h1>
      </>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 px-7 py-3.5 border-b border-border">
        <div className="max-w-prose mx-auto">
          {renderHeader()}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-7">
        <div className="max-w-prose mx-auto">
          {isLoading && (
            <div className="flex items-center gap-2.5 text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="font-inter text-[9px] tracking-widest uppercase">
                {isArticleMode ? "Loading article…" : "Retrieving passages…"}
              </span>
            </div>
          )}

          {error && (
            <p className="font-inter text-[11px] text-muted-foreground border border-border rounded p-4">
              {error}
            </p>
          )}

          {!isLoading && !error && isArticleMode && article && (
            <ArticleView article={article} />
          )}

          {!isLoading && !error && !isArticleMode && passages.length === 0 && (
            <p className="font-cardo italic text-[13px] text-muted-foreground/40">
              No passages retrieved. The index may not contain this text yet.
            </p>
          )}

          {!isLoading && !isArticleMode && passages.length > 0 && (
            <PassageList passages={passages} />
          )}
        </div>
      </div>
    </div>
  );
}
