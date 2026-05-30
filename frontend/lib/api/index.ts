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

export interface CitationResult {
  ref: string;
  part_abbr: string;
  question_n: number;
  article_n: number;
  section: string;
  section_label: string;
  article_title: string;
  question_title: string;
  url_path: string;
}

export interface PinnedSection {
  part_abbr: string;
  question_n: number;
  article_n: number;
  section: string;
  section_label: string;
  article_title: string;
  question_title: string;
  url_path: string;
  text: string;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface QueryRequest {
  query: string;
  pinned_sections?: PinnedSection[];
  conversation_history?: ConversationTurn[];
}

export interface QueryResponse {
  answer: string;
  citations: CitationResult[];
  passages_used: number;
  agent_steps: number;
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

export async function postQuery(req: QueryRequest): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  const data = await res.json();
  return {
    answer: data.answer ?? "",
    citations: data.citations ?? [],
    passages_used: data.passages_used ?? 0,
    agent_steps: data.agent_steps ?? 1,
  };
}

export type StreamEvent =
  | { type: "status"; message: string }
  | { type: "token"; text: string }
  | { type: "done"; citations: CitationResult[]; passages_used: number; agent_steps: number }
  | { type: "error"; message: string };

export async function* streamQuery(req: QueryRequest): AsyncGenerator<StreamEvent> {
  const res = await fetch("/api/query/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok || !res.body) throw new Error(`${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          yield JSON.parse(line.slice(6)) as StreamEvent;
        } catch {
        }
      }
    }
  }
}
