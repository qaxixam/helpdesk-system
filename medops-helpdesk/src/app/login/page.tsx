"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { loginSchema } from "@/lib/validations";

const DEMO = [
  { role: "Admin", email: "admin@medops.com" },
  { role: "Agent", email: "elena.agent@medops.com" },
  { role: "Requester", email: "sarah.jenkins@stjudeclinic.org" },
];
const DEMO_PASSWORD = "Password123!";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({ email: fe.email?.[0], password: fe.password?.[0] });
      return;
    }
    setErrors({});
    setLoading(true);
    const res = await signIn("credentials", { ...parsed.data, redirect: false });
    if (!res || res.error) {
      setLoading(false);
      setErrors({
        form:
          res?.code === "account_disabled"
            ? "This account has been deactivated. Contact your administrator."
            : "That email and password don’t match an account.",
      });
      return;
    }
    const callback = new URLSearchParams(window.location.search).get("callbackUrl");
    // Only allow same-site relative redirects
    window.location.assign(callback && callback.startsWith("/") && !callback.startsWith("//") ? callback : "/");
  }

  return (
    <AuthLayout>
      <h1 className="text-[28px] font-semibold tracking-[-0.015em] text-ink">Sign in</h1>
      <p className="mt-1.5 text-[14.5px] text-ink-3">Use your work email to reach the helpdesk.</p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        {errors.form && (
          <div className="rounded-md border border-urgent/25 bg-urgent-soft px-3.5 py-2.5 text-[13.5px] text-urgent" role="alert">
            {errors.form}
          </div>
        )}
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            aria-invalid={!!errors.email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={!!errors.password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-3">
        New clinic staff?{" "}
        <Link href="/register" className="font-medium text-teal-700 hover:underline">
          Create an account
        </Link>
      </p>

      <div className="mt-10 rounded-lg border border-dashed border-line-strong p-4">
        <p className="text-[13px] font-medium text-ink-2">Demo accounts</p>
        <p className="mt-0.5 text-[12.5px] text-ink-3">
          Password for all: <span className="font-mono">{DEMO_PASSWORD}</span>
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword(DEMO_PASSWORD);
                setErrors({});
              }}
              className="h-8 rounded-md bg-sunken px-3 text-[12.5px] font-medium text-ink-2 transition-colors hover:bg-teal-50 hover:text-teal-700"
            >
              {d.role}
            </button>
          ))}
        </div>
      </div>
    </AuthLayout>
  );
}
