"use client";

import { Bookmark, Search, MessageSquare } from "lucide-react";

export interface HighlightState {
  text: string;
  rect: DOMRect;
  mouseX: number;
  mouseY: number;
}

type HighlightAction = {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
};

export function HighlightMenu({
  highlight,
  onNote,
  onSearch,
  onAddToChat,
  onDismiss,
}: {
  highlight: HighlightState;
  onNote: (text: string) => void;
  onSearch: (text: string) => void;
  onAddToChat: (text: string) => void;
  onDismiss: () => void;
}) {
  const W = 186;
  const GAP = 8;

  const anchorX = Number.isFinite(highlight.mouseX)
    ? highlight.mouseX
    : highlight.rect.left + highlight.rect.width / 2;
  const anchorY = Number.isFinite(highlight.mouseY)
    ? highlight.mouseY
    : highlight.rect.bottom;

  const left = Math.max(
    8,
    Math.min(anchorX - W / 2, window.innerWidth - W - 8),
  );
  const top = anchorY > 54 ? anchorY - 48 - GAP : anchorY + GAP;

  const actions: HighlightAction[] = [
    {
      icon: Bookmark,
      label: "Note",
      onClick: () => {
        onNote(highlight.text);
        onDismiss();
      },
    },
    {
      icon: Search,
      label: "Search",
      onClick: () => {
        onSearch(highlight.text);
        onDismiss();
      },
    },
    {
      icon: MessageSquare,
      label: "Chat",
      onClick: () => {
        onAddToChat(highlight.text);
        onDismiss();
      },
    },
  ];

  return (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="fixed z-50 flex items-stretch bg-background border border-border/60 rounded shadow-md shadow-black/30 divide-x divide-border/40 overflow-hidden"
      style={{ left, top, width: W }}
    >
      {actions.map(({ icon: Icon, label, onClick }) => (
        <button
          key={label}
          onClick={onClick}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground/40 hover:text-foreground/80 hover:bg-foreground/[0.035] transition-colors"
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="font-inter text-[10px] tracking-[0.10em] uppercase leading-none">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}
