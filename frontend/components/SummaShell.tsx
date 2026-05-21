"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Search, X, PanelLeftOpen, PanelRightOpen, Sun, Moon, Menu, MessageSquare } from "lucide-react";
import SummaTree from "@/components/SummaTree";
import ContentViewer from "@/components/ContentViewer";
import AIChatPanel from "@/components/AIChatPanel";
import { SUMMA_PARTS, type SelectedNode } from "@/lib/summa-full";
import { cn } from "@/lib/utils";

const LEFT_W = 258;
const RIGHT_W = 300;
const STRIP_W = 40;

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
  const question = part.treatises.flatMap((t) => t.questions).find((q) => q.n === questionN);
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

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function SummaShell() {
  const params = useParams();
  const router = useRouter();
  const isMobile = useIsMobile();
  const selected = nodeFromParams(params);
  const { resolvedTheme, setTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Close both panels on mobile by default
  useEffect(() => {
    if (isMobile) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, [isMobile]);

  const handleTreeSelect = (node: SelectedNode) => {
    setSearchQuery("");
    setSearchInput("");
    if (isMobile) setLeftOpen(false);
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

        {/* Left slot: branding on desktop, hamburger on mobile */}
        {isMobile ? (
          <button
            onClick={() => { setLeftOpen((o) => !o); setRightOpen(false); }}
            title="Open navigation"
            className="shrink-0 p-1.5 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : (
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
        )}

        {/* Search — centered on desktop, flex-1 on mobile */}
        <form
          onSubmit={handleSearch}
          className={cn(
            "flex items-center",
            isMobile
              ? "flex-1 mx-2"
              : "absolute left-1/2 -translate-x-1/2 w-[420px] max-w-[44vw]"
          )}
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

        {/* Right slot: chat button (mobile only) + theme toggle */}
        <div
          className={cn("shrink-0 flex items-center gap-0.5 pr-2", !isMobile && "ml-auto")}
          style={isMobile ? undefined : { width: rightW }}
        >
          {isMobile && (
            <button
              onClick={() => { setRightOpen((o) => !o); setLeftOpen(false); }}
              title="Open AI chat"
              className="p-1.5 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title="Toggle theme"
            className="ml-auto p-1.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
          >
            {mounted && (resolvedTheme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />)}
          </button>
        </div>
      </header>

      {/* Mobile drawer backdrop */}
      {isMobile && (leftOpen || rightOpen) && (
        <div
          className="fixed inset-0 z-40 bg-background/75"
          onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        />
      )}

      {/* ── Three panels ── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Left panel — drawer on mobile, fixed-width column on desktop */}
        <aside
          className={cn(
            "shrink-0 border-r border-border flex flex-col overflow-hidden bg-background",
            isMobile
              ? cn(
                  "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
                  leftOpen ? "translate-x-0" : "-translate-x-full"
                )
              : "transition-[width] duration-200 ease-in-out"
          )}
          style={{ width: isMobile ? LEFT_W : leftW }}
        >
          {!isMobile && !leftOpen ? (
            <div className="flex flex-col items-center pt-3 gap-3">
              <button
                onClick={() => setLeftOpen(true)}
                title="Expand structure panel"
                className="p-1.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
              >
                <PanelLeftOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <SummaTree
              selected={selected}
              onSelect={handleTreeSelect}
              onCollapse={() => setLeftOpen(false)}
            />
          )}
        </aside>

        {/* Center — always full width on mobile */}
        <main className="flex-1 flex flex-col overflow-hidden border-r border-border min-w-0">
          <ContentViewer
            selected={selected}
            searchQuery={searchQuery}
            onHighlightSearch={(text) => { setSearchQuery(text); setSearchInput(text); }}
          />
        </main>

        {/* Right panel — drawer on mobile, fixed-width column on desktop */}
        <aside
          className={cn(
            "shrink-0 flex flex-col overflow-hidden bg-background",
            isMobile
              ? cn(
                  "fixed inset-y-0 right-0 z-50 border-l border-border transition-transform duration-200 ease-in-out",
                  rightOpen ? "translate-x-0" : "translate-x-full"
                )
              : "transition-[width] duration-200 ease-in-out"
          )}
          style={{ width: isMobile ? RIGHT_W : rightW }}
        >
          {!isMobile && !rightOpen ? (
            <div className="flex flex-col items-center pt-3 gap-3">
              <button
                onClick={() => setRightOpen(true)}
                title="Expand AI chat panel"
                className="p-1.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <AIChatPanel selected={selected} onCollapse={() => setRightOpen(false)} />
          )}
        </aside>

      </div>
    </div>
  );
}
