"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { loginSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Activity, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({ email: fieldErrors.email?.[0], password: fieldErrors.password?.[0] });
      return;
    }

    setLoading(true);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      toast.error("Invalid corporate credentials.");
      return;
    }

    toast.success("Authenticated successfully");
    // Redirect to home page which will handle role-based routing
    router.push("/");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex w-full">
      {/* Left Minimal Brand Panel */}
      <div className="hidden lg:flex w-1/2 bg-slate-950 items-center justify-center flex-col">
        <div className="h-16 w-16 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6 shadow-2xl">
          <Activity className="h-8 w-8" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">MedOps IT-SOC</h1>
        <p className="text-sm text-slate-500 font-mono">Enterprise Service Level Management</p>
      </div>

      {/* Right Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="lg:hidden flex flex-col items-center mb-8">
            <div className="h-10 w-10 rounded-lg bg-slate-950 flex items-center justify-center text-teal-400 mb-3">
              <Activity className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">MedOps IT-SOC</h1>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
            <p className="text-sm text-slate-500 mt-1">Access your support workspace.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-700">Work Email</Label>
              <Input
                id="email" type="email" placeholder="name@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-sm"
              />
              {errors.email && <p className="text-[11px] text-red-600">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-700">Password</Label>
              <Input
                id="password" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-10 text-sm"
              />
              {errors.password && <p className="text-[11px] text-red-600">{errors.password}</p>}
            </div>

            <Button type="submit" disabled={loading} className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white transition-all">
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Authenticating..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 pt-4">
            Need an account? <Link href="/register" className="text-slate-900 font-medium hover:underline">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}