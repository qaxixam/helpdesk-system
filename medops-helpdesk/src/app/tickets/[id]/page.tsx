"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
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

export default function TicketDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = use(params);
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

    const fetchTicketDetails = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
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
            fetchTicketDetails();
            if (session?.user?.role === "admin") {
                fetch("/api/users?role=agent")
                    .then((r) => r.json())
                    .then((d) => {
                        if (d.users) setAgents(d.users);
                    })
                    .catch(() => { });
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
        <div className="min-h-screen bg-slate-50">
            <Navbar />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-6">
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" />
                        Back to Incident Queue
                    </Link>
                </div>

                {loading ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-xs text-slate-500">
                        Loading clinical ticket timeline...
                    </div>
                ) : error || !ticket ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-8 text-center space-y-3">
                        <ShieldAlert className="h-8 w-8 text-red-600 mx-auto" />
                        <div className="text-sm font-semibold text-red-900">
                            {error || "Ticket Not Found"}
                        </div>
                        <p className="text-xs text-red-700">
                            Server RBAC Policy: You can only view tickets created by you or
                            assigned to your support queue.
                        </p>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push("/dashboard")}
                        >
                            Return to Queue
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-8 space-y-6">
                            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-2xs space-y-4">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-slate-900 text-teal-400">
                                            {ticket.ticketNumber}
                                        </span>
                                        <Badge variant="outline" className="text-xs">
                                            {ticket.category?.name || "Clinical IT"}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs font-semibold">
                                            {ticket.priority} Priority
                                        </Badge>
                                        <Badge variant="outline" className="text-xs">
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

                                <h1 className="text-xl font-semibold text-slate-900 leading-snug">
                                    {ticket.title}
                                </h1>

                                <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-md border border-slate-200/80">
                                    {ticket.description}
                                </p>

                                {ticket.attachments && ticket.attachments.length > 0 && (
                                    <div className="space-y-1.5 pt-2">
                                        <div className="text-xs font-medium text-slate-500">
                                            Attached Diagnostic Files:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {ticket.attachments.map((att, i) => (
                                                <a
                                                    key={i}
                                                    href={att.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-mono text-teal-700"
                                                >
                                                    <FileText className="h-3.5 w-3.5" />
                                                    {att.name}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-500">
                                    <div>
                                        Reported by{" "}
                                        <strong className="text-slate-800">
                                            {ticket.createdBy.name}
                                        </strong>{" "}
                                        ({ticket.createdBy.facility || "Medical Center"})
                                    </div>
                                    <div className="font-mono">
                                        Logged: {new Date(ticket.createdAt).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
                                    Incident Communication & Notes ({messages.length})
                                </h2>

                                {messages.length === 0 ? (
                                    <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                                        No replies yet. Post the first update below.
                                    </div>
                                ) : (
                                    messages.map((m) => (
                                        <div
                                            key={m._id}
                                            className={`rounded-lg border p-4 space-y-2 ${m.isInternal
                                                    ? "bg-amber-50/70 border-amber-300"
                                                    : "bg-white border-slate-200"
                                                }`}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-slate-900">
                                                        {m.author?.name || "Support Staff"}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px] uppercase font-mono"
                                                    >
                                                        {m.author?.role || "user"}
                                                    </Badge>
                                                    {m.isInternal && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-200/80 text-amber-950">
                                                            <Lock className="h-2.5 w-2.5" />
                                                            INTERNAL STAFF NOTE (Hidden from User)
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] font-mono text-slate-400">
                                                    {new Date(m.createdAt).toLocaleString()}
                                                </span>
                                            </div>

                                            <p className="text-xs sm:text-sm text-slate-800 whitespace-pre-line leading-relaxed">
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
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white text-xs font-mono text-teal-700"
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

                            {ticket.status !== "Closed" ? (
                                <form
                                    onSubmit={handlePostMessage}
                                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-800">
                                            Add Reply or Diagnostic Update
                                        </span>

                                        {(role === "agent" || role === "admin") && (
                                            <label className="inline-flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isInternal}
                                                    onChange={(e) => setIsInternal(e.target.checked)}
                                                    className="rounded border-amber-300"
                                                />
                                                <Lock className="h-3 w-3" />
                                                Post as Internal Note (Staff Only)
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
                                        className={
                                            isInternal ? "bg-amber-50/40 border-amber-300" : ""
                                        }
                                    />

                                    {replyAttachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {replyAttachments.map((att, i) => (
                                                <span
                                                    key={i}
                                                    className="px-2.5 py-1 rounded bg-slate-100 border text-xs font-mono"
                                                >
                                                    {att.name}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-1">
                                        <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900">
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
                                                    ? "bg-amber-600 hover:bg-amber-700 text-white"
                                                    : "bg-slate-900 hover:bg-slate-800 text-white"
                                            }
                                        >
                                            <Send className="h-3.5 w-3.5 mr-1.5" />
                                            {posting
                                                ? "Sending..."
                                                : isInternal
                                                    ? "Save Internal Note"
                                                    : "Send Reply"}
                                        </Button>
                                    </div>
                                </form>
                            ) : (
                                <div className="rounded-lg border border-slate-200 bg-slate-100 p-4 text-center text-xs text-slate-600">
                                    This incident ticket is <strong>Closed</strong> and archived.
                                </div>
                            )}
                        </div>

                        <div className="lg:col-span-4 space-y-6">
                            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Incident Controls
                                </h3>

                                {role === "user" && ticket.status !== "Closed" && (
                                    <div className="space-y-2">
                                        <p className="text-xs text-slate-600">
                                            Has your clinical issue been resolved? You can close this
                                            ticket at any time.
                                        </p>
                                        <Button
                                            onClick={() => handleUpdateTicket({ status: "Closed" })}
                                            disabled={updatingMeta}
                                            variant="outline"
                                            className="w-full text-xs border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                                        >
                                            <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                                            Mark Incident as Closed
                                        </Button>
                                    </div>
                                )}

                                {(role === "agent" || role === "admin") && (
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-700">
                                                Ticket Status
                                            </label>
                                            <Select
                                                value={ticket.status}
                                                disabled={updatingMeta}
                                                onValueChange={(val) =>
                                                    handleUpdateTicket({ status: val })
                                                }
                                            >
                                                <SelectTrigger className="h-9 text-xs w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Open">Open</SelectItem>
                                                    <SelectItem value="In Progress">
                                                        In Progress
                                                    </SelectItem>
                                                    <SelectItem value="Waiting on User">
                                                        Waiting on User
                                                    </SelectItem>
                                                    <SelectItem value="Resolved">Resolved</SelectItem>
                                                    <SelectItem value="Closed">Closed</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-medium text-slate-700">
                                                Priority Level (Recalculates SLA)
                                            </label>
                                            <Select
                                                value={ticket.priority}
                                                disabled={updatingMeta}
                                                onValueChange={(val) =>
                                                    handleUpdateTicket({ priority: val })
                                                }
                                            >
                                                <SelectTrigger className="h-9 text-xs w-full">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Low">Low</SelectItem>
                                                    <SelectItem value="Medium">Medium</SelectItem>
                                                    <SelectItem value="High">High</SelectItem>
                                                    <SelectItem value="Urgent">Urgent</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                )}

                                {role === "admin" && (
                                    <div className="space-y-1 pt-2 border-t border-slate-100">
                                        <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                                            <UserCheck className="h-3.5 w-3.5 text-teal-600" />
                                            Assign / Reassign Engineer
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
                                            <SelectTrigger className="h-9 text-xs w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="UNASSIGNED">
                                                    -- Unassigned --
                                                </SelectItem>
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

                            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-3 text-xs">
                                <h3 className="font-semibold uppercase tracking-wider text-slate-500">
                                    SLA Compliance Deadlines
                                </h3>

                                <div className="space-y-2 font-mono">
                                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                                        <span className="text-slate-500">First Response Due:</span>
                                        <span className="text-slate-900">
                                            {new Date(ticket.responseDueDate).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                                        <span className="text-slate-500">First Responded At:</span>
                                        <span className="text-teal-700">
                                            {ticket.firstRespondedAt
                                                ? new Date(ticket.firstRespondedAt).toLocaleString()
                                                : "Pending Agent Reply"}
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-1.5">
                                        <span className="text-slate-500">Resolution Due:</span>
                                        <span className="text-slate-900">
                                            {new Date(ticket.resolutionDueDate).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
                                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                    <History className="h-3.5 w-3.5" />
                                    Audit Activity Log ({activityLogs.length})
                                </h3>

                                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                                    {activityLogs.map((log) => (
                                        <div
                                            key={log._id}
                                            className="text-xs border-l-2 border-slate-300 pl-3 py-0.5 space-y-0.5"
                                        >
                                            <div className="font-medium text-slate-800">
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
            </main>
        </div>
    );
}