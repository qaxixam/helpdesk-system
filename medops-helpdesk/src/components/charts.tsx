"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Chart palette — validated (light surface, CVD-safe, ≥3:1 contrast):
 *   teal #0b9a8a · blue #4268d6 · ochre #c9822b   (fixed order, never cycled)
 * Triage red/amber are NOT used for series; they mean SLA risk only.
 */
export const SERIES = { teal: "#0b9a8a", blue: "#4268d6", ochre: "#c9822b" };
const AXIS = "#97a29f";
const GRID = "#e6ebe8";

type TipPayload = { name?: string; value?: number | string; color?: string; dataKey?: string | number };

function Tip({ active, payload, label }: { active?: boolean; payload?: TipPayload[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-line bg-surface px-3 py-2 text-[12.5px] shadow-pop">
      {label && <p className="mb-1 font-medium text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={String(p.dataKey)} className="flex items-center gap-2 text-ink-2">
          <span className="size-2 rounded-full" style={{ background: p.color }} />
          {p.name}
          <span className="num ml-auto pl-3 font-semibold text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-3 rounded-[2px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/** Created vs resolved per day. */
export function FlowChart({ data }: { data: { label: string; created: number; resolved: number }[] }) {
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <defs>
            <linearGradient id="fCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.blue} stopOpacity={0.16} />
              <stop offset="100%" stopColor={SERIES.blue} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="fResolved" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SERIES.teal} stopOpacity={0.16} />
              <stop offset="100%" stopColor={SERIES.teal} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={{ fontSize: 11.5, fill: AXIS }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11.5, fill: AXIS }} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<Tip />} cursor={{ stroke: "#c7d0cc", strokeWidth: 1 }} />
          <Area type="monotone" dataKey="created" name="Created" stroke={SERIES.blue} strokeWidth={2} fill="url(#fCreated)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
          <Area type="monotone" dataKey="resolved" name="Resolved" stroke={SERIES.teal} strokeWidth={2} fill="url(#fResolved)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-series horizontal bars with direct value labels (status, category). */
export function HBarList({
  data,
  color = SERIES.teal,
  emptyLabel = "No data yet",
}: {
  data: { label: string; value: number; hint?: string }[];
  color?: string;
  emptyLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => d.value === 0)) return <p className="py-6 text-center text-[13px] text-ink-3">{emptyLabel}</p>;
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label} className="group" title={`${d.label}: ${d.value}`}>
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2">{d.label}</span>
            <span className="num font-semibold text-ink">{d.value}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(d.value / max) * 100}%`, background: color, minWidth: d.value ? 6 : 0 }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Per-agent workload: active vs resolved, stacked, with breach count as text. */
export function WorkloadChart({ data }: { data: { name: string; active: number; resolved: number }[] }) {
  return (
    <div className="w-full" style={{ height: Math.max(140, data.length * 52 + 30) }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap={14}>
          <CartesianGrid horizontal={false} stroke={GRID} />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11.5, fill: AXIS }} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12.5, fill: "#3f4d4b" }} tickLine={false} axisLine={false} />
          <Tooltip content={<Tip />} cursor={{ fill: "rgb(15 31 30 / 0.04)" }} />
          <Bar dataKey="active" name="Active" stackId="w" fill={SERIES.teal} stroke="#fff" strokeWidth={2} radius={[0, 0, 0, 0]} />
          <Bar dataKey="resolved" name="Resolved" stackId="w" fill={SERIES.blue} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
