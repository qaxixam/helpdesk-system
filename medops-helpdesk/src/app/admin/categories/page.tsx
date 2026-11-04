"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api-client";
import type { CategoryRow } from "@/lib/types";
import { categorySchema, PRIORITIES } from "@/lib/validations";
import { SLA_RULES, type TicketPriority } from "@/lib/sla";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PriorityBadge } from "@/components/ui/badges";
import { EmptyState, ErrorState, Modal, Panel, RowsSkeleton } from "@/components/ui/primitives";

type Draft = { name: string; description: string; defaultPriority: TicketPriority };

function CategoryModal({ editing, open, onClose }: { editing: CategoryRow | null; open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Draft>(
    editing
      ? { name: editing.name, description: editing.description, defaultPriority: editing.defaultPriority }
      : { name: "", description: "", defaultPriority: "Medium" },
  );
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = categorySchema.safeParse(form);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors({ name: fe.name?.[0], description: fe.description?.[0], defaultPriority: fe.defaultPriority?.[0] });
      return;
    }
    setSaving(true);
    try {
      await fetchJson(editing ? `/api/categories/${editing._id}` : "/api/categories", {
        method: editing ? "PATCH" : "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success(editing ? "Category saved" : "Category added");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
      onClose();
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
      title={editing ? "Edit category" : "Add category"}
      description="Requesters pick a category when they raise a ticket. Its default priority is pre-selected for them."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="category-form" loading={saving}>
            {editing ? "Save category" : "Add category"}
          </Button>
        </>
      }
    >
      <form id="category-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Name" htmlFor="c-name" error={errors.name}>
          <Input id="c-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} aria-invalid={!!errors.name} />
        </Field>
        <Field label="Description" htmlFor="c-desc" error={errors.description} hint="Tell requesters what belongs here.">
          <Textarea
            id="c-desc"
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            aria-invalid={!!errors.description}
          />
        </Field>
        <Field
          label="Default priority"
          htmlFor="c-pri"
          hint={`${SLA_RULES[form.defaultPriority].responseHours}h to respond, ${SLA_RULES[form.defaultPriority].resolutionHours}h to resolve`}
        >
          <Select
            id="c-pri"
            value={form.defaultPriority}
            onChange={(e) => setForm({ ...form, defaultPriority: e.target.value as TicketPriority })}
          >
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<{ open: boolean; editing: CategoryRow | null; key: number }>({ open: false, editing: null, key: 0 });

  const q = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => fetchJson<{ categories: CategoryRow[] }>("/api/categories", { signal }),
  });

  async function remove(c: CategoryRow) {
    if (!window.confirm(`Delete “${c.name}”? This can’t be undone.`)) return;
    try {
      await fetchJson(`/api/categories/${c._id}`, { method: "DELETE" });
      toast.success("Category deleted");
      void queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const open = (editing: CategoryRow | null) => setModal((m) => ({ open: true, editing, key: m.key + 1 }));
  const rows = q.data?.categories ?? [];

  return (
    <AppShell
      title="Categories"
      description="How tickets are grouped. Categories in use can be edited but not deleted."
      actions={
        <Button onClick={() => open(null)}>
          <Plus /> Add category
        </Button>
      }
    >
      <Panel>
        {q.isPending ? (
          <RowsSkeleton rows={4} />
        ) : q.isError ? (
          <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={FolderTree}
            title="No categories yet"
            description="Add at least one so requesters can raise tickets."
            action={
              <Button onClick={() => open(null)}>
                <Plus /> Add category
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((c) => (
              <li key={c._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-medium text-ink">{c.name}</p>
                  <p className="mt-0.5 max-w-2xl text-[13px] text-ink-3">{c.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  <PriorityBadge priority={c.defaultPriority} />
                  <span className="num w-20 text-right text-[13px] text-ink-3">
                    {c.ticketCount ?? 0} ticket{c.ticketCount === 1 ? "" : "s"}
                  </span>
                  <div className="flex">
                    <Button variant="ghost" size="icon" aria-label={`Edit ${c.name}`} onClick={() => open(c)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${c.name}`}
                      disabled={(c.ticketCount ?? 0) > 0}
                      title={(c.ticketCount ?? 0) > 0 ? "In use by tickets" : "Delete"}
                      onClick={() => remove(c)}
                      className="hover:text-urgent"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {modal.open && (
        <CategoryModal key={modal.key} editing={modal.editing} open onClose={() => setModal((m) => ({ ...m, open: false }))} />
      )}
    </AppShell>
  );
}
