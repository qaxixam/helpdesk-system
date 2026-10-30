"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Activity, Lock, ArrowRight, Terminal } from "lucide-react";

const DEMO_ACCOUNTS = [
  {
    role: "Admin (IT Director)",
    name: "Marcus Vance",
    email: "admin@medops.com",
    badge: "Full Analytics & Assignment",
  },
  {
    role: "Agent (Tier-2 Engineer)",
    name: "Elena Rostova",
    email: "elena.agent@medops.com",
    badge: "Assigned Queue & Internal Notes",
  },
  {
    role: "Clinic User (Physician)",
    name: "Dr. Sarah Jenkins",
    email: "sarah.jenkins@stjudeclinic.org",
    badge: "Raise & Track Clinic Tickets",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side Zod validation
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      });
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      toast.error("Authentication failed. Check your email and password.");
      return;
    }

    toast.success("Authenticated successfully");
    router.push("/dashboard");
    router.refresh();
  }

  async function quickDemoLogin(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Password123!");
    setErrors({});
    setLoading(true);

    const res = await signIn("credentials", {
      email: demoEmail,
      password: "Password123!",
      redirect: false,
    });
    setLoading(false);

    if (res?.error) {
      toast.error("Demo login failed. Did you run npm run seed?");
      return;
    }

    toast.success(`Signed in as ${demoEmail}`);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-12 bg-slate-50">
      {/* Left Column: Clinical System Branding */}
      <div className="hidden lg:flex lg:col-span-5 bg-slate-900 text-slate-100 flex-col justify-between p-10 border-r border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded bg-teal-500 flex items-center justify-center text-slate-950 font-bold">
              <Activity className="h-5 w-5" />
            </div>
            <span className="font-semibold tracking-tight text-lg">
              MedOps <span className="text-teal-400 font-mono text-sm">IT-SOC</span>
            </span>
          </div>

          <div className="mt-16 space-y-4">
            <Badge
              variant="outline"
              className="border-teal-500/30 bg-teal-500/10 text-teal-300 font-mono text-xs"
            >
              HIPAA COMPLIANT INCIDENT DESK
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight text-white leading-snug">
              Clinical infrastructure support & real-time SLA enforcement.
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Centralized ticketing portal for EHR outages, diagnostic lab
              hardware, and clinical identity access across regional medical
              centers.
            </p>
          </div>
        </div>

        <div className="space-y-3 border-t border-slate-800 pt-6 text-xs text-slate-400 font-mono">
          <div className="flex items-center justify-between">
            <span>URGENT SLA TARGET</span>
            <span className="text-teal-400">1h Response / 8h Resolution</span>
          </div>
          <div className="flex items-center justify-between">
            <span>AUTO-CLOSE POLICY</span>
            <span className="text-slate-300">72h Post-Resolution</span>
          </div>
          <div className="flex items-center justify-between">
            <span>ACCESS CONTROL</span>
            <span className="text-slate-300">Strict API-Level RBAC</span>
          </div>
        </div>
      </div>

      {/* Right Column: Login Form & 1-Click Evaluator Access */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Sign in to MedOps Portal
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Enter your clinical credentials or use instant evaluator access below.
            </p>
          </div>

          {/* 1-Click Evaluator Demo Box */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5 text-teal-600" />
                1-Click Sandbox Login (Evaluator Mode)
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                Pass: Password123!
              </span>
            </div>
            <div className="grid gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  disabled={loading}
                  onClick={() => quickDemoLogin(acc.email)}
                  className="flex items-center justify-between w-full text-left px-3 py-2 rounded-md border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition text-xs group"
                >
                  <div>
                    <div className="font-medium text-slate-900 group-hover:text-teal-700">
                      {acc.role} — <span className="font-normal text-slate-600">{acc.name}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {acc.email}
                    </div>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-0.5 transition" />
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Work Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@stjudeclinic.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && (
                <p className="text-xs text-red-600">{errors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && (
                <p className="text-xs text-red-600">{errors.password}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white"
            >
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Authenticating..." : "Sign in to Portal"}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-500">
            New clinical staff member?{" "}
            <Link
              href="/register"
              className="font-medium text-slate-900 underline underline-offset-4 hover:text-teal-700"
            >
              Register clinic account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}   