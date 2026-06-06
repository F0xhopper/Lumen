"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useFontPrefs,
  DEFAULT_FONT_PREFS,
  FONT_FAMILY_CSS,
  FONT_SIZE_CSS,
  LINE_HEIGHT_CSS,
  LETTER_SPACING_CSS,
  FONT_WEIGHT_CSS,
  type FontPrefs,
  type FontFamily,
  type FontSize,
  type LineHeight,
  type LetterSpacing,
  type FontWeight,
  type TextLanguage,
} from "@/components/FontPrefsProvider";

const PREVIEW_TEXT =
  "I answer that, the existence of God can be proved in five ways. The first and more manifest way is the argument from motion. It is certain, and evident to our senses, that in the world some things are in motion. Now whatever is in motion is put in motion by another.";

const FONT_FAMILIES: { value: FontFamily; label: string }[] = [
  { value: "cardo",       label: "Cardo"       },
  { value: "lora",        label: "Lora"        },
  { value: "garamond",    label: "Garamond"    },
  { value: "baskerville", label: "Baskerville" },
  { value: "georgia",     label: "Georgia"     },
  { value: "inter",       label: "Inter"       },
];

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "sm", label: "S"  },
  { value: "md", label: "M"  },
  { value: "lg", label: "L"  },
  { value: "xl", label: "XL" },
];

const LINE_HEIGHTS: { value: LineHeight; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "normal",  label: "Normal"  },
  { value: "relaxed", label: "Relaxed" },
];

const LETTER_SPACINGS: { value: LetterSpacing; label: string }[] = [
  { value: "tight",  label: "Tight"  },
  { value: "normal", label: "Normal" },
  { value: "loose",  label: "Loose"  },
];

const FONT_WEIGHTS: { value: FontWeight; label: string }[] = [
  { value: "regular", label: "Regular" },
  { value: "medium",  label: "Medium"  },
];

const TEXT_LANGUAGES: { value: TextLanguage; label: string; desc: string }[] = [
  { value: "both", label: "Both",    desc: "English · Latin" },
  { value: "en",   label: "English", desc: "English only"    },
  { value: "la",   label: "Latin",   desc: "Latin only"      },
];

function prefsEqual(a: FontPrefs, b: FontPrefs) {
  return (
    a.fontFamily    === b.fontFamily    &&
    a.fontSize      === b.fontSize      &&
    a.lineHeight    === b.lineHeight    &&
    a.letterSpacing === b.letterSpacing &&
    a.fontWeight    === b.fontWeight    &&
    a.textLanguage  === b.textLanguage
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PreferencesModal({ open, onClose }: Props) {
  const { prefs, setPrefs } = useFontPrefs();
  const [draft, setDraft] = useState<FontPrefs>(prefs);
  const panelRef = useRef<HTMLDivElement>(null);

  // Reset draft to committed prefs each time the modal opens
  useEffect(() => {
    if (open) setDraft(prefs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function set<K extends keyof FontPrefs>(key: K, value: FontPrefs[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function handleSave() {
    setPrefs(draft);
    onClose();
  }

  const isDirty    = !prefsEqual(draft, prefs);
  const isDefault  = prefsEqual(draft, DEFAULT_FONT_PREFS);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/65 backdrop-blur-sm"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        className="relative w-full max-w-[400px] mx-4 max-h-[90vh] flex flex-col bg-background border border-border rounded-xl shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border shrink-0">
          <div>
            <h2 className="font-inter text-[13px] font-medium text-foreground/85">Reading preferences</h2>
            <p className="font-inter text-[10px] text-muted-foreground/40 mt-0.5">Customize how text is displayed</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preferences"
            className="p-1.5 text-muted-foreground/35 hover:text-foreground/65 transition-colors rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          {/* Live preview — reflects draft, not committed prefs */}
          <div className="px-5 py-4 border-b border-border/60">
            <p className="font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35 mb-3">Preview</p>
            <div
              className="bg-foreground/[0.025] rounded-lg px-4 py-3 text-foreground/80"
              style={{
                fontFamily:    FONT_FAMILY_CSS[draft.fontFamily],
                fontSize:      FONT_SIZE_CSS[draft.fontSize],
                lineHeight:    LINE_HEIGHT_CSS[draft.lineHeight],
                letterSpacing: LETTER_SPACING_CSS[draft.letterSpacing],
                fontWeight:    FONT_WEIGHT_CSS[draft.fontWeight],
              }}
            >
              {PREVIEW_TEXT}
            </div>
          </div>

          {/* Controls */}
          <div className="px-5 py-5 space-y-5">

            {/* Font family */}
            <div>
              <p className="font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35 mb-2.5">Font</p>
              <div className="grid grid-cols-6 gap-1">
                {FONT_FAMILIES.map(({ value, label }) => {
                  const active = draft.fontFamily === value;
                  return (
                    <button
                      key={value}
                      title={label}
                      aria-label={`Font: ${label}`}
                      aria-pressed={active}
                      onClick={() => set("fontFamily", value)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 rounded-md transition-colors",
                        "hover:bg-foreground/[0.05]",
                        active ? "bg-foreground/[0.08] ring-1 ring-foreground/15" : "",
                      )}
                    >
                      <span
                        className="text-[15px] text-foreground/75 leading-none"
                        style={{ fontFamily: FONT_FAMILY_CSS[value] }}
                      >
                        Aa
                      </span>
                      <span className={cn(
                        "font-inter text-[8px] leading-none truncate w-full text-center",
                        active ? "text-foreground/70" : "text-muted-foreground/40",
                      )}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Size + Weight */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35 mb-2.5">Size</p>
                <div className="grid grid-cols-4 gap-0.5">
                  {FONT_SIZES.map(({ value, label }) => {
                    const active = draft.fontSize === value;
                    return (
                      <button
                        key={value}
                        aria-pressed={active}
                        onClick={() => set("fontSize", value)}
                        className={cn(
                          "py-1.5 rounded-md font-inter text-[10px] transition-colors text-center",
                          "hover:bg-foreground/[0.05]",
                          active
                            ? "bg-foreground/[0.08] text-foreground/90 ring-1 ring-foreground/15"
                            : "text-foreground/50",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35 mb-2.5">Weight</p>
                <div className="grid grid-cols-2 gap-0.5">
                  {FONT_WEIGHTS.map(({ value, label }) => {
                    const active = draft.fontWeight === value;
                    return (
                      <button
                        key={value}
                        aria-pressed={active}
                        onClick={() => set("fontWeight", value)}
                        className={cn(
                          "py-1.5 rounded-md font-inter text-[10px] transition-colors text-center",
                          "hover:bg-foreground/[0.05]",
                          active
                            ? "bg-foreground/[0.08] text-foreground/90 ring-1 ring-foreground/15"
                            : "text-foreground/50",
                          value === "medium" ? "font-medium" : "",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Line height + Letter spacing */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35 mb-2.5">Line height</p>
                <div className="grid grid-cols-3 gap-0.5">
                  {LINE_HEIGHTS.map(({ value, label }) => {
                    const active = draft.lineHeight === value;
                    return (
                      <button
                        key={value}
                        aria-pressed={active}
                        onClick={() => set("lineHeight", value)}
                        className={cn(
                          "py-1.5 rounded-md font-inter text-[10px] transition-colors text-center",
                          "hover:bg-foreground/[0.05]",
                          active
                            ? "bg-foreground/[0.08] text-foreground/90 ring-1 ring-foreground/15"
                            : "text-foreground/50",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35 mb-2.5">Tracking</p>
                <div className="grid grid-cols-3 gap-0.5">
                  {LETTER_SPACINGS.map(({ value, label }) => {
                    const active = draft.letterSpacing === value;
                    return (
                      <button
                        key={value}
                        aria-pressed={active}
                        onClick={() => set("letterSpacing", value)}
                        className={cn(
                          "py-1.5 rounded-md font-inter text-[10px] transition-colors text-center",
                          "hover:bg-foreground/[0.05]",
                          active
                            ? "bg-foreground/[0.08] text-foreground/90 ring-1 ring-foreground/15"
                            : "text-foreground/50",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Language */}
            <div>
              <p className="font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35 mb-2.5">Language</p>
              <div className="grid grid-cols-3 gap-1">
                {TEXT_LANGUAGES.map(({ value, label, desc }) => {
                  const active = draft.textLanguage === value;
                  return (
                    <button
                      key={value}
                      aria-pressed={active}
                      onClick={() => set("textLanguage", value)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-2.5 rounded-md transition-colors",
                        "hover:bg-foreground/[0.05]",
                        active ? "bg-foreground/[0.08] ring-1 ring-foreground/15" : "",
                      )}
                    >
                      <span className={cn(
                        "font-inter text-[11px] leading-none",
                        active ? "text-foreground/85" : "text-foreground/50",
                      )}>
                        {label}
                      </span>
                      <span className="font-inter text-[8px] leading-none text-muted-foreground/35">
                        {desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={() => setDraft(DEFAULT_FONT_PREFS)}
            disabled={isDefault}
            className={cn(
              "font-inter text-[10px] transition-colors",
              isDefault
                ? "text-foreground/20 cursor-not-allowed"
                : "text-muted-foreground/40 hover:text-foreground/60",
            )}
          >
            Reset to defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 font-inter text-[11px] text-foreground/50 hover:text-foreground/75 transition-colors rounded"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty}
              className={cn(
                "px-4 py-1.5 rounded font-inter text-[11px] transition-colors",
                isDirty
                  ? "bg-foreground/[0.09] hover:bg-foreground/[0.14] text-foreground/85 border border-border"
                  : "bg-foreground/[0.04] text-foreground/25 border border-border/50 cursor-not-allowed",
              )}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
