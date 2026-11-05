"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, Clock3, Inbox, OctagonAlert, Plus } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { cn, displayName } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { VitalsStrip } from "@/components/kpi";
import { TicketList } from "@/components/ticket-list";
import { CreateTicketModal } from "@/components/create-ticket-modal";
import { Button, ButtonLink } from "@/components/ui/button";
import { Avatar, ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { RoleBadge, TicketId } from "@/components/ui/badges";
import { HBarList } from "@/components/charts";
import { SLA_RULES } from "@/lib/sla";
import { PRIORITIES, STATUSES } from "@/lib/validations";
import type { ActivityRow } from "@/lib/types";

interface Overview {
  summary: {
    total: number;
    active: number;
    waiting: number;
    urgent: number;
    breached: number;
    resolved: number;
    awaitingResponse: number;
    resolutionRate: number;
  };
  byStatus: { status: string; count: number }[];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * Requester status card: one compact run of icon + number + label, inside a
 * single Panel — not a grid of separate stat tiles. Reads as one instrument
 * reading, not four dashboard widgets repeating the same small numbers.
 */
function StatusPanel({ s, loading }: { s?: Overview["summary"]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Skeleton className="col-span-2 h-[88px] rounded-2xl sm:col-span-2" />
        <Skeleton className="h-[88px] rounded-2xl" />
        <Skeleton className="h-[88px] rounded-2xl" />
      </div>
    );
  }
  if (!s) return null;

  const items: { icon: typeof Inbox; value: number; label: string; tone: "ink" | "warn" | "urgent" | "ok" }[] = [
    { icon: Inbox, value: s.active, label: s.active === 1 ? "open ticket" : "open tickets", tone: "ink" },
  ];
  if (s.waiting > 0) items.push({ icon: Clock3, value: s.waiting, label: "waiting on your reply", tone: "warn" });
  if (s.breached > 0) items.push({ icon: OctagonAlert, value: s.breached, label: "past a deadline", tone: "urgent" });
  items.push({ icon: CheckCircle2, value: s.resolved, label: "resolved", tone: "ok" });

  const toneText: Record<string, string> = { ink: "text-ink", warn: "text-warn", urgent: "text-urgent", ok: "text-ok" };
  const toneIcon: Record<string, string> = { ink: "text-ink-4", warn: "text-warn", urgent: "text-urgent", ok: "text-ok" };

  // 2, 3 or 4 tiles — the primary (open) tile stays wide; with 4 tiles every
  // tile is equal-width so the grid fills cleanly (a wide primary would
  // otherwise leave a half-empty trailing row).
  const even = items.length === 4;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((it, i) => (
        <div
          key={it.label}
          className={cn(
            "glass relative overflow-hidden rounded-2xl px-5 py-5 transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
            i === 0 && !even ? "col-span-2 sm:col-span-2" : "col-span-1",
          )}
        >
          <it.icon className={cn("size-[18px]", toneIcon[it.tone])} aria-hidden />
          <p className={cn("num mt-2.5 font-semibold leading-tight tracking-[-0.02em]", i === 0 && !even ? "text-[34px]" : "text-[26px]", toneText[it.tone])}>
            {it.value}
          </p>
          <p className={cn("text-ink-3", i === 0 && !even ? "mt-1 text-[13.5px]" : "text-[12.5px]")}>{it.label}</p>
          {i === 0 && <p className="mt-1.5 text-[12.5px] text-ink-4">{s.total} raised in total</p>}
        </div>
      ))}
    </div>
  );
}

/** Compact reference card — the SLA table, sized for a sidebar. */
function ResponseTargetsPanel() {
  return (
    <Panel>
      <PanelHeader title="Response targets" description="How fast support commits to act" />
      <ul className="divide-y divide-line">
        {[...PRIORITIES].reverse().map((p) => (
          <li key={p} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
            <span className="text-ink-2">{p}</span>
            <span className="num text-ink-3">
              <span className="font-medium text-ink">{SLA_RULES[p].responseHours}h</span> reply,{" "}
              <span className="font-medium text-ink">{SLA_RULES[p].resolutionHours}h</span> fix
            </span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** A handful of the requester's most recent events — real content for the sidebar, not filler. */
function RecentActivityPanel() {
  const q = useQuery({
    queryKey: ["activity", "recent"],
    queryFn: ({ signal }) => fetchJson<{ activities: ActivityRow[] }>("/api/activity?limit=5", { signal }),
    staleTime: 30_000,
  });

  const items = q.data?.activities ?? [];

  return (
    <Panel>
      <PanelHeader title="Recent activity" action={<Link href="/activity" className="text-[13px] font-medium text-teal-700 hover:underline">View all</Link>} />
      {q.isPending ? (
        <div className="space-y-4 px-5 py-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-7 shrink-0 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-ink-3">Nothing yet — activity on your tickets shows up here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a._id} className="flex gap-3 px-5 py-3">
              {a.actor ? (
                <Avatar name={a.actor.name} size={26} />
              ) : (
                <span className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-ward text-[9.5px] font-semibold text-teal-200">
                  SYS
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug text-ink-2">
                  <span className="font-semibold text-ink">{a.actor ? displayName(a.actor.name) : "System"}</span>{" "}
                  {a.actor?.role && <RoleBadge role={a.actor.role} />} <span className="ml-0.5">{a.details}</span>
                </p>
                {a.ticket && (
                  <Link href={`/tickets/${a.ticket._id}`} className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-teal-700">
                    <TicketId value={a.ticket.ticketNumber} />
                    <span className="truncate">{a.ticket.title}</span>
                  </Link>
                )}
                <time className="num mt-0.5 block text-[11.5px] text-ink-4" dateTime={a.createdAt}>
                  {formatDistanceToNowStrict(new Date(a.createdAt), { addSuffix: true })}
                </time>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const role = session?.user?.role;
  const [creating, setCreating] = useState(false);

  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: ({ signal }) => fetchJson<Overview>("/api/agent/overview", { signal }),
    enabled: role === "agent" || role === "user",
    refetchInterval: 60_000,
  });

  const s = overview.data?.summary;
  const isAgent = role === "agent";
  const isUser = role === "user";
  const firstName = displayName(session?.user?.name).split(" ")[0];

  const vitals = [
    { label: "Active in my queue", value: s?.active ?? 0, context: `${s?.total ?? 0} assigned in total` },
    { label: "Awaiting first reply", value: s?.awaitingResponse ?? 0, context: "Reply to stop the response clock" },
    {
      label: "Urgent",
      value: s?.urgent ?? 0,
      context: `${SLA_RULES.Urgent.responseHours}h response target`,
      tone: (s?.urgent ? "alert" : "default") as "alert" | "default",
    },
    {
      label: "SLA breached",
      value: s?.breached ?? 0,
      context: "Active tickets past a deadline",
      tone: (s?.breached ? "alert" : "default") as "alert" | "default",
    },
    { label: "Resolution rate", value: `${s?.resolutionRate ?? 0}%`, context: `${s?.resolved ?? 0} resolved or closed` },
  ];

  const statusData = STATUSES.map((st) => ({
    label: st,
    value: overview.data?.byStatus.find((b) => b.status === st)?.count ?? 0,
  }));

  return (
    <AppShell
      title={status === "loading" ? "Overview" : `${greeting()}, ${firstName}`}
      description={
        isAgent
          ? "Your queue, sorted newest first. Red means a clock has run out."
          : "Track the tickets you’ve raised and reply when support asks for details."
      }
      actions={
        isUser ? (
          <Button onClick={() => setCreating(true)}>
            <Plus /> New ticket
          </Button>
        ) : isAgent ? (
          <ButtonLink href="/tickets" variant="secondary">
            Open full queue
          </ButtonLink>
        ) : null
      }
    >
      {overview.isError ? (
        <Panel>
          <ErrorState message={overview.error.message} onRetry={() => overview.refetch()} />
        </Panel>
      ) : isUser ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-5">
            <StatusPanel s={s} loading={overview.isPending} />

            <div>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold text-ink">Your tickets</h2>
                <ButtonLink href="/tickets" variant="quiet" size="sm">
                  View all
                </ButtonLink>
              </div>
              <TicketList
                role="user"
                initial={{ scope: "active" }}
                pageSize={6}
                showFilters={false}
                layout="rows"
                emptyAction={
                  <Button onClick={() => setCreating(true)}>
                    <Plus /> Raise a ticket
                  </Button>
                }
              />
            </div>
          </div>

          <div className="space-y-5">
            <RecentActivityPanel />
            <ResponseTargetsPanel />
          </div>
        </div>
      ) : (
        <>
          <VitalsStrip items={vitals} loading={overview.isPending} />

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-ink">
                  Needs attention
                  {!!s?.active && <span className="num text-[13px] font-normal text-ink-3">{s.active}</span>}
                </h2>
                <ButtonLink href="/tickets" variant="quiet" size="sm">
                  View all
                </ButtonLink>
              </div>
              {role && <TicketList role={role} initial={{ scope: "active" }} pageSize={6} showFilters={false} layout="rows" />}
            </div>

            <div className="space-y-6">
              <Panel>
                <PanelHeader title="By status" description="Everything assigned to you" />
                <div className="px-5 py-5">
                  <HBarList data={statusData} emptyLabel="Nothing here yet" />
                </div>
              </Panel>
              <Panel>
                <PanelHeader title="Response targets" description="How fast support commits to act" />
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-ink-3">
                      <th className="px-5 pb-1.5 pt-3 text-left font-medium">Priority</th>
                      <th className="px-2 pb-1.5 pt-3 text-right font-medium">Reply</th>
                      <th className="px-5 pb-1.5 pt-3 text-right font-medium">Fix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...PRIORITIES].reverse().map((p) => (
                      <tr key={p} className="border-t border-line">
                        <td className="px-5 py-2.5 text-ink-2">{p}</td>
                        <td className="num px-2 py-2.5 text-right font-medium text-ink">{SLA_RULES[p].responseHours}h</td>
                        <td className="num px-5 py-2.5 text-right font-medium text-ink">{SLA_RULES[p].resolutionHours}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            </div>
          </div>
        </>
      )}

      <CreateTicketModal open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}
