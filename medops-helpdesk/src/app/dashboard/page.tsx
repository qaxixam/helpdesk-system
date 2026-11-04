"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { fetchJson } from "@/lib/api-client";
import { displayName } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { VitalsStrip } from "@/components/kpi";
import { TicketList } from "@/components/ticket-list";
import { CreateTicketModal } from "@/components/create-ticket-modal";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState, Panel, PanelHeader } from "@/components/ui/primitives";
import { HBarList } from "@/components/charts";
import { SLA_RULES } from "@/lib/sla";
import { STATUSES } from "@/lib/validations";

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
  const firstName = displayName(session?.user?.name).split(" ")[0];

  const vitals = isAgent
    ? [
        { label: "Active in my queue", value: s?.active ?? 0, context: `${s?.total ?? 0} assigned in total` },
        { label: "Awaiting first reply", value: s?.awaitingResponse ?? 0, context: "Reply to stop the response clock" },
        { label: "Urgent", value: s?.urgent ?? 0, context: `${SLA_RULES.Urgent.responseHours}h response target`, tone: (s?.urgent ? "alert" : "default") as "alert" | "default" },
        { label: "SLA breached", value: s?.breached ?? 0, context: "Active tickets past a deadline", tone: (s?.breached ? "alert" : "default") as "alert" | "default" },
        { label: "Resolution rate", value: `${s?.resolutionRate ?? 0}%`, context: `${s?.resolved ?? 0} resolved or closed` },
      ]
    : [
        { label: "Open tickets", value: s?.active ?? 0, context: `${s?.total ?? 0} raised in total` },
        { label: "Waiting on you", value: s?.waiting ?? 0, context: "Support needs your reply", tone: (s?.waiting ? "alert" : "default") as "alert" | "default" },
        { label: "Awaiting support", value: s?.awaitingResponse ?? 0, context: "Not answered yet" },
        { label: "Resolved", value: s?.resolved ?? 0, context: "Resolved or closed" },
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
        role === "user" ? (
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
      ) : (
        <VitalsStrip items={vitals} loading={overview.isPending} />
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-ink">{isAgent ? "Needs attention" : "Your open tickets"}</h2>
            <ButtonLink href="/tickets" variant="quiet" size="sm">
              View all
            </ButtonLink>
          </div>
          {role && (
            <TicketList
              role={role}
              initial={{ scope: "active" }}
              pageSize={6}
              showFilters={false}
              emptyAction={
                role === "user" ? (
                  <Button onClick={() => setCreating(true)}>
                    <Plus /> Raise a ticket
                  </Button>
                ) : undefined
              }
            />
          )}
        </div>

        <div className="space-y-6">
          <Panel>
            <PanelHeader title="By status" description={isAgent ? "Everything assigned to you" : "Everything you’ve raised"} />
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
                {(["Urgent", "High", "Medium", "Low"] as const).map((p) => (
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

      <CreateTicketModal open={creating} onClose={() => setCreating(false)} />
    </AppShell>
  );
}
