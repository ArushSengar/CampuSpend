"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";

export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [college, setCollege] = useState("");
  const [loadDemo, setLoadDemo] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length > 0 ? 1 : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/signup", { name, email, password, college: college || null, loadDemo });
      toast.success(loadDemo ? "Account ready — demo data loaded" : "Account ready");
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm">
      <div className="mb-7">
        <h1 className="text-2xl font-bold tracking-tight text-fg">Create your account</h1>
        <p className="mt-1 text-sm text-muted">Takes 20 seconds. No card, no bank linking.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" autoComplete="name" />
        </Field>
        <Field label="College" hint="optional">
          <Input value={college} onChange={(e) => setCollege(e.target.value)} placeholder="NIT Trichy" />
        </Field>
        <Field label="Email">
          <Input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@college.edu"
            autoComplete="email"
          />
        </Field>
        <Field label="Password" hint="8+ characters">
          <Input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <div className="mt-1.5 flex gap-1">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  strength >= i ? (strength === 3 ? "bg-success" : strength === 2 ? "bg-warning" : "bg-danger") : "bg-surface-3",
                )}
              />
            ))}
          </div>
        </Field>

        <div className="rounded-xl border border-border bg-surface-2 p-3">
          <Switch
            checked={loadDemo}
            onChange={setLoadDemo}
            label="Start with demo data"
            description="5 months of realistic student spending — swap it for your own anytime in Settings."
          />
        </div>

        {error ? <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p> : null}

        <Button type="submit" block loading={loading} rightIcon={<ArrowRight className="h-4 w-4" />}>
          Create account
        </Button>

        <p className="flex items-start gap-1.5 text-[0.7rem] leading-relaxed text-subtle">
          <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
          Everything stays in your own database. The AI parser runs offline on your machine.
        </p>
      </form>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
