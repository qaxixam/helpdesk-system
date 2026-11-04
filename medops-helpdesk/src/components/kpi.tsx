import * as React from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/primitives";

export type Vital = {
  label: string;
  value: React.ReactNode;
  context?: React.ReactNode;
  tone?: "default" | "alert" | "good";
};

/**
 * The vitals strip: one bordered read-out with cells, like a bedside monitor —
 * not a row of floating cards. Alert cells get a red rule on the left.
 */
export function VitalsStrip({ items, loading }: { items: Vital[]; loading?: boolean }) {
  return (
    <div
      className={cn(
        "grid gap-px overflow-hidden rounded-lg border border-line bg-line shadow-raise",
        "grid-cols-2",
        items.length >= 5 ? "lg:grid-cols-5" : "lg:grid-cols-4",
      )}
    >
      {items.map((v, i) => (
        <div
          key={v.label}
          className={cn(
            "relative bg-surface px-5 py-4",
            // odd count on mobile: let the last cell span the row
            items.length % 2 === 1 && i === items.length - 1 && "col-span-2 lg:col-span-1",
          )}
        >
          {v.tone === "alert" && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r bg-urgent" aria-hidden />}
          <p className="text-[13px] text-ink-3">{v.label}</p>
          {loading ? (
            <Skeleton className="mt-2.5 h-7 w-16" />
          ) : (
            <p
              className={cn(
                "num mt-1 text-[28px] font-semibold leading-tight tracking-[-0.02em]",
                v.tone === "alert" ? "text-urgent" : v.tone === "good" ? "text-ok" : "text-ink",
              )}
            >
              {v.value}
            </p>
          )}
          {v.context && <p className="mt-0.5 text-[12.5px] text-ink-3">{v.context}</p>}
        </div>
      ))}
    </div>
  );
}
