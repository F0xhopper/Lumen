import { cn } from "@/lib/utils";
import type { Article } from "@/lib/api";

const ORDINALS = "primum|secundum|tertium|quartum|quintum|sextum|septimum|octavum|nonum|decimum";

const LABEL_RE = new RegExp(
  "^(" +
    "Objection \\d+\\.|" +
    "Reply to Objection \\d+\\.|" +
    "On the contrary[,.]?|" +
    "I answer that[,.]?|" +
    `Ad (?:${ORDINALS}) sic proceditur[.]?|` +
    "Praeterea[.,]?|" +
    "Sed contra(?:\\s+est)?[.,]?|" +
    "Respondeo dicendum[,.]?|" +
    `Ad (?:${ORDINALS}) (?:ergo )?dicendum[,.]?` +
  ")\\s*",
  "i"
);

const QUOTE_RE = /("(?:[^"\\]|\\.)*")/;

function renderWithQuotes(text: string): React.ReactNode {
  const parts = text.split(QUOTE_RE);
  if (parts.length === 1) return text;
  return (
    <>
      {parts.map((part, i) =>
        QUOTE_RE.test(part) ? (
          <span key={i} className="italic text-foreground/55">{part}</span>
        ) : (
          part
        )
      )}
    </>
  );
}

function rubricClass(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith("i answer that"))                  return "font-semibold text-foreground";
  if (l.startsWith("respondeo"))                      return "font-semibold text-foreground";
  if (l.startsWith("on the contrary"))                return "font-semibold text-foreground/80";
  if (l.startsWith("sed contra"))                     return "font-semibold text-foreground/80";
  if (l.startsWith("objection"))                      return "font-semibold text-foreground/65";
  if (l.startsWith("ad ") && l.includes("sic"))      return "font-semibold text-foreground/65";
  if (l.startsWith("praeterea"))                      return "font-semibold text-foreground/65";
  if (l.startsWith("reply to"))                       return "font-semibold text-foreground/60";
  if (l.startsWith("ad ") && l.includes("dicendum")) return "font-semibold text-foreground/60";
  return "font-semibold text-foreground/90";
}

function renderWithBoldLabel(text: string): React.ReactNode {
  const m = LABEL_RE.exec(text);
  const body = m ? text.slice(m[0].length) : text;
  if (!m) return renderWithQuotes(body);
  const trailingPunct = m[1].match(/[,.]$/)?.[0] ?? "";
  const labelText = trailingPunct ? m[1].slice(0, -1) : m[1];
  return (
    <>
      <span className={cn(rubricClass(m[1]), "rubric-label")}>{labelText}</span>{trailingPunct}{" "}
      {renderWithQuotes(body)}
    </>
  );
}

function SectionBlock({ id, text, className, dropcap }: { id?: string; text: string; className?: string; dropcap?: boolean }) {
  return (
    <section id={id} className={cn("scroll-mt-6", dropcap && "article-dropcap", className)}>
      <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/82 whitespace-pre-wrap">
        {renderWithBoldLabel(text)}
      </p>
    </section>
  );
}

function SectionPairRow({
  en,
  la,
  enId,
  respondeoStyle,
  dropcap,
}: {
  en: string | null;
  la: string | null;
  enId?: string;
  respondeoStyle?: boolean;
  dropcap?: boolean;
}) {
  const extraClass = respondeoStyle ? "bg-foreground/[0.02] -mx-4 px-4 py-4 rounded" : undefined;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="md:pr-8">
        {en && <SectionBlock id={enId} text={en} className={extraClass} dropcap={dropcap} />}
      </div>
      {la && (
        <div className="md:border-l md:border-border/20 md:pl-8 mt-6 md:mt-0 border-t border-border/[0.12] pt-6 md:border-t-0 md:pt-0">
          <SectionBlock text={la} className={extraClass} />
        </div>
      )}
    </div>
  );
}

export function ArticleView({ article }: { article: Article }) {
  const maxObjs    = Math.max(article.objections.length,    article.objections_la.length);
  const maxReplies = Math.max(article.replies.length,       article.replies_la.length);
  const hasSC      = article.sed_contra    || article.sed_contra_la;
  const hasResp    = article.respondeo     || article.respondeo_la;

  return (
    <div>
      <div className="space-y-9">
        {Array.from({ length: maxObjs }, (_, i) => {
          const en = article.objections[i];
          const la = article.objections_la[i];
          return (
            <SectionPairRow
              key={`obj-${i}`}
              en={en?.text ?? null}
              la={la?.text ?? null}
              enId={en ? `objection-${en.n}` : undefined}
            />
          );
        })}
      </div>

      {hasSC && (
        <>
          <div className="divider-ornamental my-9" />
          <SectionPairRow
            en={article.sed_contra ?? null}
            la={article.sed_contra_la ?? null}
            enId="sed-contra"
          />
        </>
      )}

      {hasResp && (
        <>
          <div className="divider-ornamental my-9" />
          <SectionPairRow
            en={article.respondeo ?? null}
            la={article.respondeo_la ?? null}
            enId="respondeo"
            respondeoStyle
            dropcap
          />
        </>
      )}

      {maxReplies > 0 && (
        <>
          <div className="divider-ornamental my-9" />
          <div className="space-y-9">
            {Array.from({ length: maxReplies }, (_, i) => {
              const en = article.replies[i];
              const la = article.replies_la[i];
              return (
                <SectionPairRow
                  key={`rep-${i}`}
                  en={en?.text ?? null}
                  la={la?.text ?? null}
                  enId={en ? `reply-${en.n}` : undefined}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
