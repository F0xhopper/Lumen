"use client";

import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from "react";
import { Send, Loader2, RotateCcw, PanelRightClose } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import CitationChip from "./CitationChip";
import {
  ContextArgChip,
  SentContextArg,
  buildContextPrefix,
  type ContextArg,
} from "./ContextArgChip";
import { postQuery } from "@/lib/api";
import type { CitationResult, ConversationTurn } from "@/lib/api";
import type { SelectedNode } from "@/lib/summa-full";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationResult[];
  contextArgs?: ContextArg[];
  agentSteps?: number;
  passagesUsed?: number;
}

export interface AIChatPanelHandle {
  addQuote: (text: string, node: SelectedNode) => void;
  focusInput: () => void;
}

interface Props {
  selected: SelectedNode | null;
  onCollapse: () => void;
  onNavigate?: (urlPath: string) => void;
}

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
    focusInput() {
      inputRef.current?.focus();
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
    setContextArgs((prev) => prev.filter((a) => a.type === "viewing"));
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

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
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
            onClick={() => setMessages([])}
            className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title="Clear conversation"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        )}
      </div>

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
                    <p className="text-[8px] tracking-[0.12em] uppercase text-muted-foreground/30">Sources</p>
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
