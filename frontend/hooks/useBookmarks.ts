"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  addBookmark,
  deleteBookmark,
  fetchBookmarks,
  updateBookmark,
  type Bookmark,
} from "@/lib/api/user-data";
import type { SelectedNode } from "@/lib/summa-full";

export function useBookmarks(user: User | null) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  useEffect(() => {
    if (!user) { setBookmarks([]); return; }
    fetchBookmarks().then(setBookmarks);
  }, [user?.id]);

  const add = useCallback(async (node: SelectedNode, folder?: string | null) => {
    if (!user) return;
    const optimistic: Bookmark = {
      id: `temp-${Date.now()}`,
      part_id: node.partId,
      question_n: node.questionN,
      article_n: node.articleN ?? null,
      label: null,
      folder: folder ?? null,
      created_at: new Date().toISOString(),
    };
    setBookmarks((prev) => [optimistic, ...prev]);

    const saved = await addBookmark({
      part_id: node.partId,
      question_n: node.questionN,
      article_n: node.articleN ?? null,
      folder: folder ?? null,
    });
    if (saved) {
      setBookmarks((prev) => prev.map((b) => (b.id === optimistic.id ? saved : b)));
    } else {
      setBookmarks((prev) => prev.filter((b) => b.id !== optimistic.id));
    }
  }, [user]);

  const remove = useCallback(async (id: string) => {
    if (!user) return;
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
    await deleteBookmark(id);
  }, [user]);

  const moveToFolder = useCallback(async (id: string, folder: string | null) => {
    if (!user) return;
    setBookmarks((prev) => prev.map((b) => b.id === id ? { ...b, folder } : b));
    await updateBookmark(id, { folder });
  }, [user]);

  const isBookmarked = useCallback(
    (node: SelectedNode) =>
      bookmarks.some(
        (b) =>
          b.part_id === node.partId &&
          b.question_n === node.questionN &&
          (b.article_n ?? null) === (node.articleN ?? null),
      ),
    [bookmarks],
  );

  const bookmarkId = useCallback(
    (node: SelectedNode) =>
      bookmarks.find(
        (b) =>
          b.part_id === node.partId &&
          b.question_n === node.questionN &&
          (b.article_n ?? null) === (node.articleN ?? null),
      )?.id ?? null,
    [bookmarks],
  );

  const bookmarkFolder = useCallback(
    (node: SelectedNode) =>
      bookmarks.find(
        (b) =>
          b.part_id === node.partId &&
          b.question_n === node.questionN &&
          (b.article_n ?? null) === (node.articleN ?? null),
      )?.folder ?? null,
    [bookmarks],
  );

  const folders = useMemo(
    () =>
      Array.from(
        new Set(bookmarks.map((b) => b.folder).filter((f): f is string => f !== null)),
      ).sort(),
    [bookmarks],
  );

  return { bookmarks, add, remove, moveToFolder, isBookmarked, bookmarkId, bookmarkFolder, folders };
}
