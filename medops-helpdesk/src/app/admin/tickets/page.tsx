"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { fetchJson } from "@/lib/api-client";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    Search,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Inbox,
    ArrowUpRight,
    AlertCircle,
    UserCheck,
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
    createdAt: string;
    slaBreached: boolean;
}

interface CategoryItem {
    _id: string;
    name: string;
}

interface AgentItem {
    _id: string;
    name: string;
    email: string;
}

export default function AdminTicketsPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();

    const queryClient = useQueryClient();

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [priorityFilter, setPriorityFilter] = useState("ALL");
    const [categoryFilter, setCategoryFilter] = useState("ALL");
    const [agentFilter, setAgentFilter] = useState("ALL");
    const [page, setPage] = useState(1);

    // Debounce search to prevent query flooding
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const [assigningId, setAssigningId] = useState<string | null>(null);

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.replace("/login");
        }
        if (sessionStatus === "authenticated" && session?.user?.role !== "admin") {
            router.replace("/dashboard");
        }
    }, [sessionStatus, session?.user?.role, router]);

    const params = new URLSearchParams({ page: String(page), limit: "10" });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (priorityFilter !== "ALL") params.set("priority", priorityFilter);
    if (categoryFilter !== "ALL") params.set("category", categoryFilter);
    if (agentFilter !== "ALL") params.set("assignedAgent", agentFilter);
    if (search.trim()) params.set("search", search.trim());
    const isAdmin = sessionStatus === "authenticated" && session?.user?.role === "admin";
    const ticketsQuery = useQuery({
        queryKey: ["tickets", "admin", session?.user?.id, page, statusFilter, priorityFilter, categoryFilter, agentFilter, search.trim()],
        queryFn: ({ signal }) => fetchJson<{ tickets: TicketRow[]; pagination: { page: number; limit: number; totalCount: number; totalPages: number } }>(`/api/tickets?${params.toString()}`, { signal }),
        enabled: isAdmin,
    });
    const categoriesQuery = useQuery({
        queryKey: ["categories"],
        queryFn: ({ signal }) => fetchJson<{ categories: CategoryItem[] }>("/api/categories", { signal }),
        enabled: isAdmin,
    });
    const agentsQuery = useQuery({
        queryKey: ["users", "agents", session?.user?.id],
        queryFn: ({ signal }) => fetchJson<{ users: AgentItem[] }>("/api/users?role=agent", { signal }),
        enabled: isAdmin,
    });
    const tickets = ticketsQuery.data?.tickets ?? [];
    const categories = categoriesQuery.data?.categories ?? [];
    const agents = agentsQuery.data?.users ?? [];
    const pagination = ticketsQuery.data?.pagination ?? { page: 1, limit: 10, totalCount: 0, totalPages: 1 };
    const loading = ticketsQuery.isPending;
    const error = ticketsQuery.error instanceof Error ? ticketsQuery.error.message : "";
    const fetchTickets = () => ticketsQuery.refetch();

    async function handleAssign(ticketId: string, agentId: string) {
        setAssigningId(ticketId);
        try {
            const res = await fetch(`/api/tickets/${ticketId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignedAgent: agentId === "UNASSIGNED" ? null : agentId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to assign agent");

            toast.success("Incident assigned successfully!");
            await queryClient.invalidateQueries({ queryKey: ["tickets", "admin"] });
            await queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
            await queryClient.invalidateQueries({ queryKey: ["activity"] });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Failed to assign";
            toast.error(msg);
        } finally {
            setAssigningId(null);
        }
    }

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
                return "bg-indigo-50 text-indigo-700 border-indigo-200";
            case "In Progress":
                return "bg-sky-50 text-sky-700 border-sky-200";
            case "Waiting on User":
                return "bg-amber-50 text-amber-700 border-amber-200";
            case "Resolved":
                return "bg-emerald-50 text-emerald-700 border-emerald-200";
            case "Closed":
                return "bg-slate-50 text-slate-600 border-slate-200";
            default:
                return "bg-slate-50 text-slate-700 border-slate-200";
        }
    };

    return (
        <DashboardShell
            title="All Client Incidents"

            action={
                <button
                    onClick={fetchTickets}
                    title="Refresh data"
                    className="h-9 sm:h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            }
        >
            <div className="space-y-5 w-full min-w-0 max-w-full overflow-x-hidden">
                {/* Search & Filters Band */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 w-full min-w-0">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search by ticket number or incident name..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                        <Select
                            value={statusFilter}
                            onValueChange={(val) => {
                                setStatusFilter(val ?? "ALL");
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs w-full sm:w-36">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
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
                            onValueChange={(val) => {
                                setPriorityFilter(val ?? "ALL");
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs w-full sm:w-32">
                                <SelectValue placeholder="Priority" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                <SelectItem value="ALL">All Priorities</SelectItem>
                                <SelectItem value="Urgent">Urgent</SelectItem>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select
                            value={agentFilter}
                            onValueChange={(val) => {
                                setAgentFilter(val ?? "ALL");
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs w-full sm:w-36">
                                <SelectValue placeholder="Agent" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                <SelectItem value="ALL">All Engineers</SelectItem>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {agents.map((ag) => (
                                    <SelectItem key={ag._id} value={ag._id}>
                                        {ag.name.split(" ")[0]}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={categoryFilter}
                            onValueChange={(val) => {
                                setCategoryFilter(val ?? "ALL");
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs w-full sm:w-36">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
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
                            onClick={fetchTickets}
                            className="h-7 text-xs border-rose-300 hover:bg-rose-100 cursor-pointer"
                        >
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Tickets Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-baligo overflow-hidden w-full min-w-0">
                    {loading ? (
                        <div className="p-6">
                            <TableSkeleton rows={8} />
                        </div>
                    ) : (
                        <div className="overflow-hidden w-full min-w-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="py-3 px-3 sm:px-4">Ticket</th>
                                        <th className="py-3 px-3 sm:px-4">Incident Name</th>
                                        <th className="hidden md:table-cell py-3 px-4">Priority</th>
                                        <th className="hidden sm:table-cell py-3 px-4">Status</th>
                                        <th className="hidden lg:table-cell py-3 px-4">Client / Facility</th>
                                        <th className="hidden xl:table-cell py-3 px-4">Assigned Engineer</th>
                                        <th className="py-3 px-3 sm:px-4 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {tickets.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-14 text-center">
                                                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                                                    <Inbox className="h-10 w-10 stroke-[1.5]" />
                                                    <span className="font-semibold text-sm text-slate-600">
                                                        No clinical incidents found
                                                    </span>
                                                    <p className="text-xs max-w-sm">
                                                        Try adjusting your search criteria or role filters to see incidents.
                                                    </p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        tickets.map((t) => (
                                            <tr key={t._id} className="hover:bg-slate-50/60 transition-colors">
                                                {/* Ticket Number */}
                                                <td className="py-3.5 px-3 sm:px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                                                    <Link
                                                        href={`/tickets/${t._id}`}
                                                        className="hover:text-[#5b4fe9] transition-colors cursor-pointer"
                                                    >
                                                        {t.ticketNumber}
                                                    </Link>
                                                </td>

                                                {/* Incident Title */}
                                                <td className="py-3.5 px-3 sm:px-4 min-w-0">
                                                    <Link
                                                        href={`/tickets/${t._id}`}
                                                        className="font-bold text-slate-800 hover:text-[#5b4fe9] transition-colors line-clamp-1 block cursor-pointer"
                                                    >
                                                        {t.title}
                                                    </Link>
                                                    {/* Mobile Inline Badges */}
                                                    <div className="sm:hidden flex items-center gap-1.5 mt-1.5 flex-wrap">
                                                        <span
                                                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityBadge(
                                                                t.priority
                                                            )}`}
                                                        >
                                                            {t.priority}
                                                        </span>
                                                        <span
                                                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusBadge(
                                                                t.status
                                                            )}`}
                                                        >
                                                            {t.status}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {t.createdBy?.name?.split(" ")[0]}
                                                        </span>
                                                    </div>
                                                </td>

                                                {/* Priority (Desktop) */}
                                                <td className="hidden md:table-cell py-3.5 px-4 whitespace-nowrap">
                                                    <span
                                                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${priorityBadge(
                                                            t.priority
                                                        )}`}
                                                    >
                                                        {t.priority}
                                                    </span>
                                                </td>

                                                {/* Status (Desktop) */}
                                                <td className="hidden sm:table-cell py-3.5 px-4 whitespace-nowrap">
                                                    <span
                                                        className={`text-[11px] font-medium px-2 py-0.5 rounded-md border ${statusBadge(
                                                            t.status
                                                        )}`}
                                                    >
                                                        {t.status}
                                                    </span>
                                                </td>

                                                {/* Client / Facility (Desktop) */}
                                                <td className="hidden lg:table-cell py-3.5 px-4 text-slate-600">
                                                    <div className="font-semibold text-slate-800 line-clamp-1">
                                                        {t.createdBy?.name || "Clinic Client"}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 line-clamp-1">
                                                        {t.createdBy?.facility || "Main Medical Center"}
                                                    </div>
                                                </td>

                                                {/* Quick Assign Dropdown (Desktop) */}
                                                <td className="hidden xl:table-cell py-3.5 px-4">
                                                    <Select
                                                        value={t.assignedAgent?._id || "UNASSIGNED"}
                                                        onValueChange={(val) => handleAssign(t._id, val ?? "UNASSIGNED")}
                                                        disabled={assigningId === t._id}
                                                    >
                                                        <SelectTrigger className="h-8 rounded-lg text-xs bg-slate-50 border-slate-200 w-36">
                                                            <div className="flex items-center gap-1.5 truncate">
                                                                <UserCheck className="h-3 w-3 text-slate-400 shrink-0" />
                                                                <span className="truncate">
                                                                    {t.assignedAgent ? t.assignedAgent.name.split(" ")[0] : "Assign..."}
                                                                </span>
                                                            </div>
                                                        </SelectTrigger>
                                                        <SelectContent className="z-[9999]">
                                                            <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                                                            {agents.map((ag) => (
                                                                <SelectItem key={ag._id} value={ag._id}>
                                                                    {ag.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </td>

                                                {/* Action Link */}
                                                <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                                                    <Link
                                                        href={`/tickets/${t._id}`}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-[#5b4fe9] hover:text-white text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                                                    >
                                                        <span>View</span>
                                                        <ArrowUpRight className="h-3 w-3" />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                        <span>
                            Showing{" "}
                            <span className="font-bold text-slate-800">
                                {tickets.length === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}
                            </span>{" "}
                            to{" "}
                            <span className="font-bold text-slate-800">
                                {Math.min(pagination.page * pagination.limit, pagination.totalCount)}
                            </span>{" "}
                            of{" "}
                            <span className="font-bold text-slate-800">{pagination.totalCount}</span> incidents
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
