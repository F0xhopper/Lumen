import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Article } from "@/lib/api";
import { parseCrossRefs, type CrossRef } from "@/lib/cross-refs";

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

type TextSpan =
  | { k: "text"; v: string }
  | { k: "quote"; v: string }
  | { k: "ref"; v: string; url: string };

function tokenizeQuotes(text: string): TextSpan[] {
  return text.split(QUOTE_RE).map(part =>
    QUOTE_RE.test(part)
      ? { k: "quote" as const, v: part }
      : { k: "text" as const, v: part },
  );
}

function tokenize(text: string, partAbbr: string, questionN: number): TextSpan[] {
  const refs: CrossRef[] = parseCrossRefs(text, partAbbr, questionN);
  if (refs.length === 0) return tokenizeQuotes(text);

  const spans: TextSpan[] = [];
  let pos = 0;
  for (const ref of refs) {
    if (ref.start > pos) spans.push(...tokenizeQuotes(text.slice(pos, ref.start)));
    spans.push({ k: "ref", v: ref.text, url: ref.url });
    pos = ref.end;
  }
  if (pos < text.length) spans.push(...tokenizeQuotes(text.slice(pos)));
  return spans;
}

function renderSpans(spans: TextSpan[]): React.ReactNode {
  if (spans.length === 1 && spans[0].k === "text") return spans[0].v;
  return (
    <>
      {spans.map((s, i) => {
        if (s.k === "quote") return <span key={i} className="italic text-foreground/55">{s.v}</span>;
        if (s.k === "ref")   return <Link key={i} href={s.url} className="border-b border-dotted border-foreground/30 hover:border-foreground/60 transition-colors">{s.v}</Link>;
        return s.v;
      })}
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

function renderSection(text: string, partAbbr: string, questionN: number): React.ReactNode {
  const m = LABEL_RE.exec(text);
  const body = m ? text.slice(m[0].length) : text;
  const bodyNode = renderSpans(tokenize(body, partAbbr, questionN));
  if (!m) return bodyNode;
  const trailingPunct = m[1].match(/[,.]$/)?.[0] ?? "";
  const labelText = trailingPunct ? m[1].slice(0, -1) : m[1];
  return (
    <>
      <span className={cn(rubricClass(m[1]), "rubric-label")}>{labelText}</span>{trailingPunct}{" "}
      {bodyNode}
    </>
  );
}

function SectionBlock({ id, text, className, dropcap, partAbbr, questionN }: {
  id?: string;
  text: string;
  className?: string;
  dropcap?: boolean;
  partAbbr: string;
  questionN: number;
}) {
  return (
    <section id={id} className={cn("scroll-mt-6", dropcap && "article-dropcap", className)}>
      <p className="font-cardo text-[14.5px] leading-[1.95] text-foreground/82 whitespace-pre-wrap">
        {renderSection(text, partAbbr, questionN)}
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
  partAbbr,
  questionN,
}: {
  en: string | null;
  la: string | null;
  enId?: string;
  respondeoStyle?: boolean;
  dropcap?: boolean;
  partAbbr: string;
  questionN: number;
}) {
  const extraClass = respondeoStyle ? "bg-foreground/[0.02] -mx-4 px-4 py-4 rounded" : undefined;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="md:pr-8">
        {en && <SectionBlock id={enId} text={en} className={extraClass} dropcap={dropcap} partAbbr={partAbbr} questionN={questionN} />}
      </div>
      {la && (
        <div className="md:border-l md:border-border/20 md:pl-8 mt-6 md:mt-0 border-t border-border/[0.12] pt-6 md:border-t-0 md:pt-0">
          <SectionBlock text={la} className={extraClass} partAbbr={partAbbr} questionN={questionN} />
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
  const { part_abbr, question_n } = article;

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
              partAbbr={part_abbr}
              questionN={question_n}
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
            partAbbr={part_abbr}
            questionN={question_n}
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
            partAbbr={part_abbr}
            questionN={question_n}
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
                  partAbbr={part_abbr}
                  questionN={question_n}
                />
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
