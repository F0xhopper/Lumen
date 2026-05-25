"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";
import { fetchPassages } from "@/lib/api";
import type { PinnedSection } from "@/lib/api";
import { cn } from "@/lib/utils";

const PART_SLUG: Record<string, string> = {
  I: "1",
  "I-II": "1-2",
  "II-II": "2-2",
  III: "3",
};

function passageToPin(p: Awaited<ReturnType<typeof fetchPassages>>[number]): PinnedSection {
  const slug = PART_SLUG[p.part_abbr] ?? p.part_abbr.toLowerCase();
  return {
    part_abbr: p.part_abbr,
    question_n: p.question_n,
    article_n: p.article_n,
    section: p.section,
    section_label: p.section_label,
    article_title: p.article_title,
    question_title: p.question_title,
    url_path: `/${slug}/${p.question_n}/${p.article_n}#${p.url_fragment}`,
    text: p.text,
  };
}

interface Props {
  onSelect: (section: PinnedSection) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export default function SectionPicker({ onSelect, onClose, anchorRef }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof fetchPassages>>>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose, anchorRef]);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const passages = await fetchPassages(q, 8);
      setResults(passages);
      setActiveIndex(0);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => search(query), 280);
    return () => clearTimeout(id);
  }, [query, search]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      onSelect(passageToPin(results[activeIndex]));
      onClose();
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-1 w-full z-50 bg-background border border-border rounded shadow-lg overflow-hidden"
      style={{ maxHeight: 320 }}
    >
      {/* Search input */}
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-border">
        <Search className="h-3 w-3 text-muted-foreground/40 shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search sections to pin…"
          className="flex-1 bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/40 outline-none"
        />
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40 shrink-0" />}
      </div>

      {/* Results */}
      <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
        {results.length === 0 && query.trim() && !loading && (
          <p className="px-3 py-4 text-[10px] text-muted-foreground/40 text-center">No sections found</p>
        )}
        {results.length === 0 && !query.trim() && (
          <p className="px-3 py-4 text-[10px] text-muted-foreground/30 text-center">
            Type to search the Summa
          </p>
        )}
        {results.map((p, i) => {
          const loc = `ST ${p.part_abbr} Q.${p.question_n} A.${p.article_n}`;
          return (
            <button
              key={`${p.part_abbr}-${p.question_n}-${p.article_n}-${p.section}`}
              onClick={() => { onSelect(passageToPin(p)); onClose(); }}
              className={cn(
                "w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors",
                i === activeIndex ? "bg-secondary" : "hover:bg-secondary/60",
              )}
            >
              <span className="text-[9px] font-mono text-muted-foreground/60">{loc} — {p.section_label}</span>
              <span className="text-[10px] text-foreground/80 leading-snug truncate">{p.article_title}</span>
              <span className="text-[9px] text-muted-foreground/40 line-clamp-2 leading-relaxed">{p.text.slice(0, 120)}…</span>
            </button>
          );
        })}
      </div>

      <div className="px-2.5 py-1.5 border-t border-border/50 text-[8px] text-muted-foreground/25">
        ↑↓ navigate · Enter to pin · Esc to close
      </div>
    </div>
  );
}
