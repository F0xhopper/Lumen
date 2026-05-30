"use client";

import { useState, memo, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { ChevronRight, Search, X, ChevronDown } from "lucide-react";
import { SUMMA_PARTS, type SelectedNode, type SummaQuestion, type SummaPart } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { cn } from "@/lib/utils";

export interface SummaTreeHandle {
  focusFilter: () => void;
}

interface SummaTreeProps {
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode) => void;
}

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

const TreatiseDivider = memo(({ label, dim }: { label: string; dim?: boolean }) => (
  <p className={cn(
    "px-3 pt-2.5 pb-1 text-[11px] uppercase tracking-[0.08em] font-medium select-none",
    dim ? "text-muted-foreground/40" : "text-muted-foreground/55"
  )}>
    {label}
  </p>
));
TreatiseDivider.displayName = "TreatiseDivider";

const ArticleRow = memo(({ n, title, isSelected, onClick }: { n: number; title?: string; isSelected: boolean; onClick: () => void }) => (
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
  const [filter, setFilter] = useState("");
  const filterRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    focusFilter: () => { filterRef.current?.focus(); filterRef.current?.select(); },
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

  const filterTree = buildFilterTree(filter);

  const expandAndClear = (partId: string, qKey?: string) => {
    setFilter("");
    setExpandedParts((prev) => { const n = new Set(prev); n.add(partId); return n; });
    if (qKey) setExpandedQuestions((prev) => { const n = new Set(prev); n.add(qKey); return n; });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-2 pt-2 pb-1.5 border-b border-border flex flex-col gap-1.5">
        <div className="relative">
          <select
            value={book}
            onChange={(e) => { setBook(e.target.value as "theologica" | "contra-gentiles"); setFilter(""); }}
            className="w-full appearance-none pl-3 pr-7 py-2 bg-secondary border border-border rounded text-[12px] text-foreground focus:outline-none focus:border-foreground/25 transition-colors cursor-pointer"
          >
            <option value="theologica">Summa Theologica</option>
            <option value="contra-gentiles">Summa Contra Gentiles</option>
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/45 pointer-events-none" />
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 text-muted-foreground/45 pointer-events-none" />
          <input
            ref={filterRef}
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter structure…"
            className="w-full pl-6 pr-5 py-2 bg-secondary border border-border rounded text-[12px] text-foreground placeholder:text-muted-foreground/45 focus:outline-none focus:border-foreground/25 transition-colors"
          />
          {filter && (
            <button
              onClick={() => { setFilter(""); filterRef.current?.focus(); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain py-1 select-none">

        {book === "contra-gentiles" ? (
          <div className="px-4 py-8 flex flex-col gap-2">
            <p className="text-[12px] text-foreground/70 font-cardo italic">Summa Contra Gentiles</p>
            <p className="text-[11px] text-muted-foreground/50 leading-relaxed">Content coming soon.</p>
          </div>
        ) : filterTree !== null ? (
          filterTree.length === 0 ? (
            <p className="px-3 py-5 text-[11px] text-muted-foreground/50 italic font-cardo">No results</p>
          ) : (
            filterTree.map((pm) => (
              <div key={pm.part.id}>
                <button
                  onClick={() => expandAndClear(pm.part.id)}
                  className="w-full flex items-center gap-2 px-3 py-3.5 md:py-3 rounded hover:bg-foreground/[0.04] text-left transition-colors"
                >
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/45 rotate-90" />
                  <div className="min-w-0">
                    <p className={cn("text-[13px] leading-tight", pm.selfMatch ? "text-foreground" : "text-foreground/70")}>
                      {pm.part.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">{pm.part.abbr}</p>
                  </div>
                </button>

                <div className="border-l border-border/60 ml-4">
                  {pm.treatises.map((tm, ti) => (
                    <div key={ti}>
                      <TreatiseDivider label={tm.label} dim={!tm.selfMatch && tm.questions.length === 0} />

                      {tm.questions.map((qm) => (
                        <div key={qm.q.n}>
                          <button
                            onClick={() => expandAndClear(pm.part.id, `${pm.part.id}-q${qm.q.n}`)}
                            className={cn(
                              "w-full flex items-start gap-1 px-2 py-3 md:py-2.5 rounded text-left transition-colors group border-l-2",
                              selected?.partId === pm.part.id && selected.questionN === qm.q.n && selected.articleN === undefined
                                ? "border-foreground/40 bg-foreground/[0.07]"
                                : "border-transparent hover:bg-foreground/[0.04]"
                            )}
                          >
                            <ChevronRight className={cn(
                              "h-2.5 w-2.5 mt-[3px] shrink-0 text-muted-foreground/45 transition-transform",
                              qm.articles.length > 0 && "rotate-90"
                            )} />
                            <span className="text-[11px] font-mono text-muted-foreground/55 shrink-0 mt-px">{qm.q.n}.</span>
                            <span className={cn(
                              "text-[12px] leading-snug",
                              qm.selfMatch ? "text-foreground/90" : "text-foreground/70 group-hover:text-foreground/90"
                            )}>
                              {qm.q.title}
                            </span>
                          </button>

                          {qm.articles.length > 0 && (
                            <div className="pl-5 border-l border-border/60 ml-5">
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
                                      "w-full text-left px-4 py-3 md:py-2 rounded transition-colors flex items-start gap-1.5 border-l-2",
                                      isSel
                                        ? "border-foreground/40 bg-foreground/[0.07] text-foreground"
                                        : "border-transparent text-muted-foreground/65 hover:text-foreground/80 hover:bg-foreground/[0.04]"
                                    )}
                                  >
                                    <span className="text-[11px] font-mono shrink-0 mt-px text-muted-foreground/55">A.{art.n}</span>
                                    <span className="text-[11px] leading-snug">{art.title}</span>
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
