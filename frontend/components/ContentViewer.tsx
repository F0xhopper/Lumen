"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Bookmark, Search, MessageSquare } from "lucide-react";
import { getAdjacentArticles, type SelectedNode } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { fetchArticle, fetchPassages, type Article, type Passage } from "@/lib/api";
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

// ── Article view (structured sections with anchors) ────────────────────────────

const ORDINALS = "primum|secundum|tertium|quartum|quintum|sextum|septimum|octavum|nonum|decimum";
const LABEL_RE = new RegExp(
  "^(" +
    // English
    "Objection \\d+\\.|" +
    "Reply to Objection \\d+\\.|" +
    "On the contrary[,.]?|" +
    "I answer that[,.]?|" +
    // Latin
    `Ad (?:${ORDINALS}) sic proceditur[.]?|` +
    "Praeterea[.,]?|" +
    "Sed contra(?:\\s+est)?[.,]?|" +
    "Respondeo dicendum[,.]?|" +
    `Ad (?:${ORDINALS}) (?:ergo )?dicendum[,.]?` +
  ")\\s*",
  "i"
);
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
  if (l.startsWith("i answer that"))              return "font-semibold text-foreground";
  if (l.startsWith("respondeo"))                  return "font-semibold text-foreground";
  if (l.startsWith("on the contrary"))            return "font-semibold text-foreground/80";
  if (l.startsWith("sed contra"))                 return "font-semibold text-foreground/80";
  if (l.startsWith("objection"))                  return "font-semibold text-foreground/65";
  if (l.startsWith("ad ") && l.includes("sic"))  return "font-semibold text-foreground/65";
  if (l.startsWith("praeterea"))                  return "font-semibold text-foreground/65";
  if (l.startsWith("reply to"))                   return "font-semibold text-foreground/60";
  if (l.startsWith("ad ") && l.includes("dicendum")) return "font-semibold text-foreground/60";
  return "font-semibold text-foreground/90";
}

function renderWithBoldLabel(text: string): React.ReactNode {
  const m = LABEL_RE.exec(text);
  const body = m ? text.slice(m[0].length) : text;
  if (!m) return renderWithQuotes(body);
  const trailingPunct = m[1].match(/[,.]$/)?.[0] ?? "";
  const labelText = trailingPunct ? m[1].slice(0, -1) : m[1];
  return (
    <>
      <span className={rubricClass(m[1])}>{labelText}</span>{trailingPunct}{" "}
      {renderWithQuotes(body)}
    </>
  );
}

type LangMode = "en" | "la" | "both";

function SectionBlock({
  id, text, className,
}: {
  id?: string; text: string; className?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6", className)}>
      <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/82 whitespace-pre-wrap">
        {renderWithBoldLabel(text)}
      </p>
    </section>
  );
}

function ArticleColumn({ article, lang, withIds }: {
  article: Article;
  lang: "en" | "la";
  withIds?: boolean;
}) {
  const isLatin     = lang === "la";
  const objections  = isLatin ? article.objections_la  : article.objections;
  const sed_contra  = isLatin ? article.sed_contra_la  : article.sed_contra;
  const respondeo   = isLatin ? article.respondeo_la   : article.respondeo;
  const replies     = isLatin ? article.replies_la     : article.replies;
  const body        = isLatin ? article.body_la        : article.body;

  const hasStructure = respondeo || sed_contra || objections.length > 0 || replies.length > 0;

  if (isLatin && !hasStructure) {
    return (
      <p className="font-cardo italic text-[12px] text-muted-foreground/30">
        Latin text not yet imported for this article.
      </p>
    );
  }

  if (!hasStructure) {
    return (
      <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/82 whitespace-pre-wrap">
        {body}
      </p>
    );
  }

  return (
    <div className="space-y-9">
      {objections.map((obj) => (
        <SectionBlock key={obj.n} id={withIds ? `objection-${obj.n}` : undefined} text={obj.text} />
      ))}

      {sed_contra && (
        <>
          <div className="h-px bg-border/25" />
          <SectionBlock id={withIds ? "sed-contra" : undefined} text={sed_contra} />
        </>
      )}

      {respondeo && (
        <>
          <div className="h-px bg-border/25" />
          <SectionBlock
            id={withIds ? "respondeo" : undefined}
            text={respondeo}
            className="bg-foreground/[0.02] -mx-4 px-4 py-4 rounded"
          />
        </>
      )}

      {replies.length > 0 && (
        <>
          <div className="h-px bg-border/25" />
          {replies.map((rep) => (
            <SectionBlock key={rep.n} id={withIds ? `reply-${rep.n}` : undefined} text={rep.text} />
          ))}
        </>
      )}
    </div>
  );
}

// Renders one section pair as a single grid row so both sides align at the top.
// Without items-start, grid cells stretch to row height — the border-l on the
// right column extends the full height of whichever side is taller.
function SectionPairRow({ en, la, enId, respondeoStyle }: {
  en: string | null;
  la: string | null;
  enId?: string;
  respondeoStyle?: boolean;
}) {
  const extraClass = respondeoStyle ? "bg-foreground/[0.02] -mx-4 px-4 py-4 rounded" : undefined;
  return (
    <div className="grid grid-cols-2">
      <div className="pr-8">
        {en && <SectionBlock id={enId} text={en} className={extraClass} />}
      </div>
      <div className="border-l border-border/20 pl-8">
        {la && <SectionBlock text={la} className={extraClass} />}
      </div>
    </div>
  );
}

function SideBySideArticleView({ article }: { article: Article }) {
  const maxObjs    = Math.max(article.objections.length,    article.objections_la.length);
  const maxReplies = Math.max(article.replies.length,       article.replies_la.length);
  const hasSC      = article.sed_contra   || article.sed_contra_la;
  const hasResp    = article.respondeo    || article.respondeo_la;

  return (
    <div>
      {/* Objections — one row per pair */}
      <div className="space-y-9">
        {Array.from({ length: maxObjs }, (_, i) => {
          const en = article.objections[i];
          const la = article.objections_la[i];
          return (
            <SectionPairRow
              key={`obj-${i}`}
              en={en?.text ?? null}
              la={la?.text ?? null}
              enId={en ? `objection-${en.n}` : undefined}
            />
          );
        })}
      </div>

      {hasSC && (
        <>
          <div className="my-9 h-px bg-border/25" />
          <SectionPairRow
            en={article.sed_contra ?? null}
            la={article.sed_contra_la ?? null}
            enId="sed-contra"
          />
        </>
      )}

      {hasResp && (
        <>
          <div className="my-9 h-px bg-border/25" />
          <SectionPairRow
            en={article.respondeo ?? null}
            la={article.respondeo_la ?? null}
            enId="respondeo"
            respondeoStyle
          />
        </>
      )}

      {maxReplies > 0 && (
        <>
          <div className="my-9 h-px bg-border/25" />
          <div className="space-y-9">
            {Array.from({ length: maxReplies }, (_, i) => {
              const en = article.replies[i];
              const la = article.replies_la[i];
              return (
                <SectionPairRow
                  key={`rep-${i}`}
                  en={en?.text ?? null}
                  la={la?.text ?? null}
                  enId={en ? `reply-${en.n}` : undefined}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function ArticleView({ article, lang }: { article: Article; lang: LangMode }) {
  if (lang !== "both") {
    return (
      <div className="max-w-prose">
        <ArticleColumn article={article} lang={lang} withIds={lang === "en"} />
      </div>
    );
  }

  return <SideBySideArticleView article={article} />;
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
    <div className="space-y-8">
      {passages.map((p) => {
        const href = p.article_url
          ? `${p.article_url}#${p.url_fragment}`
          : null;
        const loc = `${p.part_abbr}  Q.${p.question_n} A.${p.article_n}`;

        const card = (
          <>
            <p className="font-inter text-[11px] tracking-wide text-muted-foreground/45 mb-3">
              {loc}
              {p.article_title && (
                <>
                  <span className="mx-2 text-muted-foreground/25">·</span>
                  <span className="font-cardo italic text-[13px]">{p.article_title}</span>
                </>
              )}
            </p>

            <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/80 whitespace-pre-wrap">
              {highlightTerms(p.text, searchQuery)}
            </p>

          </>
        );

        return href ? (
          <Link
            key={p.rank}
            href={href}
            className="block -mx-3 px-3 py-3 rounded transition-colors hover:bg-foreground/[0.025]"
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
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.035] transition-colors"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="font-inter text-[10px] tracking-[0.10em] uppercase leading-none">{label}</span>
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
  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const lang: LangMode = "both";
  const scrollRef = useRef<HTMLDivElement>(null);

  const { prev: prevNode, next: nextNode } = selected
    ? getAdjacentArticles(selected)
    : { prev: null, next: null };

  const isArticleMode = Boolean(selected?.articleN !== undefined && !searchQuery.trim());
  const isSearchMode  = Boolean(searchQuery.trim());

  const resolvedPartId = selected
    ? (ABBR_TO_PART_ID[selected.partAbbr] ?? selected.partId)
    : "";

  // ── Article query ────────────────────────────────────────────────────────────
  const {
    data: article,
    isLoading: articleLoading,
    error: articleError,
  } = useQuery({
    queryKey: ["article", resolvedPartId, selected?.questionN, selected?.articleN],
    queryFn: () => fetchArticle(resolvedPartId, selected!.questionN, selected!.articleN!),
    enabled: isArticleMode && !!selected,
    staleTime: Infinity, // articles are static — never re-fetch
    retry: 1,
  });

  // ── Passages query ───────────────────────────────────────────────────────────
  const trimmedQuery = searchQuery.trim();
  const {
    data: passages = [],
    isLoading: passagesLoading,
    error: passagesError,
  } = useQuery({
    queryKey: ["passages", trimmedQuery],
    queryFn: () => fetchPassages(trimmedQuery),
    enabled: isSearchMode,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const isLoading = articleLoading || passagesLoading;
  const error = articleError || passagesError;

  // ── Highlight menu ───────────────────────────────────────────────────────────
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

  // Dismiss highlight on scroll
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
          <p className="font-inter text-[11px] tracking-widest uppercase text-muted-foreground/60">
            Search results
          </p>
          {!isLoading && passages.length > 0 && (
            <span className="font-mono text-[11px] text-muted-foreground/45">{passages.length}</span>
          )}
          {previousSelected && onBack && (
            <button
              onClick={onBack}
              title={`Back to ${previousSelected.partAbbr} Q.${previousSelected.questionN}${previousSelected.articleN !== undefined ? ` A.${previousSelected.articleN}` : ""}`}
              className="flex items-center gap-0.5 font-inter text-[11px] tracking-wide text-muted-foreground/40 hover:text-foreground/70 transition-colors"
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
        <p className="font-mono text-[11px] text-muted-foreground/55 mb-2 tracking-wide">
          {selected.partAbbr} · Q.{selected.questionN}{selected.articleN !== undefined && ` · A.${selected.articleN}`}
        </p>
        <h1 className="font-cardo text-[17px] text-foreground/90 leading-snug">
          {selected.articleN !== undefined
            ? (SUMMA_ARTICLE_TITLES[selected.partId]?.[selected.questionN]?.find((a) => a.n === selected.articleN)?.title ?? selected.questionTitle)
            : selected.questionTitle}
        </h1>
      </>
    );
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 px-7 py-3.5 border-b border-border">
        <div className={cn("mx-auto flex items-center justify-between gap-4", lang === "both" && !isSearchMode ? "w-full" : "max-w-prose")}>
          <div className="min-w-0">
            {renderHeader()}
          </div>
          {isArticleMode && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => prevNode && router.push(articleUrl(prevNode))}
                  disabled={!prevNode}
                  title={prevNode ? `${prevNode.partAbbr} Q.${prevNode.questionN} A.${prevNode.articleN}` : undefined}
                  className="p-2.5 text-muted-foreground/40 hover:text-foreground/70 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => nextNode && router.push(articleUrl(nextNode))}
                  disabled={!nextNode}
                  title={nextNode ? `${nextNode.partAbbr} Q.${nextNode.questionN} A.${nextNode.articleN}` : undefined}
                  className="p-2.5 text-muted-foreground/40 hover:text-foreground/70 disabled:opacity-20 disabled:pointer-events-none transition-colors"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-7">
        <div className={cn("mx-auto", lang === "both" && !isSearchMode ? "w-full" : "max-w-prose")}>
          {isLoading && (
            <div className="flex items-center gap-2.5 text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="font-inter text-[11px] tracking-widest uppercase">
                {isArticleMode ? "Loading article…" : "Retrieving passages…"}
              </span>
            </div>
          )}

          {error && (
            <p className="font-inter text-[11px] text-muted-foreground border border-border rounded p-4">
              {isArticleMode
                ? "Could not load article. Is the backend running?"
                : "Could not retrieve passages. Is the backend running?"}
            </p>
          )}

          {!isLoading && !error && isArticleMode && article && (
            <ArticleView article={article} lang={lang} />
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
