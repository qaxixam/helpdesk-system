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
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        facility: "St. Jude Outpatient Clinic",
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setErrors({});

        // Client-side Zod validation
        const parsed = registerSchema.safeParse(form);
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
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form),
        });
        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
            toast.error(data.error || "Registration failed");
            return;
        }

        toast.success("Clinic account registered! Please sign in.");
        router.push("/login");
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
            <div className="w-full max-w-md space-y-6">
                <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded bg-slate-900 flex items-center justify-center text-teal-400 font-bold">
                        <Activity className="h-5 w-5" />
                    </div>
                    <span className="font-semibold tracking-tight text-lg text-slate-900">
                        MedOps <span className="font-mono text-xs text-slate-500">IT-SOC</span>
                    </span>
                </div>

                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                        Register Clinical Staff Account
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Create a requester account to submit and track IT support tickets.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    className="rounded-lg border border-slate-200 bg-white p-6 shadow-xs space-y-4"
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="name">Full Name & Title</Label>
                        <Input
                            id="name"
                            placeholder="Dr. Emily Carter"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                        />
                        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="facility">Clinical Facility / Department</Label>
                        <Input
                            id="facility"
                            placeholder="MetroHealth Radiology Wing"
                            value={form.facility}
                            onChange={(e) => setForm({ ...form, facility: e.target.value })}
                        />
                        {errors.facility && (
                            <p className="text-xs text-red-600">{errors.facility}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="email">Clinical Email</Label>
                        <Input
                            id="email"
                            type="email"
                            placeholder="emily.carter@metrohealth.org"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                        {errors.email && (
                            <p className="text-xs text-red-600">{errors.email}</p>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor="password">Password (Min 8 chars, 1 uppercase, 1 number)</Label>
                        <Input
                            id="password"
                            type="password"
                            placeholder="••••••••••••"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
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
                        <UserPlus className="h-4 w-4 mr-2" />
                        {loading ? "Creating Account..." : "Complete Registration"}
                    </Button>
                </form>

                <p className="text-center text-xs text-slate-500">
                    Already have an account?{" "}
                    <Link
                        href="/login"
                        className="font-medium text-slate-900 underline underline-offset-4"
                    >
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}