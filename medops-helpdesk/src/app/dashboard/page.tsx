"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { SLACountdown } from "@/components/sla-countdown";
import { CreateTicketModal } from "@/components/create-ticket-modal";
import { StatCard } from "@/components/ui/stat-card";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { AnalyticsBarChart } from "@/components/ui/analytics-bar-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Inbox,
    AlertCircle,
    ArrowUpRight,
    BarChart3,
} from "lucide-react";

interface TicketRow {
    _id: string;
    ticketNumber: string;
    title: string;
    priority: "Low" | "Medium" | "High" | "Urgent";
    status: "Open" | "In Progress" | "Waiting on User" | "Resolved" | "Closed";
    category?: { _id: string; name: string };
    createdBy?: { _id: string; name: string; email: string; facility?: string };
    assignedAgent?: { _id: string; name: string; email: string } | null;
    responseDueDate: string;
    resolutionDueDate: string;
    firstRespondedAt?: string | null;
    slaBreached: boolean;
    createdAt: string;
}

interface CategoryItem {
    _id: string;
    name: string;
    description: string;
    defaultPriority: "Low" | "Medium" | "High" | "Urgent";
}

export default function DashboardPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();

    const [tickets, setTickets] = useState<TicketRow[]>([]);
    const [categories, setCategories] = useState<CategoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [breachedOnly, setBreachedOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 8,
        totalCount: 0,
        totalPages: 1,
    });

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
        }
    }, [sessionStatus, router]);

    const fetchTickets = useCallback(async () => {
        try {
            setError("");
            const params = new URLSearchParams({
                page: String(page),
                limit: "8",
            });
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
            if (categoryFilter !== "ALL") params.set("category", categoryFilter);
            if (search.trim()) params.set("search", search.trim());
            if (breachedOnly) params.set("breached", "true");

            const res = await fetch(`/api/tickets?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to load tickets");
            } else {
                setTickets(data.tickets || []);
                setPagination(data.pagination || { page: 1, limit: 8, totalCount: 0, totalPages: 1 });
            }
        } catch {
            setError("Network error while fetching clinical tickets");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, priorityFilter, categoryFilter, search, breachedOnly]);

    useEffect(() => {
        if (sessionStatus !== "authenticated") return;
        const controller = new AbortController();

        fetch("/api/categories", { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (data.categories) setCategories(data.categories);
            })
            .catch(() => {});

        const params = new URLSearchParams({
            page: String(page),
            limit: "8",
        });
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
        if (categoryFilter !== "ALL") params.set("category", categoryFilter);
        if (search.trim()) params.set("search", search.trim());
        if (breachedOnly) params.set("breached", "true");

        fetch(`/api/tickets?${params.toString()}`, { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (data.tickets) {
                    setTickets(data.tickets);
                    setPagination(data.pagination || { page: 1, limit: 8, totalCount: 0, totalPages: 1 });
                }
            })
            .catch(() => {
                setError("Network error while fetching clinical tickets");
            })
            .finally(() => {
                setLoading(false);
            });

        return () => controller.abort();
    }, [sessionStatus, page, statusFilter, priorityFilter, categoryFilter, search, breachedOnly]);

    const priorityBadge = (p: string) => {
        switch (p) {
            case "Urgent":
                return "bg-rose-50 text-rose-700 border-rose-200 font-semibold";
            case "High":
                return "bg-orange-50 text-orange-700 border-orange-200 font-medium";
            case "Medium":
                return "bg-sky-50 text-sky-700 border-sky-200";
            default:
                return "bg-slate-50 text-slate-700 border-slate-200";
        }
    };

    const statusBadge = (s: string) => {
        switch (s) {
            case "Open":
                return "bg-purple-50 text-[#6052E9] border-purple-200 font-medium";
            case "In Progress":
                return "bg-blue-50 text-blue-700 border-blue-200";
            case "Waiting on User":
                return "bg-amber-50 text-amber-800 border-amber-200";
            case "Resolved":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "Closed":
                return "bg-slate-100 text-slate-500 border-slate-200";
            default:
                return "bg-slate-100 text-slate-700";
        }
    };

    const user = session?.user;
    const role = user?.role || "user";

    // Role-specific calculations
    const openCount = tickets.filter((t) => t.status === "Open" || t.status === "In Progress").length;
    const waitingUserCount = tickets.filter((t) => t.status === "Waiting on User").length;
    const resolvedCount = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;
    const breachedCount = tickets.filter((t) => t.slaBreached).length;
    const urgentCount = tickets.filter((t) => t.priority === "Urgent").length;
    const resolutionPercentage = pagination.totalCount > 0 ? Math.round((resolvedCount / pagination.totalCount) * 100) : 85;

    // Page titles & descriptions tailored to each role
    const pageHeaders = {
        admin: {
            title: "Master Clinical Incident Queue",
            subtitle: "System-wide clinical incident oversight across all clinics, agents, and SLA targets",
        },
        agent: {
            title: "Assigned Incident Queue & SLA Command",
            subtitle: "Incidents assigned to your queue with active real-time SLA resolution countdowns",
        },
        user: {
            title: "Overview",
            subtitle: `Welcome back, ${user?.name || "User"} • ${user?.facility || "Main Medical Center"}`,
        },
    }[role] || {
        title: "Overview",
        subtitle: "Real-time healthcare IT support management",
    };

    return (
        <DashboardShell
            title={pageHeaders.title}
            subtitle={pageHeaders.subtitle}
            sidebarAction={
                (role === "user" || role === "admin") ? (
                    <CreateTicketModal
                        categories={categories}
                        onCreated={() => {
                            setPage(1);
                            fetchTickets();
                        }}
                        triggerText="Create Ticket"
                        triggerClassName="w-full h-10 px-4 rounded-xl bg-[#00D084] hover:bg-[#00BC76] text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer"
                    />
                ) : undefined
            }
            action={
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        onClick={fetchTickets}
                        title="Refresh data"
                        className="h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    {role === "admin" && (
                        <Link
                            href="/admin"
                            className="h-10 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                        >
                            <BarChart3 className="h-3.5 w-3.5 text-[#00D2B4]" />
                            <span>Admin Analytics</span>
                        </Link>
                    )}

                    {(role === "user" || role === "admin") && (
                        <CreateTicketModal
                            categories={categories}
                            onCreated={() => {
                                setPage(1);
                                fetchTickets();
                            }}
                        />
                    )}
                </div>
            }
        >
            <div className="space-y-6 w-full min-w-0">
                {/* 1. ROLE-SPECIFIC OVERLAPPING METRICS CARDS */}
                {role === "user" ? (
                    /* User Cards: Total Tickets, In Progress, Awaiting Reply, Resolved */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full min-w-0">
                        <StatCard
                            label="Total Tickets"
                            value={pagination.totalCount}
                            change="+12.5%"
                            isPositive={true}
                            subtitle="All reported incidents"
                        />
                        <StatCard
                            label="In Progress"
                            value={openCount}
                            change={openCount > 0 ? "Under Review" : "All Clear"}
                            isPositive={openCount === 0}
                            subtitle="Assigned to SOC engineers"
                        />
                        <StatCard
                            label="Awaiting Reply"
                            value={waitingUserCount}
                            change={waitingUserCount > 0 ? "Action Needed" : "Up to date"}
                            isPositive={waitingUserCount === 0}
                            subtitle="Engineer requested info"
                        />
                        <StatCard
                            label="Resolved Tickets"
                            value={resolvedCount}
                            change={`${resolutionPercentage}%`}
                            isPositive={true}
                            subtitle="Completed incidents"
                        />
                    </div>
                ) : role === "agent" ? (
                    /* Agent Cards: My Workload, Urgent <1h, SLA Breached, Resolution Rate */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full min-w-0">
                        <StatCard
                            label="My Assigned Queue"
                            value={pagination.totalCount}
                            change="+Active"
                            isPositive={true}
                            subtitle="Clinical tickets assigned to me"
                        />
                        <StatCard
                            label="Urgent Priority (1h SLA)"
                            value={urgentCount}
                            change={urgentCount > 0 ? "CRITICAL" : "None"}
                            isPositive={urgentCount === 0}
                            subtitle="Strict 1-hour response window"
                        />
                        <StatCard
                            label="SLA Breaches"
                            value={breachedCount}
                            change={breachedCount > 0 ? "ACTION NEEDED" : "COMPLIANT"}
                            isPositive={breachedCount === 0}
                            subtitle="Resolution deadline target"
                        />
                        <StatCard
                            label="My Resolution Rate"
                            value={`${resolutionPercentage}%`}
                            change="+12.5%"
                            isPositive={true}
                            subtitle="Resolved within deadline"
                        />
                    </div>
                ) : (
                    /* Admin Cards: Total System, Active Queue, Breached, Unassigned */
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full min-w-0">
                        <StatCard
                            label="Total Hospital Incidents"
                            value={pagination.totalCount}
                            change="+12.5%"
                            isPositive={true}
                            subtitle="Across all clinical clinics"
                        />
                        <StatCard
                            label="Active System Workload"
                            value={openCount}
                            change="-12.5%"
                            isPositive={false}
                            subtitle="Under active triage"
                        />
                        <StatCard
                            label="System SLA Breaches"
                            value={breachedCount}
                            change={breachedCount > 0 ? "Alert" : "Compliant"}
                            isPositive={breachedCount === 0}
                            subtitle="Target: 0 critical breaches"
                        />
                        <StatCard
                            label="Resolution Rate"
                            value={`${resolutionPercentage}%`}
                            change="+12.5%"
                            isPositive={true}
                            subtitle="Target: > 90%"
                        />
                    </div>
                )}

                {/* 2. MIDDLE WIDGETS (Agent & Admin Only) */}
                {role !== "user" && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full min-w-0">
                        <div className="lg:col-span-7 w-full min-w-0">
                            <AnalyticsBarChart title={role === "agent" ? "My Incident Workload Overview" : "Hospital Incidents Overview"} />
                        </div>

                        <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full min-w-0">
                            <RadialGauge
                                title="SLA Compliance Target"
                                percentage={82}
                                strokeColor="#00C975"
                                legendLabel="SLA Met on Time"
                            />
                            <RadialGauge
                                title="1-Hour Response Target"
                                percentage={94}
                                strokeColor="#3B82F6"
                                legendLabel="Response < 1h"
                            />
                        </div>
                    </div>
                )}

                {/* 3. INCIDENT TABLE CONTAINER */}
                <div id="tickets" className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-5 w-full min-w-0 overflow-hidden">
                    {/* Header & Role-Tailored Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                    {role === "agent"
                                        ? "Assigned Clinical Incident Queue"
                                        : role === "admin"
                                        ? "Hospital Clinical Incident Queue"
                                        : "My Tickets"}
                                </h2>
                                {role === "user" && pagination.totalCount > 0 && (
                                    <span className="text-[11px] bg-purple-50 text-[#6052E9] font-bold px-2 py-0.5 rounded-full border border-purple-100">
                                        {pagination.totalCount} total
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {role === "agent"
                                    ? "Showing tickets assigned to your queue with active SLA countdown timers"
                                    : role === "admin"
                                    ? "Full hospital clinical tickets view with assignee dispatch controls"
                                    : "Recent incident reports at a glance"}
                            </p>
                        </div>

                        {/* Search & Filters */}
                        {role === "user" ? (
                            <div className="flex items-center gap-2.5">
                                <Link
                                    href="/tickets"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-[#6052E9] bg-purple-50 hover:bg-purple-100 border border-purple-100 rounded-xl transition"
                                >
                                    <span>View All in My Tickets</span>
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2.5">
                                <div className="relative min-w-[180px]">
                                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        placeholder="Search TKT or title..."
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                            setPage(1);
                                        }}
                                        className="pl-8 h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                                    />
                                </div>

                                <Select
                                    value={statusFilter}
                                    onValueChange={(v) => {
                                        if (v) {
                                            setStatusFilter(v);
                                            setPage(1);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 w-[125px]">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Statuses</SelectItem>
                                        <SelectItem value="Open">Open</SelectItem>
                                        <SelectItem value="In Progress">In Progress</SelectItem>
                                        <SelectItem value="Waiting on User">Waiting on User</SelectItem>
                                        <SelectItem value="Resolved">Resolved</SelectItem>
                                        <SelectItem value="Closed">Closed</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={priorityFilter}
                                    onValueChange={(v) => {
                                        if (v) {
                                            setPriorityFilter(v);
                                            setPage(1);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 w-[125px]">
                                        <SelectValue placeholder="Priority" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Priorities</SelectItem>
                                        <SelectItem value="Urgent">Urgent (1h SLA)</SelectItem>
                                        <SelectItem value="High">High (4h SLA)</SelectItem>
                                        <SelectItem value="Medium">Medium (8h SLA)</SelectItem>
                                        <SelectItem value="Low">Low (24h SLA)</SelectItem>
                                    </SelectContent>
                                </Select>

                                <Select
                                    value={categoryFilter}
                                    onValueChange={(v) => {
                                        if (v) {
                                            setCategoryFilter(v);
                                            setPage(1);
                                        }
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50 w-[135px]">
                                        <SelectValue placeholder="Category" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ALL">All Categories</SelectItem>
                                        {categories.map((c) => (
                                            <SelectItem key={c._id} value={c._id}>
                                                {c.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setBreachedOnly(!breachedOnly);
                                        setPage(1);
                                    }}
                                    className={`h-9 px-3 rounded-xl border text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                        breachedOnly
                                            ? "bg-rose-50 border-rose-300 text-rose-700"
                                            : "bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100"
                                    }`}
                                >
                                    {breachedCount > 0 && (
                                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                    )}
                                    SLA Breached Only
                                </button>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-xs text-red-700">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Table View */}
                    <div className="overflow-hidden rounded-xl border border-slate-100 w-full min-w-0 max-w-full">
                        {loading ? (
                            <div className="p-12 text-center text-xs text-slate-400">
                                Loading clinical queue...
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <Inbox className="h-9 w-9 text-slate-300 mx-auto" />
                                <div className="text-sm font-semibold text-slate-700">
                                    No incident tickets found
                                </div>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                    {role === "user"
                                        ? "You haven't reported any incidents matching this criteria."
                                        : "No tickets match your current filters."}
                                </p>
                                {role === "user" && (
                                    <div className="pt-2">
                                        <CreateTicketModal
                                            categories={categories}
                                            onCreated={() => {
                                                setPage(1);
                                                fetchTickets();
                                            }}
                                            triggerText="Create Ticket"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            <th className="py-3 px-4">Ticket</th>
                                            <th className="py-3 px-4">Incident Name</th>
                                            {role !== "user" && <th className="py-3 px-4">Category</th>}
                                            <th className="py-3 px-4">Priority</th>
                                            <th className="py-3 px-4">Status</th>
                                            {role !== "user" && <th className="py-3 px-4">SLA Countdown</th>}
                                            {role !== "user" && (
                                                <th className="py-3 px-4">Requester & Facility</th>
                                            )}
                                            <th className="py-3 px-4 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs">
                                        {tickets.map((t) => (
                                            <tr
                                                key={t._id}
                                                className="hover:bg-slate-50/80 transition-colors group"
                                            >
                                                <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                    <Link
                                                        href={`/tickets/${t._id}`}
                                                        className="text-[#6052E9] hover:underline"
                                                    >
                                                        {t.ticketNumber}
                                                    </Link>
                                                </td>

                                                <td className="py-3.5 px-4 max-w-xs">
                                                    <Link
                                                        href={`/tickets/${t._id}`}
                                                        className="font-semibold text-slate-800 group-hover:text-[#6052E9] line-clamp-1"
                                                    >
                                                        {t.title}
                                                    </Link>
                                                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                        Logged {new Date(t.createdAt).toLocaleDateString()}
                                                    </div>
                                                </td>

                                                {role !== "user" && (
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-medium">
                                                        {t.category?.name || "General IT"}
                                                    </td>
                                                )}

                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[11px] rounded-lg px-2 py-0.5 ${priorityBadge(
                                                            t.priority
                                                        )}`}
                                                    >
                                                        {t.priority}
                                                    </Badge>
                                                </td>

                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-[11px] rounded-lg px-2 py-0.5 ${statusBadge(
                                                            t.status
                                                        )}`}
                                                    >
                                                        {t.status}
                                                    </Badge>
                                                </td>

                                                {role !== "user" && (
                                                    <td className="py-3.5 px-4 whitespace-nowrap">
                                                        <SLACountdown
                                                            status={t.status}
                                                            responseDueDate={t.responseDueDate}
                                                            resolutionDueDate={t.resolutionDueDate}
                                                            firstRespondedAt={t.firstRespondedAt}
                                                            slaBreached={t.slaBreached}
                                                        />
                                                    </td>
                                                )}

                                                {role !== "user" && (
                                                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                                                        <div>
                                                            <span className="font-semibold text-slate-800">
                                                                {t.createdBy?.name || "Requester"}
                                                            </span>
                                                            <div className="text-[10px] text-slate-400 truncate">
                                                                {t.createdBy?.facility || "Main Clinic"}
                                                            </div>
                                                        </div>
                                                    </td>
                                                )}

                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <Link
                                                        href={`/tickets/${t._id}`}
                                                        className="inline-flex items-center gap-1 text-xs font-bold text-[#6052E9] hover:text-[#4F46E5] bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors"
                                                    >
                                                        {role === "agent" ? "Triage" : "View"}
                                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Pagination / Footer */}
                        {role === "user" ? (
                            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                                <span>Showing {tickets.length} recent clinical incidents</span>
                                <Link
                                    href="/tickets"
                                    className="font-bold text-[#6052E9] hover:underline inline-flex items-center gap-1"
                                >
                                    <span>View all tickets in My Tickets</span>
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                </Link>
                            </div>
                        ) : (
                            <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3.5 flex items-center justify-between text-xs text-slate-500">
                                <div>
                                    Page <span className="font-bold text-slate-800">{pagination.page}</span> of{" "}
                                    <span className="font-bold text-slate-800">{pagination.totalPages}</span> (
                                    {pagination.totalCount} incidents)
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1 || loading}
                                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                                        className="h-8 px-2.5 text-xs rounded-lg"
                                    >
                                        <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                                        Prev
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= pagination.totalPages || loading}
                                        onClick={() => setPage((p) => p + 1)}
                                        className="h-8 px-2.5 text-xs rounded-lg"
                                    >
                                        Next
                                        <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
