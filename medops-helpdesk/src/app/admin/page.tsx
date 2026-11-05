"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { fetchJson } from "@/lib/api-client";
import type { TicketRow } from "@/lib/types";
import { displayName, formatMinutes } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { VitalsStrip } from "@/components/kpi";
import { FlowChart, HBarList, Legend, SERIES, WorkloadChart } from "@/components/charts";
import { Button, ButtonLink } from "@/components/ui/button";
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { PriorityBadge, TicketId } from "@/components/ui/badges";
import { Select } from "@/components/ui/field";
import { SlaCell, useNow } from "@/components/sla";

interface Analytics {
  summary: {
    totalTickets: number;
    activeTickets: number;
    unassignedCount: number;
    slaBreachCount: number;
    activeBreachCount: number;
    slaComplianceRate: number;
    avgFirstResponseMinutes: number | null;
    avgResolutionHours: number | null;
    resolvedInPeriod: number;
    createdInPeriod: number;
  };
  ticketsByStatus: { status: string; count: number }[];
  ticketsByPriority: { priority: string; count: number }[];
  ticketsByCategory: { category: string; count: number }[];
  trend: { date: string; label: string; created: number; resolved: number }[];
  agentWorkload: { agentId: string; name: string; active: number; resolved: number; breached: number; total: number }[];
  unassignedTickets: TicketRow[];
  agents: { _id: string; name: string }[];
}

export default function AdminOverviewPage() {
  const queryClient = useQueryClient();
  const now = useNow();
  const [running, setRunning] = useState(false);

  const q = useQuery({
    queryKey: ["analytics"],
    queryFn: ({ signal }) => fetchJson<Analytics>("/api/admin/analytics", { signal }),
    refetchInterval: 60_000,
  });
  const d = q.data;
  const s = d?.summary;

  async function runSla() {
    setRunning(true);
    try {
      const r = await fetchJson<{ newlyBreached: number; autoClosedCount: number }>("/api/cron/sla-check", { method: "POST" });
      toast.success(`SLA check done: ${r.newlyBreached} newly breached, ${r.autoClosedCount} auto-closed`);
      await queryClient.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  async function assign(ticketId: string, agentId: string) {
    if (!agentId) return;
    try {
      await fetchJson(`/api/tickets/${ticketId}`, { method: "PATCH", body: JSON.stringify({ assignedAgent: agentId }) });
      toast.success("Ticket assigned");
      await queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <AppShell
      title="Service overview"
      description="Live picture of the desk: what’s open, who’s carrying it, and where the SLA clock has run out."
      actions={
        <>
          <Button variant="secondary" onClick={runSla} loading={running}>
            {!running && <RefreshCw />} Run SLA check
          </Button>
          <ButtonLink href="/admin/tickets">Manage tickets</ButtonLink>
        </>
      }
    >
      {q.isError ? (
        <Panel>
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        </Panel>
      ) : (
        <>
          <VitalsStrip
            loading={q.isPending}
            items={[
              { label: "Active tickets", value: s?.activeTickets ?? 0, context: `${s?.totalTickets ?? 0} all time` },
              {
                label: "Unassigned",
                value: s?.unassignedCount ?? 0,
                context: s?.unassignedCount ? "Waiting for an agent" : "Every ticket has an owner",
                tone: s?.unassignedCount ? "alert" : "default",
              },
              {
                label: "Avg. first response",
                value: formatMinutes(s?.avgFirstResponseMinutes),
                context: "From open to first staff reply",
              },
              {
                label: "SLA breaches",
                value: s?.slaBreachCount ?? 0,
                context: `${s?.activeBreachCount ?? 0} still open — ${s?.slaComplianceRate ?? 100}% compliant`,
                tone: s?.activeBreachCount ? "alert" : "default",
              },
              {
                label: "Avg. resolution",
                value: s?.avgResolutionHours != null ? `${s.avgResolutionHours}h` : "—",
                context: `${s?.resolvedInPeriod ?? 0} resolved in 14 days`,
              },
            ]}
          />

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel>
              <PanelHeader
                title="Ticket flow"
                description="Created vs. resolved per day, last 14 days"
                action={
                  <Legend
                    items={[
                      { label: "Created", color: SERIES.blue },
                      { label: "Resolved", color: SERIES.teal },
                    ]}
                  />
                }
              />
              <div className="px-3 pb-4 pt-5 sm:px-5">{d ? <FlowChart data={d.trend} /> : <Skeleton className="h-[260px] w-full" />}</div>
            </Panel>

            <Panel>
              <PanelHeader title="Tickets by status" description="All tickets in the system" />
              <div className="px-5 py-5">
                {d ? (
                  <HBarList data={d.ticketsByStatus.map((x) => ({ label: x.status, value: x.count }))} />
                ) : (
                  <div className="space-y-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-6" />
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <Panel>
              <PanelHeader title="Tickets by category" />
              <div className="px-5 py-5">
                {d ? (
                  <HBarList color={SERIES.blue} data={d.ticketsByCategory.map((x) => ({ label: x.category, value: x.count }))} />
                ) : (
                  <Skeleton className="h-40" />
                )}
              </div>
            </Panel>

            <Panel>
              <PanelHeader
                title="Agent workload"
                description="Tickets each agent is carrying now and has closed out"
                action={
                  <Legend
                    items={[
                      { label: "Active", color: SERIES.teal },
                      { label: "Resolved", color: SERIES.blue },
                    ]}
                  />
                }
              />
              {d && d.agentWorkload.length === 0 ? (
                <EmptyState title="No active agents" description="Add an agent from the Team page to start assigning work." />
              ) : (
                <div className="grid gap-4 px-3 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_200px]">
                  {d ? (
                    <WorkloadChart data={d.agentWorkload.map((a) => ({ name: displayName(a.name), active: a.active, resolved: a.resolved }))} />
                  ) : (
                    <Skeleton className="h-40" />
                  )}
                  <ul className="divide-y divide-line self-start rounded-md border border-line text-[13px]">
                    {d?.agentWorkload.map((a) => (
                      <li key={a.agentId} className="flex items-center justify-between gap-2 px-3 py-2">
                        <span className="truncate text-ink-2">{displayName(a.name)}</span>
                        <span className={a.breached ? "num font-semibold text-urgent" : "num text-ink-3"}>
                          {a.breached} breached
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          </div>

          <Panel className="mt-6">
            <PanelHeader
              title="Waiting for assignment"
              description="Oldest first. Pick an agent to hand the ticket over."
              action={
                (s?.unassignedCount ?? 0) > 0 ? (
                  <ButtonLink href="/admin/tickets?assignedAgent=unassigned" variant="quiet" size="sm">
                    See all {s?.unassignedCount}
                  </ButtonLink>
                ) : null
              }
            />
            {!d ? (
              <div className="space-y-3 p-5">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : d.unassignedTickets.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="Nothing waiting" description="Every active ticket has an agent." />
            ) : (
              <ul className="divide-y divide-line">
                {d.unassignedTickets.map((t) => (
                  <li key={t._id} className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
                    <Link href={`/tickets/${t._id}`} className="min-w-0 flex-1 group">
                      <span className="flex items-center gap-2">
                        <TicketId value={t.ticketNumber} />
                        <span className="text-[12px] text-ink-4">
                          {displayName(t.createdBy?.name)} — {formatDistanceToNowStrict(new Date(t.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate font-medium text-ink group-hover:text-teal-700">{t.title}</span>
                    </Link>
                    <div className="flex items-center gap-4">
                      <PriorityBadge priority={t.priority} />
                      <SlaCell ticket={t} now={now} />
                      <Select
                        aria-label={`Assign ${t.ticketNumber}`}
                        defaultValue=""
                        onChange={(e) => assign(t._id, e.target.value)}
                        className="w-44 [&_select]:h-8 [&_select]:text-[13px]"
                      >
                        <option value="" disabled>
                          Assign to…
                        </option>
                        {d.agents.map((a) => (
                          <option key={a._id} value={a._id}>
                            {displayName(a.name)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <p className="mt-6 flex items-center gap-2 text-[12.5px] text-ink-4">
            <ShieldCheck className="size-3.5" /> Figures update every minute. SLA breaches and 3-day auto-close also run on a daily schedule.
          </p>
        </>
      )}
    </AppShell>
  );
}
