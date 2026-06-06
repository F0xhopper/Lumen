"use client";

import { useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup" | "magic";
type Status = "idle" | "loading" | "error";

interface Props {
  onClose: () => void;
}

const INPUT = cn(
  "w-full px-3 py-2 bg-secondary border rounded font-inter text-[12px]",
  "text-foreground placeholder:text-muted-foreground/35",
  "focus:outline-none focus:border-foreground/25 transition-colors",
);

export default function AuthModal({ onClose }: Props) {
  const { signInWithPassword, signInWithMagicLink, signInWithOAuth, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [done, setDone] = useState<"magic_sent" | "verify_email" | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const emailRef = useRef<HTMLInputElement>(null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setStatus("idle");
    setErrorMsg("");
    setPassword("");
    setConfirm("");
  };

  const err = (msg: string) => { setErrorMsg(msg); setStatus("error"); };

  const handleOAuth = async (provider: "google") => {
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");
    const { error } = await signInWithOAuth(provider);
    if (error) { err(error); }
    // on success the browser redirects — no further action needed
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setErrorMsg("");

    if (mode === "magic") {
      const { error } = await signInWithMagicLink(email.trim());
      if (error) { err(error); return; }
      setDone("magic_sent");
      return;
    }

    if (mode === "signup") {
      if (password.length < 8) { err("Password must be at least 8 characters."); return; }
      if (password !== confirm) { err("Passwords do not match."); return; }
      const { error, needsVerification } = await signUp(email.trim(), password);
      if (error) { err(error); return; }
      if (needsVerification) { setDone("verify_email"); return; }
      // email confirmation disabled — session started, modal can close
      onClose();
      return;
    }

    // signin
    const { error } = await signInWithPassword(email.trim(), password);
    if (error) { err("Incorrect email or password."); return; }
    onClose();
  };

  const titles: Record<Mode, string> = {
    signin: "Sign in",
    signup: "Create account",
    magic: "Magic link",
  };

  // ── Done states ─────────────────────────────────────────────────────────────
  if (done) {
    return (
      <Backdrop onClose={onClose}>
        <div className="text-center py-2 space-y-2">
          <p className="font-cardo italic text-[15px] text-foreground/80">Check your email</p>
          <p className="font-inter text-[11px] text-muted-foreground/55 leading-relaxed">
            {done === "magic_sent"
              ? <>A sign-in link was sent to <span className="text-foreground/70">{email}</span>.</>
              : <>A verification link was sent to <span className="text-foreground/70">{email}</span>. Click it to activate your account.</>
            }
          </p>
          <button
            onClick={onClose}
            className="mt-2 font-inter text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </Backdrop>
    );
  }

  // ── Form ────────────────────────────────────────────────────────────────────
  return (
    <Backdrop onClose={onClose}>
      <p className="font-cardo italic text-[15px] text-foreground/80 mb-1">{titles[mode]}</p>
      <p className="font-inter text-[10px] text-muted-foreground/45 mb-5 leading-relaxed">
        {mode === "signup"
          ? "Your bookmarks and history will sync across devices."
          : mode === "magic"
          ? "We'll email you a one-click sign-in link."
          : "Welcome back."
        }
      </p>

      {mode !== "magic" && (
        <>
          <div className="flex flex-col gap-2 mb-1">
            <OAuthButton
              onClick={() => handleOAuth("google")}
              disabled={status === "loading"}
              icon={<GoogleIcon />}
              label="Continue with Google"
            />
          </div>
          <div className="flex items-center gap-3 mb-1">
            <div className="h-px flex-1 bg-border" />
            <span className="font-inter text-[10px] text-muted-foreground/35">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <input
          ref={emailRef}
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus("idle"); }}
          placeholder="Email"
          autoFocus
          required
          className={cn(INPUT, status === "error" && mode === "magic" ? "border-red-500/50" : "border-border")}
        />

        {mode !== "magic" && (
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setStatus("idle"); }}
            placeholder="Password"
            required
            className={cn(INPUT, status === "error" ? "border-red-500/50" : "border-border")}
          />
        )}

        {mode === "signup" && (
          <input
            type="password"
            value={confirm}
            onChange={(e) => { setConfirm(e.target.value); setStatus("idle"); }}
            placeholder="Confirm password"
            required
            className={cn(INPUT, status === "error" && confirm && password !== confirm ? "border-red-500/50" : "border-border")}
          />
        )}

        {status === "error" && (
          <p className="font-inter text-[10px] text-red-400/80 -mt-1">{errorMsg}</p>
        )}

        <button
          type="submit"
          disabled={status === "loading"}
          className="flex items-center justify-center gap-2 py-2 mt-1 bg-foreground/[0.08] hover:bg-foreground/[0.13] border border-border rounded font-inter text-[11px] text-foreground/75 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {status === "loading" && <Loader2 className="h-3 w-3 animate-spin" />}
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send link"}
        </button>
      </form>

      {/* Secondary actions */}
      <div className="mt-4 flex flex-col gap-2 items-center">
        {mode === "signin" && (
          <button
            onClick={() => switchMode("magic")}
            className="font-inter text-[10px] text-muted-foreground/40 hover:text-foreground/60 transition-colors"
          >
            Sign in with magic link instead
          </button>
        )}

        <div className="h-px w-full bg-border mt-1" />

        <p className="font-inter text-[10px] text-muted-foreground/40">
          {mode === "signup" ? (
            <>Already have an account?{" "}
              <button onClick={() => switchMode("signin")} className="text-foreground/60 hover:text-foreground/80 transition-colors">
                Sign in
              </button>
            </>
          ) : (
            <>Don't have an account?{" "}
              <button onClick={() => switchMode("signup")} className="text-foreground/60 hover:text-foreground/80 transition-colors">
                Create one
              </button>
            </>
          )}
        </p>
      </div>
    </Backdrop>
  );
}

function OAuthButton({ onClick, disabled, icon, label }: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 py-2 bg-foreground/[0.06] hover:bg-foreground/[0.11] border border-border rounded font-inter text-[11px] text-foreground/70 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {icon}
      {label}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" opacity=".7"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".85"/>
    </svg>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-[300px] mx-4 bg-background border border-border rounded-lg px-6 py-5 shadow-xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-muted-foreground/35 hover:text-foreground/65 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {children}
      </div>
    </div>
  );
}
