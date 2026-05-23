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

/* ── Filter tree types ── */
interface ArticleMatch { n: number; title: string }
interface QuestionMatch { q: SummaQuestion; selfMatch: boolean; articles: ArticleMatch[] }
interface TreatiseMatch { label: string; selfMatch: boolean; questions: QuestionMatch[] }
interface PartMatch { part: SummaPart; selfMatch: boolean; treatises: TreatiseMatch[] }

function buildFilterTree(query: string): PartMatch[] | null {
  const raw = query.trim();
  if (!raw) return null;
  const lq = raw.toLowerCase();

  const tree: PartMatch[] = [];

  for (const part of SUMMA_PARTS) {
    const partSelf = part.label.toLowerCase().includes(lq) || part.abbr.toLowerCase().includes(lq);
    const treatises: TreatiseMatch[] = [];

    for (const treatise of part.treatises) {
      const treatiseSelf = treatise.label.toLowerCase().includes(lq);
      const questions: QuestionMatch[] = [];

      for (const q of treatise.questions) {
        const qSelf =
          q.title.toLowerCase().includes(lq) ||
          `q.${q.n}`.includes(lq) ||
          `${part.abbr} q.${q.n}`.toLowerCase().includes(lq);

        const allArticles = SUMMA_ARTICLE_TITLES[part.id]?.[q.n] ?? [];
        const articles = allArticles.filter(
          (a) =>
            a.title.toLowerCase().includes(lq) ||
            `a.${a.n}`.includes(lq) ||
            `q.${q.n} a.${a.n}`.includes(lq) ||
            `${part.abbr} q.${q.n} a.${a.n}`.toLowerCase().includes(lq)
        );

        if (qSelf || articles.length > 0) {
          questions.push({ q, selfMatch: qSelf, articles });
        }
      }

      if (treatiseSelf || questions.length > 0) {
        treatises.push({ label: treatise.label, selfMatch: treatiseSelf, questions });
      }
    }

    if (partSelf || treatises.length > 0) {
      tree.push({ part, selfMatch: partSelf, treatises });
    }
  }

  return tree;
}

/* ── Treatise divider ── */
const TreatiseDivider = memo(({ label, dim }: { label: string; dim?: boolean }) => (
  <p className={cn(
    "px-3 pt-3 pb-1 text-[8px] uppercase tracking-widest font-medium select-none",
    dim ? "text-muted-foreground/20" : "text-muted-foreground/30"
  )}>
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
        onClick={onToggle}
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

  const filterTree = buildFilterTree(filter);

  const expandAndClear = (partId: string, qKey?: string) => {
    setFilter("");
    setExpandedParts((prev) => { const n = new Set(prev); n.add(partId); return n; });
    if (qKey) setExpandedQuestions((prev) => { const n = new Set(prev); n.add(qKey); return n; });
  };

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
            placeholder="Filter…"
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

        {/* ── Filter tree ── */}
        {filterTree !== null ? (
          filterTree.length === 0 ? (
            <p className="px-3 py-5 text-[10px] text-muted-foreground/35 italic font-cardo">No results</p>
          ) : (
            filterTree.map((pm) => (
              <div key={pm.part.id}>
                {/* Part header */}
                <button
                  onClick={() => expandAndClear(pm.part.id)}
                  className="w-full flex items-center gap-1.5 px-3 py-2.5 hover:bg-accent text-left transition-colors"
                >
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/45 rotate-90" />
                  <div className="min-w-0">
                    <p className={cn("text-[11px] font-medium leading-tight", pm.selfMatch ? "text-foreground" : "text-foreground/55")}>
                      {pm.part.label}
                    </p>
                    <p className="text-[9px] text-muted-foreground/50 mt-px">{pm.part.abbr}</p>
                  </div>
                </button>

                {/* Treatises */}
                <div className="border-l border-border/40 ml-4">
                  {pm.treatises.map((tm, ti) => (
                    <div key={ti}>
                      <TreatiseDivider label={tm.label} dim={!tm.selfMatch && tm.questions.length === 0} />

                      {/* Questions */}
                      {tm.questions.map((qm) => (
                        <div key={qm.q.n}>
                          <button
                            onClick={() => expandAndClear(pm.part.id, `${pm.part.id}-q${qm.q.n}`)}
                            className={cn(
                              "w-full flex items-start gap-1 px-2 py-[5px] text-left transition-colors group",
                              selected?.partId === pm.part.id && selected.questionN === qm.q.n && selected.articleN === undefined
                                ? "bg-foreground/10"
                                : "hover:bg-accent"
                            )}
                          >
                            <ChevronRight className={cn(
                              "h-2.5 w-2.5 mt-[3px] shrink-0 text-muted-foreground/30 transition-transform",
                              qm.articles.length > 0 && "rotate-90"
                            )} />
                            <span className="text-[9px] font-mono text-muted-foreground/45 shrink-0 mt-px">{qm.q.n}.</span>
                            <span className={cn(
                              "text-[10px] leading-snug",
                              qm.selfMatch ? "text-foreground/90" : "text-foreground/55 group-hover:text-foreground/80"
                            )}>
                              {qm.q.title}
                            </span>
                          </button>

                          {/* Matching articles */}
                          {qm.articles.length > 0 && (
                            <div className="pl-5 border-l border-border/40 ml-5">
                              {qm.articles.map((art) => {
                                const isSel = selected?.partId === pm.part.id && selected.questionN === qm.q.n && selected.articleN === art.n;
                                return (
                                  <button
                                    key={art.n}
                                    onClick={() => {
                                      setFilter("");
                                      onSelect({ partId: pm.part.id, partLabel: pm.part.label, partAbbr: pm.part.abbr, questionN: qm.q.n, questionTitle: qm.q.title, articleN: art.n });
                                    }}
                                    className={cn(
                                      "w-full text-left px-4 py-[3px] transition-colors flex items-start gap-1.5",
                                      isSel ? "bg-foreground/10 text-foreground" : "text-muted-foreground/45 hover:text-muted-foreground hover:bg-accent"
                                    )}
                                  >
                                    <span className="text-[9px] font-mono shrink-0 mt-px">A.{art.n}</span>
                                    <span className="text-[9px] leading-snug">{art.title}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )
        ) : (

          /* ── Normal tree ── */
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
