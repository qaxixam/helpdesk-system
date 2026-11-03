"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { ActivitySkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
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
    Filter,
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

    const [activities, setActivities] = useState<ActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState<
        "ALL" | "CREATION" | "REPLIES" | "STATUS" | "NOTES" | "ASSIGNMENT"
    >("ALL");

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
        }
        if (sessionStatus === "authenticated" && session?.user?.role !== "admin") {
            router.push("/dashboard");
        }
    }, [sessionStatus, session?.user?.role, router]);

    const fetchActivities = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const res = await fetch("/api/activity");
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Failed to load activity stream");
            } else {
                setActivities(data.activities || []);
            }
        } catch {
            setError("Network error while loading activities. Click Refresh to retry.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (sessionStatus !== "authenticated" || session?.user?.role !== "admin") return;
        const controller = new AbortController();

        fetch("/api/activity", { signal: controller.signal })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Failed to load activities");
                return data;
            })
            .then((data) => {
                setActivities(data.activities || []);
                setError("");
            })
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === "AbortError") return;
                const msg = err instanceof Error ? err.message : "Network error while loading activities";
                setError(msg);
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            });

        return () => controller.abort();
    }, [sessionStatus, session?.user?.role]);

    // Filter activities by action
    const filteredActivities = activities.filter((item) => {
        if (filter === "CREATION") return item.action === "TICKET_CREATED";
        if (filter === "REPLIES") return item.action === "REPLY_POSTED";
        if (filter === "STATUS") return item.action === "STATUS_CHANGED";
        if (filter === "NOTES") return item.action === "INTERNAL_NOTE_ADDED";
        if (filter === "ASSIGNMENT") return item.action === "ASSIGNED";
        return true;
    });

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
                {/* Filter Band */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 w-full min-w-0">
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-800">Filter Event Type:</span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
                        <button
                            onClick={() => setFilter("ALL")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filter === "ALL"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                        >
                            All ({activities.length})
                        </button>
                        <button
                            onClick={() => setFilter("CREATION")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filter === "CREATION"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                        >
                            Creations
                        </button>
                        <button
                            onClick={() => setFilter("REPLIES")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filter === "REPLIES"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                        >
                            Messages
                        </button>
                        <button
                            onClick={() => setFilter("STATUS")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filter === "STATUS"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                        >
                            Status
                        </button>
                        <button
                            onClick={() => setFilter("NOTES")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filter === "NOTES"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                        >
                            Staff Notes
                        </button>
                        <button
                            onClick={() => setFilter("ASSIGNMENT")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${filter === "ASSIGNMENT"
                                    ? "bg-[#5b4fe9] text-white shadow-xs"
                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200/70"
                                }`}
                        >
                            Dispatched
                        </button>
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
                <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-100 shadow-baligo w-full min-w-0">
                    {loading ? (
                        <ActivitySkeleton />
                    ) : filteredActivities.length === 0 ? (
                        <div className="py-16 text-center">
                            <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                <Activity className="h-10 w-10 stroke-[1.5]" />
                                <span className="font-semibold text-sm text-slate-600">
                                    No activity logs found
                                </span>
                                <p className="text-xs max-w-sm">
                                    No recorded events match the selected category filter.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-slate-100 ml-3 sm:ml-4 space-y-6 sm:space-y-8 pl-4 sm:pl-6">
                            {filteredActivities.map((item) => {
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
                </div>
            </div>
        </DashboardShell>
    );
}
