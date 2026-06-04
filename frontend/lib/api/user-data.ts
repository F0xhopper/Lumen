export interface Bookmark {
  id: string;
  part_id: string;
  question_n: number;
  article_n: number | null;
  label: string | null;
  folder: string | null;
  created_at: string;
}

export interface HistoryEntry {
  id: string;
  part_id: string;
  question_n: number;
  article_n: number | null;
  visited_at: string;
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export async function fetchBookmarks(): Promise<Bookmark[]> {
  const res = await fetch("/api/bookmarks");
  if (!res.ok) return [];
  return res.json();
}

export async function addBookmark(data: {
  part_id: string;
  question_n: number;
  article_n?: number | null;
  folder?: string | null;
}): Promise<Bookmark | null> {
  const res = await fetch("/api/bookmarks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateBookmark(id: string, data: { folder?: string | null; label?: string | null }): Promise<Bookmark | null> {
  const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteBookmark(id: string): Promise<boolean> {
  const res = await fetch(`/api/bookmarks?id=${encodeURIComponent(id)}`, { method: "DELETE" });
  return res.ok;
}

// ── History ───────────────────────────────────────────────────────────────────

export async function fetchHistory(): Promise<HistoryEntry[]> {
  const res = await fetch("/api/history");
  if (!res.ok) return [];
  return res.json();
}

export async function recordVisit(data: {
  part_id: string;
  question_n: number;
  article_n?: number | null;
}): Promise<void> {
  await fetch("/api/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function clearHistory(): Promise<void> {
  await fetch("/api/history", { method: "DELETE" });
}
