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
  Menu,
  BookOpen,
  Bookmark,
  Clock,
  PenLine,
  MessageSquare,
  UserCircle,
} from "lucide-react";
import Image from "next/image";
import SummaTree, { type SummaTreeHandle } from "@/components/SummaTree";
import ContentViewer, { type ContentViewerHandle } from "@/components/ContentViewer";
import AIChatPanel, { type AIChatPanelHandle } from "@/components/AIChatPanel";
import KeybindingsHelp from "@/components/KeybindingsHelp";
import AuthModal from "@/components/AuthModal";
import UserMenu from "@/components/UserMenu";
import BookmarksPanel from "@/components/BookmarksPanel";
import { useAuth } from "@/components/AuthProvider";
import { SUMMA_PARTS, type SelectedNode, getAdjacentArticles } from "@/lib/summa-full";
import { SUMMA_ARTICLE_TITLES } from "@/lib/summa-articles";
import { SLUG_TO_PART_ID, nodeUrl } from "@/lib/navigation";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useKeybindings } from "@/hooks/useKeybindings";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useHistory } from "@/hooks/useHistory";
import { cn } from "@/lib/utils";

const LEFT_W = 258;
const RIGHT_W = 300;

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
  const { user, signOut } = useAuth();

  const chatPanelRef = useRef<AIChatPanelHandle>(null);
  const contentViewerRef = useRef<ContentViewerHandle>(null);
  const summaTreeRef = useRef<SummaTreeHandle>(null);

  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [previousSelected, setPreviousSelected] = useState<SelectedNode | null>(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"browse" | "bookmarks" | "notes" | "history">("browse");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [highlightFragment, setHighlightFragment] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const { bookmarks, add: addBookmark, remove: removeBookmark, moveToFolder, isBookmarked, bookmarkId, bookmarkFolder, folders: bookmarkFolders } = useBookmarks(user);
  const { history, record: recordVisit } = useHistory(user);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lumen-notes");
      if (saved) setNotes(JSON.parse(saved));
    } catch {}
  }, []);

  const updateNote = (key: string, value: string) => {
    const updated = { ...notes, [key]: value };
    setNotes(updated);
    try { localStorage.setItem("lumen-notes", JSON.stringify(updated)); } catch {}
  };

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

      b: () => setLeftOpen((o) => !o),
      a: () => setRightOpen((o) => !o),

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

  const handleNavigate = (urlPath: string) => {
    const hashIdx = urlPath.indexOf("#");
    setHighlightFragment(hashIdx !== -1 ? urlPath.slice(hashIdx + 1) : null);
    // Record history for article navigations from the AI panel or citations
    const clean = hashIdx !== -1 ? urlPath.slice(0, hashIdx) : urlPath;
    const parsed = parseParams({ part: clean.split("/")[1], question: clean.split("/")[2], article: clean.split("/")[3] });
    if (parsed) recordVisit(parsed);
    router.push(urlPath);
  };

  const handleTreeSelect = (node: SelectedNode) => {
    setSearchQuery("");
    setSearchInput("");
    setPreviousSelected(null);
    if (isMobile) setLeftOpen(false);
    recordVisit(node);
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
          {mounted && (
            user ? (
              <UserMenu
                user={user}
                onSignOut={signOut}
                onShowKeybindings={() => setHelpOpen(true)}
              />
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                title="Sign in"
                className="p-2.5 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
              >
                <UserCircle className="h-3.5 w-3.5" />
              </button>
            )
          )}
          {/* AI chat toggle — hidden while AI panel is disabled
          {!isMobile && (
            <button
              onClick={() => setRightOpen((o) => !o)}
              title={rightOpen ? "Collapse AI chat (a)" : "Open AI chat (a)"}
              className="p-2.5 text-muted-foreground/35 hover:text-muted-foreground/70 transition-colors"
            >
              {rightOpen
                ? <MessageSquare className="h-3.5 w-3.5" />
                : <PanelRightOpen className="h-3.5 w-3.5" />
              }
            </button>
          )}
          */}
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
          <div className="flex flex-col h-full w-full overflow-hidden" style={{ width: LEFT_W }}>
            <div className="shrink-0 flex items-stretch border-b border-border">
              {([
                { id: "browse",    Icon: BookOpen, label: "Browse"  },
                { id: "bookmarks", Icon: Bookmark, label: "Saved"   },
                { id: "notes",     Icon: PenLine,  label: "Notes"   },
                { id: "history",   Icon: Clock,    label: "History" },
              ] as const).map(({ id, Icon, label }) => (
                <button
                  key={id}
                  onClick={() => setSidebarTab(id)}
                  title={label}
                  tabIndex={leftOpen || isMobile ? 0 : -1}
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
              <BookmarksPanel
                bookmarks={bookmarks}
                isSignedIn={!!user}
                onNavigate={(url) => { router.push(url); if (isMobile) setLeftOpen(false); }}
                onRemove={removeBookmark}
                onMoveToFolder={moveToFolder}
                onSignIn={() => setAuthOpen(true)}
              />
            )}
            {sidebarTab === "notes" && (() => {
              if (!selected) return (
                <div className="flex-1 flex items-center justify-center p-6">
                  <p className="font-cardo italic text-[12px] text-muted-foreground/30 text-center">Open an article to take notes</p>
                </div>
              );
              const noteKey = `${selected.partId}-${selected.questionN}-${selected.articleN ?? "q"}`;
              return (
                <div className="flex-1 flex flex-col p-3 gap-2">
                  <p className="font-cardo italic text-[11px] text-muted-foreground/40 leading-tight">
                    {selected.partAbbr} Q.{selected.questionN}{selected.articleN ? ` A.${selected.articleN}` : ""}
                  </p>
                  <textarea
                    className="flex-1 w-full bg-transparent resize-none text-[12px] font-cardo text-foreground/80 placeholder:text-muted-foreground/25 focus:outline-none leading-relaxed"
                    placeholder="Write a note…"
                    value={notes[noteKey] ?? ""}
                    onChange={(e) => updateNote(noteKey, e.target.value)}
                  />
                </div>
              );
            })()}
            {sidebarTab === "history" && (
              <div className="flex-1 overflow-y-auto">
                {!user ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
                    <p className="font-cardo italic text-[12px] text-muted-foreground/30 text-center">Sign in to track reading history</p>
                    <button
                      onClick={() => setAuthOpen(true)}
                      className="font-inter text-[10px] tracking-wide px-3 py-1.5 border border-border rounded text-muted-foreground/50 hover:text-foreground/70 hover:border-foreground/25 transition-colors"
                    >
                      Sign in
                    </button>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex items-center justify-center h-full p-6">
                    <p className="font-cardo italic text-[12px] text-muted-foreground/30 text-center">No history yet</p>
                  </div>
                ) : (
                  <ul className="py-1">
                    {history.map((h) => {
                      const slug = { "prima-pars": "1", "prima-secundae": "1-2", "secunda-secundae": "2-2", "tertia-pars": "3" }[h.part_id] ?? h.part_id;
                      const part = SUMMA_PARTS.find((p) => p.id === h.part_id);
                      const question = part?.treatises.flatMap((t) => t.questions).find((q) => q.n === h.question_n);
                      const articleTitle = h.article_n
                        ? SUMMA_ARTICLE_TITLES[h.part_id]?.[h.question_n]?.find((a) => a.n === h.article_n)?.title
                        : undefined;
                      const label = articleTitle
                        ? `Q.${h.question_n} A.${h.article_n} — ${articleTitle}`
                        : question
                        ? `Q.${h.question_n} — ${question.title}`
                        : `Q.${h.question_n}${h.article_n ? ` A.${h.article_n}` : ""}`;
                      return (
                        <li key={h.id}>
                          <button
                            onClick={() => {
                              router.push(h.article_n ? `/${slug}/${h.question_n}/${h.article_n}` : `/${slug}/${h.question_n}`);
                              if (isMobile) setLeftOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 font-cardo text-[12px] text-foreground/65 hover:text-foreground/90 leading-tight truncate transition-colors"
                            title={label}
                          >
                            {label}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
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
          {/* AI panel edge handle — hidden while AI panel is disabled
          {!isMobile && rightOpen && (
            <div
              onClick={() => setRightOpen((o) => !o)}
              title="Collapse AI panel"
              className="absolute right-0 inset-y-0 w-4 z-20 cursor-pointer group/right-edge"
            >
              <div className="absolute right-0 inset-y-0 w-[2px] bg-border group-hover/right-edge:bg-foreground/30 transition-colors duration-150" />
            </div>
          )}
          */}

          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            <ContentViewer
              ref={contentViewerRef}
              selected={selected}
              searchQuery={searchQuery}
              previousSelected={previousSelected}
              highlightFragment={highlightFragment}
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
                if (!rightOpen) setRightOpen(true);
              }}
              isBookmarked={selected ? isBookmarked(selected) : false}
              bookmarkId={selected ? bookmarkId(selected) : null}
              bookmarkFolder={selected ? bookmarkFolder(selected) : null}
              bookmarkFolders={bookmarkFolders}
              isSignedIn={!!user}
              onAddBookmark={addBookmark}
              onRemoveBookmark={removeBookmark}
              onSignIn={() => setAuthOpen(true)}
            />
          </main>
        </div>

        {/* AI chat panel — hidden while AI panel is disabled
        {!isMobile && (
          <aside
            className="shrink-0 flex flex-col overflow-hidden border-l border-border bg-background transition-[width] duration-200 ease-in-out"
            style={{ width: rightOpen ? RIGHT_W : 0 }}
          >
            {rightOpen && (
              <AIChatPanel
                ref={chatPanelRef}
                selected={selected}
                onCollapse={() => setRightOpen(false)}
                onNavigate={handleNavigate}
              />
            )}
          </aside>
        )}
        */}

      </div>

      <KeybindingsHelp open={helpOpen} onClose={() => setHelpOpen(false)} />
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
