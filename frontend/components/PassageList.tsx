import Link from "next/link";
import type { Passage } from "@/lib/api";

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
