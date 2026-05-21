"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Bookmark, Search, MessageSquare } from "lucide-react";
import { getAdjacentArticles, type SelectedNode } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { cn } from "@/lib/utils";

const PART_TO_SLUG: Record<string, string> = {
  "prima-pars":       "1",
  "prima-secundae":   "1-2",
  "secunda-secundae": "2-2",
  "tertia-pars":      "3",
};

const ABBR_TO_PART_ID: Record<string, string> = {
  "ST I":    "prima-pars",
  "ST I-II": "prima-secundae",
  "ST II-II": "secunda-secundae",
  "ST III":  "tertia-pars",
};

function articleUrl(node: SelectedNode): string {
  return `/${PART_TO_SLUG[node.partId]}/${node.questionN}/${node.articleN}`;
}

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

// ── Article view (structured sections with anchors) ────────────────────────────

const LABEL_RE = /^(Objection \d+\.|Reply to Objection \d+\.|On the contrary[,.]?|I answer that[,.]?)\s*/i;
const QUOTE_RE = /("(?:[^"\\]|\\.)*")/;

function renderWithQuotes(text: string): React.ReactNode {
  const parts = text.split(QUOTE_RE);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        QUOTE_RE.test(part) ? (
          <span key={i} className="italic text-foreground/55">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
}

function rubricClass(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith("i answer that"))   return "font-semibold text-foreground";
  if (l.startsWith("on the contrary")) return "font-semibold text-foreground/80";
  if (l.startsWith("objection"))       return "font-semibold text-foreground/65";
  if (l.startsWith("reply to"))        return "font-semibold text-foreground/60";
  return "font-semibold text-foreground/90";
}

function renderWithBoldLabel(text: string): React.ReactNode {
  const m = LABEL_RE.exec(text);
  const body = m ? text.slice(m[0].length) : text;
  return (
    <>
      {m && <><span className={rubricClass(m[1])}>{m[1]}</span>{" "}</>}
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

// ── Question index (article list when a question is selected) ─────────────────

function QuestionIndex({ selected }: { selected: SelectedNode }) {
  const router = useRouter();
  const articles = SUMMA_ARTICLE_TITLES[selected.partId]?.[selected.questionN] ?? [];

  return (
    <div className="max-w-prose">
      {articles.length === 0 ? (
        <p className="font-cardo italic text-[13px] text-muted-foreground/40">No articles found.</p>
      ) : articles.map((art) => (
        <button
          key={art.n}
          onClick={() => router.push(`/${PART_TO_SLUG[selected.partId]}/${selected.questionN}/${art.n}`)}
          className="w-full text-left group flex items-start gap-4 py-3.5 border-b border-border/20 last:border-0 -mx-2 px-2 rounded transition-colors hover:bg-foreground/[0.025]"
        >
          <span className="font-mono text-[10px] text-muted-foreground/35 shrink-0 mt-[3px]">A.{art.n}</span>
          <span className="font-cardo text-[14px] text-foreground/70 group-hover:text-foreground/90 transition-colors leading-snug">
            {art.title}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Search term highlighting ───────────────────────────────────────────────────

function highlightTerms(text: string, query: string): React.ReactNode {
  const tokens = query
    .split(/\W+/)
    .map((t) => t.replace(/[^a-z0-9']/gi, ""))
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return text;

  const pattern = new RegExp(
    `(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-foreground/[0.09] text-foreground/95 rounded-[2px] px-px">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

// ── Passage list (search mode) ─────────────────────────────────────────────────

function sectionLabelClass(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith("i answer that"))   return "text-foreground/65";
  if (l.startsWith("on the contrary")) return "text-foreground/50";
  if (l.startsWith("objection"))       return "text-muted-foreground/40";
  if (l.startsWith("reply to"))        return "text-muted-foreground/35";
  return "text-muted-foreground/45";
}

function PassageList({ passages, searchQuery }: { passages: Passage[]; searchQuery: string }) {
  return (
    <div className="space-y-8 max-w-prose">
      {passages.map((p) => {
        const href = p.article_url
          ? `${p.article_url}#${p.url_fragment}`
          : null;
        const loc = `${p.part_abbr} Q.${p.question_n} A.${p.article_n}`;

        const card = (
          <>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[9px] font-mono text-muted-foreground/30">[{p.rank}]</span>
              <span className="font-inter text-[9px] tracking-wide text-muted-foreground/50">{loc}</span>
            </div>

            <div className="h-px bg-border/30 mb-3" />

            <div className="mb-3">
              <p className="font-cardo text-[13.5px] text-foreground/60 leading-snug">
                {p.question_title}
              </p>
              {p.article_title && (
                <p className="font-cardo italic text-[12px] text-muted-foreground/45 leading-snug mt-0.5">
                  {p.article_title}
                </p>
              )}
            </div>

            {p.section_label && (
              <p className={cn("font-inter text-[9px] tracking-widest uppercase mb-2", sectionLabelClass(p.section_label))}>
                {p.section_label}
              </p>
            )}

            <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/80 whitespace-pre-wrap">
              {highlightTerms(p.text, searchQuery)}
            </p>
          </>
        );

        return href ? (
          <Link
            key={p.rank}
            href={href}
            className="block -mx-3 px-3 py-2 rounded transition-colors hover:bg-foreground/[0.025]"
          >
            {card}
          </Link>
        ) : (
          <article key={p.rank}>{card}</article>
        );
      })}
    </div>
  );
}

// ── Highlight menu ─────────────────────────────────────────────────────────────

interface HighlightState {
  text: string;
  rect: DOMRect;
  mouseX: number;
  mouseY: number;
}

type HighlightAction = { icon: React.ElementType; label: string; onClick: () => void };

function HighlightMenu({
  highlight,
  onNote,
  onSearch,
  onAddToChat,
  onDismiss,
}: {
  highlight: HighlightState;
  onNote: (text: string) => void;
  onSearch: (text: string) => void;
  onAddToChat: (text: string) => void;
  onDismiss: () => void;
}) {
  const W = 186;
  const GAP = 8;

  const anchorX = Number.isFinite(highlight.mouseX)
    ? highlight.mouseX
    : highlight.rect.left + highlight.rect.width / 2;
  const anchorY = Number.isFinite(highlight.mouseY) ? highlight.mouseY : highlight.rect.bottom;

  const left = Math.max(8, Math.min(anchorX - W / 2, window.innerWidth - W - 8));
  const top = anchorY > 54 ? anchorY - 48 - GAP : anchorY + GAP;

  const actions: HighlightAction[] = [
    { icon: Bookmark,      label: "Note",   onClick: () => { onNote(highlight.text);      onDismiss(); } },
    { icon: Search,        label: "Search", onClick: () => { onSearch(highlight.text);    onDismiss(); } },
    { icon: MessageSquare, label: "Chat",   onClick: () => { onAddToChat(highlight.text); onDismiss(); } },
  ];

  return (
    <div
      data-highlight-menu=""
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-50 flex items-stretch bg-background border border-border/60 rounded shadow-md shadow-black/30 divide-x divide-border/40 overflow-hidden"
      style={{ left, top, width: W }}
    >
      {actions.map(({ icon: Icon, label, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          className="flex-1 flex flex-col items-center justify-center gap-[3px] py-[7px] text-muted-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.035] transition-colors"
        >
          <Icon className="h-[11px] w-[11px]" />
          <span className="font-inter text-[6.5px] tracking-[0.12em] uppercase leading-none">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ContentViewer({
  selected,
  searchQuery,
  previousSelected,
  onBack,
  onHighlightNote,
  onHighlightSearch,
  onHighlightAddToChat,
}: {
  selected: SelectedNode | null;
  searchQuery: string;
  previousSelected?: SelectedNode | null;
  onBack?: () => void;
  onHighlightNote?: (text: string) => void;
  onHighlightSearch?: (text: string) => void;
  onHighlightAddToChat?: (text: string) => void;
}) {
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [passages, setPassages] = useState<Passage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { prev: prevNode, next: nextNode } = selected
    ? getAdjacentArticles(selected)
    : { prev: null, next: null };

  const isArticleMode = Boolean(selected?.articleN !== undefined && !searchQuery.trim());
  const isSearchMode  = Boolean(searchQuery.trim());
  const isQuestionMode = Boolean(selected && selected.articleN === undefined && !searchQuery.trim());

  // Show highlight menu on text selection inside the scroll container
  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { setHighlight(null); return; }
      const text = sel.toString().trim();
      if (text.length < 3) { setHighlight(null); return; }
      const container = scrollRef.current;
      if (!container) return;
      const range = sel.getRangeAt(0);
      if (!container.contains(range.commonAncestorContainer)) { setHighlight(null); return; }
      setHighlight({ text, rect: range.getBoundingClientRect(), mouseX: e.clientX, mouseY: e.clientY });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest?.("[data-highlight-menu]")) return;
      setHighlight(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  // Dismiss on scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dismiss = () => setHighlight(null);
    el.addEventListener("scroll", dismiss);
    return () => el.removeEventListener("scroll", dismiss);
  }, []);

  // Reset scroll position on article change
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selected?.partId, selected?.questionN, selected?.articleN]);

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

    const partId = ABBR_TO_PART_ID[selected.partAbbr] ?? selected.partId;

    fetch(`/api/article?part_id=${partId}&question_n=${selected.questionN}&article_n=${selected.articleN}`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled) { setArticle(data); setIsLoading(false); } })
      .catch(() => {
        if (!cancelled) { setError("Could not load article. Is the backend running?"); setIsLoading(false); }
      });

    return () => { cancelled = true; };
  }, [isArticleMode, selected?.partId, selected?.questionN, selected?.articleN]);

  // Fetch passages for search mode only
  useEffect(() => {
    if (!isSearchMode || !searchQuery.trim()) { setPassages([]); setError(null); setIsLoading(false); return; }

    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setPassages([]);

    fetch(`/api/passages?query=${encodeURIComponent(searchQuery.trim())}&top_k=8`)
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((data) => { if (!cancelled) { setPassages(Array.isArray(data) ? data : []); setIsLoading(false); } })
      .catch(() => {
        if (!cancelled) { setError("Could not retrieve passages. Is the backend running?"); setIsLoading(false); }
      });

    return () => { cancelled = true; };
  }, [isSearchMode, searchQuery]);

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
        <div className="flex items-center gap-2 mb-1">
          <p className="font-inter text-[9px] tracking-widest uppercase text-muted-foreground/50">
            Search results
          </p>
          {!isLoading && passages.length > 0 && (
            <span className="font-mono text-[9px] text-muted-foreground/30">{passages.length}</span>
          )}
          {previousSelected && onBack && (
            <button
              onClick={onBack}
              title={`Back to ${previousSelected.partAbbr} Q.${previousSelected.questionN}${previousSelected.articleN !== undefined ? ` A.${previousSelected.articleN}` : ""}`}
              className="flex items-center gap-0.5 font-inter text-[9px] tracking-wide text-muted-foreground/40 hover:text-foreground/70 transition-colors"
            >
              <ChevronLeft className="h-2.5 w-2.5" />
              <span>
                {previousSelected.partAbbr} Q.{previousSelected.questionN}
                {previousSelected.articleN !== undefined && ` A.${previousSelected.articleN}`}
              </span>
            </button>
          )}
        </div>
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
        <div className="max-w-prose mx-auto flex items-start justify-between gap-4">
          <div className="min-w-0">
            {renderHeader()}
          </div>
          {isArticleMode && (
            <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
              <button
                onClick={() => prevNode && router.push(articleUrl(prevNode))}
                disabled={!prevNode}
                title={prevNode ? `${prevNode.partAbbr} Q.${prevNode.questionN} A.${prevNode.articleN}` : undefined}
                className="p-1 text-muted-foreground/40 hover:text-foreground/70 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => nextNode && router.push(articleUrl(nextNode))}
                disabled={!nextNode}
                title={nextNode ? `${nextNode.partAbbr} Q.${nextNode.questionN} A.${nextNode.articleN}` : undefined}
                className="p-1 text-muted-foreground/40 hover:text-foreground/70 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
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

          {!isLoading && !error && isQuestionMode && selected && (
            <QuestionIndex selected={selected} />
          )}

          {!isLoading && !error && isSearchMode && passages.length === 0 && (
            <p className="font-cardo italic text-[13px] text-muted-foreground/40">
              No passages retrieved. The index may not contain this text yet.
            </p>
          )}

          {!isLoading && isSearchMode && passages.length > 0 && (
            <PassageList passages={passages} searchQuery={searchQuery} />
          )}
        </div>
      </div>

      {highlight && (
        <HighlightMenu
          highlight={highlight}
          onNote={onHighlightNote ?? (() => {})}
          onSearch={onHighlightSearch ?? (() => {})}
          onAddToChat={onHighlightAddToChat ?? (() => {})}
          onDismiss={() => { setHighlight(null); window.getSelection()?.removeAllRanges(); }}
        />
      )}
    </div>
  );
}
