"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format, isToday, isYesterday } from "date-fns";
import { History } from "lucide-react";
import { fetchJson, type Pagination as PaginationMeta } from "@/lib/api-client";
import type { ActivityRow, Role } from "@/lib/types";
import { cn, displayName } from "@/lib/utils";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, Pagination, Panel, RowsSkeleton, Segmented, Avatar } from "@/components/ui/primitives";
import { RoleBadge, TicketId } from "@/components/ui/badges";

const ACTIONS: { value: string; label: string; staffOnly?: boolean }[] = [
  { value: "", label: "All events" },
  { value: "TICKET_CREATED", label: "Tickets created" },
  { value: "STATUS_CHANGED", label: "Status changes" },
  { value: "ASSIGNED", label: "Assignments" },
  { value: "PRIORITY_CHANGED", label: "Priority changes" },
  { value: "REPLY_POSTED", label: "Replies" },
  { value: "INTERNAL_NOTE_ADDED", label: "Internal notes", staffOnly: true },
  { value: "SLA_BREACHED", label: "SLA breaches" },
  { value: "AUTO_CLOSED", label: "Auto-closed" },
];

function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, MMM d");
}

export function ActivityFeed({ role }: { role: Role }) {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [range, setRange] = useState<"all" | "today" | "7d" | "30d">("7d");

  const params = new URLSearchParams({ page: String(page), limit: "20", dateRange: range });
  if (action) params.set("action", action);

  const q = useQuery({
    queryKey: ["activity", params.toString()],
    queryFn: ({ signal }) =>
      fetchJson<{ activities: ActivityRow[]; pagination: PaginationMeta }>(`/api/activity?${params}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const groups = useMemo(() => {
    const out: { label: string; items: ActivityRow[] }[] = [];
    for (const a of q.data?.activities ?? []) {
      const label = dayLabel(new Date(a.createdAt));
      if (out.at(-1)?.label === label) out.at(-1)!.items.push(a);
      else out.push({ label, items: [a] });
    }
    return out;
  }, [q.data]);

  return (
    <Panel>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          value={range}
          onChange={(v) => {
            setRange(v);
            setPage(1);
          }}
          options={[
            { value: "today", label: "Today" },
            { value: "7d", label: "7 days" },
            { value: "30d", label: "30 days" },
            { value: "all", label: "All" },
          ]}
        />
        <Select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          aria-label="Event type"
          className="sm:w-52"
        >
          {ACTIONS.filter((a) => role !== "user" || !a.staffOnly).map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </Select>
      </div>

      {q.isPending ? (
        <RowsSkeleton rows={8} />
      ) : q.isError ? (
        <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
      ) : groups.length === 0 ? (
        <EmptyState icon={History} title="No activity in this period" description="Try a longer time range or a different event type." />
      ) : (
        <div className={cn(q.isFetching && "opacity-60")}>
          {groups.map((g) => (
            <section key={g.label}>
              <h3 className="sticky top-14 z-10 border-b border-line bg-canvas/95 px-5 py-2 text-[12.5px] font-semibold text-ink-3 backdrop-blur lg:top-0">
                {g.label}
              </h3>
              <ul className="divide-y divide-line">
                {g.items.map((a) => (
                  <li key={a._id} className="flex gap-3.5 px-5 py-3.5">
                    {a.actor ? (
                      <Avatar name={a.actor.name} size={30} />
                    ) : (
                      <span className="inline-flex size-[30px] shrink-0 items-center justify-center rounded-full bg-ward text-[10px] font-semibold text-teal-200">
                        SYS
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] leading-snug text-ink-2">
                        <span className="font-semibold text-ink">{a.actor ? displayName(a.actor.name) : "System"}</span>{" "}
                        {a.actor?.role && <RoleBadge role={a.actor.role} />} <span className="ml-0.5">{a.details}</span>
                      </p>
                      {a.ticket && (
                        <Link href={`/tickets/${a.ticket._id}`} className="mt-1 inline-flex max-w-full items-center gap-2 text-[13px] hover:text-teal-700">
                          <TicketId value={a.ticket.ticketNumber} />
                          <span className="truncate text-ink-3 hover:text-teal-700">{a.ticket.title}</span>
                        </Link>
                      )}
                    </div>
                    <time className="num shrink-0 text-[12.5px] text-ink-4" dateTime={a.createdAt}>
                      {format(new Date(a.createdAt), "HH:mm")}
                    </time>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Pagination meta={q.data?.pagination} onPage={setPage} noun="events" />
    </Panel>
  );
}
