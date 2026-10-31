"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import {
    ShieldAlert,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Users,
    RefreshCw,
    Zap,
} from "lucide-react";

interface AnalyticsData {
    summary: {
        totalTickets: number;
        openTicketsCount: number;
        slaBreachCount: number;
        avgFirstResponseMinutes: number;
        unassignedCount: number;
    };
    ticketsByStatus: { status: string; count: number }[];
    ticketsByCategory: { category: string; count: number }[];
    agentWorkload: {
        agentName: string;
        active: number;
        resolved: number;
        breached: number;
        total: number;
    }[];
}

const COLORS = ["#0f172a", "#0d9488", "#3b82f6", "#f59e0b", "#ef4444"];

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
            if (!res.ok) {
                toast.error(json.error || "Failed to load admin analytics");
            } else {
                setData(json);
            }
        } catch {
            toast.error("Network error loading analytics");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (sessionStatus === "authenticated") {
            if (session?.user?.role !== "admin") {
                toast.error("Access denied: Admin privileges required");
                router.push("/dashboard");
                return;
            }
            fetchAnalytics();
        }
    }, [sessionStatus, session?.user?.role, router, fetchAnalytics]);

    async function handleManualSlaSync() {
        setSyncing(true);
        try {
            const res = await fetch("/api/cron/sla-check", { method: "POST" });
            const json = await res.json();
            if (res.ok) {
                toast.success(
                    `SLA Synced: ${json.newlyBreached} newly breached, ${json.autoClosedCount} auto-closed (72h stale)`
                );
                fetchAnalytics();
            } else {
                toast.error("Failed to trigger SLA sync");
            }
        } catch {
            toast.error("Error triggering cron sync");
        } finally {
            setSyncing(false);
        }
    }

    if (sessionStatus === "loading" || loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
                Loading MedOps Admin Command Center...
            </div>
        );
    }

    const summary = data?.summary;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                {/* Header & Manual Cron Trigger */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant="outline"
                                className="bg-teal-500/10 text-teal-800 border-teal-300 font-mono text-xs"
                            >
                                SECURE ADMIN SOC
                            </Badge>
                            <span className="text-xs text-slate-400 font-mono">
                                System SLA & Performance Monitor
                            </span>
                        </div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 mt-1">
                            Admin Command & Analytics Center
                        </h1>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchAnalytics}
                            className="text-xs h-9"
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Refresh Analytics
                        </Button>

                        <Button
                            size="sm"
                            disabled={syncing}
                            onClick={handleManualSlaSync}
                            className="bg-slate-900 hover:bg-slate-800 text-white text-xs h-9"
                        >
                            <Zap className="h-3.5 w-3.5 mr-1.5 text-teal-400" />
                            {syncing ? "Syncing SLAs..." : "Run SLA & Auto-Close Sync"}
                        </Button>
                    </div>
                </div>

                {/* 4 KPI Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-slate-500">
                            <span className="text-xs font-semibold uppercase tracking-wider">
                                Active Open Incidents
                            </span>
                            <ShieldAlert className="h-4 w-4 text-sky-600" />
                        </div>
                        <div className="text-2xl font-bold font-mono text-slate-900">
                            {summary?.openTicketsCount ?? 0}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Total system tickets: {summary?.totalTickets ?? 0}
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-slate-500">
                            <span className="text-xs font-semibold uppercase tracking-wider">
                                SLA Breach Count
                            </span>
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="text-2xl font-bold font-mono text-red-600">
                            {summary?.slaBreachCount ?? 0}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Requires immediate escalation
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-slate-500">
                            <span className="text-xs font-semibold uppercase tracking-wider">
                                Avg First-Response Time
                            </span>
                            <Clock className="h-4 w-4 text-teal-600" />
                        </div>
                        <div className="text-2xl font-bold font-mono text-slate-900">
                            {summary?.avgFirstResponseMinutes ?? 0} mins
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Target: &lt;60 mins for Urgent
                        </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-2">
                        <div className="flex items-center justify-between text-slate-500">
                            <span className="text-xs font-semibold uppercase tracking-wider">
                                Unassigned Queue
                            </span>
                            <Users className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="text-2xl font-bold font-mono text-amber-600">
                            {summary?.unassignedCount ?? 0}
                        </div>
                        <p className="text-[11px] text-slate-400">
                            Needs engineer assignment
                        </p>
                    </div>
                </div>

                {/* Recharts Analytics Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Status Distribution Bar Chart */}
                    <div className="lg:col-span-6 rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Open Incidents by Status
                        </h2>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.ticketsByStatus || []}>
                                    <XAxis dataKey="status" fontSize={11} stroke="#64748b" />
                                    <YAxis fontSize={11} stroke="#64748b" allowDecimals={false} />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#0f172a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Category Distribution Pie/Bar Chart */}
                    <div className="lg:col-span-6 rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Incidents by System Category
                        </h2>
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.ticketsByCategory || []} layout="vertical">
                                    <XAxis type="number" fontSize={11} stroke="#64748b" allowDecimals={false} />
                                    <YAxis dataKey="category" type="category" width={140} fontSize={10} stroke="#64748b" />
                                    <Tooltip />
                                    <Bar dataKey="count" fill="#0d9488" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Per-Agent Workload Table */}
                <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden space-y-3">
                    <div className="p-5 pb-0 flex items-center justify-between">
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Support Engineer Workload & Performance
                        </h2>
                        <span className="text-xs text-slate-400 font-mono">
                            Active Tier-1 & Tier-2 Engineers
                        </span>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                    <th className="py-3 px-5">Engineer Name</th>
                                    <th className="py-3 px-5">Active Tickets</th>
                                    <th className="py-3 px-5">Resolved / Closed</th>
                                    <th className="py-3 px-5">SLA Breached</th>
                                    <th className="py-3 px-5">Total Assigned</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 text-xs font-mono">
                                {data?.agentWorkload?.map((agent, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition">
                                        <td className="py-3.5 px-5 font-sans font-medium text-slate-900">
                                            {agent.agentName}
                                        </td>
                                        <td className="py-3.5 px-5 text-indigo-700 font-semibold">
                                            {agent.active}
                                        </td>
                                        <td className="py-3.5 px-5 text-emerald-700">
                                            {agent.resolved}
                                        </td>
                                        <td className="py-3.5 px-5 text-red-600 font-bold">
                                            {agent.breached}
                                        </td>
                                        <td className="py-3.5 px-5 text-slate-700">
                                            {agent.total}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}