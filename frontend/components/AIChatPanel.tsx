"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Loader2, RotateCcw, PanelRightClose } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";
import { postQuery } from "@/lib/api";
import type { SelectedNode } from "@/lib/summa-full";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function buildQuery(input: string, selected: SelectedNode | null): string {
  if (!selected) return input;
  const loc =
    selected.articleN !== undefined
      ? `${selected.partAbbr} Q.${selected.questionN} A.${selected.articleN}`
      : `${selected.partAbbr} Q.${selected.questionN}`;
  return `[Viewing: ${loc} — "${selected.questionTitle}"]\n\n${input}`;
}

export default function AIChatPanel({ selected, onCollapse }: { selected: SelectedNode | null; onCollapse: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (query: string) => postQuery(query),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: data.answer ?? "No response returned.",
        },
      ]);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Request failed. Is the backend running?",
        },
      ]);
    },
    onSettled: () => {
      inputRef.current?.focus();
    },
  });

  const send = useCallback(() => {
    if (!input.trim() || mutation.isPending) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const query = buildQuery(input.trim(), selected);
    setInput("");
    mutation.mutate(query);
  }, [input, mutation, selected]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clear = () => setMessages([]);

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
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
            AI Study Assistant
          </p>
          {selected && (
            <p className="text-[9px] text-muted-foreground/40 mt-0.5 truncate">
              {selected.partAbbr} Q.{selected.questionN}
              {selected.articleN !== undefined ? ` A.${selected.articleN}` : ""}
            </p>
          )}
        </div>
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
          <div
            key={msg.id}
            className={cn(msg.role === "user" ? "flex justify-end" : "block")}
          >
            {msg.role === "user" ? (
              <div className="max-w-[88%] px-3 py-2 bg-secondary border border-border rounded text-[11px] text-foreground/85 leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="text-[11px] text-foreground/80 leading-relaxed [&_.markdown]:text-[11px] [&_.markdown_p]:mb-2 [&_.markdown_p]:leading-relaxed">
                <MarkdownRenderer content={msg.content} />
              </div>
            )}
          </div>
        ))}

        {mutation.isPending && (
          <div className="flex items-center gap-2 text-muted-foreground/50">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-[9px] tracking-wider">Thinking…</span>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about the Summa…"
            rows={2}
            className={cn(
              "flex-1 resize-none px-3 py-2 bg-secondary border border-border rounded text-[11px] text-foreground",
              "placeholder:text-muted-foreground/40 leading-relaxed",
              "focus:outline-none focus:border-foreground/20 transition-colors"
            )}
            disabled={mutation.isPending}
          />
          <button
            onClick={send}
            disabled={!input.trim() || mutation.isPending}
            className="shrink-0 p-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-3 w-3" />
          </button>
        </div>
        <p className="text-[8px] text-muted-foreground/25 mt-1.5">Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}
