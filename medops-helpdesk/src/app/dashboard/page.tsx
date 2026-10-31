"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { SLACountdown } from "@/components/sla-countdown";
import { CreateTicketModal } from "@/components/create-ticket-modal";
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

    const fetchCategories = useCallback(async () => {
        try {
            const res = await fetch("/api/categories");
            const data = await res.json();
            if (res.ok && data.categories) {
                setCategories(data.categories);
            }
        } catch {
            // non-blocking
        }
    }, []);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
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
                setPagination(data.pagination);
            }
        } catch {
            setError("Network error while fetching clinical tickets");
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter, priorityFilter, categoryFilter, search, breachedOnly]);

    useEffect(() => {
        if (sessionStatus === "authenticated") {
            fetchCategories();
            fetchTickets();
        }
    }, [sessionStatus, fetchCategories, fetchTickets]);

    const priorityBadge = (p: string) => {
        switch (p) {
            case "Urgent":
                return "bg-red-50 text-red-700 border-red-200 font-semibold";
            case "High":
                return "bg-orange-50 text-orange-700 border-orange-200 font-medium";
            case "Medium":
                return "bg-blue-50 text-blue-700 border-blue-200";
            default:
                return "bg-slate-100 text-slate-700 border-slate-200";
        }
    };

    const statusBadge = (s: string) => {
        switch (s) {
            case "Open":
                return "bg-sky-50 text-sky-700 border-sky-200";
            case "In Progress":
                return "bg-indigo-50 text-indigo-700 border-indigo-200";
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

    if (sessionStatus === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-500">
                Loading MedOps workspace...
            </div>
        );
    }

    const role = session?.user?.role;

    return (
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                            {role === "agent"
                                ? "Assigned Clinical Incident Queue"
                                : role === "admin"
                                    ? "Master Clinical Incident Queue"
                                    : "My Clinical Support Tickets"}
                        </h1>
                        <p className="text-xs text-slate-500 mt-1">
                            {role === "agent"
                                ? "Showing tickets assigned strictly to your engineering queue with real-time SLA timers."
                                : role === "admin"
                                    ? "System-wide view across all clinics, support agents, and SLA targets."
                                    : "Track your reported clinic incidents, respond to engineers, and monitor SLA resolution."}
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={fetchTickets}
                            className="h-9 text-xs"
                        >
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                            Refresh
                        </Button>

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
                </div>

                {/* Filter & Search Bar */}
                <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                        <div className="lg:col-span-4 relative">
                            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <Input
                                placeholder="Search TKT-0001 or title..."
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(1);
                                }}
                                className="pl-9 h-9 text-xs"
                            />
                        </div>

                        <div className="lg:col-span-2">
                            <Select
                                value={statusFilter}
                                onValueChange={(v) => {
                                    setStatusFilter(v);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="h-9 text-xs w-full">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Statuses</SelectItem>
                                    <SelectItem value="Open">Open</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="Waiting on User">
                                        Waiting on User
                                    </SelectItem>
                                    <SelectItem value="Resolved">Resolved</SelectItem>
                                    <SelectItem value="Closed">Closed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="lg:col-span-2">
                            <Select
                                value={priorityFilter}
                                onValueChange={(v) => {
                                    setPriorityFilter(v);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="h-9 text-xs w-full">
                                    <SelectValue placeholder="Priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Priorities</SelectItem>
                                    <SelectItem value="Urgent">Urgent (1h/8h)</SelectItem>
                                    <SelectItem value="High">High (4h/24h)</SelectItem>
                                    <SelectItem value="Medium">Medium (8h/48h)</SelectItem>
                                    <SelectItem value="Low">Low (24h/72h)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="lg:col-span-2">
                            <Select
                                value={categoryFilter}
                                onValueChange={(v) => {
                                    setCategoryFilter(v);
                                    setPage(1);
                                }}
                            >
                                <SelectTrigger className="h-9 text-xs w-full">
                                    <SelectValue placeholder="Category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Categories</SelectItem>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat._id} value={cat._id}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="lg:col-span-2 flex items-center">
                            <button
                                type="button"
                                onClick={() => {
                                    setBreachedOnly(!breachedOnly);
                                    setPage(1);
                                }}
                                className={`w-full h-9 px-3 rounded-md border text-xs font-medium transition flex items-center justify-center gap-1.5 ${breachedOnly
                                        ? "bg-red-50 border-red-300 text-red-700"
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                    }`}
                            >
                                SLA Breached Only
                            </button>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-center gap-2 text-xs text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-xs text-slate-500">
                            Loading clinical incident queue...
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="p-12 text-center space-y-2">
                            <Inbox className="h-8 w-8 text-slate-300 mx-auto" />
                            <div className="text-sm font-medium text-slate-800">
                                No incident tickets match your current filters
                            </div>
                            <p className="text-xs text-slate-500">
                                Try clearing your search query or adjusting the status filter.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                        <th className="py-3 px-4">Ticket ID</th>
                                        <th className="py-3 px-4">Clinical Incident</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Priority</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4">SLA Timer</th>
                                        <th className="py-3 px-4">Assigned Engineer</th>
                                        <th className="py-3 px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-xs">
                                    {tickets.map((t) => (
                                        <tr
                                            key={t._id}
                                            className="hover:bg-slate-50/90 transition group"
                                        >
                                            <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                                                <Link
                                                    href={`/tickets/${t._id}`}
                                                    className="hover:text-teal-700 underline-offset-4 hover:underline"
                                                >
                                                    {t.ticketNumber}
                                                </Link>
                                            </td>

                                            <td className="py-3.5 px-4 max-w-xs">
                                                <Link
                                                    href={`/tickets/${t._id}`}
                                                    className="font-medium text-slate-900 group-hover:text-teal-700 line-clamp-1"
                                                >
                                                    {t.title}
                                                </Link>
                                                <div className="text-[11px] text-slate-400 mt-0.5 truncate">
                                                    By {t.createdBy?.name || "Requester"} •{" "}
                                                    {t.createdBy?.facility || "Clinic"}
                                                </div>
                                            </td>

                                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                                                {t.category?.name || "General"}
                                            </td>

                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[11px] ${priorityBadge(t.priority)}`}
                                                >
                                                    {t.priority}
                                                </Badge>
                                            </td>

                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[11px] ${statusBadge(t.status)}`}
                                                >
                                                    {t.status}
                                                </Badge>
                                            </td>

                                            <td className="py-3.5 px-4 whitespace-nowrap">
                                                <SLACountdown
                                                    status={t.status}
                                                    responseDueDate={t.responseDueDate}
                                                    resolutionDueDate={t.resolutionDueDate}
                                                    firstRespondedAt={t.firstRespondedAt}
                                                    slaBreached={t.slaBreached}
                                                />
                                            </td>

                                            <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                                                {t.assignedAgent ? (
                                                    <span className="font-medium text-slate-800">
                                                        {t.assignedAgent.name.split(" (")[0]}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                                                        UNASSIGNED
                                                    </span>
                                                )}
                                            </td>

                                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                <Link
                                                    href={`/tickets/${t._id}`}
                                                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-teal-700"
                                                >
                                                    Open
                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between text-xs text-slate-600">
                        <div>
                            Showing page{" "}
                            <span className="font-semibold text-slate-900">
                                {pagination.page}
                            </span>{" "}
                            of{" "}
                            <span className="font-semibold text-slate-900">
                                {pagination.totalPages}
                            </span>{" "}
                            ({pagination.totalCount} total tickets)
                        </div>

                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1 || loading}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="h-8 px-2.5 text-xs"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                                Prev
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= pagination.totalPages || loading}
                                onClick={() => setPage((p) => p + 1)}
                                className="h-8 px-2.5 text-xs"
                            >
                                Next
                                <ChevronRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}