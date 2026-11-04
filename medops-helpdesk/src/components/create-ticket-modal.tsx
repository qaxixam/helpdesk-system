"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api-client";
import { createTicketSchema, PRIORITIES } from "@/lib/validations";
import { SLA_RULES, type TicketPriority } from "@/lib/sla";
import type { Attachment, CategoryRow } from "@/lib/types";
import { Modal } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const MAX_FILES = 3;
const MAX_BYTES = 4 * 1024 * 1024;

export async function uploadFile(file: File): Promise<Attachment> {
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 4 MB`);
  const body = new FormData();
  body.append("file", file);
  const data = await fetchJson<{ attachment: Attachment }>("/api/upload", { method: "POST", body });
  return data.attachment;
}

export function AttachmentPicker({
  files,
  onChange,
  disabled,
}: {
  files: Attachment[];
  onChange: (files: Attachment[]) => void;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    const room = MAX_FILES - files.length;
    const chosen = Array.from(list).slice(0, room);
    if (list.length > room) toast.error(`You can attach up to ${MAX_FILES} files`);
    setUploading(chosen.length);
    const done: Attachment[] = [];
    for (const f of chosen) {
      try {
        done.push(await uploadFile(f));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    onChange([...files, ...done]);
    if (input.current) input.current.value = "";
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {files.map((f, i) => (
          <span
            key={f.url}
            className="inline-flex h-8 max-w-[220px] items-center gap-1.5 rounded-md border border-line bg-sunken pl-2.5 pr-1 text-[12.5px] text-ink-2"
          >
            <FileText className="size-3.5 shrink-0 text-ink-3" />
            <span className="truncate">{f.name}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="rounded p-1 text-ink-3 hover:bg-line hover:text-ink"
              aria-label={`Remove ${f.name}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {uploading > 0 && (
          <span className="inline-flex h-8 items-center gap-1.5 px-2 text-[12.5px] text-ink-3">
            <Loader2 className="size-3.5 animate-spin" /> Uploading…
          </span>
        )}
        {files.length + uploading < MAX_FILES && (
          <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
            <Paperclip /> Attach file
          </Button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx"
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  );
}

type Errors = Partial<Record<"title" | "description" | "category" | "priority" | "attachments", string>>;

export function CreateTicketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ title: "", description: "", category: "", priority: "Medium" as TicketPriority });
  const [files, setFiles] = useState<Attachment[]>([]);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: ({ signal }) => fetchJson<{ categories: CategoryRow[] }>("/api/categories", { signal }),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  function reset() {
    setForm({ title: "", description: "", category: "", priority: "Medium" });
    setFiles([]);
    setErrors({});
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Client-side Zod validation (same schema the API uses)
    const parsed = createTicketSchema.safeParse({ ...form, attachments: files });
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) as Errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const data = await fetchJson<{ ticket: { _id: string; ticketNumber: string } }>("/api/tickets", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      toast.success(`Ticket ${data.ticket.ticketNumber} created`);
      void queryClient.invalidateQueries({ queryKey: ["tickets"] });
      void queryClient.invalidateQueries({ queryKey: ["overview"] });
      reset();
      onClose();
      router.push(`/tickets/${data.ticket._id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const rule = SLA_RULES[form.priority];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New support ticket"
      description="Tell us what’s wrong. The more detail, the faster we can fix it."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="create-ticket" loading={saving}>
            Create ticket
          </Button>
        </>
      }
    >
      <form id="create-ticket" onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Title" htmlFor="t-title" error={errors.title}>
          <Input
            id="t-title"
            value={form.title}
            maxLength={150}
            aria-invalid={!!errors.title}
            placeholder="e.g. Lab results not syncing to patient charts"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            autoFocus
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Category" htmlFor="t-cat" error={errors.category}>
            <Select
              id="t-cat"
              value={form.category}
              aria-invalid={!!errors.category}
              onChange={(e) => {
                const cat = categories.data?.categories.find((c) => c._id === e.target.value);
                setForm({ ...form, category: e.target.value, priority: cat?.defaultPriority ?? form.priority });
              }}
            >
              <option value="">{categories.isPending ? "Loading…" : "Choose a category"}</option>
              {categories.data?.categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" error={errors.priority}>
            <div className="grid grid-cols-4 gap-1 rounded-md border border-line-strong p-1" role="radiogroup" aria-label="Priority">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={form.priority === p}
                  onClick={() => setForm({ ...form, priority: p })}
                  className={cn(
                    "h-8 rounded-[5px] text-[12.5px] font-medium transition-colors",
                    form.priority === p
                      ? {
                          Urgent: "bg-urgent text-white",
                          High: "bg-high text-white",
                          Medium: "bg-medium text-white",
                          Low: "bg-low text-white",
                        }[p]
                      : "text-ink-2 hover:bg-sunken",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </Field>
        </div>
        <p className="-mt-2 text-[12.5px] text-ink-3">
          {form.priority} tickets get a first response within {rule.responseHours}h and a fix within {rule.resolutionHours}h.
        </p>

        <Field label="Description" htmlFor="t-desc" error={errors.description} hint="What happened, where, and who is affected.">
          <Textarea
            id="t-desc"
            rows={6}
            value={form.description}
            aria-invalid={!!errors.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </Field>

        <Field label="Attachments" error={errors.attachments} hint="Up to 3 files, 4 MB each. Screenshots help.">
          <AttachmentPicker files={files} onChange={setFiles} disabled={saving} />
        </Field>
      </form>
    </Modal>
  );
}
