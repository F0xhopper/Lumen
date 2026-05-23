"use client";

import { useState, memo, useRef, useEffect } from "react";
import { ChevronRight, Search, X, PanelLeftClose } from "lucide-react";
import { SUMMA_PARTS, type SelectedNode, type SummaQuestion, type SummaPart } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { cn } from "@/lib/utils";

interface SummaTreeProps {
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode) => void;
  onCollapse: () => void;
}

/* ── Filter result types ── */
type FilterResult =
  | { type: "part"; part: SummaPart }
  | { type: "treatise"; treatise: { label: string; questions: SummaQuestion[] }; part: SummaPart; ti: number }
  | { type: "question"; q: SummaQuestion; part: SummaPart };

function buildFilter(query: string): FilterResult[] | null {
  const raw = query.trim();
  if (!raw) return null;
  const q = raw.toLowerCase();
  const results: FilterResult[] = [];
  for (const part of SUMMA_PARTS) {
    if (part.label.toLowerCase().includes(q) || part.abbr.toLowerCase().includes(q)) {
      results.push({ type: "part", part });
    }
    for (let ti = 0; ti < part.treatises.length; ti++) {
      const treatise = part.treatises[ti];
      if (treatise.label.toLowerCase().includes(q)) {
        results.push({ type: "treatise", treatise, part, ti });
      }
      for (const question of treatise.questions) {
        if (
          question.title.toLowerCase().includes(q) ||
          `q.${question.n}`.includes(q) ||
          `${part.abbr} q.${question.n}`.toLowerCase().includes(q)
        ) {
          results.push({ type: "question", q: question, part });
        }
      }
    }
  }
  return results.slice(0, 80);
}

/* ── Treatise divider ── */
const TreatiseDivider = memo(({ label }: { label: string }) => (
  <p className="px-3 pt-3 pb-1 text-[8px] uppercase tracking-widest text-muted-foreground/30 font-medium select-none">
    {label}
  </p>
));
TreatiseDivider.displayName = "TreatiseDivider";

/* ── Article row ── */
const ArticleRow = memo(({ n, title, isSelected, onClick }: { n: number; title?: string; isSelected: boolean; onClick: () => void }) => (
  <button
    onClick={onClick}
    data-selected={isSelected ? "" : undefined}
    className={cn(
      "w-full text-left px-4 py-[3px] transition-colors flex items-start gap-1.5",
      isSelected ? "bg-foreground/10 text-foreground" : "text-muted-foreground/45 hover:text-muted-foreground hover:bg-accent"
    )}
  >
    <span className="text-[9px] font-mono shrink-0 mt-px">A.{n}</span>
    {title && <span className="text-[9px] leading-snug">{title}</span>}
  </button>
));
ArticleRow.displayName = "ArticleRow";

/* ── Question row ── */
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
        onClick={() => {
          onToggle();
          onSelect({ partId: part.id, partLabel: part.label, partAbbr: part.abbr, questionN: q.n, questionTitle: q.title });
        }}
        data-selected={isQSelected ? "" : undefined}
        className={cn(
          "w-full flex items-start gap-1 px-2 py-[5px] text-left transition-colors group",
          isQSelected ? "bg-foreground/10" : "hover:bg-accent"
        )}
      >
        <ChevronRight className={cn("h-2.5 w-2.5 mt-[3px] shrink-0 text-muted-foreground/30 transition-transform", expanded && "rotate-90")} />
        <span className="text-[9px] font-mono text-muted-foreground/45 shrink-0 mt-px">{q.n}.</span>
        <span className={cn("text-[10px] leading-snug", isQSelected ? "text-foreground" : "text-foreground/65 group-hover:text-foreground/90")}>
          {q.title}
        </span>
      </button>
      {expanded && (
        <div className="pl-5 border-l border-border/40 ml-5">
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

/* ── Main tree ── */
export default function SummaTree({ selected, onSelect, onCollapse }: SummaTreeProps) {
  const [expandedParts, setExpandedParts] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const togglePart = (id: string) =>
    setExpandedParts((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleQuestion = (key: string) =>
    setExpandedQuestions((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  /* Auto-expand and scroll to selected node */
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

  const filteredResults = buildFilter(filter);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Search + collapse */}
      <div className="shrink-0 flex items-center gap-1.5 px-2 py-2 border-b border-border">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground/30 pointer-events-none" />
          <input
            ref={filterRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter questions…"
            className="w-full pl-6 pr-5 py-1.5 bg-secondary border border-border rounded text-[10px] text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-foreground/20 transition-colors"
          />
          {filter && (
            <button
              onClick={() => { setFilter(""); filterRef.current?.focus(); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/30 hover:text-muted-foreground"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
        <button
          onClick={onCollapse}
          title="Collapse panel"
          className="shrink-0 p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        >
          <PanelLeftClose className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain py-1 select-none">
        {filteredResults !== null ? (
          filteredResults.length === 0 ? (
            <p className="px-3 py-5 text-[10px] text-muted-foreground/35 italic font-cardo">
              No results
            </p>
          ) : (
            <div>
              {filteredResults.map((result) => {
                if (result.type === "part") {
                  return (
                    <button
                      key={`part-${result.part.id}`}
                      onClick={() => {
                        setFilter("");
                        setExpandedParts((prev) => { const n = new Set(prev); n.add(result.part.id); return n; });
                      }}
                      className="w-full text-left px-3 py-2 transition-colors border-b border-border/20 hover:bg-accent"
                    >
                      <p className="text-[8px] uppercase tracking-wide text-muted-foreground/40 mb-0.5">Part</p>
                      <p className="text-[10px] font-medium text-foreground/80 leading-snug">{result.part.label}</p>
                      <p className="text-[8.5px] font-mono text-muted-foreground/40 mt-0.5">{result.part.abbr}</p>
                    </button>
                  );
                }
                if (result.type === "treatise") {
                  return (
                    <button
                      key={`treatise-${result.part.id}-${result.ti}`}
                      onClick={() => {
                        setFilter("");
                        setExpandedParts((prev) => { const n = new Set(prev); n.add(result.part.id); return n; });
                      }}
                      className="w-full text-left px-3 py-2 transition-colors border-b border-border/20 hover:bg-accent"
                    >
                      <p className="text-[8px] uppercase tracking-wide text-muted-foreground/40 mb-0.5">Treatise · {result.part.abbr}</p>
                      <p className="text-[10px] text-foreground/80 leading-snug">{result.treatise.label}</p>
                      <p className="text-[8.5px] text-muted-foreground/40 mt-0.5">{result.treatise.questions.length} questions</p>
                    </button>
                  );
                }
                const { q, part } = result;
                const isSel = selected?.partId === part.id && selected.questionN === q.n && selected.articleN === undefined;
                return (
                  <button
                    key={`q-${part.id}-${q.n}`}
                    onClick={() => onSelect({ partId: part.id, partLabel: part.label, partAbbr: part.abbr, questionN: q.n, questionTitle: q.title })}
                    className={cn(
                      "w-full text-left px-3 py-2 transition-colors border-b border-border/20 last:border-0",
                      isSel ? "bg-foreground/10" : "hover:bg-accent"
                    )}
                  >
                    <p className="text-[8.5px] font-mono text-muted-foreground/45 mb-0.5">{part.abbr} · Q.{q.n}</p>
                    <p className="text-[10px] text-foreground/80 leading-snug">{q.title}</p>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          SUMMA_PARTS.map((part) => {
            const partExpanded = expandedParts.has(part.id);
            return (
              <div key={part.id}>
                <button
                  onClick={() => togglePart(part.id)}
                  className="w-full flex items-center gap-1.5 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                >
                  <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground/45 transition-transform", partExpanded && "rotate-90")} />
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-foreground leading-tight">{part.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-px">{part.abbr} · {part.treatises.reduce((s, t) => s + t.questions.length, 0)} qq.</p>
                  </div>
                </button>
                {partExpanded && (
                  <div className="border-l border-border/40 ml-4">
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
}
