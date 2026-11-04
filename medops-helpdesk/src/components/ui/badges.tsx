import { cn } from "@/lib/utils";
import type { TicketPriority, TicketStatus } from "@/lib/sla";
import type { Role } from "@/lib/types";

const statusStyle: Record<TicketStatus, { dot: string; text: string }> = {
  Open: { dot: "bg-teal-500", text: "text-teal-700" },
  "In Progress": { dot: "bg-medium", text: "text-medium" },
  "Waiting on User": { dot: "bg-warn", text: "text-warn" },
  Resolved: { dot: "bg-ok", text: "text-ok" },
  Closed: { dot: "bg-ink-4", text: "text-ink-3" },
};

/** Status = dot + label (quiet). Colour fill is reserved for priority / SLA. */
export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const s = statusStyle[status] ?? statusStyle.Open;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[13px] font-medium whitespace-nowrap", s.text, className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden />
      {status}
    </span>
  );
}

const priorityStyle: Record<TicketPriority, string> = {
  Urgent: "bg-urgent-soft text-urgent ring-urgent/25",
  High: "bg-high-soft text-high ring-high/25",
  Medium: "bg-medium-soft text-medium ring-medium/20",
  Low: "bg-low-soft text-low ring-low/20",
};

const priorityBars: Record<TicketPriority, number> = { Low: 1, Medium: 2, High: 3, Urgent: 4 };

/** Triage tag: priority name + 4-step signal bars. */
export function PriorityBadge({ priority, className }: { priority: TicketPriority; className?: string }) {
  const level = priorityBars[priority] ?? 1;
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-sm px-2 text-[12px] font-semibold ring-1 ring-inset whitespace-nowrap",
        priorityStyle[priority],
        className,
      )}
    >
      <span className="flex items-end gap-px" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn("w-[3px] rounded-[1px] bg-current", i > level && "opacity-25")}
            style={{ height: 3 + i * 2 }}
          />
        ))}
      </span>
      {priority}
    </span>
  );
}

const roleStyle: Record<Role, string> = {
  admin: "bg-ward text-white",
  agent: "bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200",
  user: "bg-sunken text-ink-2 ring-1 ring-inset ring-line",
};
const roleLabel: Record<Role, string> = { admin: "Admin", agent: "Agent", user: "Requester" };

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={cn("inline-flex h-5 items-center rounded-sm px-1.5 text-[11.5px] font-semibold", roleStyle[role])}>
      {roleLabel[role]}
    </span>
  );
}

export function TicketId({ value, className }: { value: string; className?: string }) {
  return <span className={cn("font-mono text-[12.5px] text-ink-3", className)}>{value}</span>;
}
