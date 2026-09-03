"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Receipt, Sparkles, ArrowRight, Lock, Mail, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in both email and password.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { email, password });
      toast.success("Welcome back!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "error" in err
            ? String((err as { error: unknown }).error)
            : "Invalid email or password.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/login", {
        email: "demo@campuspend.app",
        password: "campuspend",
      });
      toast.success("Signed into Demo Account!");
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Could not log into demo account.");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Background Decorative Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/20 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-[400px] w-[400px] rounded-full bg-accent/15 blur-[140px]" />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <Link href="/dashboard" className="inline-flex items-center gap-2.5">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-xl shadow-primary/25 border border-white/10">
              <Receipt className="h-5 w-5" />
            </span>
            <div className="text-left">
              <span className="text-lg font-black tracking-tight text-fg">CampuSpend</span>
              <span className="block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-primary">
                for students
              </span>
            </div>
          </Link>
          <h1 className="mt-4 text-xl font-black tracking-tight text-fg">Welcome Back</h1>
          <p className="mt-1 text-xs text-muted">
            Track UPI & cash, split bills, and master your student budget.
          </p>
        </div>

        {/* Auth Card */}
        <div className="rounded-3xl border border-border/80 bg-surface/80 p-6 shadow-2xl backdrop-blur-2xl sm:p-7">
          {/* Quick Demo Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            disabled={demoLoading || loading}
            className="group flex w-full items-center justify-between rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-3 text-left transition hover:border-primary/60 hover:from-primary/15 hover:to-accent/15 pressable"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-8.5 w-8.5 place-items-center rounded-xl bg-primary text-white shadow-sm">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <p className="text-xs font-bold text-fg">1-Click Demo Sandbox</p>
                <p className="text-[0.68rem] text-muted">
                  Explore pre-loaded student ledger
                </p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-0.5" />
          </button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border/80" />
            <span className="text-[0.65rem] font-bold uppercase tracking-wider text-subtle">
              or sign in
            </span>
            <div className="h-px flex-1 bg-border/80" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger-soft/30 p-2.5 text-xs font-medium text-danger">
                {error}
              </div>
            ) : null}

            <Field label="Email" required>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                leftIcon={<Mail className="h-3.5 w-3.5 text-subtle" />}
                required
                className="h-10 text-xs"
              />
            </Field>

            <Field label="Password" required>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  leftIcon={<Lock className="h-3.5 w-3.5 text-subtle" />}
                  required
                  className="h-10 pr-10 text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-subtle hover:text-fg"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </Field>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="mt-2 h-10 w-full text-xs font-bold shadow-md shadow-primary/20"
            >
              Sign In
            </Button>
          </form>

          <div className="mt-5 text-center text-xs text-muted">
            New here?{" "}
            <Link href="/signup" className="font-bold text-primary hover:underline">
              Create Account
            </Link>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-1.5 text-center text-[0.68rem] text-subtle">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span>Local SQLite database · Zero ads · Complete privacy</span>
        </div>
      </div>
    </div>
  );
}
