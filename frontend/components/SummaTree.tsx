"use client";

import { useState, memo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ChevronDown } from "lucide-react";
import { SUMMA_PARTS, type SelectedNode, type SummaQuestion, type SummaPart } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { fetchArticle } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface SummaTreeHandle {
  focus: () => void;
}

interface SummaTreeProps {
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode) => void;
}

const TreatiseDivider = memo(({ label }: { label: string }) => (
  <p className="px-2 pt-3 pb-0.5 text-[9.5px] uppercase tracking-[0.1em] font-medium select-none text-muted-foreground/35">
    {label}
  </p>
));
TreatiseDivider.displayName = "TreatiseDivider";

const ArticleRow = memo(({ n, title, isSelected, onClick, onPrefetch }: {
  n: number;
  title?: string;
  isSelected: boolean;
  onClick: () => void;
  onPrefetch?: () => void;
}) => (
  <button
    onClick={onClick}
    onPointerEnter={onPrefetch}
    data-selected={isSelected ? "" : undefined}
    className={cn(
      "w-full text-left px-2 py-1.5 rounded-sm transition-colors flex items-baseline gap-1.5",
      isSelected
        ? "bg-foreground/[0.08] text-foreground"
        : "text-muted-foreground/55 hover:text-foreground/80 hover:bg-foreground/[0.04]"
    )}
  >
    <span className="text-[10px] font-mono shrink-0 text-muted-foreground/35 tabular-nums">A{n}</span>
    {title && <span className="text-[11px] leading-snug">{title}</span>}
  </button>
));
ArticleRow.displayName = "ArticleRow";

const QuestionRow = memo(({
  q, part, selected, onSelect, expanded, onToggle,
}: {
  q: SummaQuestion;
  part: SummaPart;
  selected: SelectedNode | null;
  onSelect: (n: SelectedNode) => void;
  expanded: boolean;
  onToggle: () => void;
}) => {
  const isQSelected = selected?.partId === part.id && selected.questionN === q.n && selected.articleN === undefined;
  const articleTitles = SUMMA_ARTICLE_TITLES[part.id]?.[q.n];
  const articleCount = articleTitles?.length ?? q.articles;
  const queryClient = useQueryClient();

  return (
    <div>
      <button
        onClick={onToggle}
        data-selected={isQSelected ? "" : undefined}
        className={cn(
          "w-full flex items-start gap-1.5 px-2 py-[7px] rounded-sm text-left transition-colors group",
          isQSelected
            ? "bg-foreground/[0.07] text-foreground"
            : "hover:bg-foreground/[0.04]"
        )}
      >
        <ChevronRight className={cn("h-2.5 w-2.5 mt-[3px] shrink-0 text-muted-foreground/35 transition-transform duration-150", expanded && "rotate-90")} />
        <span className="text-[10.5px] font-mono text-muted-foreground/40 shrink-0 tabular-nums">{q.n}.</span>
        <span className={cn("text-[11.5px] leading-snug", isQSelected ? "text-foreground" : "text-foreground/70 group-hover:text-foreground/90")}>
          {q.title}
        </span>
      </button>
      {expanded && (
        <div className="ml-[19px] pl-2.5 border-l border-border/40 mb-0.5">
          {Array.from({ length: articleCount }, (_, i) => i + 1).map((n) => (
            <ArticleRow
              key={n}
              n={n}
              title={articleTitles?.find((a) => a.n === n)?.title}
              isSelected={selected?.partId === part.id && selected.questionN === q.n && selected.articleN === n}
              onClick={() => onSelect({ partId: part.id, partLabel: part.label, partAbbr: part.abbr, questionN: q.n, questionTitle: q.title, articleN: n })}
              onPrefetch={() => queryClient.prefetchQuery({
                queryKey: ["article", part.id, q.n, n],
                queryFn: () => fetchArticle(part.id, q.n, n),
                staleTime: Infinity,
              })}
            />
          ))}
        </div>
      )}
    </div>
  );
});
QuestionRow.displayName = "QuestionRow";

const SummaTree = forwardRef<SummaTreeHandle, SummaTreeProps>(function SummaTree(
  { selected, onSelect },
  ref
) {
  const [book, setBook] = useState<"theologica" | "contra-gentiles">("theologica");
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(false);

  useImperativeHandle(ref, () => ({
    focus: () => scrollRef.current?.focus(),
  }));

  const togglePart = (id: string) =>
    setExpandedParts((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleQuestion = (key: string) =>
    setExpandedQuestions((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  useEffect(() => {
    if (!selected) return;
    setExpandedParts((prev) => {
      if (prev.has(selected.partId)) return prev;
      const n = new Set(prev); n.add(selected.partId); return n;
    });
    if (selected.articleN !== undefined) {
      const qKey = `${selected.partId}-q${selected.questionN}`;
      setExpandedQuestions((prev) => {
        if (prev.has(qKey)) return prev;
        const n = new Set(prev); n.add(qKey); return n;
      });
    }
    if (!isMounted.current) { isMounted.current = true; return; }
    setTimeout(() => {
      scrollRef.current?.querySelector("[data-selected]")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 80);
  }, [selected?.partId, selected?.questionN, selected?.articleN]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-2 pt-2 pb-1.5 border-b border-border">
        <div className="relative">
          <select
            value={book}
            onChange={(e) => setBook(e.target.value as "theologica" | "contra-gentiles")}
            className="w-full appearance-none pl-3 pr-7 py-2 bg-secondary border border-border rounded text-[12px] text-foreground focus:outline-none focus:border-foreground/25 transition-colors cursor-pointer"
          >
            <option value="theologica">Summa Theologica</option>
            <option value="contra-gentiles">Summa Contra Gentiles</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/45 pointer-events-none" />
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain py-1 select-none">
        {book === "contra-gentiles" ? (
          <div className="px-4 py-8 flex flex-col gap-2">
            <p className="text-[12px] text-foreground/70 font-cardo italic">Summa Contra Gentiles</p>
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">Content coming soon.</p>
          </div>
        ) : (
          SUMMA_PARTS.map((part) => {
            const partExpanded = expandedParts.has(part.id);
            const qqCount = part.treatises.reduce((s, t) => s + t.questions.length, 0);
            return (
              <div key={part.id} className="mb-0.5">
                <button
                  onClick={() => togglePart(part.id)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-sm hover:bg-foreground/[0.04] text-left transition-colors"
                >
                  <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground/35 transition-transform duration-150", partExpanded && "rotate-90")} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-foreground/85 leading-tight">{part.label}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">{part.abbr} · {qqCount} qq.</p>
                  </div>
                </button>
                {partExpanded && (
                  <div className="ml-4 pl-1 border-l border-border/50 pb-1">
                    {part.treatises.map((treatise, ti) => (
                      <div key={ti}>
                        <TreatiseDivider label={treatise.label} />
                        {treatise.questions.map((q) => {
                          const qKey = `${part.id}-q${q.n}`;
                          return (
                            <QuestionRow
                              key={q.n}
                              q={q}
                              part={part}
                              selected={selected}
                              onSelect={onSelect}
                              expanded={expandedQuestions.has(qKey)}
                              onToggle={() => toggleQuestion(qKey)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default SummaTree;
