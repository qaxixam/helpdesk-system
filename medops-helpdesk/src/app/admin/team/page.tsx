"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Search, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { fetchJson, type Pagination as PaginationMeta } from "@/lib/api-client";
import type { Role, UserRow } from "@/lib/types";
import { createStaffSchema } from "@/lib/validations";
import { cn, displayName } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { RoleBadge } from "@/components/ui/badges";
import { Avatar, EmptyState, ErrorState, Modal, Pagination, Panel, RowsSkeleton, Segmented } from "@/components/ui/primitives";

type RoleFilter = "ALL" | Role;

function AddMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const blank = { name: "", email: "", password: "", role: "agent" as Role, facility: "" };
  const [form, setForm] = useState(blank);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = createStaffSchema.safeParse(form);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await fetchJson("/api/users", { method: "POST", body: JSON.stringify(parsed.data) });
      toast.success(`${parsed.data.name} added`);
      setForm(blank);
      onClose();
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add team member"
      description="Create an account for an agent, admin or requester. Share the password with them securely."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="add-member" loading={saving}>
            Add member
          </Button>
        </>
      }
    >
      <form id="add-member" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Role">
          <Segmented
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={[
              { value: "agent", label: "Agent" },
              { value: "admin", label: "Admin" },
              { value: "user", label: "Requester" },
            ]}
          />
        </Field>
        <Field label="Full name" htmlFor="m-name" error={errors.name}>
          <Input id="m-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Email" htmlFor="m-email" error={errors.email}>
          <Input
            id="m-email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            aria-invalid={!!errors.email}
          />
        </Field>
        <Field label="Team or facility" htmlFor="m-fac" error={errors.facility} hint="Optional">
          <Input id="m-fac" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })} />
        </Field>
        <Field label="Temporary password" htmlFor="m-pass" error={errors.password} hint="8+ characters, one uppercase letter, one number.">
          <Input
            id="m-pass"
            type="text"
            autoComplete="off"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            aria-invalid={!!errors.password}
          />
        </Field>
      </form>
    </Modal>
  );
}

export default function TeamPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<RoleFilter>("ALL");
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (role !== "ALL") params.set("role", role);
  if (debounced) params.set("search", debounced);

  const q = useQuery({
    queryKey: ["users", params.toString()],
    queryFn: ({ signal }) => fetchJson<{ users: UserRow[]; pagination: PaginationMeta }>(`/api/users?${params}`, { signal }),
    placeholderData: keepPreviousData,
  });

  async function patch(user: UserRow, change: { role?: Role; isActive?: boolean }) {
    setBusy(user._id);
    try {
      const res = await fetchJson<{ unassignedTickets: number }>("/api/users", {
        method: "PATCH",
        body: JSON.stringify({ userId: user._id, ...change }),
      });
      const name = displayName(user.name);
      toast.success(
        change.isActive === false
          ? `${name} deactivated`
          : change.isActive
            ? `${name} reactivated`
            : `${name} is now ${change.role === "user" ? "a requester" : `an ${change.role}`}`,
        res.unassignedTickets ? { description: `${res.unassignedTickets} open ticket(s) moved back to unassigned.` } : undefined,
      );
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const rows = q.data?.users ?? [];

  return (
    <AppShell
      title="Team"
      description="Manage who can use the desk and what they can do. Deactivated people can’t sign in."
      actions={
        <Button onClick={() => setAdding(true)}>
          <UserPlus /> Add member
        </Button>
      }
    >
      <Panel>
        <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            value={role}
            onChange={(v) => {
              setRole(v);
              setPage(1);
            }}
            options={[
              { value: "ALL", label: "Everyone" },
              { value: "agent", label: "Agents" },
              { value: "admin", label: "Admins" },
              { value: "user", label: "Requesters" },
            ]}
          />
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search people" />
          </div>
        </div>

        {q.isPending ? (
          <RowsSkeleton />
        ) : q.isError ? (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Users} title="No one matches" description="Try another name or role filter." />
        ) : (
          <ul className={cn("divide-y divide-line", q.isFetching && "opacity-60")}>
            {rows.map((u) => {
              const self = u._id === session?.user?.id;
              return (
                <li key={u._id} className="flex flex-col gap-3 px-5 py-3.5 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={u.name} size={34} className={cn(!u.isActive && "opacity-40")} />
                    <div className="min-w-0">
                      <p className={cn("flex items-center gap-2 text-[14px] font-medium", u.isActive ? "text-ink" : "text-ink-4 line-through")}>
                        <span className="truncate">{displayName(u.name)}</span>
                        <RoleBadge role={u.role} />
                        {self && <span className="text-[12px] font-normal text-ink-4">You</span>}
                      </p>
                      <p className="truncate text-[13px] text-ink-3">
                        {u.email}
                        {u.facility ? ` — ${u.facility}` : ""}
                      </p>
                    </div>
                  </div>
                  <span className="hidden text-[12.5px] text-ink-4 lg:block">Joined {format(new Date(u.createdAt), "MMM d, yyyy")}</span>
                  <div className="flex items-center gap-2">
                    <Select
                      aria-label={`Role for ${u.name}`}
                      value={u.role}
                      disabled={self || busy === u._id}
                      onChange={(e) => patch(u, { role: e.target.value as Role })}
                      className="w-36 [&_select]:h-8 [&_select]:text-[13px]"
                    >
                      <option value="user">Requester</option>
                      <option value="agent">Agent</option>
                      <option value="admin">Admin</option>
                    </Select>
                    <Button
                      size="sm"
                      variant={u.isActive ? "danger" : "secondary"}
                      disabled={self}
                      loading={busy === u._id}
                      onClick={() => patch(u, { isActive: !u.isActive })}
                      className="w-28"
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pagination meta={q.data?.pagination} onPage={setPage} noun="people" />
      </Panel>
      <AddMemberModal open={adding} onClose={() => setAdding(false)} />
    </AppShell>
  );
}
