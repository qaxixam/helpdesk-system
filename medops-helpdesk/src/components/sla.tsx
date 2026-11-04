"use client";

import { useEffect, useState } from "react";
import { cn, formatDuration } from "@/lib/utils";
import type { TicketRow } from "@/lib/types";

/** Shared clock so every countdown on the page ticks together. */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

type SlaTicket = Pick<
  TicketRow,
  "status" | "createdAt" | "responseDueDate" | "resolutionDueDate" | "firstRespondedAt" | "resolvedAt" | "slaBreached"
>;

export type TargetState = "running" | "warning" | "missed" | "met" | "stopped";

export interface TargetReading {
  label: string;
  state: TargetState;
  /** ms left (negative when overdue) */
  remaining: number;
  /** 0..1 portion of the window used */
  used: number;
  doneAt?: number;
}

function read(label: string, start: number, due: number, doneAt: number | null, now: number, stopped: boolean): TargetReading {
  const span = Math.max(1, due - start);
  if (doneAt) {
    return {
      label,
      state: doneAt <= due ? "met" : "missed",
      remaining: due - doneAt,
      used: Math.min(1.25, (doneAt - start) / span),
      doneAt,
    };
  }
  const remaining = due - now;
  const used = Math.min(1.25, (now - start) / span);
  if (remaining < 0) return { label, state: "missed", remaining, used };
  if (stopped) return { label, state: "stopped", remaining, used };
  return { label, state: used >= 0.75 ? "warning" : "running", remaining, used };
}

export function readSla(t: SlaTicket, now: number) {
  const start = new Date(t.createdAt).getTime();
  const closed = t.status === "Closed";
  const resolvedish = t.status === "Resolved" || closed;
  const response = read(
    "First response",
    start,
    new Date(t.responseDueDate).getTime(),
    t.firstRespondedAt ? new Date(t.firstRespondedAt).getTime() : null,
    now,
    closed,
  );
  const resolution = read(
    "Resolution",
    start,
    new Date(t.resolutionDueDate).getTime(),
    t.resolvedAt ? new Date(t.resolvedAt).getTime() : null,
    now,
    resolvedish,
  );
  const breached = t.slaBreached || response.state === "missed" || resolution.state === "missed";
  const current = !t.firstRespondedAt && !resolvedish ? response : resolution;
  return { response, resolution, breached, current, resolvedish };
}

const tone: Record<TargetState, { text: string; bar: string }> = {
  running: { text: "text-ink-2", bar: "bg-teal-500" },
  warning: { text: "text-high", bar: "bg-high" },
  missed: { text: "text-urgent", bar: "bg-urgent" },
  met: { text: "text-ok", bar: "bg-ok" },
  stopped: { text: "text-ink-3", bar: "bg-ink-4" },
};

function describe(r: TargetReading) {
  switch (r.state) {
    case "met":
      return "Met";
    case "missed":
      return r.doneAt ? `Missed by ${formatDuration(-r.remaining)}` : `Overdue ${formatDuration(-r.remaining)}`;
    case "stopped":
      return "Stopped";
    default:
      return `${formatDuration(r.remaining)} left`;
  }
}

/** Compact read-out for tables: what matters right now for this ticket. */
export function SlaCell({ ticket, now }: { ticket: SlaTicket; now: number }) {
  const sla = readSla(ticket, now);

  if (sla.resolvedish) {
    return sla.breached ? (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-urgent">
        <span className="size-1.5 rounded-full bg-urgent" /> Breached
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ok">
        <span className="size-1.5 rounded-full bg-ok" /> Within SLA
      </span>
    );
  }

  const r = sla.current;
  const t = tone[sla.breached && r.state !== "missed" ? "missed" : r.state];
  return (
    <div className="min-w-[120px]">
      <div className={cn("num flex items-center gap-1.5 text-[13px] font-medium", t.text)}>
        {sla.breached && <span className="size-1.5 animate-pulse-dot rounded-full bg-urgent" aria-hidden />}
        {sla.breached && r.state !== "missed" ? `Breached · ${describe(r)}` : describe(r)}
      </div>
      <div className="mt-1 h-1 w-full max-w-[140px] overflow-hidden rounded-full bg-sunken" aria-hidden>
        <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${Math.min(100, r.used * 100)}%` }} />
      </div>
      <div className="mt-0.5 text-[11.5px] text-ink-4">{r.label}</div>
    </div>
  );
}

/** Full SLA trace for the ticket page: two targets on one time axis. */
export function SlaTrace({ ticket }: { ticket: SlaTicket }) {
  const now = useNow(1000);
  const sla = readSla(ticket, now);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink">Service level</h3>
        {sla.breached ? (
          <span className="inline-flex h-6 items-center gap-1.5 rounded-sm bg-urgent px-2 text-[12px] font-semibold text-white">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-white" aria-hidden /> SLA breached
          </span>
        ) : sla.resolvedish ? (
          <span className="inline-flex h-6 items-center rounded-sm bg-ok-soft px-2 text-[12px] font-semibold text-ok">
            Within SLA
          </span>
        ) : (
          <span className="inline-flex h-6 items-center rounded-sm bg-teal-50 px-2 text-[12px] font-semibold text-teal-700">
            On track
          </span>
        )}
      </div>

      <div className="mt-4 space-y-4">
        {[sla.response, sla.resolution].map((r) => {
          const t = tone[r.state];
          return (
            <div key={r.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink-2">{r.label}</span>
                <span className={cn("num text-[13px] font-semibold", t.text)}>{describe(r)}</span>
              </div>
              <div className="chart-paper relative mt-1.5 h-2.5 overflow-hidden rounded-sm bg-sunken" aria-hidden>
                <div
                  className={cn("absolute inset-y-0 left-0", t.bar, r.state === "stopped" && "opacity-60")}
                  style={{ width: `${Math.min(100, (r.used / 1.25) * 100)}%` }}
                />
                {/* deadline marker sits at 80% of the axis (axis = 125% of the window) */}
                <div className="absolute inset-y-0 w-px bg-ink" style={{ left: "80%" }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-ink-4">The dark mark is the deadline. Bars past it are overdue.</p>
    </div>
  );
}
