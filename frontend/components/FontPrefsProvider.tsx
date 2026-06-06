"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/components/AuthProvider";

// ── Types ──────────────────────────────────────────────────────────────────────

export type FontFamily = "cardo" | "lora" | "garamond" | "baskerville" | "georgia" | "inter";
export type FontSize = "sm" | "md" | "lg" | "xl";
export type LineHeight = "compact" | "normal" | "relaxed";
export type LetterSpacing = "tight" | "normal" | "loose";
export type FontWeight = "regular" | "medium";

export interface FontPrefs {
  fontFamily: FontFamily;
  fontSize: FontSize;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  fontWeight: FontWeight;
}

export const DEFAULT_FONT_PREFS: FontPrefs = {
  fontFamily: "cardo",
  fontSize: "md",
  lineHeight: "normal",
  letterSpacing: "normal",
  fontWeight: "regular",
};

// ── CSS value maps (keep in sync with globals.css :root defaults) ──────────────

export const FONT_FAMILY_CSS: Record<FontFamily, string> = {
  cardo:       "var(--font-cardo), Georgia, serif",
  lora:        "var(--font-lora), Georgia, serif",
  garamond:    "var(--font-garamond), 'EB Garamond', Garamond, serif",
  baskerville: "var(--font-baskerville), 'Libre Baskerville', Georgia, serif",
  georgia:     "Georgia, 'Times New Roman', serif",
  inter:       "var(--font-inter), system-ui, sans-serif",
};

export const FONT_SIZE_CSS: Record<FontSize, string> = {
  sm: "13.5px",
  md: "14.5px",
  lg: "16.5px",
  xl: "19px",
};

export const LINE_HEIGHT_CSS: Record<LineHeight, string> = {
  compact: "1.70",
  normal:  "1.95",
  relaxed: "2.25",
};

export const LETTER_SPACING_CSS: Record<LetterSpacing, string> = {
  tight:  "-0.01em",
  normal: "0em",
  loose:  "0.025em",
};

export const FONT_WEIGHT_CSS: Record<FontWeight, string> = {
  regular: "400",
  medium:  "500",
};

// ── Persistence helpers ────────────────────────────────────────────────────────

const STORAGE_KEY = "lumen-font-prefs";

function loadFromStorage(): FontPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FONT_PREFS;
    return { ...DEFAULT_FONT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FONT_PREFS;
  }
}

function saveToStorage(prefs: FontPrefs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore quota / private-mode errors */ }
}

function applyCSS(prefs: FontPrefs): void {
  const root = document.documentElement;
  root.style.setProperty("--reading-font", FONT_FAMILY_CSS[prefs.fontFamily]);
  root.style.setProperty("--reading-size", FONT_SIZE_CSS[prefs.fontSize]);
  root.style.setProperty("--reading-leading", LINE_HEIGHT_CSS[prefs.lineHeight]);
  root.style.setProperty("--reading-tracking", LETTER_SPACING_CSS[prefs.letterSpacing]);
  root.style.setProperty("--reading-weight", FONT_WEIGHT_CSS[prefs.fontWeight]);
}

// ── Backend API ────────────────────────────────────────────────────────────────

async function fetchPrefsFromBackend(): Promise<FontPrefs | null> {
  try {
    const res = await fetch("/api/preferences");
    if (!res.ok) return null;
    const d = await res.json();
    return {
      fontFamily:    (d.font_family    as FontFamily)    ?? DEFAULT_FONT_PREFS.fontFamily,
      fontSize:      (d.font_size      as FontSize)      ?? DEFAULT_FONT_PREFS.fontSize,
      lineHeight:    (d.line_height    as LineHeight)    ?? DEFAULT_FONT_PREFS.lineHeight,
      letterSpacing: (d.letter_spacing as LetterSpacing) ?? DEFAULT_FONT_PREFS.letterSpacing,
      fontWeight:    (d.font_weight    as FontWeight)    ?? DEFAULT_FONT_PREFS.fontWeight,
    };
  } catch {
    return null;
  }
}

async function savePrefsToBackend(prefs: FontPrefs): Promise<void> {
  try {
    await fetch("/api/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        font_family:    prefs.fontFamily,
        font_size:      prefs.fontSize,
        line_height:    prefs.lineHeight,
        letter_spacing: prefs.letterSpacing,
        font_weight:    prefs.fontWeight,
      }),
    });
  } catch { /* network errors are non-fatal */ }
}

// ── Context ────────────────────────────────────────────────────────────────────

interface FontPrefsContextValue {
  prefs: FontPrefs;
  setPrefs: (prefs: FontPrefs) => void;
}

const FontPrefsContext = createContext<FontPrefsContextValue>({
  prefs: DEFAULT_FONT_PREFS,
  setPrefs: () => {},
});

const SAVE_DEBOUNCE_MS = 600;

export function FontPrefsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [prefs, setPrefsState] = useState<FontPrefs>(DEFAULT_FONT_PREFS);
  const loadedForUserRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: read localStorage and set state. The blocking inline script in
  // layout.tsx already applied the CSS variables, so no flash occurs.
  useEffect(() => {
    setPrefsState(loadFromStorage());
  }, []);

  // Keep CSS variables in sync whenever state changes (covers both localStorage
  // load and server-fetched updates).
  useEffect(() => {
    applyCSS(prefs);
  }, [prefs]);

  // When a user signs in fetch server prefs (server wins for cross-device sync).
  // When user signs out reset the guard so the next sign-in always re-fetches.
  useEffect(() => {
    if (!user) {
      loadedForUserRef.current = null;
      return;
    }
    if (loadedForUserRef.current === user.id) return;
    loadedForUserRef.current = user.id;

    fetchPrefsFromBackend().then((serverPrefs) => {
      if (serverPrefs) {
        setPrefsState(serverPrefs);
        saveToStorage(serverPrefs);
      }
    });
  }, [user?.id]);

  const setPrefs = useCallback(
    (newPrefs: FontPrefs) => {
      setPrefsState(newPrefs);
      saveToStorage(newPrefs);
      if (user) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => savePrefsToBackend(newPrefs), SAVE_DEBOUNCE_MS);
      }
    },
    [user],
  );

  return (
    <FontPrefsContext.Provider value={{ prefs, setPrefs }}>
      {children}
    </FontPrefsContext.Provider>
  );
}

export function useFontPrefs() {
  return useContext(FontPrefsContext);
}
