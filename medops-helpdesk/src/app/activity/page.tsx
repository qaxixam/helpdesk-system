"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActivitySkeleton } from "@/components/ui/skeleton";
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
    RefreshCw,
    UserCheck,
    Clock,
    AlertCircle,
    ArrowUpRight,
    Calendar,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

interface ActivityItem {
    _id: string;
    action: string;
    details: string;
    createdAt: string;
    ticket?: {
        _id: string;
        ticketNumber: string;
        title: string;
        priority: string;
        status: string;
    };
    actor?: {
        _id: string;
        name: string;
        email: string;
        role: string;
        facility?: string;
    };
}

export default function ActivityPage() {
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<
        "ALL" | "TICKET_CREATED" | "REPLY_POSTED" | "STATUS_CHANGED" | "ASSIGNED"
    >("ALL");
    const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 12,
        totalCount: 0,
        totalPages: 1,
    });

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
        }
    }, [sessionStatus, router]);

    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const params = new URLSearchParams({
                page: String(page),
                limit: "12",
                dateRange,
            });
            if (filter !== "ALL") params.set("action", filter);

            const res = await fetch(`/api/activity?${params.toString()}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to load activity stream");
            } else {
                setActivities(data.activities || []);
                setPagination(data.pagination || { page: 1, limit: 12, totalCount: 0, totalPages: 1 });
            }
        } catch {
            setError("Network error while loading activities. Click Refresh to retry.");
        } finally {
            setLoading(false);
        }
    }, [page, filter, dateRange]);

    useEffect(() => {
        if (sessionStatus !== "authenticated") return;
        const controller = new AbortController();

        const params = new URLSearchParams({
            page: String(page),
            limit: "12",
            dateRange,
        });
        if (filter !== "ALL") params.set("action", filter);

        fetch(`/api/activity?${params.toString()}`, { signal: controller.signal })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || "Failed to load activity stream");
                }
                return data;
            })
            .then((data) => {
                setActivities(data.activities || []);
                setPagination(data.pagination || { page: 1, limit: 12, totalCount: 0, totalPages: 1 });
                setError("");
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                const msg = err instanceof Error ? err.message : "Network error while loading activities";
                setError(msg);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [sessionStatus, page, filter, dateRange]);

    const currentUserId = session?.user?.id;

    const getActionMeta = (action: string) => {
        switch (action) {
            case "TICKET_CREATED":
                return {
                    label: "Incident Logged",
                    icon: PlusCircle,
                    badgeColor: "bg-purple-50 text-[#6052E9] border-purple-200",
                    iconColor: "text-[#6052E9]",
                    bgIcon: "bg-purple-100",
                };
            case "REPLY_POSTED":
                return {
                    label: "Reply Posted",
                    icon: MessageSquare,
                    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
                    iconColor: "text-blue-600",
                    bgIcon: "bg-blue-100",
                };
            case "STATUS_CHANGED":
                return {
                    label: "Status Changed",
                    icon: RefreshCw,
                    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
                    iconColor: "text-amber-600",
                    bgIcon: "bg-amber-100",
                };
            case "ASSIGNED":
                return {
                    label: "Engineer Assigned",
                    icon: UserCheck,
                    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
                    iconColor: "text-emerald-600",
                    bgIcon: "bg-emerald-100",
                };
            default:
                return {
                    label: "Ticket Update",
                    icon: Clock,
                    badgeColor: "bg-slate-50 text-slate-700 border-slate-200",
                    iconColor: "text-slate-600",
                    bgIcon: "bg-slate-100",
                };
        }
    };

    return (
        <DashboardShell
            title="Activity Stream"
            subtitle="Real-time audit log of all your submitted incidents, conversations, and status milestones"
            action={
                <button
                    onClick={fetchActivities}
                    title="Refresh activities"
                    className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Refresh Stream</span>
                </button>
            }
        >
            <div className="space-y-6 w-full min-w-0">
                {/* Activity Feed Container */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 sm:space-y-5 w-full min-w-0 overflow-hidden">
                    {/* Header, Filter Pills & Date Filter */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-[#6052E9]" />
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                Timeline of Events
                            </h2>
                            <span className="text-xs bg-purple-50 text-[#6052E9] font-bold px-2 py-0.5 rounded-full border border-purple-100">
                                {pagination.totalCount} items
                            </span>
                        </div>

                        {/* Filter Tabs and Date Selector */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            {/* Action Filter Pills */}
                            <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-1 sm:pb-0 scrollbar-none">
                                <button
                                    onClick={() => {
                                        setFilter("ALL");
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        filter === "ALL"
                                            ? "bg-[#6052E9] text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => {
                                        setFilter("TICKET_CREATED");
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        filter === "TICKET_CREATED"
                                            ? "bg-[#6052E9] text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    Creations
                                </button>
                                <button
                                    onClick={() => {
                                        setFilter("REPLY_POSTED");
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        filter === "REPLY_POSTED"
                                            ? "bg-[#6052E9] text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    Replies
                                </button>
                                <button
                                    onClick={() => {
                                        setFilter("STATUS_CHANGED");
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        filter === "STATUS_CHANGED"
                                            ? "bg-[#6052E9] text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    Updates
                                </button>
                                <button
                                    onClick={() => {
                                        setFilter("ASSIGNED");
                                        setPage(1);
                                    }}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                                        filter === "ASSIGNED"
                                            ? "bg-[#6052E9] text-white shadow-xs"
                                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                    }`}
                                >
                                    Assigned
                                </button>
                            </div>

                            {/* Date Filter Dropdown */}
                            <div className="flex items-center gap-1.5 shrink-0">
                                <Select
                                    value={dateRange}
                                    onValueChange={(val) => {
                                        setDateRange((val ?? "all") as "all" | "today" | "7d" | "30d");
                                        setPage(1);
                                    }}
                                >
                                    <SelectTrigger className="h-8 text-xs rounded-xl border-slate-200 bg-slate-50/70 w-[130px] font-medium text-slate-700">
                                        <Calendar className="h-3.5 w-3.5 mr-1 text-[#6052E9]" />
                                        <SelectValue placeholder="Date Range" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Time</SelectItem>
                                        <SelectItem value="today">Today</SelectItem>
                                        <SelectItem value="7d">Last 7 Days</SelectItem>
                                        <SelectItem value="30d">Last 30 Days</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-xs text-red-700">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Timeline List */}
                    {loading ? (
                        <div className="p-4">
                            <ActivitySkeleton count={5} />
                        </div>
                    ) : activities.length === 0 ? (
                        <div className="p-12 text-center space-y-2">
                            <CheckCircle2 className="h-8 w-8 text-slate-300 mx-auto" />
                            <div className="text-sm font-semibold text-slate-700">
                                No activity records found
                            </div>
                            <p className="text-xs text-slate-400">
                                Any action taken on your tickets will automatically appear here.
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {activities.map((item) => {
                                const meta = getActionMeta(item.action);
                                const Icon = meta.icon;
                                const isMe = item.actor?._id === currentUserId;

                                return (
                                    <div
                                        key={item._id}
                                        className="py-4 flex items-start justify-between gap-4 hover:bg-slate-50/70 p-3 rounded-xl transition-colors"
                                    >
                                        <div className="flex items-start gap-3.5 min-w-0">
                                            {/* Icon */}
                                            <div
                                                className={`h-9 w-9 rounded-xl ${meta.bgIcon} flex items-center justify-center shrink-0 mt-0.5`}
                                            >
                                                <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                                            </div>

                                            {/* Details */}
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span
                                                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${meta.badgeColor}`}
                                                    >
                                                        {meta.label}
                                                    </span>

                                                    {item.ticket && (
                                                        <Link
                                                            href={`/tickets/${item.ticket._id}`}
                                                            className="font-mono text-xs font-bold text-[#6052E9] hover:underline"
                                                        >
                                                            {item.ticket.ticketNumber}
                                                        </Link>
                                                    )}

                                                    <span className="text-xs text-slate-400">•</span>

                                                    <span className="text-[11px] text-slate-500">
                                                        {isMe ? (
                                                            <strong className="text-slate-800">You</strong>
                                                        ) : (
                                                            <strong className="text-slate-800">
                                                                {item.actor?.name || "SOC Team"}
                                                            </strong>
                                                        )}
                                                        {item.actor?.facility && ` (${item.actor.facility})`}
                                                    </span>
                                                </div>

                                                <p className="text-xs text-slate-700 font-medium mt-1">
                                                    {item.details}
                                                </p>

                                                {item.ticket && (
                                                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                        Incident: &ldquo;{item.ticket.title}&rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right Timestamp & Link */}
                                        <div className="flex flex-col items-end shrink-0 gap-1.5">
                                            <span className="text-[11px] text-slate-400 whitespace-nowrap">
                                                {new Date(item.createdAt).toLocaleString(undefined, {
                                                    month: "short",
                                                    day: "numeric",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                })}
                                            </span>

                                            {item.ticket && (
                                                <Link
                                                    href={`/tickets/${item.ticket._id}`}
                                                    className="inline-flex items-center gap-1 text-[11px] text-[#6052E9] hover:text-[#4f42d4] font-bold"
                                                >
                                                    <span>View</span>
                                                    <ArrowUpRight className="h-3 w-3" />
                                                </Link>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Pagination Controls */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                            <div>
                                Page <strong className="text-slate-800">{pagination.page}</strong> of{" "}
                                <strong className="text-slate-800">{pagination.totalPages}</strong> ({pagination.totalCount} total)
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={pagination.page <= 1}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                    title="Previous Page"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                    title="Next Page"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
