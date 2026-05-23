// Typed API client — all server fetches go through here

export interface SectionItem {
  n: number;
  text: string;
}

export interface Article {
  part_abbr: string;
  question_n: number;
  question_title: string;
  article_n: number;
  article_title: string;
  body: string;
  sed_contra: string | null;
  respondeo: string | null;
  objections: SectionItem[];
  replies: SectionItem[];
  source_url: string | null;
  body_la: string | null;
  sed_contra_la: string | null;
  respondeo_la: string | null;
  objections_la: SectionItem[];
  replies_la: SectionItem[];
  source_url_la: string | null;
}

export interface Passage {
  rank: number;
  text: string;
  score: number;
  part_abbr: string;
  question_n: number;
  article_n: number;
  question_title: string;
  article_title: string;
  section: string;
  section_label: string;
  url_fragment: string;
  article_url: string;
}

export interface QueryResponse {
  answer: string;
}

export async function fetchArticle(
  partId: string,
  questionN: number,
  articleN: number,
): Promise<Article> {
  const res = await fetch(
    `/api/article?part_id=${encodeURIComponent(partId)}&question_n=${questionN}&article_n=${articleN}`,
  );
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

export async function fetchPassages(query: string, topK = 8): Promise<Passage[]> {
  const res = await fetch(
    `/api/passages?query=${encodeURIComponent(query.trim())}&top_k=${topK}`,
  );
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function postQuery(query: string): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}
