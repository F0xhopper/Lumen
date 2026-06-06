"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen, FolderPlus, X } from "lucide-react";
import type { Bookmark } from "@/lib/api/user-data";
import { SUMMA_PARTS } from "@/lib/summa-full";
import { cn } from "@/lib/utils";

const PART_SLUG: Record<string, string> = {
  "prima-pars": "1",
  "prima-secundae": "1-2",
  "secunda-secundae": "2-2",
  "tertia-pars": "3",
};

function bookmarkLabel(b: Bookmark): string {
  if (b.label) return b.label;
  const part = SUMMA_PARTS.find((p) => p.id === b.part_id);
  const question = part?.treatises.flatMap((t) => t.questions).find((q) => q.n === b.question_n);
  const base = question ? `Q.${b.question_n} — ${question.title}` : `Q.${b.question_n}`;
  return b.article_n ? `${base} A.${b.article_n}` : base;
}

function bookmarkUrl(b: Bookmark): string {
  const slug = PART_SLUG[b.part_id] ?? b.part_id;
  return b.article_n ? `/${slug}/${b.question_n}/${b.article_n}` : `/${slug}/${b.question_n}`;
}

// ── Folder picker popover ────────────────────────────────────────────────────

interface FolderPickerProps {
  currentFolder: string | null;
  folders: string[];
  onAssign: (folder: string | null) => void;
  onClose: () => void;
}

function FolderPicker({ currentFolder, folders, onAssign, onClose }: FolderPickerProps) {
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [onClose]);

  const submit = () => {
    const name = newName.trim();
    if (name) { onAssign(name); setNewName(""); }
  };

  return (
    <div
      ref={ref}
      className="absolute left-full top-0 ml-1 w-44 z-50 bg-background border border-border rounded-lg shadow-xl overflow-hidden"
    >
      {folders.length > 0 && (
        <>
          <div className="py-1">
            <button
              onClick={() => onAssign(null)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-[6px] font-inter text-[11px] text-left transition-colors hover:bg-foreground/[0.04]",
                currentFolder === null ? "text-foreground/80" : "text-muted-foreground/55",
              )}
            >
              <span className="flex-1">Uncategorized</span>
              {currentFolder === null && <span className="text-muted-foreground/40 text-[9px]">✓</span>}
            </button>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => onAssign(f)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-[6px] font-inter text-[11px] text-left transition-colors hover:bg-foreground/[0.04]",
                  currentFolder === f ? "text-foreground/80" : "text-muted-foreground/55",
                )}
              >
                <span className="flex-1 truncate">{f}</span>
                {currentFolder === f && <span className="text-muted-foreground/40 text-[9px]">✓</span>}
              </button>
            ))}
          </div>
          <div className="h-px bg-border" />
        </>
      )}
      <div className="px-2 py-2">
        <input
          ref={inputRef}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); submit(); }
            if (e.key === "Escape") onClose();
          }}
          placeholder="New folder…"
          className="w-full px-2 py-1.5 bg-secondary border border-border rounded font-cardo text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/25 transition-colors"
        />
      </div>
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

interface Props {
  bookmarks: Bookmark[];
  onNavigate: (url: string) => void;
  onRemove: (id: string) => void;
  onMoveToFolder: (id: string, folder: string | null) => void;
  onSignIn: () => void;
  isSignedIn: boolean;
}

export default function BookmarksPanel({
  bookmarks,
  onNavigate,
  onRemove,
  onMoveToFolder,
  onSignIn,
  isSignedIn,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pickerFor, setPickerFor] = useState<string | null>(null);
  const [localFolders, setLocalFolders] = useState<string[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingFolder) newFolderInputRef.current?.focus();
  }, [creatingFolder]);

  if (!isSignedIn) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6">
        <p className="font-cardo italic text-[12px] text-muted-foreground/30 text-center">
          Sign in to save bookmarks
        </p>
        <button
          onClick={onSignIn}
          className="font-inter text-[10px] tracking-wide px-3 py-1.5 border border-border rounded text-muted-foreground/50 hover:text-foreground/70 hover:border-foreground/25 transition-colors"
        >
          Sign in
        </button>
      </div>
    );
  }

  // Named folders: union of folders from saved bookmarks + locally created empty folders
  const folderNamesFromBookmarks = Array.from(
    new Set(bookmarks.map((b) => b.folder).filter((f): f is string => f !== null)),
  ).sort();
  const allNamedFolders = Array.from(new Set([...folderNamesFromBookmarks, ...localFolders])).sort();
  const allFolders = [...allNamedFolders, null] as (string | null)[];

  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (name && !allNamedFolders.includes(name)) {
      setLocalFolders((prev) => [...prev, name]);
    }
    setNewFolderName("");
    setCreatingFolder(false);
  };

  const handleDeleteFolder = (folder: string) => {
    // Move all bookmarks in this folder to uncategorized
    bookmarks.filter((b) => b.folder === folder).forEach((b) => onMoveToFolder(b.id, null));
    // Remove from locally created folders
    setLocalFolders((prev) => prev.filter((f) => f !== folder));
  };

  const hasContent = bookmarks.length > 0 || localFolders.length > 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between px-2.5 py-1.5 border-b border-border">
        <span className="font-inter text-[9px] tracking-widest uppercase text-muted-foreground/25">Saved</span>
        <button
          onClick={() => setCreatingFolder(true)}
          title="New folder"
          className="p-1 text-muted-foreground/30 hover:text-foreground/60 transition-colors"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Inline new-folder input */}
        {creatingFolder && (
          <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border/50">
            <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
            <input
              ref={newFolderInputRef}
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleCreateFolder(); }
                if (e.key === "Escape") { setNewFolderName(""); setCreatingFolder(false); }
              }}
              onBlur={handleCreateFolder}
              placeholder="Folder name…"
              className="flex-1 bg-transparent border-b border-foreground/20 font-inter text-[11px] text-foreground/80 placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/40 transition-colors pb-0.5"
            />
          </div>
        )}

        {/* Empty state */}
        {!hasContent && !creatingFolder && (
          <div className="flex items-center justify-center h-full p-6">
            <p className="font-cardo italic text-[12px] text-muted-foreground/30 text-center leading-relaxed">
              No bookmarks yet — use the bookmark icon in the header while reading
            </p>
          </div>
        )}

        {/* Folder list */}
        <div className="py-1">
          {allFolders.map((folder) => {
            const items = bookmarks.filter((b) => b.folder === folder);
            // Skip uncategorized section if empty; always show named folders (even if empty)
            if (folder === null && items.length === 0) return null;

            const key = folder ?? "__uncategorized__";
            const isOpen = !collapsed.has(key);

            return (
              <div key={key}>
                {/* Folder header */}
                <div className="group/folder flex items-center px-2.5 py-1.5 hover:bg-foreground/[0.03] transition-colors">
                  <button
                    onClick={() => toggleCollapse(key)}
                    className="flex-1 flex items-center gap-1.5 min-w-0"
                  >
                    {isOpen
                      ? <ChevronDown className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                      : <ChevronRight className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                    }
                    {isOpen
                      ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                      : <Folder className="h-3.5 w-3.5 text-muted-foreground/35 shrink-0" />
                    }
                    <span className="flex-1 text-left font-inter text-[10px] tracking-wide text-muted-foreground/50 truncate">
                      {folder ?? "Uncategorized"}
                    </span>
                    <span className="font-inter text-[9px] text-muted-foreground/30">{items.length || ""}</span>
                  </button>
                  {folder !== null && (
                    <button
                      onClick={() => handleDeleteFolder(folder)}
                      title="Delete folder"
                      className="shrink-0 ml-1 p-0.5 text-transparent group-hover/folder:text-muted-foreground/30 hover:!text-foreground/60 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>

                {/* Bookmark rows */}
                {isOpen && (
                  <>
                    {items.length === 0 ? (
                      <p className="pl-8 pb-1.5 font-cardo italic text-[11px] text-muted-foreground/25">
                        Empty
                      </p>
                    ) : (
                      <ul>
                        {items.map((b) => (
                          <li key={b.id} className="group/item relative flex items-center pl-7 pr-1.5">
                            <button
                              onClick={() => { onNavigate(bookmarkUrl(b)); }}
                              className="flex-1 text-left py-1.5 font-cardo text-[12px] text-foreground/60 hover:text-foreground/90 leading-snug truncate transition-colors"
                              title={bookmarkLabel(b)}
                            >
                              {bookmarkLabel(b)}
                            </button>

                            {/* Hover actions */}
                            <div className="shrink-0 flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                              <div className="relative">
                                <button
                                  onClick={(e) => { e.stopPropagation(); setPickerFor(pickerFor === b.id ? null : b.id); }}
                                  title="Move to folder"
                                  className="p-1 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
                                >
                                  <FolderPlus className="h-3 w-3" />
                                </button>
                                {pickerFor === b.id && (
                                  <FolderPicker
                                    currentFolder={b.folder}
                                    folders={allNamedFolders}
                                    onAssign={(f) => { onMoveToFolder(b.id, f); setPickerFor(null); }}
                                    onClose={() => setPickerFor(null)}
                                  />
                                )}
                              </div>
                              <button
                                onClick={() => onRemove(b.id)}
                                title="Remove bookmark"
                                className="p-1 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
