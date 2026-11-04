"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ArrowLeft, FileText, Lock, MessageSquareText, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { ApiError, fetchJson } from "@/lib/api-client";
import type { ActivityRow, Attachment, MessageRow, Role, TicketRow, UserRow } from "@/lib/types";
import { createMessageSchema, PRIORITIES, STATUSES } from "@/lib/validations";
import { cn, displayName } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { SlaTrace } from "@/components/sla";
import { AttachmentPicker } from "@/components/create-ticket-modal";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { PriorityBadge, RoleBadge, StatusBadge, TicketId } from "@/components/ui/badges";
import { Avatar, EmptyState, ErrorState, Panel, Segmented, Skeleton } from "@/components/ui/primitives";

interface TicketPayload {
  ticket: TicketRow;
  messages: MessageRow[];
  activityLogs: ActivityRow[];
  hasMoreMessages: boolean;
  hasMoreActivity: boolean;
}

function AttachmentList({ items }: { items: Attachment[] }) {
  if (!items?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {items.map((a) => (
        <a
          key={a.url}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 max-w-[240px] items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] text-ink-2 hover:border-teal-200 hover:text-teal-700"
        >
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{a.name}</span>
        </a>
      ))}
    </div>
  );
}

function Message({ m }: { m: MessageRow }) {
  const role = (m.author?.role ?? "user") as Role;
  return (
    <li
      className={cn(
        "rounded-lg border px-4 py-3.5 sm:px-5",
        m.isInternal
          ? "border-warn/30 bg-[repeating-linear-gradient(135deg,var(--color-warn-soft)_0_10px,#fdf7ea_10px_20px)]"
          : role === "user"
            ? "border-line bg-surface"
            : "border-teal-100 bg-teal-50/50",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <Avatar name={m.author?.name} size={26} />
        <span className="text-[13.5px] font-semibold text-ink">{displayName(m.author?.name)}</span>
        <RoleBadge role={role} />
        {m.isInternal && (
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-warn">
            <Lock className="size-3" /> Internal note · staff only
          </span>
        )}
        <time className="ml-auto text-[12px] text-ink-4" dateTime={m.createdAt} title={format(new Date(m.createdAt), "PPpp")}>
          {formatDistanceToNowStrict(new Date(m.createdAt), { addSuffix: true })}
        </time>
      </div>
      <p className="mt-2.5 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-ink-2">{m.body}</p>
      <AttachmentList items={m.attachments} />
    </li>
  );
}

const ACTION_LABEL: Record<string, string> = {
  TICKET_CREATED: "Created",
  STATUS_CHANGED: "Status",
  ASSIGNED: "Assigned",
  UNASSIGNED: "Unassigned",
  PRIORITY_CHANGED: "Priority",
  REPLY_POSTED: "Reply",
  INTERNAL_NOTE_ADDED: "Note",
  SLA_BREACHED: "SLA",
  AUTO_CLOSED: "Auto-close",
};

function ActivityTimeline({ items }: { items: ActivityRow[] }) {
  if (items.length === 0) return <p className="py-4 text-center text-[13px] text-ink-3">No entries yet.</p>;
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {items.map((a) => (
        <li key={a._id} className="relative">
          <span
            className={cn(
              "absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-surface",
              a.action === "SLA_BREACHED" ? "bg-urgent" : a.action === "STATUS_CHANGED" ? "bg-teal-500" : "bg-line-strong",
            )}
            aria-hidden
          />
          <p className="text-[13px] leading-snug text-ink-2">
            <span className="font-medium text-ink">{a.actor ? displayName(a.actor.name) : "System"}</span> — {a.details}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-4">
            {ACTION_LABEL[a.action] ?? a.action} · {format(new Date(a.createdAt), "MMM d, HH:mm")}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-[13px] text-ink-3">{label}</dt>
      <dd className="min-w-0 text-right text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;
  const isStaff = role === "agent" || role === "admin";
  const queryClient = useQueryClient();

  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [tab, setTab] = useState<"all" | "status">("all");
  const [older, setOlder] = useState<{ messages: MessageRow[]; activity: ActivityRow[]; moreM?: boolean; moreA?: boolean }>({
    messages: [],
    activity: [],
  });

  const q = useQuery({
    queryKey: ["ticket", id],
    queryFn: ({ signal }) => fetchJson<TicketPayload>(`/api/tickets/${id}`, { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
  });

  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: ({ signal }) => fetchJson<{ users: UserRow[] }>("/api/users?role=agent&active=true&limit=100", { signal }),
    enabled: role === "admin",
    staleTime: 5 * 60_000,
  });

  const t = q.data?.ticket;
  const messages = [...older.messages, ...(q.data?.messages ?? [])];
  const activity = [...(q.data?.activityLogs ?? []), ...older.activity];
  const hasMoreMessages = older.moreM ?? q.data?.hasMoreMessages;
  const hasMoreActivity = older.moreA ?? q.data?.hasMoreActivity;
  const closed = t?.status === "Closed";

  async function refresh() {
    setOlder({ messages: [], activity: [] });
    await queryClient.invalidateQueries({ queryKey: ["ticket", id] });
    void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    void queryClient.invalidateQueries({ queryKey: ["overview"] });
    void queryClient.invalidateQueries({ queryKey: ["analytics"] });
  }

  async function update(patch: Record<string, unknown>, success: string) {
    setUpdating(true);
    try {
      await fetchJson(`/api/tickets/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      toast.success(success);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUpdating(false);
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createMessageSchema.safeParse({ body, isInternal: isStaff && internal, attachments: files });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your message");
      return;
    }
    setSending(true);
    try {
      await fetchJson(`/api/tickets/${id}/messages`, { method: "POST", body: JSON.stringify(parsed.data) });
      setBody("");
      setFiles([]);
      toast.success(parsed.data.isInternal ? "Internal note added" : "Reply sent");
      await refresh();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function loadOlder(kind: "messages" | "activity") {
    const list = kind === "messages" ? messages : activity;
    const cursor = kind === "messages" ? list[0] : list[list.length - 1];
    if (!cursor) return;
    try {
      const p = new URLSearchParams({ history: kind, beforeAt: cursor.createdAt, beforeId: cursor._id });
      const data = await fetchJson<{ messages?: MessageRow[]; activityLogs?: ActivityRow[]; hasMoreMessages?: boolean; hasMoreActivity?: boolean }>(
        `/api/tickets/${id}?${p}`,
      );
      setOlder((o) =>
        kind === "messages"
          ? { ...o, messages: [...(data.messages ?? []), ...o.messages], moreM: data.hasMoreMessages }
          : { ...o, activity: [...o.activity, ...(data.activityLogs ?? [])], moreA: data.hasMoreActivity },
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const backHref = role === "admin" ? "/admin/tickets" : "/tickets";
  const back = (
    <Link href={backHref} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-3 hover:text-ink">
      <ArrowLeft className="size-3.5" /> {role === "admin" ? "All tickets" : role === "agent" ? "My queue" : "My tickets"}
    </Link>
  );

  if (q.isError) {
    const notFound = q.error instanceof ApiError && (q.error.status === 404 || q.error.status === 403);
    return (
      <AppShell title={notFound ? "Ticket not found" : "Ticket"} back={back}>
        <Panel>
          {notFound ? (
            <EmptyState
              title="This ticket doesn’t exist or isn’t shared with you"
              description="Check the link, or go back to your list."
            />
          ) : (
            <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
          )}
        </Panel>
      </AppShell>
    );
  }

  if (!t) {
    return (
      <AppShell title={<Skeleton className="h-8 w-80 max-w-full" />} back={back}>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </AppShell>
    );
  }

  const statusLogs = activity.filter((a) => ["STATUS_CHANGED", "TICKET_CREATED", "AUTO_CLOSED"].includes(a.action));

  return (
    <AppShell
      back={back}
      title={t.title}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <TicketId value={t.ticketNumber} className="text-[13px]" />
          <StatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
          <span className="text-[13px] text-ink-3">
            Opened {formatDistanceToNowStrict(new Date(t.createdAt), { addSuffix: true })} by {displayName(t.createdBy?.name)}
          </span>
        </span>
      }
      actions={
        role === "user" && !closed ? (
          <Button variant="secondary" loading={updating} onClick={() => update({ status: "Closed" }, "Ticket closed")}>
            Close ticket
          </Button>
        ) : null
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ---------------- Conversation ---------------- */}
        <div className="min-w-0 space-y-4">
          {role === "user" && t.status === "Resolved" && (
            <div className="flex flex-col gap-3 rounded-lg border border-ok/25 bg-ok-soft px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[13.5px] text-ink-2">
                <span className="font-semibold text-ok">Marked as resolved.</span> Is it working? Close the ticket, or reply below to
                reopen it. It closes on its own after 3 days.
              </p>
              <Button size="sm" onClick={() => update({ status: "Closed" }, "Ticket closed")} loading={updating}>
                Yes, close it
              </Button>
            </div>
          )}
          {role === "user" && t.status === "Waiting on User" && (
            <div className="rounded-lg border border-warn/30 bg-warn-soft px-5 py-4 text-[13.5px] text-ink-2">
              <span className="font-semibold text-warn">Support is waiting for you.</span> Reply below with the details they asked for.
            </div>
          )}

          <Panel className="px-5 py-5">
            <div className="flex items-center gap-2.5">
              <Avatar name={t.createdBy?.name} size={26} />
              <span className="text-[13.5px] font-semibold text-ink">{displayName(t.createdBy?.name)}</span>
              {t.createdBy?.facility && <span className="truncate text-[12.5px] text-ink-3">{t.createdBy.facility}</span>}
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-ink">{t.description}</p>
            {!!t.attachments?.length && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-3">
                  <Paperclip className="size-3.5" /> {t.attachments.length} attachment{t.attachments.length > 1 ? "s" : ""}
                </p>
                <AttachmentList items={t.attachments} />
              </div>
            )}
          </Panel>

          <div className="flex items-center justify-between pt-2">
            <h2 className="text-[15px] font-semibold text-ink">Conversation</h2>
            <span className="text-[12.5px] text-ink-3">{messages.length} shown</span>
          </div>

          {hasMoreMessages && (
            <Button variant="ghost" size="sm" className="w-full" onClick={() => loadOlder("messages")}>
              Load earlier messages
            </Button>
          )}

          {messages.length === 0 ? (
            <Panel>
              <EmptyState
                icon={MessageSquareText}
                title="No replies yet"
                description={isStaff ? "Your first public reply stops the first-response clock." : "Support will reply here. You’ll also get an email."}
              />
            </Panel>
          ) : (
            <ul className="space-y-3">
              {messages.map((m) => (
                <Message key={m._id} m={m} />
              ))}
            </ul>
          )}

          {/* Composer */}
          {closed ? (
            <div className="rounded-lg border border-dashed border-line-strong px-5 py-4 text-center text-[13.5px] text-ink-3">
              This ticket is closed. {role === "user" ? "Raise a new ticket if the problem comes back." : "Change the status to reopen it."}
            </div>
          ) : (
            <form
              onSubmit={send}
              className={cn(
                "rounded-lg border bg-surface p-3 shadow-raise transition-colors sm:p-4",
                internal ? "border-warn/50 bg-[#fffaf0]" : "border-line",
              )}
            >
              {isStaff && (
                <div className="mb-3">
                  <Segmented
                    value={internal ? "note" : "reply"}
                    onChange={(v) => setInternal(v === "note")}
                    options={[
                      { value: "reply", label: "Reply to requester" },
                      { value: "note", label: "Internal note" },
                    ]}
                  />
                </div>
              )}
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={internal ? "Only agents and admins will see this note" : "Write a reply…"}
                rows={4}
                maxLength={5000}
                aria-label="Message"
                className="border-0 px-1 shadow-none focus:ring-0"
              />
              <div className="mt-2 flex flex-col gap-3 border-t border-line pt-3 sm:flex-row sm:items-center sm:justify-between">
                <AttachmentPicker files={files} onChange={setFiles} disabled={sending} />
                <Button type="submit" loading={sending} disabled={body.trim().length < 2}>
                  {!sending && (internal ? <Lock /> : <Send />)}
                  {internal ? "Add note" : "Send reply"}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* ---------------- Sidebar ---------------- */}
        <aside className="space-y-5">
          <Panel className="px-5 py-5">
            <SlaTrace ticket={t} />
          </Panel>

          <Panel className="px-5 py-3">
            <dl className="divide-y divide-line">
              <Detail label="Status">
                {isStaff ? (
                  <Select
                    aria-label="Change status"
                    value={t.status}
                    disabled={updating}
                    onChange={(e) => update({ status: e.target.value }, `Status set to ${e.target.value}`)}
                    className="w-44 [&_select]:h-8 [&_select]:text-[13px]"
                  >
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                ) : (
                  <StatusBadge status={t.status} />
                )}
              </Detail>
              <Detail label="Priority">
                {isStaff && !closed ? (
                  <Select
                    aria-label="Change priority"
                    value={t.priority}
                    disabled={updating}
                    onChange={(e) => update({ priority: e.target.value }, `Priority set to ${e.target.value}`)}
                    className="w-44 [&_select]:h-8 [&_select]:text-[13px]"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </Select>
                ) : (
                  <PriorityBadge priority={t.priority} />
                )}
              </Detail>
              <Detail label="Assignee">
                {role === "admin" && !closed ? (
                  <Select
                    aria-label="Assign agent"
                    value={t.assignedAgent?._id ?? ""}
                    disabled={updating}
                    onChange={(e) =>
                      update({ assignedAgent: e.target.value || null }, e.target.value ? "Ticket assigned" : "Ticket unassigned")
                    }
                    className="w-44 [&_select]:h-8 [&_select]:text-[13px]"
                  >
                    <option value="">Unassigned</option>
                    {agents.data?.users.map((a) => (
                      <option key={a._id} value={a._id}>
                        {displayName(a.name)}
                      </option>
                    ))}
                  </Select>
                ) : t.assignedAgent ? (
                  displayName(t.assignedAgent.name)
                ) : (
                  <span className="text-ink-4">Not assigned yet</span>
                )}
              </Detail>
              <Detail label="Category">{t.category?.name ?? "—"}</Detail>
              <Detail label="Requester">
                <span className="block truncate">{displayName(t.createdBy?.name)}</span>
              </Detail>
              <Detail label="Reply due">{format(new Date(t.responseDueDate), "MMM d, HH:mm")}</Detail>
              <Detail label="Fix due">{format(new Date(t.resolutionDueDate), "MMM d, HH:mm")}</Detail>
              {t.firstRespondedAt && <Detail label="First reply">{format(new Date(t.firstRespondedAt), "MMM d, HH:mm")}</Detail>}
              {t.resolvedAt && <Detail label="Resolved">{format(new Date(t.resolvedAt), "MMM d, HH:mm")}</Detail>}
            </dl>
          </Panel>

          <Panel className="px-5 py-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-[13px] font-semibold text-ink">History</h3>
              <Segmented
                value={tab}
                onChange={setTab}
                options={[
                  { value: "all", label: "Activity" },
                  { value: "status", label: "Status" },
                ]}
              />
            </div>
            <ActivityTimeline items={tab === "all" ? activity : statusLogs} />
            {hasMoreActivity && (
              <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => loadOlder("activity")}>
                Load older entries
              </Button>
            )}
          </Panel>
        </aside>
      </div>
    </AppShell>
  );
}
