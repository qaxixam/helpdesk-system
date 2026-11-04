"use client";

import { useEffect, useState, useCallback, useRef, use, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { SLACountdown } from "@/components/sla-countdown";
import { TicketDetailSkeleton } from "@/components/ui/skeleton";
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
    PhoneCall,
    Maximize2,
    ExternalLink,
    X,
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

interface PageProps {
    params: Promise<{ id: string }>;
}

function isImageAttachment(url: string, name?: string): boolean {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    const lowerName = (name || "").toLowerCase();
    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".bmp"];
    if (imageExtensions.some((ext) => lowerUrl.endsWith(ext) || lowerName.endsWith(ext))) {
        return true;
    }
    return lowerUrl.includes("/image/upload/") || lowerUrl.startsWith("data:image/");
}

function TicketDetailContent({ params }: PageProps) {
    const unwrappedParams = use(params);
    const id = unwrappedParams?.id;
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();

    const [ticket, setTicket] = useState<TicketDetail | null>(null);
    const [messages, setMessages] = useState<MessageItem[]>([]);
    const [activityLogs, setActivityLogs] = useState<ActivityItem[]>([]);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [hasMoreActivity, setHasMoreActivity] = useState(false);
    const [loadingHistory, setLoadingHistory] = useState<"messages" | "activity" | null>(null);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selectedPreview, setSelectedPreview] = useState<Attachment | null>(null);

    const [replyBody, setReplyBody] = useState("");
    const [isInternal, setIsInternal] = useState(false);
    const [replyAttachments, setReplyAttachments] = useState<Attachment[]>([]);
    const [uploading, setUploading] = useState(false);
    const [posting, setPosting] = useState(false);
    const [updatingMeta, setUpdatingMeta] = useState(false);
    const historyControllerRef = useRef<AbortController | null>(null);

    const fetchTicketDetails = useCallback(async (signal?: AbortSignal) => {
        if (!id) return;
        try {
            setLoading(true);
            setError("");
            const res = await fetch(`/api/tickets/${id}`, { cache: "no-store", signal });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || "Unable to access this ticket");
            } else {
                setTicket(data.ticket);
                setMessages(data.messages || []);
                setActivityLogs(data.activityLogs || []);
                setHasMoreMessages(Boolean(data.hasMoreMessages));
                setHasMoreActivity(Boolean(data.hasMoreActivity));
            }
        } catch (fetchError) {
            if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
            setError("Network error loading ticket details");
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        if (sessionStatus === "unauthenticated") {
            router.push("/login");
            return;
        }
        if (sessionStatus !== "authenticated") return;

        const controller = new AbortController();
        historyControllerRef.current?.abort();
        historyControllerRef.current = null;
        setTicket(null);
        setMessages([]);
        setActivityLogs([]);
        setHasMoreMessages(false);
        setHasMoreActivity(false);
        setLoadingHistory(null);
        setLoading(true);
        fetchTicketDetails(controller.signal);

        if (session?.user?.role === "admin") {
            fetch("/api/users?role=agent", { cache: "no-store", signal: controller.signal })
                .then((r) => (r.ok ? r.json() : null))
                .then((d) => {
                    if (d?.users) setAgents(d.users);
                })
                .catch((fetchError) => {
                    if (!(fetchError instanceof DOMException && fetchError.name === "AbortError")) {
                        setAgents([]);
                    }
                });
        }

        return () => {
            controller.abort();
            historyControllerRef.current?.abort();
        };
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
                if (data.ticket) setTicket(data.ticket);
            }
        } catch {
            toast.error("Failed to update ticket");
        } finally {
            setUpdatingMeta(false);
        }
    }

    async function loadOlderHistory(kind: "messages" | "activity") {
        const cursorItem = kind === "messages" ? messages[0] : activityLogs[activityLogs.length - 1];
        if (!id || !cursorItem || loadingHistory) return;

        const controller = new AbortController();
        historyControllerRef.current?.abort();
        historyControllerRef.current = controller;
        setLoadingHistory(kind);
        try {
            const params = new URLSearchParams({
                history: kind,
                beforeAt: cursorItem.createdAt,
                beforeId: cursorItem._id,
            });
            const res = await fetch(`/api/tickets/${id}?${params}`, { cache: "no-store", signal: controller.signal });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not load older history");

            if (kind === "messages") {
                setMessages((current) => [...(data.messages || []), ...current]);
                setHasMoreMessages(Boolean(data.hasMoreMessages));
            } else {
                setActivityLogs((current) => [...current, ...(data.activityLogs || [])]);
                setHasMoreActivity(Boolean(data.hasMoreActivity));
            }
        } catch (loadError) {
            if (loadError instanceof DOMException && loadError.name === "AbortError") return;
            toast.error(loadError instanceof Error ? loadError.message : "Could not load older history");
        } finally {
            if (historyControllerRef.current === controller) {
                historyControllerRef.current = null;
                setLoadingHistory(null);
            }
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
                if (data.message) setMessages((current) => [...current, data.message]);
                if (data.activityLog) setActivityLogs((current) => [data.activityLog, ...current]);
                if (data.ticket) setTicket((current) => current ? { ...current, ...data.ticket } : current);
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
                    href={role === "user" ? "/tickets" : "/dashboard"}
                    className="h-10 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-white/10"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {role === "user" ? "Back to My Tickets" : "Back to Queue"}
                </Link>
            }
        >
            {loading ? (
                <TicketDetailSkeleton />
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
                        onClick={() => router.push(role === "user" ? "/tickets" : "/dashboard")}
                        className="rounded-xl"
                    >
                        Return to Tickets
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0">
                    {/* Left 8 cols: Incident Description & Messages */}
                    <div className="lg:col-span-8 space-y-6 w-full min-w-0">
                        {/* Main Incident Card */}
                        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
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

                                {role !== "user" && (
                                    <SLACountdown
                                        status={ticket.status}
                                        responseDueDate={ticket.responseDueDate}
                                        resolutionDueDate={ticket.resolutionDueDate}
                                        firstRespondedAt={ticket.firstRespondedAt}
                                        slaBreached={ticket.slaBreached}
                                    />
                                )}
                            </div>

                            <h1 className="text-xl font-bold text-slate-900 leading-snug">
                                {ticket.title}
                            </h1>

                            <div className="text-xs sm:text-sm text-slate-700 whitespace-pre-line leading-relaxed bg-[#F8FAFC] p-4 rounded-xl border border-slate-100">
                                {ticket.description}
                            </div>

                            {ticket.attachments && ticket.attachments.length > 0 && (
                                <div className="space-y-3 pt-3 border-t border-slate-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                                            <Paperclip className="h-3.5 w-3.5 text-[#5b4fe9]" />
                                            <span>Incident Attachments ({ticket.attachments.length}/3)</span>
                                        </div>
                                        <span className="text-[11px] text-slate-400">
                                            Click any image to preview
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {ticket.attachments.map((att, i) => {
                                            const isImg = isImageAttachment(att.url, att.name);
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => setSelectedPreview(att)}
                                                    className="group relative rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-xs hover:shadow-md hover:border-[#5b4fe9]/50 transition-all cursor-pointer flex flex-col"
                                                >
                                                    {isImg ? (
                                                        <div className="relative aspect-video sm:aspect-[4/3] w-full bg-slate-900 overflow-hidden">
                                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                                            <img
                                                                src={att.url}
                                                                alt={att.name}
                                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                            />
                                                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                <span className="px-2.5 py-1 rounded-lg bg-white/95 text-slate-900 text-xs font-bold flex items-center gap-1 shadow-md">
                                                                    <Maximize2 className="h-3.5 w-3.5 text-[#5b4fe9]" />
                                                                    View
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-video w-full bg-slate-50 flex items-center justify-center text-slate-400">
                                                            <FileText className="h-8 w-8 text-slate-400" />
                                                        </div>
                                                    )}
                                                    <div className="p-2.5 bg-white flex items-center justify-between gap-2 border-t border-slate-100">
                                                        <span className="text-xs font-medium text-slate-700 truncate" title={att.name}>
                                                            {att.name}
                                                        </span>
                                                        <a
                                                            href={att.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="Open in new tab"
                                                            className="text-slate-400 hover:text-[#5b4fe9] p-1 rounded-md hover:bg-slate-50 transition"
                                                        >
                                                            <ExternalLink className="h-3.5 w-3.5" />
                                                        </a>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 text-xs text-slate-400">
                                <div className="flex items-center gap-1.5">
                                    <span>Submitted:</span>
                                    <strong className="text-slate-600 font-medium">
                                        {new Date(ticket.createdAt).toLocaleString(undefined, {
                                            month: "short",
                                            day: "numeric",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </strong>
                                </div>
                                <div className="text-slate-500">
                                    Facility: <strong className="text-slate-700">{ticket.createdBy?.facility || "Main Medical Center"}</strong>
                                </div>
                            </div>
                        </div>

                        {/* Communication / Message History */}
                        <div className="space-y-4">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                                Incident Communication & Diagnostic Updates ({messages.length} loaded)
                            </h2>

                            {hasMoreMessages && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={loadingHistory !== null}
                                    onClick={() => loadOlderHistory("messages")}
                                    className="rounded-lg text-xs"
                                >
                                    {loadingHistory === "messages" ? "Loading older replies…" : "Load older replies"}
                                </Button>
                            )}

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
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                                                {m.attachments.map((att, idx) => {
                                                    const isImg = isImageAttachment(att.url, att.name);
                                                    return (
                                                        <div
                                                            key={idx}
                                                            onClick={() => setSelectedPreview(att)}
                                                            className="group relative rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs hover:border-[#5b4fe9] transition cursor-pointer"
                                                        >
                                                            {isImg ? (
                                                                <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
                                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                    <img
                                                                        src={att.url}
                                                                        alt={att.name}
                                                                        loading="lazy"
                                                                        decoding="async"
                                                                        className="w-full h-full object-cover group-hover:scale-105 transition"
                                                                    />
                                                                    <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                                                                        <Maximize2 className="h-4 w-4 text-white" />
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="p-2 flex items-center gap-1.5 text-xs text-slate-600">
                                                                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                                                                    <span className="truncate">{att.name}</span>
                                                                </div>
                                                            )}
                                                            <div className="p-1.5 bg-slate-50/80 text-[10px] text-slate-600 truncate border-t border-slate-100">
                                                                {att.name}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
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
                                className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-6 shadow-baligo space-y-4"
                            >
                                <div className="flex items-center justify-between gap-2 flex-wrap">
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

                                <div className="flex items-center justify-between pt-1 gap-2 flex-wrap">
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

                    {/* Right 4 cols: Controls & Information */}
                    <div className="lg:col-span-4 space-y-6 w-full min-w-0">
                        {role === "user" ? (
                            /* User Friendly Right Sidebar */
                            <>
                                {/* Ticket Status Summary Card */}
                                <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                            Ticket Status
                                        </h3>
                                        <Badge
                                            variant="outline"
                                            className="text-xs rounded-lg font-bold text-[#6052E9] border-purple-200 bg-purple-50"
                                        >
                                            {ticket.status}
                                        </Badge>
                                    </div>

                                    <p className="text-xs text-slate-500 leading-relaxed bg-[#F8FAFC] p-3 rounded-xl border border-slate-100">
                                        {ticket.status === "Open" && "Your incident report has been received and queued. A support engineer will review it shortly."}
                                        {ticket.status === "In Progress" && "A support engineer is actively investigating and working on this incident."}
                                        {ticket.status === "Waiting on User" && "The engineer has requested additional details. Please reply to the thread to continue."}
                                        {ticket.status === "Resolved" && "Our engineering team has marked this incident as resolved. Please verify your system."}
                                        {ticket.status === "Closed" && "This incident has been resolved and archived."}
                                    </p>

                                    <div className="space-y-3 pt-2 text-xs">
                                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                                            <span className="text-slate-400 font-medium">Assigned Support</span>
                                            {ticket.assignedAgent ? (
                                                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    <span>{ticket.assignedAgent.name.split(" (")[0]}</span>
                                                </div>
                                            ) : (
                                                <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md text-[10px] uppercase">
                                                    In Triage Queue
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                                            <span className="text-slate-400 font-medium">Category</span>
                                            <span className="font-semibold text-slate-800">
                                                {ticket.category?.name || "General IT"}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between py-1.5">
                                            <span className="text-slate-400 font-medium">Priority Level</span>
                                            <Badge
                                                variant="outline"
                                                className={`text-[11px] rounded-lg px-2 py-0.5 font-bold ${
                                                    ticket.priority === "Urgent"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200"
                                                        : "bg-slate-50 text-slate-700"
                                                }`}
                                            >
                                                {ticket.priority}
                                            </Badge>
                                        </div>
                                    </div>

                                    {ticket.status !== "Closed" && (
                                        <div className="pt-3 border-t border-slate-100">
                                            <p className="text-[11px] text-slate-400 mb-2">
                                                Has your issue been resolved?
                                            </p>
                                            <Button
                                                onClick={() => handleUpdateTicket({ status: "Closed" })}
                                                disabled={updatingMeta}
                                                variant="outline"
                                                className="w-full text-xs rounded-xl border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold cursor-pointer"
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" />
                                                Close Incident Ticket
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Clinical IT Emergency Contact Card (Baligo midnight navy) */}
                                <div className="bg-[#141738] text-white rounded-2xl p-5 sm:p-6 border border-white/5 shadow-baligo space-y-3">
                                    <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider">
                                        <PhoneCall className="h-3.5 w-3.5" />
                                        Hospital IT Operations
                                    </div>
                                    <h4 className="text-sm font-bold text-white">
                                        Critical Patient System Down?
                                    </h4>
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        For operating room or immediate patient care downtime, dial SOC helpline:
                                    </p>
                                    <div className="py-1">
                                        <div className="text-2xl font-black text-[#00D2B4] font-mono">
                                            EXT 4040
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                            24/7 Priority Emergency Dispatch
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Agent & Admin Right Sidebar with Controls, SLA, & Audit */
                            <>
                                {/* Incident Controls */}
                                <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-100 shadow-baligo space-y-4 w-full min-w-0 overflow-hidden">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                                        Incident Controls
                                    </h3>

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
                                        Audit Activity Log ({activityLogs.length} loaded)
                                    </h3>

                                    {hasMoreActivity && (
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            disabled={loadingHistory !== null}
                                            onClick={() => loadOlderHistory("activity")}
                                            className="rounded-lg text-xs"
                                        >
                                            {loadingHistory === "activity" ? "Loading older activity…" : "Load older activity"}
                                        </Button>
                                    )}

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
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Fullscreen Responsive Image Lightbox Modal */}
            {selectedPreview && (
                <div
                    className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 transition-all"
                    onClick={() => setSelectedPreview(null)}
                >
                    <div
                        className="relative bg-[#141738] rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-white"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-3.5 sm:p-4 border-b border-white/10 bg-white/5">
                            <div className="flex items-center gap-2 min-w-0 pr-3">
                                <FileText className="h-4 w-4 text-[#00D2B4] shrink-0" />
                                <span className="text-xs sm:text-sm font-bold truncate">
                                    {selectedPreview.name}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a
                                    href={selectedPreview.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="h-8 px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition"
                                >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Open Original</span>
                                </a>
                                <button
                                    onClick={() => setSelectedPreview(null)}
                                    className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Image Body */}
                        <div className="flex-1 p-2 sm:p-4 flex items-center justify-center bg-slate-950/50 overflow-auto">
                            {isImageAttachment(selectedPreview.url, selectedPreview.name) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={selectedPreview.url}
                                    alt={selectedPreview.name}
                                    className="max-w-full max-h-[75vh] w-auto h-auto object-contain rounded-lg shadow-lg select-none"
                                />
                            ) : (
                                <div className="p-10 text-center text-slate-400 space-y-3">
                                    <FileText className="h-14 w-14 mx-auto text-slate-400" />
                                    <p className="text-sm">This file is not an image.</p>
                                    <a
                                        href={selectedPreview.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#5b4fe9] text-white text-xs font-bold"
                                    >
                                        Download File
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}

export default function TicketDetailPage({ params }: PageProps) {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#F4F6FB] p-4 sm:p-8">
                    <TicketDetailSkeleton />
                </div>
            }
        >
            <TicketDetailContent params={params} />
        </Suspense>
    );
}
