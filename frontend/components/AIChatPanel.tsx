"use client";

import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from "react";
import { Send, Loader2, RotateCcw, PanelRightClose, X, Eye, Quote } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import CitationChip from "./CitationChip";
import { postQuery } from "@/lib/api";
import type { CitationResult, ConversationTurn } from "@/lib/api";
import type { SelectedNode } from "@/lib/summa-full";
import { cn } from "@/lib/utils";

// ── Context argument types ─────────────────────────────────────────────────────

type ViewingArg = { id: "viewing"; type: "viewing"; node: SelectedNode };
type QuoteArg   = { id: string;   type: "quote";   text: string; node: SelectedNode };
export type ContextArg = ViewingArg | QuoteArg;

function nodeLabel(node: SelectedNode): string {
  const base = `${node.partAbbr} Q.${node.questionN}`;
  return node.articleN !== undefined ? `${base} A.${node.articleN}` : base;
}

function buildContextPrefix(args: ContextArg[]): string {
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

// ── Message type ───────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationResult[];
  contextArgs?: ContextArg[];
  agentSteps?: number;
  passagesUsed?: number;
}

// ── Ref handle ─────────────────────────────────────────────────────────────────

export interface AIChatPanelHandle {
  addQuote: (text: string, node: SelectedNode) => void;
}

interface Props {
  selected: SelectedNode | null;
  onCollapse: () => void;
  onNavigate?: (urlPath: string) => void;
}

// ── Context arg chips ──────────────────────────────────────────────────────────

function ContextArgChip({ arg, onRemove }: { arg: ContextArg; onRemove: () => void }) {
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

// ── Sent-message context chips (read-only) ─────────────────────────────────────

function SentContextArg({ arg, onNavigate }: { arg: ContextArg; onNavigate?: (urlPath: string) => void }) {
  const PART_SLUG: Record<string, string> = { I: "1", "I-II": "1-2", "II-II": "2-2", III: "3" };
  const urlPath = arg.node.articleN !== undefined
    ? `/${PART_SLUG[arg.node.partAbbr]}/${arg.node.questionN}/${arg.node.articleN}`
    : `/${PART_SLUG[arg.node.partAbbr]}/${arg.node.questionN}`;
  const Icon = arg.type === "viewing" ? Eye : Quote;
  const label = arg.type === "viewing"
    ? nodeLabel(arg.node)
    : `"${arg.text.length > 40 ? arg.text.slice(0, 40) + "…" : arg.text}" · ${nodeLabel(arg.node)}`;

  return (
    <button
      onClick={() => onNavigate?.(urlPath)}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/40 bg-secondary/40 text-[8.5px] font-mono text-muted-foreground/50 hover:text-foreground/70 hover:border-border transition-colors max-w-full"
    >
      <Icon className="h-[9px] w-[9px] shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const AIChatPanel = forwardRef<AIChatPanelHandle, Props>(function AIChatPanel(
  { selected, onCollapse, onNavigate },
  ref,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contextArgs, setContextArgs] = useState<ContextArg[]>([]);
  const [isPending, setIsPending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastViewingKeyRef = useRef<string | null>(null);

  // Auto-add viewing arg when navigating to a new article
  useEffect(() => {
    if (!selected) {
      setContextArgs((prev) => prev.filter((a) => a.type !== "viewing"));
      lastViewingKeyRef.current = null;
      return;
    }
    const key = `${selected.partAbbr}-${selected.questionN}-${selected.articleN ?? ""}`;
    if (key === lastViewingKeyRef.current) return;
    lastViewingKeyRef.current = key;
    setContextArgs((prev) => {
      const without = prev.filter((a) => a.type !== "viewing");
      return [{ id: "viewing", type: "viewing", node: selected }, ...without];
    });
  }, [selected]);

  useImperativeHandle(ref, () => ({
    addQuote(text, node) {
      const id = `quote-${Date.now()}`;
      setContextArgs((prev) => [...prev, { id, type: "quote", text, node }]);
    },
  }));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNavigate = useCallback(
    (urlPath: string) => onNavigate?.(urlPath),
    [onNavigate],
  );

  const removeContextArg = (id: string) => {
    setContextArgs((prev) => prev.filter((a) => a.id !== id));
    if (id === "viewing") lastViewingKeyRef.current = null;
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const send = useCallback(async () => {
    if (!input.trim() || isPending) return;

    const userText = input.trim();
    const currentArgs = [...contextArgs];

    const prefix = buildContextPrefix(currentArgs);
    const fullQuery = prefix ? `${prefix}\n\n${userText}` : userText;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: userText,
      contextArgs: currentArgs.length > 0 ? currentArgs : undefined,
    };

    const history: ConversationTurn[] = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setContextArgs((prev) => prev.filter((a) => a.type === "viewing")); // keep viewing, clear quotes
    setIsPending(true);

    try {
      const result = await postQuery({
        query: fullQuery,
        conversation_history: history,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: result.answer,
          citations: result.citations,
          agentSteps: result.agent_steps,
          passagesUsed: result.passages_used,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Request failed. Is the backend running?",
        },
      ]);
    } finally {
      setIsPending(false);
      inputRef.current?.focus();
    }
  }, [input, isPending, messages, contextArgs]);

  const clear = () => {
    setMessages([]);
    // Keep contextArgs — viewing chip persists
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border">
        <button
          onClick={onCollapse}
          title="Collapse panel"
          className="shrink-0 p-1 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </button>
        <div className="flex-1 min-w-0" />
        {messages.length > 0 && (
          <button
            onClick={clear}
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title="Clear conversation"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {messages.length === 0 && (
          <div className="text-center pt-6 px-2">
            <p className="text-[10px] text-muted-foreground/30 leading-relaxed">
              {selected
                ? `Ask anything about ${selected.partAbbr} Q.${selected.questionN}`
                : "Select a question then ask the AI"}
            </p>
            <p className="text-[9px] text-muted-foreground/20 mt-2">
              Highlight text to quote it in chat
            </p>
            {selected && (
              <div className="mt-4 space-y-1.5">
                {[
                  `What is the central argument of Q.${selected.questionN}?`,
                  `What objections does Aquinas consider?`,
                  `How does this connect to the rest of the Summa?`,
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="w-full text-left text-[9px] text-muted-foreground/40 hover:text-muted-foreground/60 px-2 py-1.5 border border-border/50 rounded hover:border-border transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={cn(msg.role === "user" ? "flex flex-col items-end gap-1.5" : "block")}>
            {msg.role === "user" && msg.contextArgs && msg.contextArgs.length > 0 && (
              <div className="flex flex-wrap gap-1 max-w-[88%] justify-end">
                {msg.contextArgs.map((arg) => (
                  <SentContextArg key={arg.id} arg={arg} onNavigate={handleNavigate} />
                ))}
              </div>
            )}

            {msg.role === "user" ? (
              <div className="max-w-[88%] px-3 py-2 bg-secondary border border-border rounded text-[11px] text-foreground/85 leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-[11px] text-foreground/80 leading-relaxed [&_.markdown]:text-[11px] [&_.markdown_p]:mb-2 [&_.markdown_p]:leading-relaxed">
                  <MarkdownRenderer
                    content={msg.content}
                    citations={msg.citations}
                    onNavigate={handleNavigate}
                  />
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="border-t border-border/40 pt-2 space-y-1">
                    <p className="text-[8px] tracking-[0.12em] uppercase text-muted-foreground/30">
                      Sources
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {msg.citations.map((c) => (
                        <CitationChip key={c.ref} citation={c} onNavigate={handleNavigate} />
                      ))}
                    </div>
                  </div>
                )}

                {msg.passagesUsed !== undefined && (
                  <p className="text-[8px] text-muted-foreground/25">
                    {msg.passagesUsed} passage{msg.passagesUsed !== 1 ? "s" : ""} retrieved
                    {msg.agentSteps !== undefined && msg.agentSteps > 1
                      ? ` · ${msg.agentSteps} search rounds`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        {isPending && (
          <div className="flex items-center gap-2 text-muted-foreground/50">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[9px] tracking-wider">Thinking…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border p-3">
        {contextArgs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {contextArgs.map((arg) => (
              <ContextArgChip key={arg.id} arg={arg} onRemove={() => removeContextArg(arg.id)} />
            ))}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Ask about the Summa…"
            rows={2}
            className={cn(
              "flex-1 resize-none px-3 py-2 bg-secondary border border-border rounded text-[11px] text-foreground",
              "placeholder:text-muted-foreground/40 leading-relaxed",
              "focus:outline-none focus:border-foreground/20 transition-colors",
            )}
            disabled={isPending}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isPending}
            className="shrink-0 p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
        <p className="text-[8px] text-muted-foreground/25 mt-1.5">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
});

export default AIChatPanel;
