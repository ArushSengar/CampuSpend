"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { DEMO_CREDENTIALS } from "@/lib/demo";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { email, password });
      toast.success("Welcome back");
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const demo = async () => {
    setDemoLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/login", { email: DEMO_CREDENTIALS.email, password: DEMO_CREDENTIALS.password });
      toast.success("Signed in as the demo student", "5 months of realistic data loaded.");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Demo login failed");
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-fg">Welcome back</h1>
        <p className="mt-1 text-sm text-muted">Log in to pick up where your money left off.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@college.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <Input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p> : null}

        <Button type="submit" block loading={loading} rightIcon={<ArrowRight className="h-4 w-4" />}>
          Log in
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-[0.7rem] uppercase tracking-wider text-subtle">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="secondary" block onClick={demo} loading={demoLoading} leftIcon={<Sparkles className="h-4 w-4" />}>
        Explore the live demo
      </Button>
      <p className="mt-2 text-center text-[0.7rem] text-subtle">
        {DEMO_CREDENTIALS.email} · {DEMO_CREDENTIALS.password}
      </p>

      <p className="mt-8 text-center text-sm text-muted">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-64 w-full max-w-sm animate-pulse rounded-2xl bg-surface-2" />}>
      <LoginForm />
    </Suspense>
  );
}
