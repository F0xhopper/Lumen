"use client";

import Link from "next/link";
import type { Passage, QuestionMatch } from "@/lib/api";
import { PART_ID_TO_SLUG } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { TextLanguage } from "@/components/FontPrefsProvider";

function highlightTerms(text: string, query: string): React.ReactNode {
  const tokens = query
    .split(/\W+/)
    .map((t) => t.replace(/[^a-z0-9']/gi, ""))
    .filter((t) => t.length >= 3);
  if (tokens.length === 0) return text;

  const pattern = new RegExp(
    `(${tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi"
  );
  const parts = text.split(pattern);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-foreground/[0.09] text-foreground/95 rounded-[2px] px-px">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

const SKELETON_WIDTHS: string[][] = [
  ["100%", "92%", "97%", "85%", "78%"],
  ["100%", "88%", "94%", "91%", "68%"],
  ["100%", "95%", "82%", "89%", "74%"],
  ["100%", "90%", "96%", "83%", "71%"],
  ["100%", "87%", "93%", "88%", "66%"],
];

export function SearchLoadingSkeleton() {
  return (
    <div className="space-y-9">
      {SKELETON_WIDTHS.map((lines, cardIndex) => (
        <div
          key={cardIndex}
          className="space-y-3"
          style={{ opacity: Math.max(0.15, 1 - cardIndex * 0.18) }}
        >
          <div className="flex items-center gap-2">
            <div className="h-[7px] w-14 rounded-sm bg-foreground/[0.06] animate-pulse" />
            <div className="h-[7px] w-0.5 rounded-sm bg-foreground/[0.04]" />
            <div className="h-[7px] w-28 rounded-sm bg-foreground/[0.05] animate-pulse" />
          </div>
          <div className="space-y-[9px]">
            {lines.map((w, lineIndex) => (
              <div
                key={lineIndex}
                className="h-[11px] rounded-sm bg-foreground/[0.045] animate-pulse"
                style={{
                  width: w,
                  animationDelay: `${(cardIndex * lines.length + lineIndex) * 55}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const OBJ_LINES = [
  ["100%", "92%", "97%", "85%", "78%"],
  ["100%", "88%", "94%", "91%", "68%"],
  ["100%", "95%", "82%", "89%", "74%"],
];
const RESPONDEO_LINES = ["100%", "97%", "93%", "100%", "89%", "95%", "82%", "76%"];
const REPLY_LINES = [
  ["100%", "91%", "88%", "79%"],
  ["100%", "94%", "86%", "83%"],
  ["100%", "89%", "92%", "68%"],
];

function SkeletonCol({ lines, labelWidth, respondeo, delay }: { lines: string[]; labelWidth: string; respondeo?: boolean; delay: () => string }) {
  const wrapper = respondeo ? "bg-foreground/[0.02] -mx-4 px-4 py-4 rounded space-y-[10px]" : "space-y-[10px]";
  return (
    <div className={wrapper}>
      <div className="h-[9px] rounded-sm bg-foreground/[0.07] animate-pulse" style={{ width: labelWidth, animationDelay: delay() }} />
      {lines.map((w, j) => (
        <div key={j} className="h-[11px] rounded-sm bg-foreground/[0.045] animate-pulse" style={{ width: w, animationDelay: delay() }} />
      ))}
    </div>
  );
}

export function ArticleLoadingSkeleton({ textLanguage = "en" }: { textLanguage?: TextLanguage }) {
  let tick = 0;
  const delay = () => `${(tick++) * 45}ms`;
  const both = textLanguage === "both";

  return (
    <div>
      <div className="space-y-9">
        {OBJ_LINES.map((lines, i) => (
          <div key={i} className={cn("grid grid-cols-1", both && "md:grid-cols-2")}>
            <div className="md:pr-8">
              <SkeletonCol lines={lines} labelWidth="38%" delay={delay} />
            </div>
            {both && (
              <div className="md:border-l md:border-border/20 md:pl-8 mt-6 md:mt-0 border-t border-border/[0.12] pt-6 md:border-t-0 md:pt-0">
                <SkeletonCol lines={lines} labelWidth="38%" delay={delay} />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="h-px bg-foreground/[0.05] my-9" />

      <div className={cn("grid grid-cols-1", both && "md:grid-cols-2")}>
        <div className="md:pr-8">
          <SkeletonCol lines={RESPONDEO_LINES} labelWidth="44%" respondeo delay={delay} />
        </div>
        {both && (
          <div className="md:border-l md:border-border/20 md:pl-8 mt-6 md:mt-0 border-t border-border/[0.12] pt-6 md:border-t-0 md:pt-0">
            <SkeletonCol lines={RESPONDEO_LINES} labelWidth="44%" respondeo delay={delay} />
          </div>
        )}
      </div>

      <div className="h-px bg-foreground/[0.05] my-9" />

      <div className="space-y-9">
        {REPLY_LINES.map((lines, i) => (
          <div key={i} className={cn("grid grid-cols-1", both && "md:grid-cols-2")}>
            <div className="md:pr-8">
              <SkeletonCol lines={lines} labelWidth="42%" delay={delay} />
            </div>
            {both && (
              <div className="md:border-l md:border-border/20 md:pl-8 mt-6 md:mt-0 border-t border-border/[0.12] pt-6 md:border-t-0 md:pt-0">
                <SkeletonCol lines={lines} labelWidth="42%" delay={delay} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function EmptySearchState({ query }: { query: string }) {
  return (
    <div className="flex flex-col items-center py-16 gap-4 text-center">
      <span className="text-[28px] leading-none text-muted-foreground/[0.12] select-none">✦</span>
      <div className="space-y-1">
        <p className="font-cardo italic text-[15px] text-muted-foreground/35 leading-snug">
          No passages found
        </p>
        {query && (
          <p className="font-inter text-[10px] text-muted-foreground/25 tracking-wide">
            for &ldquo;{query}&rdquo;
          </p>
        )}
      </div>
      <p className={cn(
        "font-inter text-[10px] text-muted-foreground/20 tracking-wide",
        "leading-relaxed max-w-[200px]"
      )}>
        Try broader terms or phrases from the Summa text
      </p>
    </div>
  );
}

export function QuestionJumpList({ matches }: { matches: QuestionMatch[] }) {
  return (
    <div className="mb-8">
      <p className="font-inter text-[10px] tracking-widest uppercase text-muted-foreground/35 mb-2">
        Questions
      </p>
      <div className="flex flex-col">
        {matches.map((m) => {
          const slug = PART_ID_TO_SLUG[m.part_id];
          const href = slug ? `/${slug}/${m.question_n}` : null;
          const inner = (
            <span className="font-inter text-[11px] tracking-wide text-muted-foreground/55 hover:text-foreground/75 transition-colors">
              {m.part_abbr}&nbsp;&nbsp;Q.{m.question_n}
              <span className="mx-2 text-muted-foreground/25">·</span>
              <span className="font-cardo italic text-[13px]">{m.question_title}</span>
            </span>
          );
          return href ? (
            <Link key={m.rank} href={href} className="block -mx-3 px-3 py-1.5 rounded transition-colors hover:bg-foreground/[0.025]">
              {inner}
            </Link>
          ) : (
            <span key={m.rank} className="px-3 py-1.5">{inner}</span>
          );
        })}
      </div>
    </div>
  );
}

export function PassageList({ passages, searchQuery }: { passages: Passage[]; searchQuery: string }) {
  return (
    <div className="space-y-8">
      {passages.map((p) => {
        const href = p.article_url ? `${p.article_url}#${p.url_fragment}` : null;
        const loc = `${p.part_abbr}  Q.${p.question_n} A.${p.article_n}`;

        const card = (
          <>
            <p className="font-inter text-[11px] tracking-wide text-muted-foreground/45 mb-3">
              {loc}
              {p.article_title && (
                <>
                  <span className="mx-2 text-muted-foreground/25">·</span>
                  <span className="font-cardo italic text-[13px]">{p.article_title}</span>
                </>
              )}
            </p>
            <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/80 whitespace-pre-wrap">
              {highlightTerms(p.text, searchQuery)}
            </p>
          </>
        );

        return href ? (
          <Link
            key={p.rank}
            href={href}
            className="block -mx-3 px-3 py-3 rounded transition-colors hover:bg-foreground/[0.025]"
          >
            {card}
          </Link>
        ) : (
          <article key={p.rank}>{card}</article>
        );
      })}
    </div>
  );
}
