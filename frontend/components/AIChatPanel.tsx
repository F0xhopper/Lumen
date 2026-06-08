"use client";

import {
  useState, useRef, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from "react";
import { Send, RotateCcw, PanelRightClose, ArrowLeft } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import {
  ContextArgChip,
  SentContextArg,
  buildContextPrefix,
  type ContextArg,
} from "./ContextArgChip";
import { streamQuery, getErrorMessage } from "@/lib/api";
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
  isMobile?: boolean;
}

const AIChatPanel = forwardRef<AIChatPanelHandle, Props>(function AIChatPanel(
  { selected, onCollapse, onNavigate, isMobile },
  ref,
) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [contextArgs, setContextArgs] = useState<ContextArg[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [streamStatus, setStreamStatus] = useState<string | null>(null);

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

    const assistantId = (Date.now() + 1).toString();
    let messageCreated = false;

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setContextArgs((prev) => prev.filter((a) => a.type === "viewing"));
    setIsPending(true);
    setStreamStatus(null);

    const ensureMessage = () => {
      if (!messageCreated) {
        messageCreated = true;
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant" as const, content: "" }]);
      }
    };

    try {
      for await (const event of streamQuery({
        query: fullQuery,
        conversation_history: history,
      })) {
        if (event.type === "status") {
          setStreamStatus(event.message);
        } else if (event.type === "token") {
          ensureMessage();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + event.text }
                : m,
            ),
          );
        } else if (event.type === "done") {
          setStreamStatus(null);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    citations: event.citations,
                    passagesUsed: event.passages_used,
                    agentSteps: event.agent_steps,
                  }
                : m,
            ),
          );
        } else if (event.type === "error") {
          ensureMessage();
          setStreamStatus(null);
          const streamErrMsg =
            event.message === "Agent search limit reached"
              ? "Search limit reached. Try a more specific question."
              : event.message === "Internal server error"
              ? "Server error. Please try again."
              : event.message || "Request failed.";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: streamErrMsg } : m,
            ),
          );
        }
      }
    } catch (err) {
      ensureMessage();
      setStreamStatus(null);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: getErrorMessage(err, "query") }
            : m,
        ),
      );
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

      <div className="shrink-0 flex items-center px-2.5 border-b border-border gap-2 min-h-[44px]">
        <button
          onClick={onCollapse}
          title={isMobile ? "Back" : "Collapse panel"}
          className={cn(
            "shrink-0 p-1 transition-colors",
            isMobile
              ? "text-muted-foreground/60 hover:text-foreground/80 -ml-0.5"
              : "text-muted-foreground/35 hover:text-foreground/70",
          )}
        >
          {isMobile
            ? <ArrowLeft className="h-5 w-5" />
            : <PanelRightClose className="h-3.5 w-3.5" />
          }
        </button>
        {isMobile && (
          <span className="font-cardo italic text-[17px] text-foreground/75 leading-none">
            Ask Aquinas
          </span>
        )}
        <div className="flex-1" />
        {messages.length > 0 ? (
          <button
            onClick={() => setMessages([])}
            className="shrink-0 p-1 text-muted-foreground/35 hover:text-foreground/70 transition-colors"
            title="Clear conversation"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        ) : (
          <div className="w-5" />
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-8 px-2">
            <p className="font-cardo italic text-[13px] text-muted-foreground/30 leading-relaxed">
              {selected
                ? `Ask anything about ${selected.partAbbr} Q.${selected.questionN}`
                : "Select a question to begin"}
            </p>
            <p className="font-inter text-[9px] tracking-[0.08em] uppercase text-muted-foreground/25 mt-2">
              Highlight text to quote it in chat
            </p>
            {selected && (
              <div className="mt-5 space-y-1">
                {[
                  `What is the central argument of Q.${selected.questionN}?`,
                  `What objections does Aquinas consider?`,
                  `How does this connect to the rest of the Summa?`,
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => { setInput(suggestion); inputRef.current?.focus(); }}
                    className="w-full text-left font-cardo text-[12px] text-muted-foreground/45 hover:text-foreground/75 px-2 py-2 rounded hover:bg-foreground/[0.04] transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(msg.role === "user" ? "flex flex-col items-end gap-1" : "block")}
          >
            {msg.role === "user" && msg.contextArgs && msg.contextArgs.length > 0 && (
              <div className="flex flex-wrap gap-1 max-w-[90%] justify-end">
                {msg.contextArgs.map((arg) => (
                  <SentContextArg key={arg.id} arg={arg} onNavigate={handleNavigate} />
                ))}
              </div>
            )}

            {msg.role === "user" ? (
              <div className="max-w-[90%] px-2.5 py-1.5 bg-foreground/[0.06] rounded font-inter text-[11px] text-foreground/80 leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="font-cardo text-[13px] text-foreground/85 leading-relaxed [&_.markdown]:font-cardo [&_.markdown]:text-[13px] [&_.markdown_p]:mb-2 [&_.markdown_p]:leading-relaxed [&_.markdown_blockquote]:border-muted-foreground/30">
                  <MarkdownRenderer
                    content={msg.content}
                    citations={msg.citations}
                    onNavigate={handleNavigate}
                  />
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="pt-2 mt-0.5 border-t border-border/40">
                    <p className="font-inter text-[9px] tracking-[0.12em] uppercase text-muted-foreground/35 mb-1.5">Citations</p>
                    <div className="space-y-0.5">
                      {msg.citations.map((c) => (
                        <button
                          key={c.ref}
                          onClick={() => handleNavigate(c.url_path)}
                          title={`${c.question_title} — ${c.article_title}`}
                          className="w-full flex items-baseline gap-2 text-left group cursor-pointer hover:bg-foreground/[0.04] px-1.5 py-1 -mx-1.5 rounded transition-colors"
                        >
                          <span className="shrink-0 font-mono text-[9px] text-muted-foreground/40 group-hover:text-muted-foreground/60">[{c.ref}]</span>
                          <span className="flex-1 font-cardo text-[11px] text-foreground/55 group-hover:text-foreground/80 leading-tight min-w-0 truncate">
                            ST {c.part_abbr} Q.{c.question_n} A.{c.article_n} — {c.section_label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {msg.passagesUsed !== undefined && (
                  <p className="font-inter text-[9px] text-muted-foreground/30">
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
          <div className="flex items-center gap-2 pl-1">
            <span className="flex gap-[3px] items-center shrink-0 py-0.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="inline-block w-[3px] h-[3px] rounded-full bg-muted-foreground/30 animate-bounce"
                  style={{ animationDelay: `${i * 120}ms`, animationDuration: "900ms" }}
                />
              ))}
            </span>
            {streamStatus && (
              <span className="font-inter text-[9px] tracking-wide text-muted-foreground/30 truncate transition-opacity duration-300">
                {streamStatus}
              </span>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — matches left sidebar toolbar padding */}
      <div className="shrink-0 border-t border-border px-2 pt-2 pb-2">
        {contextArgs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5 px-0.5">
            {contextArgs.map((arg) => (
              <ContextArgChip key={arg.id} arg={arg} onRemove={() => removeContextArg(arg.id)} />
            ))}
          </div>
        )}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Ask about the Summa…"
            rows={2}
            className={cn(
              "w-full resize-none pl-3 pr-8 py-2 bg-secondary border border-border rounded",
              "font-cardo text-[12px] text-foreground placeholder:text-muted-foreground/35 placeholder:italic",
              "leading-relaxed focus:outline-none focus:border-foreground/25 transition-colors",
            )}
            disabled={isPending}
          />
          <button
            onClick={send}
            disabled={!input.trim() || isPending}
            className="absolute right-2 bottom-2 p-1 text-muted-foreground/35 hover:text-foreground/70 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
            title="Send (Enter)"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
});

export default AIChatPanel;
