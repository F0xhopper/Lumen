"use client";

import { X, Eye, Quote } from "lucide-react";
import type { SelectedNode } from "@/lib/summa-full";
import { nodeUrl } from "@/lib/navigation";

export type ViewingArg = { id: "viewing"; type: "viewing"; node: SelectedNode };
export type QuoteArg   = { id: string;   type: "quote";   text: string; node: SelectedNode };
export type ContextArg = ViewingArg | QuoteArg;

export function nodeLabel(node: SelectedNode): string {
  const base = `${node.partAbbr} Q.${node.questionN}`;
  return node.articleN !== undefined ? `${base} A.${node.articleN}` : base;
}

export function buildContextPrefix(args: ContextArg[]): string {
  return args
    .map((a) => {
      if (a.type === "viewing") {
        return `[Viewing: ${nodeLabel(a.node)} — "${a.node.questionTitle}"]`;
      }
      const snippet = a.text.length > 120 ? a.text.slice(0, 120) + "…" : a.text;
      return `[Quote from ${nodeLabel(a.node)}: "${snippet}"]`;
    })
    .join("\n");
}

export function ContextArgChip({ arg, onRemove }: { arg: ContextArg; onRemove: () => void }) {
  if (arg.type === "viewing") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/60 bg-secondary/70 text-[8.5px] font-mono text-foreground/60 max-w-full">
        <Eye className="h-[9px] w-[9px] shrink-0 text-muted-foreground/40" />
        <span className="truncate">{nodeLabel(arg.node)}</span>
        <button onClick={onRemove} className="ml-0.5 shrink-0 text-muted-foreground/40 hover:text-foreground/70 transition-colors">
          <X className="h-2 w-2" />
        </button>
      </span>
    );
  }

  const snippet = arg.text.length > 50 ? arg.text.slice(0, 50) + "…" : arg.text;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/60 bg-secondary/70 text-[8.5px] font-mono text-foreground/60 max-w-full">
      <Quote className="h-[9px] w-[9px] shrink-0 text-muted-foreground/40" />
      <span className="truncate italic">"{snippet}"</span>
      <span className="text-muted-foreground/35 shrink-0">·</span>
      <span className="shrink-0">{nodeLabel(arg.node)}</span>
      <button onClick={onRemove} className="ml-0.5 shrink-0 text-muted-foreground/40 hover:text-foreground/70 transition-colors">
        <X className="h-2 w-2" />
      </button>
    </span>
  );
}

export function SentContextArg({ arg, onNavigate }: { arg: ContextArg; onNavigate?: (urlPath: string) => void }) {
  const Icon = arg.type === "viewing" ? Eye : Quote;
  const label =
    arg.type === "viewing"
      ? nodeLabel(arg.node)
      : `"${arg.text.length > 40 ? arg.text.slice(0, 40) + "…" : arg.text}" · ${nodeLabel(arg.node)}`;

  return (
    <button
      onClick={() => onNavigate?.(nodeUrl(arg.node))}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/40 bg-secondary/40 text-[8.5px] font-mono text-muted-foreground/50 hover:text-foreground/70 hover:border-border transition-colors max-w-full"
    >
      <Icon className="h-[9px] w-[9px] shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}
