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
import { Lock } from "lucide-react";

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
    let res;
    try {
      res = await signIn("credentials", { email, password, redirect: false });
    } catch {
      toast.error("Could not reach the sign-in service. Please try again.");
      setLoading(false);
      return;
    }
    setLoading(false);

    if (!res || res.error) {
      toast.error("Invalid corporate credentials.");
      return;
    }

    toast.success("Authenticated successfully");
    const requestedDestination = new URLSearchParams(window.location.search).get("callbackUrl") || "/";
    let destination = "/";
    try {
      const destinationUrl = new URL(requestedDestination, window.location.origin);
      if (destinationUrl.origin === window.location.origin) {
        destination = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
      }
    } catch {
      // Ignore malformed or external return URLs and use the role-aware home route.
    }
    router.replace(destination);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex w-full bg-[#F4F6FB] font-sans">
      {/* Left Minimal Brand Panel */}
      <div className="hidden lg:flex w-1/2 bg-[#141738] items-center justify-center flex-col p-12 relative overflow-hidden">
        {/* Subtle decorative purple glow circle */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#6052E9]/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full bg-[#00D2B4]/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-4 h-4 rounded-full bg-[#FFB020] inline-block shadow-sm" />
            <span className="w-4 h-4 rounded-full bg-[#00D2B4] inline-block shadow-sm" />
            <span className="w-4 h-4 rounded-full bg-[#FF5630] inline-block shadow-sm" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-3">
            MedOps Helpdesk
          </h1>
          <p className="text-sm text-slate-300 font-normal leading-relaxed">
            Enterprise Clinical Incident Management, Real-time SLA Timers, and Performance Analytics.
          </p>

          <div className="mt-8 flex items-center gap-2 text-xs font-mono text-purple-200 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10">
            <span>SOC Incident Control System</span>
          </div>
        </div>
      </div>

      {/* Right Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-7 bg-white p-8 sm:p-10 rounded-2xl shadow-baligo border border-slate-100">
          <div className="lg:hidden flex flex-col items-center mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-3 h-3 rounded-full bg-[#FFB020]" />
              <span className="w-3 h-3 rounded-full bg-[#00D2B4]" />
              <span className="w-3 h-3 rounded-full bg-[#FF5630]" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">MedOps Helpdesk</h1>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Sign in</h2>
            <p className="text-xs text-slate-400 mt-1">Access your support workspace and clinical queue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Work Email</Label>
              <Input
                id="email" type="email" placeholder="name@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
              {errors.email && <p className="text-[11px] text-rose-600 font-medium">{errors.email}</p>}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</Label>
              <Input
                id="password" type="password" placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
              {errors.password && <p className="text-[11px] text-rose-600 font-medium">{errors.password}</p>}
            </div>

            <Button type="submit" disabled={loading} className="w-full h-10 bg-[#6052E9] hover:bg-[#4F46E5] text-white rounded-xl font-semibold shadow-sm transition-all">
              <Lock className="h-4 w-4 mr-2" />
              {loading ? "Authenticating..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
            Need an account? <Link href="/register" className="text-[#6052E9] font-bold hover:underline">Register here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
