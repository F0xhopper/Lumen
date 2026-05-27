"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Binding {
  key: string;
  description: string;
}

const SECTIONS: { label: string; bindings: Binding[] }[] = [
  {
    label: "Navigation",
    bindings: [
      { key: "j / k", description: "Scroll down / up" },
      { key: "d / u", description: "Half page down / up" },
      { key: "g g", description: "Scroll to top" },
      { key: "G", description: "Scroll to bottom" },
      { key: "[", description: "Previous article" },
      { key: "]", description: "Next article" },
    ],
  },
  {
    label: "Focus",
    bindings: [
      { key: "/", description: "Search the Summa" },
      { key: "f", description: "Filter tree" },
      { key: "a", description: "Ask AI" },
      { key: "Esc", description: "Blur / dismiss" },
    ],
  },
  {
    label: "Panels",
    bindings: [
      { key: "b", description: "Toggle sidebar" },
      { key: "c", description: "Toggle AI chat" },
      { key: "t", description: "Toggle theme" },
      { key: "?", description: "Show this help" },
    ],
  },
];

interface KeybindingsHelpProps {
  open: boolean;
  onClose: () => void;
}

export default function KeybindingsHelp({ open, onClose }: KeybindingsHelpProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-background border border-border rounded-lg p-5 w-[420px] max-w-[92vw] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-muted-foreground/50">
            Keyboard shortcuts
          </p>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.label}>
              <p className="font-inter text-[9px] tracking-[0.12em] uppercase text-muted-foreground/35 mb-1.5">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.bindings.map(({ key, description }) => (
                  <div key={key} className="flex items-center justify-between py-1 border-b border-border/25">
                    <span className="font-inter text-[11px] text-foreground/65">{description}</span>
                    <kbd
                      className={cn(
                        "font-mono text-[10px] bg-secondary border border-border/60 rounded px-1.5 py-0.5",
                        "text-muted-foreground/70 leading-none"
                      )}
                    >
                      {key}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[8px] text-muted-foreground/25 text-right">
          Bindings inactive when typing · Esc or ? to close
        </p>
      </div>
    </div>
  );
}
