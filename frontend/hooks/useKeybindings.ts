import { useEffect, useRef } from "react";

type KeyMap = Record<string, () => void>;

function isInputActive(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === "input" ||
    tag === "textarea" ||
    tag === "select" ||
    (el as HTMLElement).isContentEditable
  );
}

export function useKeybindings(
  bindings: KeyMap,
  options: { alwaysActive?: string[] } = {}
) {
  const bindingsRef = useRef<KeyMap>(bindings);
  bindingsRef.current = bindings;

  const alwaysActiveRef = useRef<string[]>(options.alwaysActive ?? []);
  alwaysActiveRef.current = options.alwaysActive ?? [];

  const lastKeyRef = useRef<{ key: string; time: number } | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;
      const inputActive = isInputActive();

      if (inputActive && !alwaysActiveRef.current.includes(key)) return;

      const now = Date.now();
      const last = lastKeyRef.current;

      // Double-key sequences (e.g. "gg") — only in normal mode
      if (!inputActive && last && now - last.time < 400 && last.key === key) {
        const seqKey = `${key}${key}`;
        if (bindingsRef.current[seqKey]) {
          e.preventDefault();
          bindingsRef.current[seqKey]();
          lastKeyRef.current = null;
          return;
        }
      }

      lastKeyRef.current = { key, time: now };

      if (bindingsRef.current[key]) {
        e.preventDefault();
        bindingsRef.current[key]();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
