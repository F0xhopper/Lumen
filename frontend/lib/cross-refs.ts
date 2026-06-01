import { API_ABBR_TO_SLUG } from "./navigation";

// Order matters: longer alternatives must come first to prevent partial matches
const COLON_REF_RE = /\b(II-II|I-II|III|I):(\d+)(?::(\d+))?/g;

// Bare "(Article N...)" refs within same question — stops at ; to avoid swallowing
// mixed citations like "(Article 1; I-II:11:2)"
const BARE_ARTICLE_RE = /\(Article\s+(\d+)[^;)]*\)/g;

const PART_ABBR_TO_SLUG: Record<string, string> = {
  "ST I":    "1",
  "ST I-II": "1-2",
  "ST II-II": "2-2",
  "ST III":  "3",
};

export interface CrossRef {
  start: number;
  end: number;
  url: string;
  text: string;
}

export function parseCrossRefs(
  text: string,
  partAbbr: string,
  questionN: number,
): CrossRef[] {
  const currentSlug = PART_ABBR_TO_SLUG[partAbbr] ?? "1";
  const refs: CrossRef[] = [];

  COLON_REF_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = COLON_REF_RE.exec(text)) !== null) {
    const slug = API_ABBR_TO_SLUG[m[1]];
    if (!slug) continue;
    const qN = parseInt(m[2], 10);
    const aN = m[3] !== undefined ? parseInt(m[3], 10) : undefined;
    const url = aN !== undefined ? `/${slug}/${qN}/${aN}` : `/${slug}/${qN}`;
    refs.push({ start: m.index, end: m.index + m[0].length, url, text: m[0] });
  }

  BARE_ARTICLE_RE.lastIndex = 0;
  while ((m = BARE_ARTICLE_RE.exec(text)) !== null) {
    const aN = parseInt(m[1], 10);
    refs.push({
      start: m.index,
      end: m.index + m[0].length,
      url: `/${currentSlug}/${questionN}/${aN}`,
      text: m[0],
    });
  }

  refs.sort((a, b) => a.start - b.start);

  // Remove overlaps (keep first)
  const result: CrossRef[] = [];
  let lastEnd = 0;
  for (const ref of refs) {
    if (ref.start >= lastEnd) {
      result.push(ref);
      lastEnd = ref.end;
    }
  }
  return result;
}
