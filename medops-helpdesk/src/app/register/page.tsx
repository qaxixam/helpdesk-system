"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { registerSchema } from "@/lib/validations";
import { fetchJson } from "@/lib/api-client";

type Form = { name: string; email: string; facility: string; password: string };
type Errors = Partial<Record<keyof Form | "form", string>>;

export default function RegisterPage() {
  const [form, setForm] = useState<Form>({ name: "", email: "", facility: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) as Errors);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await fetchJson("/api/auth/register", { method: "POST", body: JSON.stringify(parsed.data) });
      const res = await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirect: false });
      if (res?.error) {
        toast.success("Account created. Please sign in.");
        window.location.assign("/login");
        return;
      }
      window.location.assign("/dashboard");
    } catch (err) {
      setErrors({ form: (err as Error).message });
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-[28px] font-semibold tracking-[-0.015em] text-ink">Create your account</h1>
      <p className="mt-1.5 text-[14.5px] text-ink-3">For clinic and department staff who need IT support.</p>

      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        {errors.form && (
          <div className="rounded-md border border-urgent/25 bg-urgent-soft px-3.5 py-2.5 text-[13.5px] text-urgent" role="alert">
            {errors.form}
          </div>
        )}
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" value={form.name} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Work email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={!!errors.email} />
        </Field>
        <Field label="Clinic or department" htmlFor="facility" error={errors.facility}>
          <Input
            id="facility"
            placeholder="e.g. St. Jude Outpatient – ER"
            value={form.facility}
            onChange={set("facility")}
            aria-invalid={!!errors.facility}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          error={errors.password}
          hint="At least 8 characters, with an uppercase letter and a number."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            aria-invalid={!!errors.password}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-[13.5px] text-ink-3">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-teal-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
