"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { SLACountdown } from "@/components/sla-countdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
    ArrowLeft,
    Lock,
    Send,
    Paperclip,
    History,
    CheckCircle2,
    ShieldAlert,
    FileText,
    UserCheck,
} from "lucide-react";

interface Attachment {
    name: string;
    url: string;
}

interface TicketDetail {
    _id: string;
    ticketNumber: string;
    title: string;
    description: string;
    priority: "Low" | "Medium" | "High" | "Urgent";
    status: "Open" | "In Progress" | "Waiting on User" | "Resolved" | "Closed";
    category?: { _id: string; name: string };
    createdBy: { _id: string; name: string; email: string; facility?: string };
    assignedAgent?: {
        _id: string;
        name: string;
        email: string;
        facility?: string;
    } | null;
    attachments: Attachment[];
    responseDueDate: string;
    resolutionDueDate: string;
    firstRespondedAt?: string | null;
    resolvedAt?: string | null;
    slaBreached: boolean;
    createdAt: string;
}

interface MessageItem {
    _id: string;
    body: string;
    isInternal: boolean;
    attachments: Attachment[];
    createdAt: string;
    author: {
        _id: string;
        name: string;
        email: string;
        role: string;
        facility?: string;
    };
}

interface ActivityItem {
    _id: string;
    action: string;
    details: string;
    createdAt: string;
    actor?: { name: string; role: string };
}

interface AgentOption {
    _id: string;
    name: string;
    email: string;
}

export default function TicketDetailPage() {
    const params = useParams<{ id: string }>();
    const id = params?.id;
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();

    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityItem[]>([]);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [replyBody, setReplyBody] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [updatingMeta, setUpdatingMeta] = useState(false);

    const hasFetchedRef = useRef(false);

    const fetchTicketDetails = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            setError("");
            const res = await fetch(`/api/tickets/${id}`);
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Unable to access this ticket");
            } else {
                setTicket(data.ticket);
                setMessages(data.messages || []);
                setActivityLogs(data.activityLogs || []);
            }
        } catch {
            setError("Network error loading ticket details");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (sessionStatus === "authenticated") {
            if (!hasFetchedRef.current) {
                hasFetchedRef.current = true;
                fetchTicketDetails();
                if (session?.user?.role === "admin") {
                    fetch("/api/users?role=agent")
                        .then((r) => r.json())
                        .then((d) => {
                            if (d.users) setAgents(d.users);
                        })
                        .catch(() => {});
                }
            }
        }
    }, [sessionStatus, session?.user?.role, router, fetchTicketDetails]);

    async function handleUpdateTicket(payload: {
        status?: string;
        priority?: string;
        assignedAgent?: string | null;
    }) {
        setUpdatingMeta(true);
        try {
            const res = await fetch(`/api/tickets/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Update failed");
            } else {
                toast.success("Ticket updated");
                fetchTicketDetails();
            }
        } catch {
            toast.error("Failed to update ticket");
        } finally {
            setUpdatingMeta(false);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        if (replyAttachments.length + files.length > 3) {
            toast.error("Maximum 3 attachments per reply");
            return;
        }

        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const formData = new FormData();
                formData.append("file", file);
                const res = await fetch("/api/upload", {
                    method: "POST",
                    body: formData,
                });
                const data = await res.json();
                if (res.ok && data.attachment) {
                    setReplyAttachments((prev) => [...prev, data.attachment]);
                } else {
                    toast.error(data.error || "Upload failed");
                }
            }
        } finally {
            setUploading(false);
            e.target.value = "";
        }
    }

    async function handlePostMessage(e: React.FormEvent) {
        e.preventDefault();
        if (replyBody.trim().length < 2) {
            toast.error("Please enter a message before sending");
            return;
        }

        setPosting(true);
        try {
            const res = await fetch(`/api/tickets/${id}/messages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    body: replyBody,
                    isInternal,
                    attachments: replyAttachments,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to post reply");
            } else {
                toast.success(
                    isInternal ? "Internal note added (Staff Only)" : "Reply posted"
                );
                setReplyBody("");
                setIsInternal(false);
                setReplyAttachments([]);
                fetchTicketDetails();
            }
        } catch {
            toast.error("Network error while posting message");
        } finally {
            setPosting(false);
        }
    }

    const role = session?.user?.role;

    return (
        <DashboardShell
            title={ticket ? `${ticket.ticketNumber} Details` : "Incident Details"}
            action={
                <Link
                    href="/dashboard"
                    className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Queue
                </Link>
            }
        >
            {loading ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-xs text-slate-400 shadow-baligo">
                    Loading clinical ticket timeline...
                </div>
            ) : error || !ticket ? (
                <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center space-y-3 shadow-baligo">
                    <ShieldAlert className="h-8 w-8 text-rose-500 mx-auto" />
                    <div className="text-base font-bold text-slate-900">
                        {error || "Ticket Not Found"}
                    </div>
                    <p className="text-xs text-slate-500">
                        You can only view tickets created by you or assigned to your support queue.
                    </p>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push("/dashboard")}
                        className="rounded-xl"
                    >
                        Return to Queue
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
                    {/* Left 8 cols: Incident Description & Messages */}
                    <div className="lg:col-span-8 space-y-6 w-full min-w-0">
                        {/* Main Incident Card */}
                        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs font-bold px-3 py-1 rounded-xl bg-[#141738] text-[#00D2B4]">
                                        {ticket.ticketNumber}
                                    </span>
                                    <Badge variant="outline" className="text-xs rounded-lg">
                                        {ticket.category?.name || "Clinical IT"}
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className={`text-xs font-bold rounded-lg ${
                                            ticket.priority === "Urgent"
                                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                                : "bg-slate-50 text-slate-700"
                                        }`}
                                    >
                                        {ticket.priority} Priority
                                    </Badge>
                                    <Badge
                                        variant="outline"
                                        className="text-xs rounded-lg font-medium text-[#6052E9] border-purple-200 bg-purple-50"
                                    >
                                        {ticket.status}
                                    </Badge>
                                </div>

                                <SLACountdown
                                    status={ticket.status}
                                    responseDueDate={ticket.responseDueDate}
                                    resolutionDueDate={ticket.resolutionDueDate}
                                    firstRespondedAt={ticket.firstRespondedAt}
                                    slaBreached={ticket.slaBreached}
                                />
                            </div>

                            <h1 className="text-xl font-bold text-slate-900 leading-snug">
                                {ticket.title}
                            </h1>

                            <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
                                {ticket.description}
                            </div>

                            {ticket.attachments && ticket.attachments.length > 0 && (
                                <div className="space-y-1.5 pt-2">
                                    <div className="text-xs font-semibold text-slate-400">
                                        Attached Diagnostic Files:
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {ticket.attachments.map((att, i) => (
                                            <a
                                                key={i}
                                                href={att.url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-mono text-[#6052E9]"
                                            >
                                                <FileText className="h-3.5 w-3.5" />
                                                {att.name}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-400">
                                <div>
                                    Reported by{" "}
                                    <strong className="text-slate-700">
                                        {ticket.createdBy.name}
                                    </strong>{" "}
                                    ({ticket.createdBy.facility || "Medical Center"})
                                </div>
                                <div className="font-mono">
                                    Logged: {new Date(ticket.createdAt).toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Communication / Message History */}
                        <div className="space-y-4">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                Incident Communication & Diagnostic Updates ({messages.length})
                            </h2>

                            {messages.length === 0 ? (
                                <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-xs text-slate-400 shadow-baligo">
                                    No replies yet. Post the first update below.
                                </div>
                            ) : (
                                messages.map((m) => (
                                    <div
                                        key={m._id}
                                        className={`rounded-2xl border p-5 space-y-2 shadow-baligo ${
                                            m.isInternal
                                                ? "bg-amber-50/70 border-amber-200"
                                                : "bg-white border-slate-100"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-900">
                                                    {m.author?.name || "Support Staff"}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] uppercase font-mono rounded-md"
                                                >
                                                    {m.author?.role || "user"}
                                                </Badge>
                                                {m.isInternal && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-200/80 text-amber-950">
                                                        <Lock className="h-2.5 w-2.5" />
                                                        STAFF NOTE
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] font-mono text-slate-400">
                                                {new Date(m.createdAt).toLocaleString()}
                                            </span>
                                        </div>

                                        <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                            {m.body}
                                        </p>

                                        {m.attachments && m.attachments.length > 0 && (
                                            <div className="flex flex-wrap gap-2 pt-2">
                                                {m.attachments.map((att, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={att.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-xs font-mono text-[#6052E9]"
                                                    >
                                                        <Paperclip className="h-3 w-3" />
                                                        {att.name}
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Reply Form */}
                        {ticket.status !== "Closed" ? (
                            <form
                                onSubmit={handlePostMessage}
                                className="bg-white rounded-2xl border border-slate-100 p-6 shadow-baligo space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-800">
                                        Add Reply or Diagnostic Update
                                    </span>

                                    {(role === "agent" || role === "admin") && (
                                        <label className="inline-flex items-center gap-2 text-xs font-medium text-amber-900 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={isInternal}
                                                onChange={(e) => setIsInternal(e.target.checked)}
                                                className="rounded border-amber-300"
                                            />
                                            <Lock className="h-3 w-3" />
                                            Internal Note (Staff Only)
                                        </label>
                                    )}
                                </div>

                                <Textarea
                                    rows={4}
                                    placeholder={
                                        isInternal
                                            ? "Write an internal technical note visible only to Agents and Admins..."
                                            : "Write your response to the ticket thread..."
                                    }
                                    value={replyBody}
                                    onChange={(e) => setReplyBody(e.target.value)}
                                    className={`rounded-xl text-xs ${
                                        isInternal ? "bg-amber-50/40 border-amber-300" : ""
                                    }`}
                                />

                                {replyAttachments.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {replyAttachments.map((att, i) => (
                                            <span
                                                key={i}
                                                className="px-2.5 py-1 rounded-lg bg-slate-100 border text-xs font-mono"
                                            >
                                                {att.name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-1">
                                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
                                        <Paperclip className="h-3.5 w-3.5" />
                                        <span>
                                            {uploading
                                                ? "Uploading..."
                                                : `Attach File (${replyAttachments.length}/3)`}
                                        </span>
                                        <input
                                            type="file"
                                            accept="image/*,.pdf,.txt,.log"
                                            onChange={handleFileUpload}
                                            disabled={uploading || replyAttachments.length >= 3}
                                            className="hidden"
                                        />
                                    </label>

                                    <Button
                                        type="submit"
                                        size="sm"
                                        disabled={posting || uploading}
                                        className={
                                            isInternal
                                                ? "bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                                                : "bg-[#00D084] hover:bg-[#00BC76] text-white rounded-xl font-bold"
                                        }
                                    >
                                        <Send className="h-3.5 w-3.5 mr-1.5" />
                                        {posting
                                            ? "Sending..."
                                            : isInternal
                                            ? "Save Note"
                                            : "Send Reply"}
                                    </Button>
                                </div>
                            </form>
                        ) : (
                            <div className="bg-slate-100 rounded-2xl border border-slate-200 p-5 text-center text-xs text-slate-500 font-medium">
                                This incident ticket is <strong>Closed</strong> and archived.
                            </div>
                        )}
                    </div>

                    {/* Right 4 cols: Controls & SLA Metadata */}
                    <div className="lg:col-span-4 space-y-6 w-full min-w-0">
                        {/* Incident Controls */}
                        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                Incident Controls
                            </h3>

                            {role === "user" && ticket.status !== "Closed" && (
                                <div className="space-y-2">
                                    <p className="text-xs text-slate-500">
                                        Has your clinical issue been resolved? You can close this ticket at any time.
                                    </p>
                                    <Button
                                        onClick={() => handleUpdateTicket({ status: "Closed" })}
                                        disabled={updatingMeta}
                                        variant="outline"
                                        className="w-full text-xs rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-semibold"
                                    >
                                        <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                                        Mark Incident as Closed
                                    </Button>
                                </div>
                            )}

                            {(role === "agent" || role === "admin") && (
                                <div className="space-y-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Ticket Status
                                        </label>
                                        <Select
                                            value={ticket.status || undefined}
                                            disabled={updatingMeta}
                                            onValueChange={(val) => {
                                                if (val) handleUpdateTicket({ status: val });
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs w-full rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Open">Open</SelectItem>
                                                <SelectItem value="In Progress">In Progress</SelectItem>
                                                <SelectItem value="Waiting on User">Waiting on User</SelectItem>
                                                <SelectItem value="Resolved">Resolved</SelectItem>
                                                <SelectItem value="Closed">Closed</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-700">
                                            Priority Level
                                        </label>
                                        <Select
                                            value={ticket.priority || undefined}
                                            disabled={updatingMeta}
                                            onValueChange={(val) => {
                                                if (val) handleUpdateTicket({ priority: val });
                                            }}
                                        >
                                            <SelectTrigger className="h-9 text-xs w-full rounded-xl">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Low">Low (24h/72h)</SelectItem>
                                                <SelectItem value="Medium">Medium (8h/48h)</SelectItem>
                                                <SelectItem value="High">High (4h/24h)</SelectItem>
                                                <SelectItem value="Urgent">Urgent (1h/8h)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            )}

                            {role === "admin" && (
                                <div className="space-y-1 pt-3 border-t border-slate-100">
                                    <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                                        <UserCheck className="h-3.5 w-3.5 text-[#6052E9]" />
                                        Assign Engineer
                                    </label>
                                    <Select
                                        value={ticket.assignedAgent?._id || "UNASSIGNED"}
                                        disabled={updatingMeta}
                                        onValueChange={(val) =>
                                            handleUpdateTicket({
                                                assignedAgent: val === "UNASSIGNED" ? null : val,
                                            })
                                        }
                                    >
                                        <SelectTrigger className="h-9 text-xs w-full rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UNASSIGNED">-- Unassigned --</SelectItem>
                                            {agents.map((ag) => (
                                                <SelectItem key={ag._id} value={ag._id}>
                                                    {ag.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* SLA Compliance Deadlines */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo space-y-3 text-xs">
                            <h3 className="font-bold uppercase tracking-wider text-slate-400">
                                SLA Compliance Deadlines
                            </h3>

                            <div className="space-y-2 font-mono">
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="text-slate-400">First Response Due:</span>
                                    <span className="text-slate-900 font-semibold">
                                        {new Date(ticket.responseDueDate).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="text-slate-400">First Responded At:</span>
                                    <span className="text-emerald-600 font-semibold">
                                        {ticket.firstRespondedAt
                                            ? new Date(ticket.firstRespondedAt).toLocaleString()
                                            : "Pending Reply"}
                                    </span>
                                </div>
                                <div className="flex justify-between py-1.5">
                                    <span className="text-slate-400">Resolution Due:</span>
                                    <span className="text-slate-900 font-semibold">
                                        {new Date(ticket.resolutionDueDate).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Audit Activity Log */}
                        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <History className="h-3.5 w-3.5" />
                                Audit Activity Log ({activityLogs.length})
                            </h3>

                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                {activityLogs.map((log) => (
                                    <div
                                        key={log._id}
                                        className="text-xs border-l-2 border-purple-300 pl-3 py-0.5 space-y-0.5"
                                    >
                                        <div className="font-semibold text-slate-800">
                                            {log.details}
                                        </div>
                                        <div className="text-[11px] font-mono text-slate-400">
                                            {log.actor?.name || "System"} •{" "}
                                            {new Date(log.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
