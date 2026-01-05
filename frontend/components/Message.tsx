"use client";

import { Bot, User } from "lucide-react";
import MarkdownRenderer from "./MarkdownRenderer";

interface MessageProps {
  message: {
    id: string;
    content: string;
    role: "user" | "assistant";
    timestamp: Date;
    metadata?: {
      source?: string;
      chunkIndex?: number;
    };
  };
}

export default function Message({ message }: MessageProps) {
  const isUser = message.role === "user";

  // Format time consistently to avoid hydration issues
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div
      className={`flex items-start space-x-3 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser && (
        <div className="p-2 bg-primary rounded-lg">
          <Bot className="h-5 w-5 text-primary-foreground" />
        </div>
      )}

      <div className={`flex-1 max-w-[80%] ${isUser ? "order-first" : ""}`}>
        <div
          className={`p-3 rounded-lg ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          }`}
        >
          <MarkdownRenderer content={message.content} />
        </div>

        {/* Metadata for assistant messages */}
        {!isUser && message.metadata?.source && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span>Source: {message.metadata.source}</span>
            {message.metadata.chunkIndex !== undefined && (
              <span className="ml-2">Chunk: {message.metadata.chunkIndex}</span>
            )}
          </div>
        )}

        <div
          className={`mt-1 text-xs text-muted-foreground ${
            isUser ? "text-right" : "text-left"
          }`}
          suppressHydrationWarning
        >
          {formatTime(message.timestamp)}
        </div>
      </div>

      {isUser && (
        <div className="p-2 bg-secondary rounded-lg">
          <User className="h-5 w-5 text-secondary-foreground" />
        </div>
      )}
    </div>
  );
}
