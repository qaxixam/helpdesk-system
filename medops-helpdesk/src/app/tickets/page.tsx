"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DashboardShell } from "@/components/dashboard-shell";
import { CreateTicketModal } from "@/components/create-ticket-modal";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
    SlidersHorizontal,
} from "lucide-react";

interface TicketRow {
    _id: string;
    ticketNumber: string;
    title: string;
    priority: "Low" | "Medium" | "High" | "Urgent";
    status: "Open" | "In Progress" | "Waiting on User" | "Resolved" | "Closed";
    category?: { _id: string; name: string };
    createdBy?: { _id: string; name: string; email: string; facility?: string };
    assignedAgent?: { _id: string; name: string; email: string };
    responseDueDate: string;
    resolutionDueDate: string;
    firstRespondedAt?: string;
    slaBreached: boolean;
    createdAt: string;
}

interface CategoryOption {
    _id: string;
    name: string;
    description: string;
    defaultPriority: "Low" | "Medium" | "High" | "Urgent";
}

export default function MyTicketsPage() {
    const router = useRouter();
    const { status: sessionStatus } = useSession();

    const [tickets, setTickets] = useState<TicketRow[]>([]);
    const [categories, setCategories] = useState<CategoryOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filters & Pagination
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 10,
        totalCount: 0,
        totalPages: 1,
    });
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [search, setSearch] = useState("");

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
                limit: "10",
            });
            if (statusFilter !== "ALL") params.set("status", statusFilter);
            if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
            if (categoryFilter !== "ALL") params.set("category", categoryFilter);
            if (search.trim()) params.set("search", search.trim());

            const res = await fetch(`/api/tickets?${params.toString()}`);
            const data = await res.json();

            if (!res.ok) {
                setError(data.error || "Failed to load tickets");
            } else {
                setTickets(data.tickets || []);
                setPagination(data.pagination || { page: 1, limit: 10, totalCount: 0, totalPages: 1 });
            }
        } catch {
            setError("Network error while fetching tickets");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, priorityFilter, categoryFilter, search]);

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
            limit: "10",
        });
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
        if (categoryFilter !== "ALL") params.set("category", categoryFilter);
        if (search.trim()) params.set("search", search.trim());

        fetch(`/api/tickets?${params.toString()}`, { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (data.tickets) {
                    setTickets(data.tickets);
                    setPagination(data.pagination || { page: 1, limit: 10, totalCount: 0, totalPages: 1 });
                }
            })
            .catch(() => {})
            .finally(() => {
                setLoading(false);
            });

        return () => controller.abort();
    }, [sessionStatus, page, statusFilter, priorityFilter, categoryFilter, search]);

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

    return (
        <DashboardShell
            title="My Tickets"
            subtitle="Complete catalog of your clinical incident reports, conversation status, and resolutions"
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
                    <CreateTicketModal
                        categories={categories}
                        onCreated={() => {
                            setPage(1);
                            fetchTickets();
                        }}
                    />
                </div>
            }
        >
            <div className="space-y-6 w-full min-w-0">
                {/* Main Full Ticket Management Container */}
                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-5 w-full min-w-0 overflow-hidden">
                    {/* Filter bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <SlidersHorizontal className="h-4 w-4 text-[#6052E9]" />
                            <h2 className="text-base font-bold text-slate-900 tracking-tight">
                                All Incident Records
                            </h2>
                            <span className="text-xs bg-purple-50 text-[#6052E9] font-bold px-2 py-0.5 rounded-full border border-purple-100">
                                {pagination.totalCount} total
                            </span>
                        </div>

                        {/* Search & Filters */}
                        <div className="flex flex-wrap items-center gap-2.5">
                            <div className="relative min-w-[200px]">
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
                        </div>
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
                                Loading your tickets...
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="p-12 text-center space-y-3">
                                <Inbox className="h-9 w-9 text-slate-300 mx-auto" />
                                <div className="text-sm font-semibold text-slate-700">
                                    No incident tickets found
                                </div>
                                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                    You have not reported any incidents matching this criteria. Create a new ticket whenever you need support.
                                </p>
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
                            </div>
                        ) : (
                            <div className="overflow-x-auto w-full max-w-full">
                                <table className="w-full text-left border-collapse min-w-[700px]">
                                    <thead>
                                        <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                            <th className="py-3 px-4">Ticket</th>
                                            <th className="py-3 px-4">Incident Name</th>
                                            <th className="py-3 px-4">Priority</th>
                                            <th className="py-3 px-4">Status</th>
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

                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <Link
                                                        href={`/tickets/${t._id}`}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-[#6052E9] font-bold text-xs transition"
                                                    >
                                                        <span>View</span>
                                                        <ArrowUpRight className="h-3.5 w-3.5" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs text-slate-500">
                            <div>
                                Page <strong className="text-slate-800">{pagination.page}</strong> of{" "}
                                <strong className="text-slate-800">{pagination.totalPages}</strong> ({pagination.totalCount} total)
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    disabled={pagination.page <= 1}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                                    disabled={pagination.page >= pagination.totalPages}
                                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
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

