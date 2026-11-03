"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { RadialGauge } from "@/components/ui/radial-gauge";
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
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
    RefreshCw, Zap, UserPlus, ArrowRight, Layers, UserCheck, CheckCircle2,
} from "lucide-react";

interface TicketSummaryItem {
    _id: string;
    ticketNumber: string;
    title: string;
    status: string;
    priority: string;
    category?: { name: string };
    createdBy?: { name: string; email: string; facility?: string };
    assignedAgent?: { _id: string; name: string; email: string };
    createdAt: string;
    slaBreached: boolean;
}

interface AnalyticsData {
    summary: {
        totalTickets: number;
        openTickets: number;
        inProgressTickets: number;
        resolvedClosedTickets: number;
        slaBreachCount: number;
        slaComplianceRate: number;
        avgFirstResponseMinutes: number;
        unassignedCount: number;
    };
    ticketsByStatus: {
        status: string;
        count: number;
        percentage: number;
        color: string;
        badgeClass: string;
    }[];
    conversationFlow: {
        day: string;
        date: string;
        incoming: number;
        conversations: number;
        resolved: number;
    }[];
    ticketsByCategory: { category: string; count: number }[];
    agentWorkload: {
        agentId: string;
        agentName: string;
        facility: string;
        active: number;
        resolved: number;
        breached: number;
        total: number;
    }[];
    unassignedTickets: TicketSummaryItem[];
    agents: {
        _id: string;
        name: string;
        email: string;
    }[];
}

function CreateStaffModal({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "agent",
        facility: "Main Medical Center",
    });
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to create staff account");
            } else {
                toast.success(`${form.role.toUpperCase()} account created successfully!`);
                setForm({
                    name: "",
                    email: "",
                    password: "",
                    role: "agent",
                    facility: "Main Medical Center",
                });
                setOpen(false);
                onCreated();
            }
        } catch {
            toast.error("Network error while creating staff account");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-[#00D084] hover:bg-[#00BC76] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer">
                <UserPlus className="h-4 w-4" />
                <span>Add Agent</span>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-900">
                        Add New Support Engineer / Agent
                    </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Full Name</Label>
                        <Input
                            required
                            placeholder="e.g. Dr. Alex Morgan"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="rounded-xl text-xs"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
                        <Input
                            required
                            type="email"
                            placeholder="alex.morgan@hospital.org"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            className="rounded-xl text-xs"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Initial Password</Label>
                        <Input
                            required
                            type="text"
                            placeholder="Temporary secure password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            className="rounded-xl text-xs"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Role</Label>
                            <Select
                                value={form.role}
                                onValueChange={(val) => setForm({ ...form, role: val ?? "agent" })}
                            >
                                <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent className="z-[9999]">
                                    <SelectItem value="agent">Support Agent</SelectItem>
                                    <SelectItem value="admin">System Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold text-slate-700">Facility</Label>
                            <Input
                                placeholder="Main Medical Center"
                                value={form.facility}
                                onChange={(e) => setForm({ ...form, facility: e.target.value })}
                                className="rounded-xl text-xs"
                            />
                        </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#5b4fe9] hover:bg-[#4a3ecc] text-white rounded-xl h-10 font-bold text-xs"
                    >
                        {loading ? "Creating Account..." : "Create Staff Account"}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminOverviewPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);

    const hasFetchedRef = useRef(false);

    const fetchAnalytics = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/analytics", { cache: "no-store" });
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (error) {
            console.error("Admin analytics error:", error);
            toast.error("Could not load command center analytics");
        } finally {
            setLoading(false);
        }
    }, []);

    const userRole = session?.user?.role;

    useEffect(() => {
        if (sessionStatus === "loading") return;

        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }

        if (sessionStatus === "authenticated") {
            if (userRole !== "admin") {
                router.push("/dashboard");
                return;
            }

            if (!hasFetchedRef.current) {
                hasFetchedRef.current = true;
                fetchAnalytics();
            }
        }
    }, [sessionStatus, userRole, router, fetchAnalytics]);

    async function handleManualSlaSync() {
        setSyncing(true);
        try {
            const res = await fetch("/api/cron/sla-check", { method: "POST" });
            const json = await res.json();
            if (res.ok) {
                toast.success(`SLA Synced: ${json.newlyBreached} breached, ${json.autoClosedCount} auto-closed`);
                fetchAnalytics();
            }
        } finally {
            setSyncing(false);
        }
    }

    async function handleAssignEngineer(ticketId: string, agentId: string) {
        if (!agentId || agentId === "UNASSIGNED") return;
        setAssigningTicketId(ticketId);
        try {
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignedAgent: agentId }),
            });
            const resData = await res.json();
            if (!res.ok) throw new Error(resData.error || "Failed to assign engineer");

            toast.success("Incident assigned to support engineer!");
            // Instantly remove ticket from the unassigned list in state
            setData((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    unassignedTickets: prev.unassignedTickets.filter((t) => t._id !== ticketId),
                    summary: {
                        ...prev.summary,
                        unassignedCount: Math.max(0, prev.summary.unassignedCount - 1),
                    },
                };
            });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Assignment failed";
            toast.error(msg);
        } finally {
            setAssigningTicketId(null);
        }
    }

    if (sessionStatus === "loading" || loading) {
        return (
            <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center text-xs text-slate-500 font-sans">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-[#5b4fe9] border-t-transparent animate-spin" />
                    <span>Loading Admin Command Center & Analytics...</span>
                </div>
            </div>
        );
    }

    const summary = data?.summary;
    const totalTickets = summary?.totalTickets ?? 0;
    const openTickets = summary?.openTickets ?? 0;
    const inProgressTickets = summary?.inProgressTickets ?? 0;
    const resolvedClosedTickets = summary?.resolvedClosedTickets ?? 0;
    const complianceRate = summary?.slaComplianceRate ?? 100;

    const priorityBadge = (p: string) => {
        switch (p) {
            case "Urgent":
                return "bg-rose-50 text-rose-700 border-rose-200";
            case "High":
                return "bg-orange-50 text-orange-700 border-orange-200";
            case "Medium":
                return "bg-sky-50 text-sky-700 border-sky-200";
            default:
                return "bg-slate-50 text-slate-700 border-slate-200";
        }
    };

    return (
        <DashboardShell
            title="Overview"

            action={
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    <button
                        onClick={fetchAnalytics}
                        title="Refresh data"
                        className="h-9 sm:h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <button
                        onClick={handleManualSlaSync}
                        disabled={syncing}
                        className="h-9 sm:h-10 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                    >
                        <Zap className="h-3.5 w-3.5 text-[#00D2B4]" />
                        <span className="hidden sm:inline">{syncing ? "Syncing..." : "Run SLA Sync"}</span>
                    </button>

                    <CreateStaffModal onCreated={fetchAnalytics} />
                </div>
            }
        >
            <div className="space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
                {/* 1. 4 Top KPI Cards (Total, Open, In Progress, Resolved & Closed) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 w-full min-w-0">
                    <StatCard
                        label="Total Incidents"
                        value={totalTickets}
                        change="+12.5%"
                        isPositive={true}
                        subtitle="All hospital logged tickets"
                    />
                    <StatCard
                        label="Open Tickets"
                        value={openTickets}
                        change="-4.2%"
                        isPositive={true}
                        subtitle="Awaiting triage & engineer"
                    />
                    <StatCard
                        label="In Progress"
                        value={inProgressTickets}
                        change="+8.1%"
                        isPositive={false}
                        subtitle="Under active investigation"
                    />
                    <StatCard
                        label="Resolved & Closed"
                        value={resolvedClosedTickets}
                        change="+19.4%"
                        isPositive={true}
                        subtitle="Successfully completed"
                    />
                </div>

                {/* 2. Middle Row: Conversation Flow Timeline & SLA Gauge */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
                    {/* Left 8 cols: Conversation & Incident Flow (AreaChart) */}
                    <div className="lg:col-span-8 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-baligo flex flex-col justify-between w-full min-w-0 overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                                    Conversation & Ticket Flow
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">
                                    7-day volume of incoming clinical requests, replies & resolutions
                                </p>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#5b4fe9]" />
                                    <span>Incoming</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                                    <span>Conversations</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#00d084]" />
                                    <span>Resolved</span>
                                </div>
                            </div>
                        </div>

                        <div className="h-64 sm:h-72 w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart
                                    data={data?.conversationFlow || []}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <defs>
                                        <linearGradient id="flowIncoming" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#5b4fe9" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#5b4fe9" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="flowConversations" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                                        </linearGradient>
                                        <linearGradient id="flowResolved" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#00d084" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#00d084" stopOpacity={0.0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F4F9" />
                                    <XAxis
                                        dataKey="day"
                                        fontSize={11}
                                        stroke="#94A3B8"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        fontSize={11}
                                        stroke="#94A3B8"
                                        allowDecimals={false}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#141738",
                                            borderRadius: "12px",
                                            border: "none",
                                            color: "#FFFFFF",
                                            fontSize: "12px",
                                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                                        }}
                                        cursor={{ stroke: "#5b4fe9", strokeWidth: 1, strokeDasharray: "4 4" }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="incoming"
                                        stroke="#5b4fe9"
                                        strokeWidth={2.5}
                                        fillOpacity={1}
                                        fill="url(#flowIncoming)"
                                        name="Incoming Tickets"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="conversations"
                                        stroke="#38bdf8"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#flowConversations)"
                                        name="Message Activity"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="resolved"
                                        stroke="#00d084"
                                        strokeWidth={2}
                                        fillOpacity={1}
                                        fill="url(#flowResolved)"
                                        name="Resolved Tickets"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Right 4 cols: SLA Compliance & Target Radial Gauges */}
                    <div className="lg:col-span-4 flex flex-col gap-4 w-full min-w-0">
                        <RadialGauge
                            title="SLA Compliance Rate"
                            percentage={complianceRate}
                            strokeColor="#00D084"
                            legendLabel="On-Time Resolution"
                        />
                        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-baligo flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    First Response Speed
                                </span>
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                    FAST
                                </Badge>
                            </div>
                            <div className="flex items-baseline gap-2 mt-2">
                                <span className="text-3xl font-extrabold text-slate-900 tracking-tight">
                                    {summary?.avgFirstResponseMinutes ?? 12}
                                </span>
                                <span className="text-sm font-semibold text-slate-400">minutes avg</span>
                            </div>
                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                                <span>Target: &lt; 60 mins</span>
                                <span className="text-emerald-600 font-bold">98% compliant</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Incidents Distribution by Status & Category Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
                    {/* Incidents Distribution by Status (7 cols) */}
                    <div className="lg:col-span-7 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-baligo flex flex-col justify-between w-full min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                                    Incidents Distribution by Status
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Real-time status breakdown across the helpdesk</p>
                            </div>
                            <Badge variant="outline" className="text-xs font-mono rounded-lg">
                                {totalTickets} Total
                            </Badge>
                        </div>

                        <div className="h-56 sm:h-64 w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data?.ticketsByStatus || []}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F4F9" />
                                    <XAxis
                                        dataKey="status"
                                        fontSize={11}
                                        stroke="#94A3B8"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        fontSize={11}
                                        stroke="#94A3B8"
                                        allowDecimals={false}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#141738",
                                            borderRadius: "12px",
                                            border: "none",
                                            color: "#FFFFFF",
                                            fontSize: "12px",
                                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                                        }}
                                        cursor={{ fill: "rgba(91, 79, 233, 0.05)" }}
                                    />
                                    <Bar dataKey="count" fill="#5b4fe9" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3 border-t border-slate-100">
                            {data?.ticketsByStatus?.map((st) => (
                                <div key={st.status} className="flex flex-col text-center p-2 rounded-xl bg-slate-50/80">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase truncate">
                                        {st.status}
                                    </span>
                                    <span className="text-sm font-extrabold text-slate-800 mt-0.5">
                                        {st.count}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {st.percentage}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Incidents by Clinical Category (5 cols) */}
                    <div className="lg:col-span-5 bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-baligo flex flex-col justify-between w-full min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                                    Clinical Categories
                                </h3>
                                <p className="text-xs text-slate-400 mt-0.5">Incidents categorized by medical domain</p>
                            </div>
                            <Layers className="h-4 w-4 text-slate-400" />
                        </div>

                        <div className="h-56 sm:h-64 w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={data?.ticketsByCategory || []}
                                    margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F4F9" />
                                    <XAxis type="number" fontSize={11} stroke="#94A3B8" axisLine={false} tickLine={false} />
                                    <YAxis
                                        type="category"
                                        dataKey="category"
                                        fontSize={11}
                                        stroke="#475569"
                                        axisLine={false}
                                        tickLine={false}
                                        width={95}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#141738",
                                            borderRadius: "12px",
                                            border: "none",
                                            color: "#FFFFFF",
                                            fontSize: "12px",
                                        }}
                                    />
                                    <Bar dataKey="count" fill="#00D084" radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                            <span>Top Category</span>
                            <span className="font-bold text-slate-800">
                                {data?.ticketsByCategory?.[0]?.category || "General Clinical"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* 4. UNASSIGNED HOSPITAL INCIDENTS QUEUE (Replacing generic recent list) */}
                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100/90 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                                    Unassigned Hospital Incidents
                                </h3>
                                {(data?.unassignedTickets?.length ?? 0) > 0 ? (
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                        {data?.unassignedTickets.length} Needs Assignment
                                    </span>
                                ) : (
                                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        All Dispatched
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Client & staff issues pending assignment to a support engineer
                            </p>
                        </div>
                        <Link
                            href="/admin/tickets"
                            className="inline-flex items-center gap-1 text-xs font-bold text-[#5b4fe9] hover:underline cursor-pointer"
                        >
                            <span>View All in Tickets</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-100 w-full min-w-0">
                        {data?.unassignedTickets?.length === 0 ? (
                            <div className="py-12 px-4 text-center">
                                <div className="flex flex-col items-center justify-center gap-2.5 max-w-md mx-auto">
                                    <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                                        <CheckCircle2 className="h-6 w-6 stroke-[2]" />
                                    </div>
                                    <span className="font-bold text-sm text-slate-800">
                                        All Hospital Incidents Dispatched!
                                    </span>
                                    <p className="text-xs text-slate-400 text-center leading-relaxed">
                                        Every incident reported by clinical staff has been assigned to an engineer. New incoming tickets will appear here automatically for dispatch.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <table className="w-full text-left border-collapse">
                                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="py-3 px-3 sm:px-4">Ticket</th>
                                        <th className="py-3 px-3 sm:px-4">Incident Name & Issue</th>
                                        <th className="hidden md:table-cell py-3 px-4">Priority</th>
                                        <th className="hidden lg:table-cell py-3 px-4">Reported By / Facility</th>
                                        <th className="py-3 px-3 sm:px-4">Assign Engineer</th>
                                        <th className="py-3 px-3 sm:px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {data?.unassignedTickets?.map((t) => (
                                        <tr key={t._id} className="hover:bg-slate-50/60 transition-colors">
                                            {/* Ticket Number */}
                                            <td className="py-3.5 px-3 sm:px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                <Link
                                                    href={`/tickets/${t._id}`}
                                                    className="hover:text-[#5b4fe9] transition-colors"
                                                >
                                                    {t.ticketNumber}
                                                </Link>
                                            </td>

                                            {/* Incident Title */}
                                            <td className="py-3.5 px-3 sm:px-4">
                                                <Link
                                                    href={`/tickets/${t._id}`}
                                                    className="font-bold text-slate-800 line-clamp-1 max-w-[180px] sm:max-w-xs hover:text-[#5b4fe9] transition-colors block"
                                                >
                                                    {t.title}
                                                </Link>
                                                <div className="sm:hidden flex items-center gap-1.5 mt-1">
                                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityBadge(t.priority)}`}>
                                                        {t.priority}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">
                                                        {t.createdBy?.name || "Staff"}
                                                    </span>
                                                </div>
                                            </td>

                                            {/* Priority (Desktop) */}
                                            <td className="hidden md:table-cell py-3.5 px-4 whitespace-nowrap">
                                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${priorityBadge(t.priority)}`}>
                                                    {t.priority}
                                                </span>
                                            </td>

                                            {/* Reporter & Facility (Desktop) */}
                                            <td className="hidden lg:table-cell py-3.5 px-4 text-slate-600">
                                                <div className="font-semibold text-slate-800 line-clamp-1">
                                                    {t.createdBy?.name || "Clinic Staff"}
                                                </div>
                                                <span className="text-slate-400 text-[10px] block line-clamp-1">
                                                    {t.createdBy?.facility || "Main Medical Center"}
                                                </span>
                                            </td>

                                            {/* Assign Engineer Dropdown */}
                                            <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                                                <Select
                                                    value="UNASSIGNED"
                                                    onValueChange={(val) => handleAssignEngineer(t._id, val ?? "")}
                                                    disabled={assigningTicketId === t._id}
                                                >
                                                    <SelectTrigger className="h-8 rounded-lg text-xs bg-slate-50 border-slate-200 w-36 sm:w-44 focus:ring-1 focus:ring-[#5b4fe9]">
                                                        <div className="flex items-center gap-1.5 truncate text-slate-600 font-medium">
                                                            <UserCheck className="h-3 w-3 text-slate-400 shrink-0" />
                                                            <span className="truncate">
                                                                {assigningTicketId === t._id ? "Assigning..." : "Assign Engineer..."}
                                                            </span>
                                                        </div>
                                                    </SelectTrigger>
                                                    <SelectContent className="z-[9999]">
                                                        <SelectItem value="UNASSIGNED" disabled>
                                                            Select Support Engineer
                                                        </SelectItem>
                                                        {data?.agents?.map((ag) => (
                                                            <SelectItem key={ag._id} value={ag._id}>
                                                                {ag.name}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </td>

                                            {/* Action View */}
                                            <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                                                <Link
                                                    href={`/tickets/${t._id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#5b4fe9] hover:text-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                                >
                                                    <span>View</span>
                                                    <ArrowRight className="h-3 w-3" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
