"use client";

import Link from "next/link";
import type { Passage, QuestionMatch } from "@/lib/api";
import { PART_ID_TO_SLUG } from "@/lib/navigation";

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
];

export function SearchLoadingSkeleton() {
  return (
    <div className="space-y-9">
      {SKELETON_WIDTHS.map((lines, cardIndex) => (
        <div
          key={cardIndex}
          className="space-y-3"
          style={{ opacity: 1 - cardIndex * 0.2 }}
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
                  animationDelay: `${(cardIndex * lines.length + lineIndex) * 60}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
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
