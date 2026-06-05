"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { Check, Keyboard, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  useFontPrefs,
  FONT_FAMILY_CSS,
  type FontFamily,
  type FontSize,
  type LineHeight,
  type LetterSpacing,
  type FontWeight,
} from "@/components/FontPrefsProvider";

interface Props {
  user: User;
  onSignOut: () => void;
  onShowKeybindings: () => void;
}

function avatarHue(email: string): number {
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffff;
  return h % 360;
}

const THEMES = [
  { value: "light",  label: "Light",  Icon: Sun     },
  { value: "dark",   label: "Dark",   Icon: Moon    },
  { value: "system", label: "System", Icon: Monitor },
] as const;

const FONT_FAMILIES: { value: FontFamily; label: string }[] = [
  { value: "cardo",       label: "Cardo"    },
  { value: "lora",        label: "Lora"     },
  { value: "garamond",    label: "Garamond" },
  { value: "baskerville", label: "Bskvl"    },
  { value: "georgia",     label: "Georgia"  },
  { value: "inter",       label: "Inter"    },
];

const FONT_SIZES: { value: FontSize; label: string }[] = [
  { value: "sm", label: "S"  },
  { value: "md", label: "M"  },
  { value: "lg", label: "L"  },
  { value: "xl", label: "XL" },
];

const LINE_HEIGHTS: { value: LineHeight; label: string; icon: string }[] = [
  { value: "compact", label: "Compact", icon: "≡" },
  { value: "normal",  label: "Normal",  icon: "☰" },
  { value: "relaxed", label: "Relaxed", icon: "⋮" },
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

export default function UserMenu({ user, onSignOut, onShowKeybindings }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const { prefs, setPrefs } = useFontPrefs();

  const email = user.email ?? "";
  const avatarUrl: string | undefined = user.user_metadata?.avatar_url;
  const displayName: string | undefined =
    user.user_metadata?.full_name ?? user.user_metadata?.name;
  const hue = avatarHue(email);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative flex items-center">

      {/* Avatar trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
        className={cn(
          "w-[26px] h-[26px] rounded-full overflow-hidden shrink-0",
          "ring-1 ring-border hover:ring-foreground/30 transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/40",
        )}
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt={displayName ?? email} width={26} height={26} className="w-full h-full object-cover" />
        ) : (
          <span
            className="w-full h-full flex items-center justify-center font-inter text-[10px] font-semibold text-white select-none"
            style={{ background: `hsl(${hue} 30% 36%)` }}
          >
            {email[0].toUpperCase()}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-[248px] z-50 rounded-lg border border-border bg-background shadow-xl"
        >
          {/* User */}
          <div className="px-3 pt-3 pb-2.5">
            {displayName && (
              <p className="font-inter text-[11px] font-medium text-foreground/85 truncate leading-snug">
                {displayName}
              </p>
            )}
            <p className={cn("font-inter text-[10px] text-muted-foreground/50 truncate", displayName ? "mt-0.5" : "text-[11px] text-foreground/70")}>
              {email}
            </p>
          </div>

          <div className="h-px bg-border mx-0" />

          {/* Appearance */}
          <div className="py-1.5">
            <p className="px-3 pt-1 pb-1 font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35">
              Appearance
            </p>
            {THEMES.map(({ value, label, Icon }) => {
              const active = theme === value;
              return (
                <button
                  key={value}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => setTheme(value)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-[7px] transition-colors text-left",
                    "hover:bg-foreground/[0.04]",
                    active ? "text-foreground/90" : "text-foreground/55",
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-foreground/70" : "text-muted-foreground/35")} />
                  <span className="flex-1 font-inter text-[11px]">{label}</span>
                  {active && <Check className="h-3 w-3 text-foreground/50 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="h-px bg-border" />

          {/* Typography */}
          <div className="py-2">
            <p className="px-3 pt-0.5 pb-2 font-inter text-[9px] tracking-[0.1em] uppercase text-muted-foreground/35">
              Typography
            </p>

            {/* Font family */}
            <div className="px-3 mb-2.5">
              <p className="font-inter text-[9px] text-muted-foreground/40 mb-1.5 uppercase tracking-[0.08em]">Font</p>
              <div className="grid grid-cols-6 gap-0.5">
                {FONT_FAMILIES.map(({ value, label }) => {
                  const active = prefs.fontFamily === value;
                  return (
                    <button
                      key={value}
                      title={label}
                      aria-label={`Font: ${label}`}
                      aria-pressed={active}
                      onClick={() => setPrefs({ ...prefs, fontFamily: value })}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-1.5 rounded transition-colors",
                        "hover:bg-foreground/[0.05]",
                        active ? "bg-foreground/[0.07] ring-1 ring-foreground/10" : "",
                      )}
                    >
                      <span
                        className="text-[13px] text-foreground/75 leading-none"
                        style={{ fontFamily: FONT_FAMILY_CSS[value] }}
                      >
                        Aa
                      </span>
                      <span className={cn(
                        "font-inter text-[7.5px] leading-none truncate w-full text-center",
                        active ? "text-foreground/70" : "text-muted-foreground/40",
                      )}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font size */}
            <div className="px-3 mb-2.5">
              <p className="font-inter text-[9px] text-muted-foreground/40 mb-1.5 uppercase tracking-[0.08em]">Size</p>
              <div className="grid grid-cols-4 gap-0.5">
                {FONT_SIZES.map(({ value, label }) => {
                  const active = prefs.fontSize === value;
                  return (
                    <button
                      key={value}
                      aria-pressed={active}
                      onClick={() => setPrefs({ ...prefs, fontSize: value })}
                      className={cn(
                        "py-1 rounded font-inter text-[10px] transition-colors",
                        "hover:bg-foreground/[0.05]",
                        active
                          ? "bg-foreground/[0.07] text-foreground/90 ring-1 ring-foreground/10"
                          : "text-foreground/50",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Line height */}
            <div className="px-3 mb-2.5">
              <p className="font-inter text-[9px] text-muted-foreground/40 mb-1.5 uppercase tracking-[0.08em]">Spacing</p>
              <div className="grid grid-cols-3 gap-0.5">
                {LINE_HEIGHTS.map(({ value, label, icon }) => {
                  const active = prefs.lineHeight === value;
                  return (
                    <button
                      key={value}
                      aria-pressed={active}
                      onClick={() => setPrefs({ ...prefs, lineHeight: value })}
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-1.5 rounded transition-colors",
                        "hover:bg-foreground/[0.05]",
                        active
                          ? "bg-foreground/[0.07] text-foreground/90 ring-1 ring-foreground/10"
                          : "text-foreground/50",
                      )}
                    >
                      <span className="font-inter text-[12px] leading-none">{icon}</span>
                      <span className="font-inter text-[8px] leading-none">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Letter spacing */}
            <div className="px-3 mb-2.5">
              <p className="font-inter text-[9px] text-muted-foreground/40 mb-1.5 uppercase tracking-[0.08em]">Tracking</p>
              <div className="grid grid-cols-3 gap-0.5">
                {LETTER_SPACINGS.map(({ value, label }) => {
                  const active = prefs.letterSpacing === value;
                  return (
                    <button
                      key={value}
                      aria-pressed={active}
                      onClick={() => setPrefs({ ...prefs, letterSpacing: value })}
                      className={cn(
                        "py-1 rounded font-inter text-[10px] transition-colors text-center",
                        "hover:bg-foreground/[0.05]",
                        active
                          ? "bg-foreground/[0.07] text-foreground/90 ring-1 ring-foreground/10"
                          : "text-foreground/50",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Font weight */}
            <div className="px-3">
              <p className="font-inter text-[9px] text-muted-foreground/40 mb-1.5 uppercase tracking-[0.08em]">Weight</p>
              <div className="grid grid-cols-2 gap-0.5">
                {FONT_WEIGHTS.map(({ value, label }) => {
                  const active = prefs.fontWeight === value;
                  return (
                    <button
                      key={value}
                      aria-pressed={active}
                      onClick={() => setPrefs({ ...prefs, fontWeight: value })}
                      className={cn(
                        "py-1 rounded font-inter text-[10px] transition-colors text-center",
                        "hover:bg-foreground/[0.05]",
                        active
                          ? "bg-foreground/[0.07] text-foreground/90 ring-1 ring-foreground/10"
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

          <div className="h-px bg-border" />

          {/* Actions */}
          <div className="py-1.5">
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onShowKeybindings(); }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] font-inter text-[11px] text-foreground/55 hover:text-foreground/90 hover:bg-foreground/[0.04] transition-colors text-left"
            >
              <Keyboard className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />
              Keyboard shortcuts
            </button>
          </div>

          <div className="h-px bg-border" />

          <div className="py-1.5">
            <button
              role="menuitem"
              onClick={() => { setOpen(false); onSignOut(); }}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] font-inter text-[11px] text-foreground/55 hover:text-foreground/90 hover:bg-foreground/[0.04] transition-colors text-left"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
