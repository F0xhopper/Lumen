"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { fetchHistory, recordVisit, type HistoryEntry } from "@/lib/api/user-data";
import type { SelectedNode } from "@/lib/summa-full";

export function useHistory(user: User | null) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (!user) { setHistory([]); return; }
    fetchHistory().then(setHistory);
  }, [user?.id]);

  const record = useCallback(async (node: SelectedNode) => {
    if (!user) return;

    // Optimistically dedup + prepend
    const entry: HistoryEntry = {
      id: `temp-${Date.now()}`,
      part_id: node.partId,
      question_n: node.questionN,
      article_n: node.articleN ?? null,
      visited_at: new Date().toISOString(),
    };
    setHistory((prev) => [
      entry,
      ...prev.filter(
        (h) =>
          !(h.part_id === node.partId &&
            h.question_n === node.questionN &&
            (h.article_n ?? null) === (node.articleN ?? null)),
      ),
    ].slice(0, 50));

    await recordVisit({
      part_id: node.partId,
      question_n: node.questionN,
      article_n: node.articleN ?? null,
    });
  }, [user]);

  return { history, record };
}
