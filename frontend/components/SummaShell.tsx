"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import {
  Search,
  X,
  PanelLeftOpen,
  PanelLeftClose,
  Menu,
  BookOpen,
  Bookmark,
  Clock,
  Sun,
  Moon,
} from "lucide-react";
import Image from "next/image";
import SummaTree, { type SummaTreeHandle } from "@/components/SummaTree";
import ContentViewer, { type ContentViewerHandle } from "@/components/ContentViewer";
import { type AIChatPanelHandle } from "@/components/AIChatPanel";
import KeybindingsHelp from "@/components/KeybindingsHelp";
import { SUMMA_PARTS, type SelectedNode, getAdjacentArticles } from "@/lib/summa-full";
import { SLUG_TO_PART_ID, nodeUrl } from "@/lib/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useKeybindings } from "@/hooks/useKeybindings";
import { cn } from "@/lib/utils";

const LEFT_W = 258;

function parseParams(params: ReturnType<typeof useParams>): SelectedNode | null {
  function str(v: string | string[] | undefined): string | null {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v[0] ?? null;
    return null;
  }

  const slug = str(params.part);
  const qRaw = str(params.question);
  const aRaw = str(params.article);

  if (!slug || !qRaw) return null;
  const partId = SLUG_TO_PART_ID[slug];
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

export default function SummaShell() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const selected = parseParams(params);
  const { resolvedTheme, setTheme } = useTheme();

  const chatPanelRef = useRef<AIChatPanelHandle>(null);
  const contentViewerRef = useRef<ContentViewerHandle>(null);
  const summaTreeRef = useRef<SummaTreeHandle>(null);

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [previousSelected, setPreviousSelected] = useState<SelectedNode | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"browse" | "bookmarks" | "history">("browse");
  const inputRef = useRef<HTMLInputElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (isMobile && !leftOpen) {
      hamburgerRef.current?.focus();
    }
  }, [isMobile, leftOpen]);

  useEffect(() => {
    if (isMobile) setLeftOpen(false);
  }, [isMobile]);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearchQuery(q);
    setSearchInput(q);
  }, [searchParams]);

  const { prev: prevArticle, next: nextArticle } = selected
    ? getAdjacentArticles(selected)
    : { prev: null, next: null };

  useKeybindings(
    {
      j:  () => contentViewerRef.current?.scrollBy(80),
      k:  () => contentViewerRef.current?.scrollBy(-80),
      d:  () => contentViewerRef.current?.scrollBy(320),
      u:  () => contentViewerRef.current?.scrollBy(-320),
      gg: () => contentViewerRef.current?.scrollToTop(),
      G:  () => contentViewerRef.current?.scrollToBottom(),

      "[": () => { if (prevArticle) router.push(nodeUrl(prevArticle)); },
      "]": () => { if (nextArticle) router.push(nodeUrl(nextArticle)); },

      "/": () => { inputRef.current?.focus(); inputRef.current?.select(); },
      f: () => {
        if (!isMobile) setLeftOpen(true);
        setTimeout(() => summaTreeRef.current?.focusFilter(), 220);
      },

      b: () => setLeftOpen((o) => !o),

      t: () => setTheme(resolvedTheme === "dark" ? "light" : "dark"),

      "?": () => setHelpOpen((o) => !o),

      Escape: () => {
        setHelpOpen(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      },
    },
    { alwaysActive: ["Escape"] }
  );

  const handleTreeSelect = (node: SelectedNode) => {
    setSearchQuery("");
    setSearchInput("");
    setPreviousSelected(null);
    if (isMobile) setLeftOpen(false);
    router.push(nodeUrl(node));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    if (selected) setPreviousSelected(selected);
    setSearchQuery(q);
    if (params.part) {
      router.push(`/?q=${encodeURIComponent(q)}`);
    } else {
      router.replace(`/?q=${encodeURIComponent(q)}`);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchInput("");
    if (previousSelected) {
      router.push(nodeUrl(previousSelected));
      setPreviousSelected(null);
    } else {
      router.replace("/");
      inputRef.current?.focus();
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {isMobile && leftOpen && (
        <div
          className="fixed top-12 inset-x-0 bottom-0 z-40 bg-background/75"
          onClick={() => setLeftOpen(false)}
        />
      )}

      <header className="relative shrink-0 flex items-center h-12 border-b border-border px-2 z-10 bg-background">
        {isMobile ? (
          <button
            ref={hamburgerRef}
            onClick={() => setLeftOpen((o) => !o)}
            title="Open navigation"
            className="shrink-0 p-2.5 text-muted-foreground/50 hover:text-foreground transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={() => setLeftOpen((o) => !o)}
            title={leftOpen ? "Collapse sidebar (b)" : "Expand sidebar (b)"}
            className="shrink-0 p-2.5 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
          >
            {leftOpen
              ? <PanelLeftClose className="h-3.5 w-3.5" />
              : <PanelLeftOpen className="h-3.5 w-3.5" />
            }
          </button>
        )}

        <div className="flex items-center gap-2 px-1 mr-2">
          <Image
            src="/sun-icon-white.png"
            alt=""
            width={28}
            height={28}
            className="opacity-70 dark:opacity-70 invert dark:invert-0"
          />
          <p className="font-cardo italic text-[19px] text-foreground/85 leading-none hidden sm:block">Lumen</p>
        </div>

        <form
          onSubmit={handleSearch}
          className={cn(
            isMobile ? "flex-1 mx-2" : "absolute left-1/2 -translate-x-1/2 w-[420px] max-w-[44vw]",
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

        <div className="shrink-0 flex items-center gap-0.5 ml-auto pr-2">
          <button
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            title="Toggle theme (t)"
            className="p-2.5 text-muted-foreground/35 hover:text-muted-foreground transition-colors"
          >
            {mounted && (resolvedTheme === "dark"
              ? <Sun className="h-3.5 w-3.5" />
              : <Moon className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden min-w-0">
        <aside
          className={cn(
            "shrink-0 flex flex-col overflow-hidden bg-background",
            isMobile
              ? cn(
                  "border-r border-border fixed top-12 bottom-0 left-0 z-50 transition-transform duration-200 ease-in-out",
                  leftOpen ? "translate-x-0" : "-translate-x-full",
                )
              : "transition-[width] duration-200 ease-in-out",
          )}
          style={{ width: isMobile ? LEFT_W : (leftOpen ? LEFT_W : 0) }}
        >
          {(leftOpen || isMobile) && (
            <>
              <div className="shrink-0 flex items-stretch border-b border-border">
                {([
                  { id: "browse",    Icon: BookOpen, label: "Browse"  },
                  { id: "bookmarks", Icon: Bookmark, label: "Saved"   },
                  { id: "history",   Icon: Clock,    label: "History" },
                ] as const).map(({ id, Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setSidebarTab(id)}
                    title={label}
                    className={cn(
                      "flex-1 flex items-center justify-center min-h-[44px] py-2 border-b-2 transition-colors",
                      sidebarTab === id
                        ? "border-foreground/35 text-foreground/65"
                        : "border-transparent text-muted-foreground/30 hover:text-muted-foreground/55"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>

              {sidebarTab === "browse" && (
                <SummaTree ref={summaTreeRef} selected={selected} onSelect={handleTreeSelect} />
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

        <div className="flex flex-col flex-1 overflow-hidden min-w-0 relative">
          {!isMobile && leftOpen && (
            <div
              onClick={() => setLeftOpen((o) => !o)}
              title="Collapse sidebar"
              className="absolute left-0 inset-y-0 w-4 z-20 cursor-pointer group/edge"
            >
              <div className="absolute left-0 inset-y-0 w-[2px] bg-border group-hover/edge:bg-foreground/30 transition-colors duration-150" />
            </div>
          )}

          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <ContentViewer
              ref={contentViewerRef}
              selected={selected}
              searchQuery={searchQuery}
              previousSelected={previousSelected}
              onBack={() => {
                if (!previousSelected) return;
                setSearchQuery("");
                setSearchInput("");
                router.push(nodeUrl(previousSelected));
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
                chatPanelRef.current?.addQuote(text, selected);
              }}
            />
          </main>
        </div>

      </div>

      <KeybindingsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
