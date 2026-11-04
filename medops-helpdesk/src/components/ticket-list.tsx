"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { Inbox, Search, SearchX, X } from "lucide-react";
import { toast } from "sonner";
import { fetchJson, type Pagination as PaginationMeta } from "@/lib/api-client";
import type { CategoryRow, Role, TicketRow } from "@/lib/types";
import { PRIORITIES, STATUSES } from "@/lib/validations";
import { cn, displayName } from "@/lib/utils";
import { Input, Select } from "@/components/ui/field";
import { PriorityBadge, StatusBadge, TicketId } from "@/components/ui/badges";
import { Avatar, EmptyState, ErrorState, Pagination, Panel, RowsSkeleton } from "@/components/ui/primitives";
import { SlaCell, useNow } from "@/components/sla";

type Filters = {
  search: string;
  status: string;
  priority: string;
  category: string;
  assignedAgent: string;
  breached: boolean;
  scope: string;
};

const EMPTY: Filters = { search: "", status: "", priority: "", category: "", assignedAgent: "", breached: false, scope: "" };

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function TicketList({
  role,
  initial,
  pageSize = 10,
  emptyAction,
  showFilters = true,
}: {
  role: Role;
  initial?: Partial<Filters>;
  pageSize?: number;
  emptyAction?: React.ReactNode;
  showFilters?: boolean;
}) {
  const [filters, setFilters] = useState<Filters>({ ...EMPTY, ...initial });
  const [page, setPage] = useState(1);
  const search = useDebounced(filters.search);
  const now = useNow();
  const queryClient = useQueryClient();

  const params = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), limit: String(pageSize) });
    if (search.trim()) p.set("search", search.trim());
    if (filters.status) p.set("status", filters.status);
    if (filters.priority) p.set("priority", filters.priority);
    if (filters.category) p.set("category", filters.category);
    if (filters.assignedAgent) p.set("assignedAgent", filters.assignedAgent);
    if (filters.breached) p.set("breached", "true");
    if (filters.scope && !filters.status) p.set("scope", filters.scope);
    return p.toString();
  }, [page, pageSize, search, filters]);

  const tickets = useQuery({
    queryKey: ["tickets", params],
    queryFn: ({ signal }) => fetchJson<{ tickets: TicketRow[]; pagination: PaginationMeta }>(`/api/tickets?${params}`, { signal }),
    placeholderData: keepPreviousData,
  });

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => fetchJson<{ categories: CategoryRow[] }>("/api/categories", { signal }),
    enabled: showFilters,
    staleTime: 5 * 60_000,
  });

  const agents = useQuery({
    queryKey: ["agents"],
    queryFn: ({ signal }) =>
      fetchJson<{ users: { _id: string; name: string }[] }>("/api/users?role=agent&active=true&limit=100", { signal }),
    enabled: role === "admin",
    staleTime: 5 * 60_000,
  });

  function update(patch: Partial<Filters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }

  async function assign(ticketId: string, agentId: string) {
    try {
      await fetchJson(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ assignedAgent: agentId || null }),
      });
      toast.success(agentId ? "Ticket assigned" : "Ticket unassigned");
      await queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const filtered = JSON.stringify({ ...filters, scope: "" }) !== JSON.stringify({ ...EMPTY, ...initial, scope: "" });
  const rows = tickets.data?.tickets ?? [];
  const showRequester = role !== "user";

  return (
    <Panel>
      {showFilters && (
        <div className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5 lg:flex-row lg:items-center">
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
            <Input
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              placeholder="Search by ticket number or title"
              className="pl-9"
              aria-label="Search tickets"
            />
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:items-center">
            <Select value={filters.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status" className="sm:w-40">
              <option value="">{filters.scope === "active" ? "All active" : "All statuses"}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
            <Select value={filters.priority} onChange={(e) => update({ priority: e.target.value })} aria-label="Priority" className="sm:w-36">
              <option value="">All priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
            <Select value={filters.category} onChange={(e) => update({ category: e.target.value })} aria-label="Category" className="sm:w-44">
              <option value="">All categories</option>
              {categories.data?.categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {role === "admin" && (
              <Select
                value={filters.assignedAgent}
                onChange={(e) => update({ assignedAgent: e.target.value })}
                aria-label="Assignee"
                className="sm:w-40"
              >
                <option value="">Any assignee</option>
                <option value="unassigned">Unassigned</option>
                {agents.data?.users.map((a) => (
                  <option key={a._id} value={a._id}>
                    {displayName(a.name)}
                  </option>
                ))}
              </Select>
            )}
            <label className="col-span-2 inline-flex h-10 cursor-pointer items-center gap-2 rounded-md px-1 text-[13px] text-ink-2 sm:col-span-1">
              <input
                type="checkbox"
                checked={filters.breached}
                onChange={(e) => update({ breached: e.target.checked })}
                className="size-4 accent-urgent"
              />
              Breached only
            </label>
            {filtered && (
              <button
                onClick={() => {
                  setFilters({ ...EMPTY, ...initial });
                  setPage(1);
                }}
                className="col-span-2 inline-flex h-10 items-center gap-1 px-1 text-[13px] font-medium text-teal-700 hover:underline sm:col-span-1"
              >
                <X className="size-3.5" /> Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      {tickets.isPending ? (
        <RowsSkeleton rows={pageSize > 8 ? 8 : pageSize} />
      ) : tickets.isError ? (
        <ErrorState message={tickets.error.message} onRetry={() => tickets.refetch()} />
      ) : rows.length === 0 ? (
        filtered ? (
          <EmptyState icon={SearchX} title="No tickets match these filters" description="Try a different search or clear the filters." />
        ) : (
          <EmptyState
            icon={Inbox}
            title={role === "agent" ? "Your queue is clear" : role === "user" ? "No tickets yet" : "No tickets yet"}
            description={
              role === "agent"
                ? "Tickets an admin assigns to you will show up here."
                : role === "user"
                  ? "When something isn’t working, raise a ticket and track it here."
                  : "Tickets raised by requesters will appear here."
            }
            action={emptyAction}
          />
        )
      ) : (
        <div className={cn("transition-opacity", tickets.isFetching && "opacity-60")}>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-[12.5px] text-ink-3">
                  <th className="px-5 py-2.5 font-medium">Ticket</th>
                  <th className="px-3 py-2.5 font-medium">Priority</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  <th className="px-3 py-2.5 font-medium">SLA</th>
                  {showRequester && <th className="px-3 py-2.5 font-medium">Requester</th>}
                  {role !== "agent" && <th className="px-3 py-2.5 font-medium">Assignee</th>}
                  <th className="px-5 py-2.5 text-right font-medium">Opened</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((t) => (
                  <tr key={t._id} className="group align-top transition-colors hover:bg-canvas">
                    <td className="max-w-[360px] px-5 py-3.5">
                      <Link href={`/tickets/${t._id}`} className="block focus:outline-none">
                        <span className="flex items-center gap-2">
                          <TicketId value={t.ticketNumber} />
                          {t.category?.name && <span className="truncate text-[12px] text-ink-4">{t.category.name}</span>}
                        </span>
                        <span className="mt-0.5 block truncate font-medium text-ink group-hover:text-teal-700">{t.title}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3.5">
                      <PriorityBadge priority={t.priority} />
                    </td>
                    <td className="px-3 py-3.5">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-3.5">
                      <SlaCell ticket={t} now={now} />
                    </td>
                    {showRequester && (
                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={t.createdBy?.name} size={24} />
                          <span className="max-w-[140px] truncate text-[13px] text-ink-2">{displayName(t.createdBy?.name)}</span>
                        </div>
                      </td>
                    )}
                    {role === "admin" ? (
                      <td className="px-3 py-3">
                        <Select
                          aria-label={`Assign ${t.ticketNumber}`}
                          value={t.assignedAgent?._id ?? ""}
                          disabled={t.status === "Closed"}
                          onChange={(e) => assign(t._id, e.target.value)}
                          className={cn("w-40 [&_select]:h-8 [&_select]:text-[13px]", !t.assignedAgent && "[&_select]:border-dashed [&_select]:text-high")}
                        >
                          <option value="">Unassigned</option>
                          {agents.data?.users.map((a) => (
                            <option key={a._id} value={a._id}>
                              {displayName(a.name)}
                            </option>
                          ))}
                        </Select>
                      </td>
                    ) : role === "user" ? (
                      <td className="px-3 py-3.5 text-[13px] text-ink-2">
                        {t.assignedAgent ? displayName(t.assignedAgent.name) : <span className="text-ink-4">Not yet assigned</span>}
                      </td>
                    ) : null}
                    <td className="num px-5 py-3.5 text-right text-[13px] whitespace-nowrap text-ink-3">
                      {formatDistanceToNowStrict(new Date(t.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile list */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map((t) => (
              <li key={t._id}>
                <Link href={`/tickets/${t._id}`} className="block px-4 py-4 active:bg-canvas">
                  <div className="flex items-center justify-between gap-3">
                    <TicketId value={t.ticketNumber} />
                    <PriorityBadge priority={t.priority} />
                  </div>
                  <p className="mt-1.5 font-medium leading-snug text-ink">{t.title}</p>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div className="space-y-1">
                      <StatusBadge status={t.status} />
                      <p className="text-[12.5px] text-ink-3">
                        {role === "user"
                          ? t.assignedAgent
                            ? displayName(t.assignedAgent.name)
                            : "Not yet assigned"
                          : displayName(t.createdBy?.name)}
                      </p>
                    </div>
                    <SlaCell ticket={t} now={now} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pagination meta={tickets.data?.pagination} onPage={setPage} noun="tickets" />
    </Panel>
  );
}
