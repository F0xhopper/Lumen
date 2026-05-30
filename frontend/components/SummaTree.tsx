"use client";

import { useState, memo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { SUMMA_PARTS, type SelectedNode, type SummaQuestion, type SummaPart } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { cn } from "@/lib/utils";

export interface SummaTreeHandle {
  focus: () => void;
}

interface SummaTreeProps {
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode) => void;
}

const TreatiseDivider = memo(({ label }: { label: string }) => (
  <p className="px-3 pt-2.5 pb-1 text-[11px] uppercase tracking-[0.08em] font-medium select-none text-muted-foreground/55">
    {label}
  </p>
));
TreatiseDivider.displayName = "TreatiseDivider";

const ArticleRow = memo(({ n, title, isSelected, onClick }: {
  n: number;
  title?: string;
  isSelected: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    data-selected={isSelected ? "" : undefined}
    className={cn(
      "w-full text-left px-4 py-3 md:py-2 rounded transition-colors flex items-start gap-1.5 border-l-2",
      isSelected
        ? "border-foreground/40 bg-foreground/[0.07] text-foreground"
        : "border-transparent text-muted-foreground/65 hover:text-foreground/80 hover:bg-foreground/[0.04]"
    )}
  >
    <span className="text-[11px] font-mono shrink-0 mt-px text-muted-foreground/55">A.{n}</span>
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

  return (
    <div>
      <button
        onClick={onToggle}
        data-selected={isQSelected ? "" : undefined}
        className={cn(
          "w-full flex items-start gap-1 px-2 py-3 md:py-2.5 rounded text-left transition-colors group border-l-2",
          isQSelected
            ? "border-foreground/40 bg-foreground/[0.07]"
            : "border-transparent hover:bg-foreground/[0.04]"
        )}
      >
        <ChevronRight className={cn("h-2.5 w-2.5 mt-[3px] shrink-0 text-muted-foreground/45 transition-transform", expanded && "rotate-90")} />
        <span className="text-[11px] font-mono text-muted-foreground/55 shrink-0 mt-px">{q.n}.</span>
        <span className={cn("text-[12px] leading-snug", isQSelected ? "text-foreground" : "text-foreground/75 group-hover:text-foreground/95")}>
          {q.title}
        </span>
      </button>
      {expanded && (
        <div className="pl-5 border-l border-border/60 ml-5">
          {Array.from({ length: articleCount }, (_, i) => i + 1).map((n) => (
            <ArticleRow
              key={n}
              n={n}
              title={articleTitles?.find((a) => a.n === n)?.title}
              isSelected={selected?.partId === part.id && selected.questionN === q.n && selected.articleN === n}
              onClick={() => onSelect({ partId: part.id, partLabel: part.label, partAbbr: part.abbr, questionN: q.n, questionTitle: q.title, articleN: n })}
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
            return (
              <div key={part.id}>
                <button
                  onClick={() => togglePart(part.id)}
                  className="w-full flex items-center gap-2 px-3 py-3.5 md:py-3 rounded hover:bg-foreground/[0.04] text-left transition-colors"
                >
                  <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground/45 transition-transform", partExpanded && "rotate-90")} />
                  <div className="min-w-0">
                    <p className="text-[13px] text-foreground leading-tight">{part.label}</p>
                    <p className="text-[11px] text-muted-foreground/65 mt-0.5">{part.abbr} · {part.treatises.reduce((s, t) => s + t.questions.length, 0)} qq.</p>
                  </div>
                </button>
                {partExpanded && (
                  <div className="border-l border-border/60 ml-4">
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
