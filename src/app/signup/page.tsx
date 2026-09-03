"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Lock,
  Mail,
  User,
  GraduationCap,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Field, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [college, setCollege] = useState("");
  const [loadDemo, setLoadDemo] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in your name, email, and password.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/signup", {
        name,
        email,
        password,
        college: college || null,
        loadDemo,
      });

      toast.success("Account created successfully!");
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "error" in err
            ? String((err as { error: unknown }).error)
            : "Failed to create account. Email might already be taken.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12">
      {/* Background Decorative Ambient Glows */}
      <div className="pointer-events-none absolute -top-40 right-1/2 h-[500px] w-[500px] translate-x-1/2 rounded-full bg-accent/15 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-10 h-[400px] w-[400px] rounded-full bg-primary/20 blur-[140px]" />

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
          <h1 className="mt-4 text-xl font-black tracking-tight text-fg">Create Account</h1>
          <p className="mt-1 text-xs text-muted">
            Manage UPI, cash, and roommate debts effortlessly.
          </p>
        </div>

        {/* Signup Card */}
        <div className="rounded-3xl border border-border/80 bg-surface/80 p-6 shadow-2xl backdrop-blur-2xl sm:p-7">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {error ? (
              <div className="rounded-2xl border border-danger/30 bg-danger-soft/30 p-2.5 text-xs font-medium text-danger">
                {error}
              </div>
            ) : null}

            <Field label="Full Name" required>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Aarav Sharma"
                leftIcon={<User className="h-3.5 w-3.5 text-subtle" />}
                required
                className="h-10 text-xs"
              />
            </Field>

            <Field label="College / Campus">
              <Input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="IIT Bombay / BITS Pilani"
                leftIcon={<GraduationCap className="h-3.5 w-3.5 text-subtle" />}
                className="h-10 text-xs"
              />
            </Field>

            <Field label="Email Address" required>
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

            <Field label="Password" required hint="At least 8 characters">
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

            {/* Load Demo Data Toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-border/80 bg-surface-2/50 p-3">
              <div>
                <p className="text-xs font-bold text-fg">Include Demo Dataset</p>
                <p className="text-[0.68rem] text-muted">
                  Pre-populate realistic student transactions
                </p>
              </div>
              <Switch checked={loadDemo} onChange={setLoadDemo} />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={loading}
              className="mt-2 h-10 w-full text-xs font-bold shadow-md shadow-primary/20"
            >
              Sign Up
            </Button>
          </form>

          <div className="mt-5 text-center text-xs text-muted">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Sign In
            </Link>
          </div>
        </div>

        {/* Privacy Note */}
        <div className="flex items-center justify-center gap-1.5 text-center text-[0.68rem] text-subtle">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          <span>Local SQLite · Zero tracking · Complete privacy</span>
        </div>
      </div>
    </div>
  );
}
