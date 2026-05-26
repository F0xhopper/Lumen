"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  X,
  PanelLeftOpen,
  PanelLeftClose,
  PanelRightOpen,
  Sun,
  Moon,
  Menu,
  MessageSquare,
  BookOpen,
  Bookmark,
  Clock,
} from "lucide-react";
import SummaTree from "@/components/SummaTree";
import ContentViewer from "@/components/ContentViewer";
import AIChatPanel, { type AIChatPanelHandle } from "@/components/AIChatPanel";
import { SUMMA_PARTS, type SelectedNode } from "@/lib/summa-full";
import { cn } from "@/lib/utils";

const LEFT_W = 258;
const RIGHT_W = 300;
const STRIP_W = 0;

const PART_SLUG: Record<string, string> = {
  "1": "prima-pars",
  "1-2": "prima-secundae",
  "2-2": "secunda-secundae",
  "3": "tertia-pars",
};
const PART_TO_SLUG: Record<string, string> = Object.fromEntries(
  Object.entries(PART_SLUG).map(([k, v]) => [v, k]),
);

function str(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}

function nodeFromParams(
  params: ReturnType<typeof useParams>,
): SelectedNode | null {
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
  const question = part.treatises
    .flatMap((t) => t.questions)
    .find((q) => q.n === questionN);
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
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const selected = nodeFromParams(params);
  const { resolvedTheme, setTheme } = useTheme();

  const chatPanelRef = useRef<AIChatPanelHandle>(null);

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [previousSelected, setPreviousSelected] = useState<SelectedNode | null>(
    null,
  );
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"browse" | "bookmarks" | "history">("browse");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  // Close both panels on mobile by default
  useEffect(() => {
    if (isMobile) {
      setLeftOpen(false);
      setRightOpen(false);
    }
  }, [isMobile]);

  // Sync ?q= param → state: restores search on back-navigation, clears it on article nav
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearchQuery(q);
    setSearchInput(q);
  }, [searchParams]);

  const handleTreeSelect = (node: SelectedNode) => {
    setSearchQuery("");
    setSearchInput("");
    setPreviousSelected(null);
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
    if (selected) setPreviousSelected(selected);
    setSearchQuery(q);
    // push from article pages so back returns there; replace within search to avoid stacking
    if (str(params.part)) {
      router.push(`/?q=${encodeURIComponent(q)}`);
    } else {
      router.replace(`/?q=${encodeURIComponent(q)}`);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchInput("");
    if (previousSelected) {
      const slug = PART_TO_SLUG[previousSelected.partId];
      if (previousSelected.articleN !== undefined) {
        router.push(
          `/${slug}/${previousSelected.questionN}/${previousSelected.articleN}`,
        );
      } else {
        router.push(`/${slug}/${previousSelected.questionN}`);
      }
      setPreviousSelected(null);
    } else {
      router.replace("/");
      inputRef.current?.focus();
    }
  };

  const leftW = leftOpen ? LEFT_W : STRIP_W;
  const rightW = rightOpen ? RIGHT_W : STRIP_W;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Mobile drawer backdrop */}
      {isMobile && (leftOpen || rightOpen) && (
        <div
          className="fixed inset-0 z-40 bg-background/75"
          onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        />
      )}

      {/* ── Left sidebar — full height ── */}
      <aside
        className={cn(
          "shrink-0 border-r border-border flex flex-col overflow-hidden bg-background",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 transition-transform duration-200 ease-in-out",
                leftOpen ? "translate-x-0" : "-translate-x-full",
              )
            : "transition-[width] duration-200 ease-in-out",
        )}
        style={{ width: isMobile ? LEFT_W : leftW }}
      >
        {(leftOpen || isMobile) && (
          <>
            {/* Branding */}
            <div className="shrink-0 flex items-center px-4 h-12 border-b border-border">
              <p className="font-cardo italic text-[17px] text-foreground/85 leading-none">Lumen</p>
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex items-stretch border-b border-border">
              {([
                { id: "browse",    Icon: BookOpen, label: "Browse"    },
                { id: "bookmarks", Icon: Bookmark, label: "Saved"     },
                { id: "history",   Icon: Clock,    label: "History"   },
              ] as const).map(({ id, Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setSidebarTab(id)}
                  title={label}
                  className={cn(
                    "flex-1 flex items-center justify-center min-h-[44px] py-2.5 border-b-2 transition-colors",
                    sidebarTab === id
                      ? "border-foreground/35 text-foreground/65"
                      : "border-transparent text-muted-foreground/30 hover:text-muted-foreground/55"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>

            {/* Tab content */}
            {sidebarTab === "browse" && (
              <SummaTree selected={selected} onSelect={handleTreeSelect} />
            )}
            {sidebarTab === "bookmarks" && (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="font-cardo italic text-[12px] text-muted-foreground/30 text-center">No bookmarks yet</p>
              </div>
            )}
            {sidebarTab === "history" && (
              <div className="flex-1 flex items-center justify-center p-6">
                <p className="font-cardo italic text-[12px] text-muted-foreground/30 text-center">No history yet</p>
              </div>
            )}
          </>
        )}
      </aside>

      {/* ── Content column ── */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        {/* Header */}
        <header className="relative shrink-0 flex items-center border-b border-border px-2 py-2.5 z-10 bg-background">
          {/* Mobile: hamburger */}
          {isMobile && (
            <button
              onClick={() => { setLeftOpen((o) => !o); setRightOpen(false); }}
              title="Open navigation"
              className="shrink-0 p-2.5 text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <Menu className="h-4 w-4" />
            </button>
          )}

          {/* Collapse/expand toggle — far left of header, against the sidebar edge */}
          {!isMobile && (
            <button
              onClick={() => setLeftOpen((o) => !o)}
              title={leftOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="shrink-0 p-2.5 mr-1 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
            >
              {leftOpen
                ? <PanelLeftClose className="h-3.5 w-3.5" />
                : <PanelLeftOpen className="h-3.5 w-3.5" />
              }
            </button>
          )}

          {/* Search — centered on desktop, flex-1 on mobile */}
          <form
            onSubmit={handleSearch}
            className={cn(
              isMobile
                ? "flex-1 mx-2"
                : "absolute left-1/2 -translate-x-1/2 w-[420px] max-w-[44vw]",
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
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </form>

          {/* Right: chat (mobile) + theme toggle */}
          <div className="shrink-0 flex items-center gap-0.5 ml-auto pr-2">
            {isMobile && (
              <button
                onClick={() => { setRightOpen((o) => !o); setLeftOpen(false); }}
                title="Open AI chat"
                className="p-2.5 text-muted-foreground/50 hover:text-foreground transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              title="Toggle theme"
              className="p-2.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
            >
              {mounted && (resolvedTheme === "dark"
                ? <Sun className="h-3.5 w-3.5" />
                : <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ContentViewer
            selected={selected}
            searchQuery={searchQuery}
            previousSelected={previousSelected}
            onBack={() => {
              if (!previousSelected) return;
              setSearchQuery("");
              setSearchInput("");
              const slug = PART_TO_SLUG[previousSelected.partId];
              if (previousSelected.articleN !== undefined) {
                router.push(`/${slug}/${previousSelected.questionN}/${previousSelected.articleN}`);
              } else {
                router.push(`/${slug}/${previousSelected.questionN}`);
              }
              setPreviousSelected(null);
            }}
            onHighlightSearch={(text) => {
              if (selected) setPreviousSelected(selected);
              setSearchQuery(text);
              setSearchInput(text);
              router.push(`/?q=${encodeURIComponent(text)}`);
            }}
            onHighlightAddToChat={(text) => {
              if (!selected) return;
              setRightOpen(true);
              chatPanelRef.current?.addQuote(text, selected);
            }}
          />
        </main>
      </div>
    </div>
  );
}
