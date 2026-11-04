"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { fetchJson } from "@/lib/api-client";
import { ActivitySkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Activity,
    PlusCircle,
    MessageSquare,
    CheckCircle2,
    Clock,
    Lock,
    UserCheck,
    ArrowUpRight,
    RefreshCw,
    AlertCircle,
    Calendar,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface ActivityItem {
    _id: string;
    action: string;
    details: string;
    createdAt: string;
    actor?: {
        _id: string;
        name: string;
        email: string;
        role: "user" | "agent" | "admin";
        facility?: string;
    };
    ticket?: {
        _id: string;
        ticketNumber: string;
        title: string;
        priority: string;
        status: string;
    };
}

export default function AdminActivityPage() {
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();

    const [filter, setFilter] = useState<
        "ALL" | "TICKET_CREATED" | "REPLY_POSTED" | "STATUS_CHANGED" | "INTERNAL_NOTE_ADDED" | "ASSIGNED"
    >("ALL");
    const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.replace("/login");
        }
        if (sessionStatus === "authenticated" && session?.user?.role !== "admin") {
            router.replace("/dashboard");
        }
    }, [sessionStatus, session?.user?.role, router]);

    const params = new URLSearchParams({ page: String(page), limit: "12", dateRange });
    if (filter !== "ALL") params.set("action", filter);
    const activitiesQuery = useQuery({
        queryKey: ["activity", session?.user?.id, "admin", page, filter, dateRange],
        queryFn: ({ signal }) => fetchJson<{ activities: ActivityItem[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }>(`/api/activity?${params.toString()}`, { signal }),
        enabled: sessionStatus === "authenticated" && session?.user?.role === "admin",
    });
    const activities = activitiesQuery.data?.activities ?? [];
    const pagination = activitiesQuery.data?.pagination ?? { page: 1, limit: 12, totalCount: 0, totalPages: 1 };
    const loading = activitiesQuery.isPending;
    const error = activitiesQuery.error instanceof Error ? activitiesQuery.error.message : "";
    const fetchActivities = () => activitiesQuery.refetch();

    const getActionBadge = (action: string) => {
        switch (action) {
            case "TICKET_CREATED":
                return {
                    label: "Logged Incident",
                    icon: PlusCircle,
                    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
                    dotColor: "bg-[#5b4fe9]",
                };
            case "REPLY_POSTED":
                return {
                    label: "Public Message",
                    icon: MessageSquare,
                    color: "bg-sky-50 text-sky-700 border-sky-200",
                    dotColor: "bg-[#38bdf8]",
                };
            case "INTERNAL_NOTE_ADDED":
                return {
                    label: "Staff Internal Note",
                    icon: Lock,
                    color: "bg-amber-50 text-amber-700 border-amber-200",
                    dotColor: "bg-[#f59e0b]",
                };
            case "STATUS_CHANGED":
                return {
                    label: "Status Transition",
                    icon: CheckCircle2,
                    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    dotColor: "bg-[#00d084]",
                };
            case "ASSIGNED":
                return {
                    label: "Task Dispatched",
                    icon: UserCheck,
                    color: "bg-purple-50 text-purple-700 border-purple-200",
                    dotColor: "bg-purple-600",
                };
            default:
                return {
                    label: "System Event",
                    icon: Clock,
                    color: "bg-slate-50 text-slate-700 border-slate-200",
                    dotColor: "bg-slate-400",
                };
        }
    };

    const getRoleBadge = (role?: string) => {
        switch (role) {
            case "admin":
                return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">ADMIN</span>;
            case "agent":
                return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">ENGINEER</span>;
            default:
                return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">CLIENT</span>;
        }
    };

    return (
        <DashboardShell
            title="System Activity & Audit Trail"
            subtitle="Hospital Security Operations Log • Real-time stream of all user reports, engineer dispatch & status events"
            action={
                <button
                    onClick={fetchActivities}
                    title="Refresh activity"
                    className="h-9 sm:h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            }
        >
            <div className="space-y-5 w-full min-w-0 max-w-full overflow-x-hidden">
                {/* Filter Band with Event Types & Date Filter */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 w-full min-w-0">
                    {/* Action Filter Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                        <button
                            onClick={() => {
                                setFilter("ALL");
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                filter === "ALL"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                            }`}
                        >
                            All Events
                        </button>
                        <button
                            onClick={() => {
                                setFilter("TICKET_CREATED");
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                filter === "TICKET_CREATED"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                            }`}
                        >
                            Creations
                        </button>
                        <button
                            onClick={() => {
                                setFilter("REPLY_POSTED");
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                filter === "REPLY_POSTED"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                            }`}
                        >
                            Messages
                        </button>
                        <button
                            onClick={() => {
                                setFilter("STATUS_CHANGED");
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                filter === "STATUS_CHANGED"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                            }`}
                        >
                            Status
                        </button>
                        <button
                            onClick={() => {
                                setFilter("INTERNAL_NOTE_ADDED");
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                filter === "INTERNAL_NOTE_ADDED"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                            }`}
                        >
                            Staff Notes
                        </button>
                        <button
                            onClick={() => {
                                setFilter("ASSIGNED");
                                setPage(1);
                            }}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                filter === "ASSIGNED"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                            }`}
                        >
                            Dispatched
                        </button>
                    </div>

                    {/* Date Range Selector */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Select
                            value={dateRange}
                            onValueChange={(val) => {
                                setDateRange((val ?? "all") as "all" | "today" | "7d" | "30d");
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-9 sm:h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs w-full sm:w-40 focus:ring-1 focus:ring-[#5b4fe9]">
                                <div className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                    <SelectValue placeholder="Date Range" />
                                </div>
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                <SelectItem value="all">All Time</SelectItem>
                                <SelectItem value="today">Today</SelectItem>
                                <SelectItem value="7d">Last 7 Days</SelectItem>
                                <SelectItem value="30d">Last 30 Days</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={fetchActivities}
                            className="h-7 text-xs border-rose-300 hover:bg-rose-100 cursor-pointer"
                        >
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Activity Feed Container */}
                <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-100 shadow-baligo w-full min-w-0 space-y-6">
                    {loading ? (
                        <ActivitySkeleton />
                    ) : activities.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                <Activity className="h-10 w-10 stroke-[1.5]" />
                                <span className="font-semibold text-sm text-slate-600">
                                    No activity logs found
                                </span>
                                <p className="text-xs max-w-sm">
                                    No recorded events match the selected filter and date range.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-slate-100 ml-3 sm:ml-4 space-y-6 sm:space-y-8 pl-4 sm:pl-6">
                            {activities.map((item) => {
                                const badge = getActionBadge(item.action);
                                const Icon = badge.icon;
                                const isSelf = item.actor?._id === session?.user?.id;

                                return (
                                    <div key={item._id} className="relative group">
                                        {/* Dot on the timeline */}
                                        <span
                                            className={`absolute -left-[23px] sm:-left-[31px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ${badge.dotColor} shadow-xs ring-4 ring-slate-50`}
                                        />

                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                            {/* Left details */}
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md border ${badge.color}`}>
                                                        <Icon className="h-3 w-3" />
                                                        {badge.label}
                                                    </span>

                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-slate-800">
                                                            {item.actor?.name || "System Automated"}
                                                        </span>
                                                        {getRoleBadge(item.actor?.role)}
                                                        {isSelf && (
                                                            <span className="text-[10px] font-bold text-[#5b4fe9]">
                                                                (You)
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <p className="text-xs sm:text-sm text-slate-700 font-medium pt-0.5 leading-relaxed">
                                                    {item.details}
                                                </p>

                                                {item.actor?.facility && (
                                                    <div className="text-[11px] text-slate-400">
                                                        {item.actor.facility}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right timestamp & Ticket link */}
                                            <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 text-right shrink-0">
                                                <span className="text-[11px] text-slate-400 font-mono whitespace-nowrap">
                                                    {new Date(item.createdAt).toLocaleDateString("en-US", {
                                                        month: "short",
                                                        day: "numeric",
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </span>

                                                {item.ticket && (
                                                    <Link
                                                        href={`/tickets/${item.ticket._id}`}
                                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 hover:bg-[#5b4fe9] hover:text-white text-slate-700 text-[11px] font-mono font-bold transition-colors cursor-pointer"
                                                    >
                                                        <span>{item.ticket.ticketNumber}</span>
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                        <span>
                            Showing{" "}
                            <strong className="text-slate-800">
                                {activities.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
                            </strong>{" "}
                            to{" "}
                            <strong className="text-slate-800">
                                {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
                            </strong>{" "}
                            of <strong className="text-slate-800">{pagination.totalCount}</strong> activities
                        </span>

                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={pagination.page <= 1 || loading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="h-8 px-2.5 rounded-lg border-slate-200 text-xs cursor-pointer"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                                Previous
                            </Button>
                            <span className="px-2 font-mono font-medium text-slate-700">
                                {pagination.page} / {pagination.totalPages}
                            </span>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={pagination.page >= pagination.totalPages || loading}
                                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                className="h-8 px-2.5 rounded-lg border-slate-200 text-xs cursor-pointer"
                            >
                                Next
                                <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
