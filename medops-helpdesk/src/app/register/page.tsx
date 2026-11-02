"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerSchema } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Activity, UserPlus } from "lucide-react";

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: "", email: "", password: "", facility: "" });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrors({});

        const parsed = registerSchema.safeParse({
            ...form,
            facility: form.facility || "Main Medical Center"
        });

        if (!parsed.success) {
            const fieldErrors = parsed.error.flatten().fieldErrors;
            setErrors({
                name: fieldErrors.name?.[0] || "",
                email: fieldErrors.email?.[0] || "",
                password: fieldErrors.password?.[0] || "",
                facility: fieldErrors.facility?.[0] || "",
            });
            return;
        }

        setLoading(true);
        const res = await fetch("/api/auth/register", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data),
        });
        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
            toast.error(data.error || "Registration failed");
            return;
        }

        toast.success("Account created successfully. Please sign in.");
        router.push("/login");
    }

    return (
        <div className="min-h-screen flex w-full">
            <div className="hidden lg:flex w-1/2 bg-slate-950 items-center justify-center flex-col">
                <div className="h-16 w-16 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400 mb-6 shadow-2xl">
                    <Activity className="h-8 w-8" />
                </div>
                <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">MedOps IT-SOC</h1>
                <p className="text-sm text-slate-500 font-mono">Enterprise Service Level Management</p>
            </div>

            <div className="w-full lg:w-1/2 flex items-center justify-center bg-white px-6">
                <div className="w-full max-w-sm space-y-6">
                    <div className="lg:hidden flex flex-col items-center mb-6">
                        <div className="h-10 w-10 rounded-lg bg-slate-950 flex items-center justify-center text-teal-400 mb-3">
                            <Activity className="h-5 w-5" />
                        </div>
                    </div>

                    <div>
                        <h2 className="text-xl font-semibold text-slate-900">Create an account</h2>
                        <p className="text-sm text-slate-500 mt-1">Register to submit support incidents.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-700">Full Name</Label>
                            <Input
                                placeholder="John Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                                className="h-10 text-sm"
                            />
                            {errors.name && <p className="text-[11px] text-red-600">{errors.name}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-700">Facility / Department</Label>
                            <Input
                                placeholder="Radiology Wing" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })}
                                className="h-10 text-sm"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-700">Work Email</Label>
                            <Input
                                type="email" placeholder="name@company.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                                className="h-10 text-sm"
                            />
                            {errors.email && <p className="text-[11px] text-red-600">{errors.email}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-700">Password</Label>
                            <Input
                                type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                                className="h-10 text-sm"
                            />
                            {errors.password && <p className="text-[11px] text-red-600">{errors.password}</p>}
                        </div>

                        <Button type="submit" disabled={loading} className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white mt-2">
                            <UserPlus className="h-4 w-4 mr-2" />
                            {loading ? "Creating account..." : "Register"}
                        </Button>
                    </form>

                    <p className="text-center text-sm text-slate-500 pt-2">
                        Already have an account? <Link href="/login" className="text-slate-900 font-medium hover:underline">Sign in</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}