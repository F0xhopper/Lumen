"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SelectedNode } from "@/lib/summa-full";

interface BookmarkButtonProps {
  selected: SelectedNode;
  isBookmarked: boolean;
  bookmarkId: string | null;
  currentFolder: string | null;
  folders: string[];
  isSignedIn: boolean;
  onAdd: (node: SelectedNode, folder?: string | null) => void;
  onRemove: (id: string) => void;
  onSignIn: () => void;
}

export default function BookmarkButton({
  selected,
  isBookmarked,
  bookmarkId,
  currentFolder,
  folders,
  isSignedIn,
  onAdd,
  onRemove,
  onSignIn,
}: BookmarkButtonProps) {
  const [open, setOpen] = useState(false);
  const [pickedFolder, setPickedFolder] = useState<string | null>(null);
  const [newFolder, setNewFolder] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      setPickedFolder(currentFolder);
      setNewFolder("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, currentFolder]);

  const handleIconClick = () => {
    if (!isSignedIn) { onSignIn(); return; }
    if (isBookmarked) {
      onRemove(bookmarkId!);
    } else {
      setOpen((o) => !o);
    }
  };

  const save = () => {
    const folder = newFolder.trim() || pickedFolder || null;
    onAdd(selected, folder);
    setOpen(false);
    setNewFolder("");
    setPickedFolder(null);
  };

  return (
    <div className="relative" data-bookmark-button>
      <button
        onClick={handleIconClick}
        title={isBookmarked ? "Remove bookmark" : "Bookmark this article"}
        className={cn(
          "p-2.5 transition-colors",
          isBookmarked
            ? "text-foreground/65 hover:text-muted-foreground/40"
            : "text-muted-foreground/40 hover:text-foreground/70"
        )}
      >
        {isBookmarked
          ? <BookmarkCheck className="h-3.5 w-3.5" />
          : <Bookmark className="h-3.5 w-3.5" />
        }
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-1 w-52 z-50 bg-background border border-border rounded-lg shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="font-inter text-[10px] tracking-widest uppercase text-muted-foreground/40">
              Save to folder
            </p>
          </div>

          {folders.length > 0 && (
            <div className="py-1 border-b border-border">
              <button
                onClick={() => setPickedFolder(null)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-[6px] font-inter text-[11px] text-left transition-colors hover:bg-foreground/[0.04]",
                  pickedFolder === null ? "text-foreground/80" : "text-muted-foreground/55"
                )}
              >
                <span className="flex-1">Uncategorized</span>
                {pickedFolder === null && (
                  <span className="text-muted-foreground/40 text-[9px]">✓</span>
                )}
              </button>
              {folders.map((f) => (
                <button
                  key={f}
                  onClick={() => setPickedFolder(f)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-[6px] font-inter text-[11px] text-left transition-colors hover:bg-foreground/[0.04]",
                    pickedFolder === f ? "text-foreground/80" : "text-muted-foreground/55"
                  )}
                >
                  <span className="flex-1 truncate">{f}</span>
                  {pickedFolder === f && (
                    <span className="text-muted-foreground/40 text-[9px]">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}

          <div className="px-2 py-2 space-y-1.5">
            <input
              ref={inputRef}
              value={newFolder}
              onChange={(e) => setNewFolder(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); save(); }
                if (e.key === "Escape") setOpen(false);
              }}
              placeholder={folders.length > 0 ? "New folder…" : "Folder name (optional)…"}
              className="w-full px-2 py-1.5 bg-secondary border border-border rounded font-cardo text-[11px] text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-foreground/25 transition-colors"
            />
            <button
              onClick={save}
              className="w-full py-1.5 font-inter text-[10px] tracking-wide bg-foreground/[0.06] hover:bg-foreground/[0.1] text-foreground/70 rounded transition-colors"
            >
              Save bookmark
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
