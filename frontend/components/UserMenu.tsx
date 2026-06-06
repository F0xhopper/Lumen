"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { User } from "@supabase/supabase-js";
import { Check, Keyboard, LogOut, Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import PreferencesModal from "@/components/PreferencesModal";

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

export default function UserMenu({ user, onSignOut, onShowKeybindings }: Props) {
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();

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
    <>
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
            className="absolute right-0 top-full mt-2 w-[220px] z-50 rounded-lg border border-border bg-background shadow-xl"
          >
            {/* User info */}
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

            <div className="h-px bg-border" />

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

            {/* Actions */}
            <div className="py-1.5">
              <button
                role="menuitem"
                onClick={() => { setOpen(false); setPrefsOpen(true); }}
                className="w-full flex items-center gap-2.5 px-3 py-[7px] font-inter text-[11px] text-foreground/55 hover:text-foreground/90 hover:bg-foreground/[0.04] transition-colors text-left"
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-muted-foreground/35" />
                Reading preferences
              </button>
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

      <PreferencesModal open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  );
}
