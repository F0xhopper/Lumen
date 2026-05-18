"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Search, X, PanelLeftOpen, PanelRightOpen } from "lucide-react";
import SummaTree from "@/components/SummaTree";
import ContentViewer from "@/components/ContentViewer";
import AIChatPanel from "@/components/AIChatPanel";
import { SUMMA_PARTS, type SelectedNode } from "@/lib/summa-full";

const LEFT_W = 258;
const RIGHT_W = 300;
const STRIP_W = 40;

// URL part slugs: 1 → prima-pars, 1-2 → prima-secundae, 2-2 → secunda-secundae, 3 → tertia-pars
const PART_SLUG: Record<string, string> = {
  "1":   "prima-pars",
  "1-2": "prima-secundae",
  "2-2": "secunda-secundae",
  "3":   "tertia-pars",
};
const PART_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PART_SLUG).map(([k, v]) => [v, k])
);

function str(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}

function nodeFromParams(params: ReturnType<typeof useParams>): SelectedNode | null {
  const slug = str(params.part);
  const qRaw = str(params.question);
  const aRaw = str(params.article);

  if (!slug || !qRaw) return null;
  const partId = PART_SLUG[slug];
  if (!partId) return null;

  const questionN = parseInt(qRaw, 10);
  if (isNaN(questionN)) return null;

  const part = SUMMA_PARTS.find((p) => p.id === partId);
  if (!part) return null;
  const question = part.questions.find((q) => q.n === questionN);
  if (!question) return null;

  const articleN = aRaw ? parseInt(aRaw, 10) : undefined;

  return {
    partId: part.id,
    partLabel: part.label,
    partAbbr: part.abbr,
    questionN,
    questionTitle: question.title,
    articleN: articleN && !isNaN(articleN) ? articleN : undefined,
  };
}

export default function SummaShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const router = useRouter();

  const selected = nodeFromParams(params);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTreeSelect = (node: SelectedNode) => {
    setSearchQuery("");
    setSearchInput("");
    const slug = PART_TO_SLUG[node.partId];
    if (node.articleN !== undefined) {
      router.push(`/${slug}/${node.questionN}/${node.articleN}`);
    } else {
      router.push(`/${slug}/${node.questionN}`);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearchQuery(q);
    // Navigate home so ContentViewer isn't competing with a selected article
    if (str(params.part)) router.push("/");
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchInput("");
    inputRef.current?.focus();
  };

  const leftW = leftOpen ? LEFT_W : STRIP_W;
  const rightW = rightOpen ? RIGHT_W : STRIP_W;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">

      {/* ── Global top bar ── */}
      <header className="relative shrink-0 flex items-center border-b border-border px-2 py-2.5 z-10 bg-background">
        <div
          className="shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: leftW }}
        >
          {leftOpen && (
            <div className="pl-3">
              <p className="font-cardo italic text-[17px] text-foreground/85 leading-none">Lumen</p>
              <p className="text-[8.5px] text-muted-foreground tracking-[0.12em] mt-0.5 font-inter">
                Summa Theologica · St. Thomas Aquinas
              </p>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSearch}
          className="absolute left-1/2 -translate-x-1/2 flex items-center w-[420px] max-w-[44vw]"
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/35 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search the Summa…"
              className="w-full pl-8 pr-8 py-1.5 bg-secondary border border-border rounded text-[12px] font-cardo text-foreground placeholder:text-muted-foreground/35 focus:outline-none focus:border-foreground/25 transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </form>

        <div
          className="ml-auto shrink-0 transition-[width] duration-200 ease-in-out"
          style={{ width: rightW }}
        />
      </header>

      {/* ── Three panels ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        <aside
          className="shrink-0 border-r border-border flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: leftW }}
        >
          {leftOpen ? (
            <SummaTree
              selected={selected}
              onSelect={handleTreeSelect}
              onCollapse={() => setLeftOpen(false)}
            />
          ) : (
            <div className="flex flex-col items-center pt-3 gap-3">
              <button
                onClick={() => setLeftOpen(true)}
                title="Expand structure panel"
                className="p-1.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
              >
                <PanelLeftOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </aside>

        <main className="flex-1 flex flex-col overflow-hidden border-r border-border min-w-0">
          <ContentViewer selected={selected} searchQuery={searchQuery} />
        </main>

        <aside
          className="shrink-0 flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: rightW }}
        >
          {rightOpen ? (
            <AIChatPanel selected={selected} onCollapse={() => setRightOpen(false)} />
          ) : (
            <div className="flex flex-col items-center pt-3 gap-3">
              <button
                onClick={() => setRightOpen(true)}
                title="Expand AI chat panel"
                className="p-1.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </aside>

      </div>
    </div>
  );
}
