"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAdjacentArticles, SUMMA_PARTS, type SelectedNode } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { fetchArticle, fetchPassages, fetchQuestionMatches, ApiError, getErrorMessage } from "@/lib/api";
import { PART_ABBR_TO_PART_ID, PART_ID_TO_SLUG, nodeUrl } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ArticleView } from "./ArticleView";
import { PassageList, QuestionJumpList, SearchLoadingSkeleton, ArticleLoadingSkeleton, EmptySearchState } from "./PassageList";
import { HighlightMenu, type HighlightState } from "./HighlightMenu";

function ContentHeader({
  isSearchMode,
  selected,
  searchQuery,
  passages,
  isLoading,
  previousSelected,
  onBack,
}: {
  isSearchMode: boolean;
  selected: SelectedNode | null;
  searchQuery: string;
  passages: unknown[];
  isLoading: boolean;
  previousSelected?: SelectedNode | null;
  onBack?: () => void;
}) {
  if (isSearchMode) {
    return (
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
  }

  if (!selected) return null;

  return (
    <>
      <p className="font-mono text-[11px] text-muted-foreground/55 mb-2 tracking-wide">
        {selected.partAbbr} · Q.{selected.questionN}
        {selected.articleN !== undefined && ` · A.${selected.articleN}`}
      </p>
      <h1 className="font-cardo text-[17px] text-foreground/90 leading-snug">
        {selected.articleN !== undefined
          ? (SUMMA_ARTICLE_TITLES[selected.partId]?.[selected.questionN]?.find(
              (a) => a.n === selected.articleN
            )?.title ?? selected.questionTitle)
          : selected.questionTitle}
      </h1>
    </>
  );
}

export interface ContentViewerHandle {
  scrollBy: (delta: number) => void;
  scrollToTop: () => void;
  scrollToBottom: () => void;
}

interface ContentViewerProps {
  selected: SelectedNode | null;
  searchQuery: string;
  previousSelected?: SelectedNode | null;
  highlightFragment?: string | null;
  onBack?: () => void;
  onHighlightNote?: (text: string) => void;
  onHighlightSearch?: (text: string) => void;
  onHighlightAddToChat?: (text: string) => void;
}

const ContentViewer = forwardRef<ContentViewerHandle, ContentViewerProps>(
  function ContentViewer(
    {
      selected,
      searchQuery,
      previousSelected,
      highlightFragment,
      onBack,
      onHighlightNote,
      onHighlightSearch,
      onHighlightAddToChat,
    },
    ref
  ) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [highlight, setHighlight] = useState<HighlightState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    scrollBy: (delta) => scrollRef.current?.scrollBy({ top: delta, behavior: "smooth" }),
    scrollToTop: () => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" }),
    scrollToBottom: () => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    },
  }));

  const { prev: prevNode, next: nextNode } = selected
    ? getAdjacentArticles(selected)
    : { prev: null, next: null };

  const isArticleMode  = Boolean(selected?.articleN !== undefined && !searchQuery.trim());
  const isQuestionMode = Boolean(selected && selected.articleN === undefined && !searchQuery.trim());
  const isSearchMode   = Boolean(searchQuery.trim());

  const resolvedPartId = selected
    ? (PART_ABBR_TO_PART_ID[selected.partAbbr] ?? selected.partId)
    : "";

  const retryPolicy = (failureCount: number, error: unknown) => {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return false;
    return failureCount < 1;
  };

  const {
    data: article,
    isLoading: articleLoading,
    error: articleError,
    refetch: refetchArticle,
  } = useQuery({
    queryKey: ["article", resolvedPartId, selected?.questionN, selected?.articleN],
    queryFn: () => fetchArticle(resolvedPartId, selected!.questionN, selected!.articleN!),
    enabled: isArticleMode && !!selected,
    staleTime: Infinity,
    retry: retryPolicy,
  });

  const trimmedQuery = searchQuery.trim();
  const {
    data: passages = [],
    isLoading: passagesLoading,
    error: passagesError,
    refetch: refetchPassages,
  } = useQuery({
    queryKey: ["passages", trimmedQuery],
    queryFn: () => fetchPassages(trimmedQuery),
    enabled: isSearchMode,
    staleTime: 5 * 60 * 1000,
    retry: retryPolicy,
  });

  const { data: questionMatches = [] } = useQuery({
    queryKey: ["question-matches", trimmedQuery],
    queryFn: () => fetchQuestionMatches(trimmedQuery),
    enabled: isSearchMode,
    staleTime: 5 * 60 * 1000,
    retry: retryPolicy,
  });

  const isLoading = articleLoading || passagesLoading;
  const error = articleError || passagesError;

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

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dismiss = () => setHighlight(null);
    el.addEventListener("scroll", dismiss);
    return () => el.removeEventListener("scroll", dismiss);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [selected?.partId, selected?.questionN, selected?.articleN]);

  useEffect(() => {
    if (scrollRef.current && trimmedQuery) scrollRef.current.scrollTop = 0;
  }, [trimmedQuery]);

  useEffect(() => {
    if (!article) return;
    const hash = window.location.hash.slice(1) || highlightFragment || "";
    if (!hash) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("section-flash");
      void el.offsetWidth; // force reflow so animation restarts if already active
      el.classList.add("section-flash");
    }, 80);
    return () => clearTimeout(timer);
  }, [article, highlightFragment]);

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

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 px-4 py-3 sm:px-7 sm:py-3.5 border-b border-border">
        <div className={cn("mx-auto flex items-center justify-between gap-4", isSearchMode ? "max-w-prose" : "w-full")}>
          <div className="min-w-0">
            <ContentHeader
              isSearchMode={isSearchMode}
              selected={selected}
              searchQuery={searchQuery}
              passages={passages}
              isLoading={isLoading}
              previousSelected={previousSelected}
              onBack={onBack}
            />
          </div>
          {isArticleMode && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => prevNode && router.push(nodeUrl(prevNode))}
                onPointerEnter={() => prevNode?.articleN !== undefined && queryClient.prefetchQuery({
                  queryKey: ["article", PART_ABBR_TO_PART_ID[prevNode.partAbbr] ?? prevNode.partId, prevNode.questionN, prevNode.articleN],
                  queryFn: () => fetchArticle(PART_ABBR_TO_PART_ID[prevNode.partAbbr] ?? prevNode.partId, prevNode.questionN, prevNode.articleN!),
                  staleTime: Infinity,
                })}
                disabled={!prevNode}
                title={prevNode ? `${prevNode.partAbbr} Q.${prevNode.questionN} A.${prevNode.articleN}` : undefined}
                className="p-2.5 text-muted-foreground/40 hover:text-foreground/70 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => nextNode && router.push(nodeUrl(nextNode))}
                onPointerEnter={() => nextNode?.articleN !== undefined && queryClient.prefetchQuery({
                  queryKey: ["article", PART_ABBR_TO_PART_ID[nextNode.partAbbr] ?? nextNode.partId, nextNode.questionN, nextNode.articleN],
                  queryFn: () => fetchArticle(PART_ABBR_TO_PART_ID[nextNode.partAbbr] ?? nextNode.partId, nextNode.questionN, nextNode.articleN!),
                  staleTime: Infinity,
                })}
                disabled={!nextNode}
                title={nextNode ? `${nextNode.partAbbr} Q.${nextNode.questionN} A.${nextNode.articleN}` : undefined}
                className="p-2.5 text-muted-foreground/40 hover:text-foreground/70 disabled:opacity-20 disabled:pointer-events-none transition-colors"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
        <div className={cn("mx-auto", isSearchMode || isQuestionMode ? "max-w-prose" : "w-full")}>
          {isLoading && isSearchMode && <SearchLoadingSkeleton />}

          {isLoading && isArticleMode && <ArticleLoadingSkeleton />}

          {error ? (
            <div className="border border-border rounded p-4 space-y-2">
              <p className="font-inter text-[11px] text-muted-foreground">
                {getErrorMessage(error, isArticleMode ? "article" : "search")}
              </p>
              {!(error instanceof ApiError && (error.status === 404 || error.status === 400)) && (
                <button
                  onClick={() => isArticleMode ? refetchArticle() : refetchPassages()}
                  className="font-inter text-[10px] tracking-wide text-muted-foreground/50 hover:text-foreground/70 transition-colors"
                >
                  Try again
                </button>
              )}
            </div>
          ) : null}

          {!isLoading && !error && isArticleMode && article && (
            <ArticleView article={article} />
          )}

          {isQuestionMode && selected && (() => {
            const slug = PART_ID_TO_SLUG[selected.partId] ?? PART_ID_TO_SLUG[PART_ABBR_TO_PART_ID[selected.partAbbr]];
            const articleTitles = SUMMA_ARTICLE_TITLES[selected.partId]?.[selected.questionN] ?? [];
            const articleCount = articleTitles.length ||
              (SUMMA_PARTS.find(p => p.id === selected.partId)
                ?.treatises.flatMap(t => t.questions)
                .find(q => q.n === selected.questionN)?.articles ?? 0);
            return (
              <div className="space-y-1">
                <p className="font-inter text-[10px] tracking-widest uppercase text-muted-foreground/35 mb-4">
                  {articleCount} {articleCount === 1 ? "article" : "articles"}
                </p>
                {Array.from({ length: articleCount }, (_, i) => i + 1).map((n) => {
                  const title = articleTitles.find(a => a.n === n)?.title;
                  return (
                    <Link
                      key={n}
                      href={`/${slug}/${selected.questionN}/${n}`}
                      className="block -mx-3 px-3 py-2 rounded transition-colors hover:bg-foreground/[0.025] group"
                    >
                      <span className="font-inter text-[11px] text-muted-foreground/45 group-hover:text-muted-foreground/60 transition-colors">
                        A.{n}
                        {title && (
                          <>
                            <span className="mx-2 text-muted-foreground/25">·</span>
                            <span className="font-cardo italic text-[13px] text-foreground/70 group-hover:text-foreground/85 transition-colors">{title}</span>
                          </>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            );
          })()}

          {!isLoading && isSearchMode && questionMatches.length > 0 && (
            <QuestionJumpList matches={questionMatches} />
          )}

          {!isLoading && !error && isSearchMode && passages.length === 0 && questionMatches.length === 0 && (
            <EmptySearchState query={trimmedQuery} />
          )}

          {!isLoading && isSearchMode && passages.length > 0 && (
            <PassageList passages={passages} searchQuery={searchQuery} />
          )}
        </div>
      </div>

      {highlight && (
        <HighlightMenu
          highlight={highlight}
          citation={
            selected?.articleN !== undefined
              ? `ST ${selected.partAbbr}, q.${selected.questionN}, a.${selected.articleN}`
              : selected
              ? `ST ${selected.partAbbr}, q.${selected.questionN}`
              : undefined
          }
          onNote={onHighlightNote ?? (() => {})}
          onSearch={onHighlightSearch ?? (() => {})}
          onAddToChat={onHighlightAddToChat ?? (() => {})}
          onDismiss={() => { setHighlight(null); window.getSelection()?.removeAllRanges(); }}
        />
      )}
    </div>
  );
});

export default ContentViewer;
