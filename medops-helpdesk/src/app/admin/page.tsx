"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { StatCard } from "@/components/ui/stat-card";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { CreateCategoryModal } from "@/components/create-category-modal";
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
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
    RefreshCw, Zap, UserPlus, Clock,
} from "lucide-react";

interface TicketItem {
    _id: string;
    title: string;
    status: string;
    priority: string;
    category?: { name: string };
    assignedAgent?: { _id: string; name: string; email: string };
    createdAt: string;
    slaBreached: boolean;
}

interface AgentItem {
    _id: string;
    name: string;
    email: string;
}

interface CategoryItem {
    _id: string;
    name: string;
    description: string;
    defaultPriority: "Low" | "Medium" | "High" | "Urgent";
}

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
    tickets: TicketItem[];
    agents: AgentItem[];
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
            <DialogTrigger className="h-10 px-4 rounded-xl bg-[#00D084] hover:bg-[#00BC76] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer">
                <UserPlus className="h-4 w-4" />
                Add Staff / Agent
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-lg font-bold text-slate-900">Create Staff Account</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Full Name</Label>
                        <Input required placeholder="Alex System Engineer" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Email</Label>
                        <Input required type="email" placeholder="alex@medops.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Password</Label>
                        <Input required type="text" placeholder="Initial password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-semibold text-slate-700">Role</Label>
                        <Select value={form.role} onValueChange={(val) => setForm({ ...form, role: val ?? "agent" })}>
                            <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                            <SelectContent className="z-[9999]">
                                <SelectItem value="agent">Support Agent</SelectItem>
                                <SelectItem value="admin">System Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit" disabled={loading} className="w-full bg-[#6052E9] hover:bg-[#4F46E5] text-white rounded-xl h-10 font-semibold">
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
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [assigningTicketId, setAssigningTicketId] = useState<string | null>(null);

    const hasFetchedRef = useRef(false);

    const fetchAnalytics = useCallback(async () => {
        try {
            const [analyticsRes, catRes] = await Promise.all([
                fetch("/api/admin/analytics", { cache: "no-store" }),
                fetch("/api/categories", { cache: "no-store" }),
            ]);

            if (analyticsRes.ok) {
                const json = await analyticsRes.json();
                setData(json);
            }
            if (catRes.ok) {
                const catJson = await catRes.json();
                if (catJson.categories) setCategories(catJson.categories);
            }
        } catch (error) {
            console.error("Admin analytics error:", error);
            toast.error("Could not load analytics data");
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

    async function handleAssignAgent(ticketId: string, agentId: string) {
        setAssigningTicketId(ticketId);
        try {
            // Correct PATCH endpoint to /api/tickets/[id] with assignedAgent
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignedAgent: agentId === "UNASSIGNED" ? null : agentId }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || "Failed to assign agent");

            toast.success("Task successfully assigned to engineer!");
            fetchAnalytics();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Assignment failed";
            toast.error(message);
        } finally {
            setAssigningTicketId(null);
        }
    }

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

    if (sessionStatus === "loading" || loading) {
        return (
            <div className="min-h-screen bg-[#F4F6FB] flex items-center justify-center text-xs text-slate-500 font-sans">
                Loading MedOps Admin Command Center...
            </div>
        );
    }

    const summary = data?.summary;
    const totalTickets = summary?.totalTickets ?? 0;
    const openTickets = summary?.openTicketsCount ?? 0;
    const slaBreaches = summary?.slaBreachCount ?? 0;
    const complianceRate = totalTickets > 0 ? Math.round(((totalTickets - slaBreaches) / totalTickets) * 100) : 98;
    const assignedCount = totalTickets - (summary?.unassignedCount ?? 0);
    const assignedRate = totalTickets > 0 ? Math.round((assignedCount / totalTickets) * 100) : 85;

    return (
        <DashboardShell
            title="Admin Command & SOC Analytics"
            subtitle="Hospital IT Security Operations Center • System-wide control, staff dispatch & SLA compliance"
            action={
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={fetchAnalytics}
                        title="Refresh data"
                        className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <button
                        onClick={handleManualSlaSync}
                        disabled={syncing}
                        className="h-10 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                    >
                        <Zap className="h-3.5 w-3.5 text-[#00D2B4]" />
                        <span className="hidden sm:inline">{syncing ? "Syncing..." : "Run SLA Sync"}</span>
                    </button>

                    <CreateCategoryModal onCreated={fetchAnalytics} />
                    <CreateStaffModal onCreated={fetchAnalytics} />
                </div>
            }
        >
            <div className="space-y-6 w-full min-w-0">
                {/* 1. Overlapping Top Stat Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full min-w-0">
                    <StatCard
                        label="Total Hospital Incidents"
                        value={totalTickets}
                        change="+12.5%"
                        isPositive={true}
                        subtitle="Across all medical clinics"
                    />
                    <StatCard
                        label="Open Incident Queue"
                        value={openTickets}
                        change="-12.5%"
                        isPositive={false}
                        subtitle="Under active triage"
                    />
                    <StatCard
                        label="SLA Breaches"
                        value={slaBreaches}
                        change={slaBreaches > 0 ? "ACTION NEEDED" : "COMPLIANT"}
                        isPositive={slaBreaches === 0}
                        subtitle="Target: 0 breaches"
                    />
                    <StatCard
                        label="Avg Response Time"
                        value={`${summary?.avgFirstResponseMinutes ?? 12}m`}
                        change="+12.5%"
                        isPositive={true}
                        subtitle="Target < 60 mins"
                    />
                </div>

                {/* 2. Middle Row: Status & Category Charts + Target Radial Gauges */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
                    {/* Left 7 cols: Status Breakdown Chart */}
                    <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo flex flex-col justify-between w-full min-w-0 overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">
                                Incidents Distribution by Status
                            </h3>
                            <span className="text-xs font-medium text-slate-400">Real-time Overview</span>
                        </div>

                        <div className="h-60 w-full min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data?.ticketsByStatus || []}
                                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F4F9" />
                                    <XAxis dataKey="status" fontSize={11} stroke="#94A3B8" axisLine={false} tickLine={false} />
                                    <YAxis fontSize={11} stroke="#94A3B8" allowDecimals={false} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: "#141738",
                                            borderRadius: "12px",
                                            border: "none",
                                            color: "#FFFFFF",
                                            fontSize: "12px",
                                            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
                                        }}
                                        cursor={{ fill: "rgba(96, 82, 233, 0.04)" }}
                                    />
                                    <Bar dataKey="count" fill="#6052E9" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                            <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded-xs bg-[#6052E9]" />
                                <span>Active Incident Volume</span>
                            </div>
                        </div>
                    </div>

                    {/* Right 5 cols: Two Radial Progress Gauges */}
                    <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
                        <RadialGauge
                            title="Hospital SLA Compliance"
                            percentage={complianceRate}
                            strokeColor="#00C975"
                            legendLabel="Compliance Met"
                        />
                        <RadialGauge
                            title="Engineer Assignment"
                            percentage={assignedRate}
                            strokeColor="#3B82F6"
                            legendLabel="Assigned Tickets"
                        />
                    </div>
                </div>

                {/* 3. Task Assignment Table */}
                <div id="assignment" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                Clinical Support Requests & Task Assignment
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Assign or reassign pending hospital incident requests to active engineers
                            </p>
                        </div>
                        <Badge variant="outline" className="text-xs font-mono rounded-lg px-2.5 py-1 w-fit">
                            {data?.tickets?.length ?? 0} Total Requests
                        </Badge>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-100 w-full min-w-0 max-w-full">
                        <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full text-left border-collapse min-w-[700px]">
                                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="py-3 px-4">Title / Issue</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">Priority</th>
                                        <th className="py-3 px-4">Assigned Engineer</th>
                                        <th className="py-3 px-4 text-right">Dispatch / Assign</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {data?.tickets && data.tickets.length > 0 ? (
                                        data.tickets.map((ticket) => (
                                            <tr key={ticket._id} className="hover:bg-slate-50/80 transition-colors">
                                                <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs truncate">
                                                    {ticket.title}
                                                    {ticket.slaBreached && (
                                                        <span className="ml-2 text-[10px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md font-mono">
                                                            SLA BREACHED
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-slate-600 font-medium">
                                                    {ticket.category?.name || "General"}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge variant="outline" className="text-[10px] font-medium capitalize rounded-md">
                                                        {ticket.status}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                                        ticket.priority === "Urgent" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-700"
                                                    }`}>
                                                        {ticket.priority}
                                                    </span>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {ticket.assignedAgent ? (
                                                        <span className="text-[#6052E9] font-bold">
                                                            {ticket.assignedAgent.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-amber-600 font-medium italic">Unassigned</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <Select
                                                        defaultValue={ticket.assignedAgent?._id || "UNASSIGNED"}
                                                        onValueChange={(agentId) => {
                                                            if (agentId) handleAssignAgent(ticket._id, agentId);
                                                        }}
                                                        disabled={assigningTicketId === ticket._id}
                                                    >
                                                        <SelectTrigger className="h-8 w-44 text-xs rounded-xl border-slate-200 bg-slate-50/60 ml-auto">
                                                            <SelectValue placeholder="Assign Agent..." />
                                                        </SelectTrigger>
                                                        <SelectContent className="z-[9999]">
                                                            <SelectItem value="UNASSIGNED">-- Unassigned --</SelectItem>
                                                            {data.agents?.map((agent) => (
                                                                <SelectItem key={agent._id} value={agent._id} className="text-xs">
                                                                    {agent.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                                                No support requests found in the system.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 4. Support Engineer Workload Table */}
                <div id="users" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                Support Engineer Workload & Performance
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Active assignments, resolved count, and SLA breach tracking per engineer
                            </p>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-100 w-full min-w-0 max-w-full">
                        <div className="overflow-x-auto w-full max-w-full">
                            <table className="w-full text-left border-collapse min-w-[500px]">
                                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="py-3 px-5">Engineer Name</th>
                                        <th className="py-3 px-5">Active Tickets</th>
                                        <th className="py-3 px-5">Resolved</th>
                                        <th className="py-3 px-5">Breached</th>
                                        <th className="py-3 px-5">Total Handled</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {data?.agentWorkload?.map((a, i) => (
                                        <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                                            <td className="py-3 px-5 font-semibold text-slate-800 flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-lg bg-purple-50 text-[#6052E9] font-bold flex items-center justify-center text-[10px]">
                                                    {a.agentName.slice(0, 2).toUpperCase()}
                                                </div>
                                                <span>{a.agentName}</span>
                                            </td>
                                            <td className="py-3 px-5 font-bold text-[#6052E9]">{a.active}</td>
                                            <td className="py-3 px-5 font-bold text-emerald-600">{a.resolved}</td>
                                            <td className="py-3 px-5 font-bold text-rose-600">{a.breached}</td>
                                            <td className="py-3 px-5 font-bold text-slate-700">{a.total}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* 5. Clinical Categories & SLA Matrix */}
                <div id="categories" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                Clinical Categories & SLA Response Policy
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                Managed healthcare IT scopes and their assigned response and resolution windows
                            </p>
                        </div>
                        <CreateCategoryModal onCreated={fetchAnalytics} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 w-full min-w-0">
                        {categories.map((cat) => (
                            <div key={cat._id} className="p-4 rounded-xl border border-slate-100 bg-[#F8FAFC] flex flex-col justify-between space-y-3">
                                <div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="font-bold text-slate-900 text-sm">
                                            {cat.name}
                                        </span>
                                        <Badge
                                            variant="outline"
                                            className={`text-[10px] rounded-md ${
                                                cat.defaultPriority === "Urgent"
                                                    ? "bg-rose-50 text-rose-700 border-rose-200 font-bold"
                                                    : cat.defaultPriority === "High"
                                                    ? "bg-orange-50 text-orange-700 border-orange-200"
                                                    : "bg-blue-50 text-blue-700 border-blue-200"
                                            }`}
                                        >
                                            {cat.defaultPriority}
                                        </Badge>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed line-clamp-2">
                                        {cat.description}
                                    </p>
                                </div>

                                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-mono">
                                    <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3 text-[#6052E9]" />
                                        <span>
                                            {cat.defaultPriority === "Urgent"
                                                ? "1h Resp / 8h Res"
                                                : cat.defaultPriority === "High"
                                                ? "4h Resp / 24h Res"
                                                : cat.defaultPriority === "Medium"
                                                ? "8h Resp / 48h Res"
                                                : "24h Resp / 72h Res"}
                                        </span>
                                    </div>
                                    <span className="text-emerald-600 font-semibold">Active Policy</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
