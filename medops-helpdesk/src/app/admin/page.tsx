"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import {
    ShieldAlert, Clock, AlertTriangle, Users, RefreshCw, Zap, UserPlus
} from "lucide-react";

interface AnalyticsData {
    summary: { totalTickets: number; openTicketsCount: number; slaBreachCount: number; avgFirstResponseMinutes: number; unassignedCount: number; };
    ticketsByStatus: { status: string; count: number }[];
    ticketsByCategory: { category: string; count: number }[];
    agentWorkload: { agentName: string; active: number; resolved: number; breached: number; total: number; }[];
}

function CreateStaffModal({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent", facility: "IT Helpdesk" });
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || "Failed to create staff");
            else {
                toast.success(`${form.role.toUpperCase()} account created!`);
                setForm({ name: "", email: "", password: "", role: "agent", facility: "IT Helpdesk" });
                setOpen(false);
                onCreated();
            }
        } catch {
            toast.error("Network error");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white text-xs h-9">
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Staff / Agent
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg">Create Staff Account</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs">Full Name</Label>
                        <Input required placeholder="Alex System Engineer" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Email</Label>
                        <Input required type="email" placeholder="alex@medops.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Password</Label>
                        <Input required type="text" placeholder="Initial password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs">Role</Label>
                        <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="agent">Support Agent</SelectItem>
                                <SelectItem value="admin">System Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full bg-slate-900 text-white">
                        {loading ? "Creating..." : "Create Account"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminDashboardPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const fetchAnalytics = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/analytics");
            const json = await res.json();
            if (res.ok) setData(json);
        } catch { toast.error("Error loading analytics"); }
        setLoading(false);
    }, []);

    useEffect(() => {
        if (sessionStatus === "unauthenticated") router.push("/login");
        if (sessionStatus === "authenticated") {
            if (session?.user?.role !== "admin") router.push("/dashboard");
            else fetchAnalytics();
        }
    }, [sessionStatus, session?.user?.role, router, fetchAnalytics]);

    async function handleManualSlaSync() {
        setSyncing(true);
        try {
            const res = await fetch("/api/cron/sla-check", { method: "POST" });
            const json = await res.json();
            if (res.ok) {
                toast.success(`SLA Synced: ${json.newlyBreached} breached, ${json.autoClosedCount} auto-closed`);
                fetchAnalytics();
            }
        } finally { setSyncing(false); }
    }

    if (sessionStatus === "loading" || loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">Loading MedOps Admin...</div>;
    const summary = data?.summary;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <Badge variant="outline" className="bg-teal-500/10 text-teal-800 border-teal-300 font-mono text-xs">SECURE ADMIN SOC</Badge>
                        <h1 className="text-2xl font-semibold text-slate-900 mt-1">Command & Analytics Center</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <CreateStaffModal onCreated={fetchAnalytics} />
                        <Button variant="outline" size="sm" onClick={fetchAnalytics} className="text-xs h-9">
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
                        </Button>
                        <Button size="sm" disabled={syncing} onClick={handleManualSlaSync} className="bg-slate-900 text-white text-xs h-9">
                            <Zap className="h-3.5 w-3.5 mr-1.5 text-teal-400" /> {syncing ? "Syncing SLAs..." : "Run SLA Sync"}
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    <div className="rounded-lg border bg-white p-5 shadow-2xs">
                        <div className="flex justify-between text-slate-500 text-xs font-semibold uppercase">Open Incidents <ShieldAlert className="h-4 w-4 text-sky-600" /></div>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-2">{summary?.openTicketsCount ?? 0}</div>
                    </div>
                    <div className="rounded-lg border bg-white p-5 shadow-2xs">
                        <div className="flex justify-between text-slate-500 text-xs font-semibold uppercase">SLA Breaches <AlertTriangle className="h-4 w-4 text-red-600" /></div>
                        <div className="text-2xl font-bold font-mono text-red-600 mt-2">{summary?.slaBreachCount ?? 0}</div>
                    </div>
                    <div className="rounded-lg border bg-white p-5 shadow-2xs">
                        <div className="flex justify-between text-slate-500 text-xs font-semibold uppercase">Avg Response <Clock className="h-4 w-4 text-teal-600" /></div>
                        <div className="text-2xl font-bold font-mono text-slate-900 mt-2">{summary?.avgFirstResponseMinutes ?? 0} m</div>
                    </div>
                    <div className="rounded-lg border bg-white p-5 shadow-2xs">
                        <div className="flex justify-between text-slate-500 text-xs font-semibold uppercase">Unassigned <Users className="h-4 w-4 text-amber-600" /></div>
                        <div className="text-2xl font-bold font-mono text-amber-600 mt-2">{summary?.unassignedCount ?? 0}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="rounded-lg border bg-white p-5 shadow-2xs h-64">
                        <h2 className="text-xs font-semibold uppercase text-slate-500 mb-4">Tickets by Status</h2>
                        <ResponsiveContainer width="100%" height="100%"><BarChart data={data?.ticketsByStatus || []}><XAxis dataKey="status" fontSize={11} stroke="#64748b" /><YAxis fontSize={11} stroke="#64748b" allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
                    </div>
                    <div className="rounded-lg border bg-white p-5 shadow-2xs h-64">
                        <h2 className="text-xs font-semibold uppercase text-slate-500 mb-4">Tickets by Category</h2>
                        <ResponsiveContainer width="100%" height="100%"><BarChart data={data?.ticketsByCategory || []} layout="vertical"><XAxis type="number" fontSize={11} stroke="#64748b" allowDecimals={false} /><YAxis dataKey="category" type="category" width={140} fontSize={10} stroke="#64748b" /><Tooltip /><Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
                    </div>
                </div>

                <div className="rounded-lg border bg-white shadow-2xs overflow-hidden">
                    <div className="p-4 bg-slate-50 border-b text-xs font-semibold uppercase text-slate-500">Support Engineer Workload</div>
                    <table className="w-full text-left"><thead className="border-b bg-slate-50 text-[11px] text-slate-500 uppercase"><th className="py-3 px-5">Name</th><th className="py-3 px-5">Active</th><th className="py-3 px-5">Resolved</th><th className="py-3 px-5">Breached</th><th className="py-3 px-5">Total</th></thead>
                        <tbody className="divide-y text-xs font-mono">
                            {data?.agentWorkload?.map((a, i) => (
                                <tr key={i}><td className="py-3 px-5 font-sans font-medium">{a.agentName}</td><td className="py-3 px-5 text-indigo-700">{a.active}</td><td className="py-3 px-5 text-emerald-700">{a.resolved}</td><td className="py-3 px-5 text-red-600">{a.breached}</td><td className="py-3 px-5">{a.total}</td></tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}