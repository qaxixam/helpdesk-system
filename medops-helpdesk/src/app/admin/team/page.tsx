"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { TableSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    UserPlus,
    Search,
    Shield,
    Wrench,
    Stethoscope,
    RefreshCw,
    AlertCircle,
    CheckCircle,
    XCircle,
} from "lucide-react";

interface TeamMember {
    _id: string;
    name: string;
    email: string;
    role: "admin" | "agent" | "user";
    facility?: string;
    isActive: boolean;
    createdAt?: string;
}

interface AgentWorkloadItem {
    agentId: string;
    agentName: string;
    active: number;
    resolved: number;
    breached: number;
    total: number;
}

export default function AdminTeamPage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();

    const [members, setMembers] = useState<TeamMember[]>([]);
    const [workloads, setWorkloads] = useState<Record<string, AgentWorkloadItem>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("ALL");

    // Modal state for Create Agent
    const [createOpen, setCreateOpen] = useState(false);
    const [createForm, setCreateForm] = useState({
        name: "",
        email: "",
        password: "",
        role: "agent",
        facility: "Main Medical Center",
    });
    const [creating, setCreating] = useState(false);
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const hasFetchedRef = useRef(false);

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
        }
        if (sessionStatus === "authenticated" && session?.user?.role !== "admin") {
            router.push("/dashboard");
        }
    }, [sessionStatus, session?.user?.role, router]);

    const fetchTeam = useCallback(async () => {
        try {
            setLoading(true);
            setError("");
            const [usersRes, analyticsRes] = await Promise.all([
                fetch("/api/users?role=ALL"),
                fetch("/api/admin/analytics"),
            ]);

            const usersData = await usersRes.json();
            if (!usersRes.ok) throw new Error(usersData.error || "Failed to load team");
            setMembers(usersData.users || []);

            if (analyticsRes.ok) {
                const analyticsData = await analyticsRes.json();
                const workloadMap: Record<string, AgentWorkloadItem> = {};
                if (analyticsData.agentWorkload) {
                    analyticsData.agentWorkload.forEach((w: AgentWorkloadItem) => {
                        workloadMap[w.agentId] = w;
                    });
                }
                setWorkloads(workloadMap);
            }
        } catch {
            setError("Network error while loading team members");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (sessionStatus === "authenticated" && session?.user?.role === "admin") {
            if (!hasFetchedRef.current) {
                hasFetchedRef.current = true;
                fetchTeam();
            }
        }
    }, [sessionStatus, session?.user?.role, fetchTeam]);

    async function handleCreateAgent(e: React.FormEvent) {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await fetch("/api/users", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(createForm),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to create staff member");
            } else {
                toast.success(`${createForm.role.toUpperCase()} account created successfully!`);
                setCreateOpen(false);
                setCreateForm({
                    name: "",
                    email: "",
                    password: "",
                    role: "agent",
                    facility: "Main Medical Center",
                });
                fetchTeam();
            }
        } catch {
            toast.error("Network error while creating account");
        } finally {
            setCreating(false);
        }
    }

    async function handleToggleStatus(userId: string, currentStatus: boolean) {
        setUpdatingId(userId);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, isActive: !currentStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update user status");

            toast.success(`User ${!currentStatus ? "activated" : "deactivated"} successfully!`);
            setMembers((prev) =>
                prev.map((m) => (m._id === userId ? { ...m, isActive: !currentStatus } : m))
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Update failed";
            toast.error(msg);
        } finally {
            setUpdatingId(null);
        }
    }

    async function handleChangeRole(userId: string, newRole: string) {
        setUpdatingId(userId);
        try {
            const res = await fetch("/api/users", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId, role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to update role");

            toast.success("Role updated successfully!");
            setMembers((prev) =>
                prev.map((m) => (m._id === userId ? { ...m, role: newRole as "admin" | "agent" | "user" } : m))
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Role change failed";
            toast.error(msg);
        } finally {
            setUpdatingId(null);
        }
    }

    const filteredMembers = members.filter((m) => {
        if (roleFilter !== "ALL" && m.role !== roleFilter) return false;
        if (search.trim()) {
            const query = search.toLowerCase();
            return (
                m.name.toLowerCase().includes(query) ||
                m.email.toLowerCase().includes(query) ||
                (m.facility && m.facility.toLowerCase().includes(query))
            );
        }
        return true;
    });

    const totalStaff = members.length;
    const totalAgents = members.filter((m) => m.role === "agent").length;
    const totalAdmins = members.filter((m) => m.role === "admin").length;
    const totalClients = members.filter((m) => m.role === "user").length;

    const roleBadge = (role: string) => {
        switch (role) {
            case "admin":
                return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200">
                        <Shield className="h-3 w-3" />
                        Admin
                    </span>
                );
            case "agent":
                return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                        <Wrench className="h-3 w-3" />
                        Support Engineer
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-50 text-slate-700 border border-slate-200">
                        <Stethoscope className="h-3 w-3" />
                        Clinic Client
                    </span>
                );
        }
    };

    return (
        <DashboardShell
            title="Hospital Support Team & Engineers"

            action={
                <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
                    <button
                        onClick={fetchTeam}
                        title="Refresh roster"
                        className="h-9 sm:h-10 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center gap-1.5 transition-colors border border-white/10 cursor-pointer"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Refresh</span>
                    </button>

                    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                        <DialogTrigger className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-xl bg-[#00D084] hover:bg-[#00BC76] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer">
                            <UserPlus className="h-4 w-4" />
                            <span>Create Agent / Staff</span>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-slate-900">
                                    Add New Staff Member
                                </DialogTitle>
                            </DialogHeader>
                            <form onSubmit={handleCreateAgent} className="space-y-4 mt-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Full Name</Label>
                                    <Input
                                        required
                                        placeholder="Dr. Jordan Hayes"
                                        value={createForm.name}
                                        onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                        className="rounded-xl text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Email Address</Label>
                                    <Input
                                        required
                                        type="email"
                                        placeholder="jordan.hayes@medops.org"
                                        value={createForm.email}
                                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                        className="rounded-xl text-xs"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-slate-700">Temporary Password</Label>
                                    <Input
                                        required
                                        type="text"
                                        placeholder="Initial secure password"
                                        value={createForm.password}
                                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                        className="rounded-xl text-xs"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Role</Label>
                                        <Select
                                            value={createForm.role}
                                            onValueChange={(val) => setCreateForm({ ...createForm, role: val ?? "agent" })}
                                        >
                                            <SelectTrigger className="rounded-xl text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent className="z-[9999]">
                                                <SelectItem value="agent">Support Engineer</SelectItem>
                                                <SelectItem value="admin">System Admin</SelectItem>
                                                <SelectItem value="user">Clinic User</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold text-slate-700">Facility</Label>
                                        <Input
                                            placeholder="Hospital Center"
                                            value={createForm.facility}
                                            onChange={(e) => setCreateForm({ ...createForm, facility: e.target.value })}
                                            className="rounded-xl text-xs"
                                        />
                                    </div>
                                </div>
                                <Button
                                    type="submit"
                                    disabled={creating}
                                    className="w-full bg-[#5b4fe9] hover:bg-[#4a3ecc] text-white rounded-xl h-10 font-bold text-xs"
                                >
                                    {creating ? "Creating Staff Member..." : "Create Account"}
                                </Button>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            }
        >
            <div className="space-y-5 w-full min-w-0 max-w-full overflow-x-hidden">
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 w-full min-w-0">
                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Total Team
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-2">
                            {totalStaff}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 font-medium">All accounts</span>
                    </div>

                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Support Engineers
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#5b4fe9] mt-2">
                            {totalAgents}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 font-medium">Active dispatch staff</span>
                    </div>

                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Admins
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-purple-700 mt-2">
                            {totalAdmins}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 font-medium">SOC command</span>
                    </div>

                    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col justify-between">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Clinic Clients
                        </span>
                        <div className="text-2xl sm:text-3xl font-extrabold text-[#00d084] mt-2">
                            {totalClients}
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 font-medium">Requesters</span>
                    </div>
                </div>

                {/* Filter & Search Band */}
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-baligo flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 w-full min-w-0">
                    <div className="relative flex-1 min-w-0">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <Input
                            placeholder="Search staff by name, email or facility..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white w-full"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Select value={roleFilter} onValueChange={(val) => setRoleFilter(val ?? "ALL")}>
                            <SelectTrigger className="h-10 rounded-xl bg-slate-50/70 border-slate-200 text-xs w-full sm:w-44">
                                <SelectValue placeholder="Role Filter" />
                            </SelectTrigger>
                            <SelectContent className="z-[9999]">
                                <SelectItem value="ALL">All Roles ({members.length})</SelectItem>
                                <SelectItem value="agent">Support Engineers ({totalAgents})</SelectItem>
                                <SelectItem value="admin">System Admins ({totalAdmins})</SelectItem>
                                <SelectItem value="user">Clinic Requesters ({totalClients})</SelectItem>
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
                            onClick={fetchTeam}
                            className="h-7 text-xs border-rose-300 hover:bg-rose-100 cursor-pointer"
                        >
                            Try Again
                        </Button>
                    </div>
                )}

                {/* Team Roster Table */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-baligo overflow-hidden w-full min-w-0">
                    {loading ? (
                        <div className="p-6">
                            <TableSkeleton rows={6} />
                        </div>
                    ) : (
                        <div className="overflow-hidden w-full min-w-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                    <tr>
                                        <th className="py-3 px-3 sm:px-4">Member Name</th>
                                        <th className="py-3 px-3 sm:px-4">Role</th>
                                        <th className="hidden md:table-cell py-3 px-4">Facility</th>
                                        <th className="hidden lg:table-cell py-3 px-4">Assigned Workload</th>
                                        <th className="py-3 px-3 sm:px-4 text-center">Status</th>
                                        <th className="py-3 px-3 sm:px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs">
                                    {filteredMembers.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-12 text-center text-slate-400">
                                                No team members match your filter.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredMembers.map((m) => {
                                            const workload = workloads[m._id];
                                            const isSelf = m._id === session?.user?.id;

                                            return (
                                                <tr key={m._id} className="hover:bg-slate-50/60 transition-colors">
                                                    {/* Member & Email */}
                                                    <td className="py-3.5 px-3 sm:px-4">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 border border-slate-200">
                                                                {m.name.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                                                    <span>{m.name}</span>
                                                                    {isSelf && (
                                                                        <span className="text-[10px] font-bold text-[#5b4fe9]">
                                                                            (You)
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-[11px] text-slate-400 truncate">
                                                                    {m.email}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* Role */}
                                                    <td className="py-3.5 px-3 sm:px-4 whitespace-nowrap">
                                                        {roleBadge(m.role)}
                                                    </td>

                                                    {/* Facility (Desktop) */}
                                                    <td className="hidden md:table-cell py-3.5 px-4 text-slate-600">
                                                        {m.facility || "Main Medical Center"}
                                                    </td>

                                                    {/* Workload Stats (Desktop) */}
                                                    <td className="hidden lg:table-cell py-3.5 px-4">
                                                        {m.role === "agent" && workload ? (
                                                            <div className="flex items-center gap-2 text-[11px]">
                                                                <span className="font-bold text-[#5b4fe9] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                                                    {workload.active} active
                                                                </span>
                                                                <span className="text-slate-400">
                                                                    {workload.resolved} resolved
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] text-slate-400">—</span>
                                                        )}
                                                    </td>

                                                    {/* Active / Inactive Status */}
                                                    <td className="py-3.5 px-3 sm:px-4 text-center whitespace-nowrap">
                                                        <button
                                                            onClick={() => handleToggleStatus(m._id, m.isActive)}
                                                            disabled={updatingId === m._id || isSelf}
                                                            title={isSelf ? "Cannot deactivate yourself" : "Toggle active status"}
                                                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${isSelf
                                                                    ? "cursor-not-allowed opacity-80"
                                                                    : "cursor-pointer hover:opacity-85"
                                                                } ${m.isActive
                                                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                                    : "bg-slate-100 text-slate-500 border border-slate-200"
                                                                }`}
                                                        >
                                                            {m.isActive ? (
                                                                <>
                                                                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                                                                    <span>Active</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <XCircle className="h-3 w-3 text-slate-400" />
                                                                    <span>Inactive</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>

                                                    {/* Role Adjust Dropdown */}
                                                    <td className="py-3.5 px-3 sm:px-4 text-right whitespace-nowrap">
                                                        {isSelf ? (
                                                            <span className="text-[11px] text-slate-400 font-mono">Owner</span>
                                                        ) : (
                                                            <Select
                                                                value={m.role}
                                                                onValueChange={(val) => handleChangeRole(m._id, val ?? "agent")}
                                                                disabled={updatingId === m._id}
                                                            >
                                                                <SelectTrigger className="h-8 rounded-lg text-xs bg-slate-50 border-slate-200 w-28 ml-auto">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent className="z-[9999]">
                                                                    <SelectItem value="agent">Agent</SelectItem>
                                                                    <SelectItem value="admin">Admin</SelectItem>
                                                                    <SelectItem value="user">User</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
