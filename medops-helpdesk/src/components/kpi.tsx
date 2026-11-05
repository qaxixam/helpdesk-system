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
 * Bento grid of KPI tiles, glass-surfaced, floating on the page backdrop.
 * The first (primary) metric gets a wider tile; the rest fill in around
 * it as smaller tiles — an asymmetric grid, not a uniform row of cards.
 */
export function VitalsStrip({ items, loading }: { items: Vital[]; loading?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((v, i) => {
        const primary = i === 0;
        return (
          <div
            key={v.label}
            className={cn(
              "glass relative overflow-hidden rounded-2xl px-5 py-5 transition-transform duration-200 motion-safe:hover:-translate-y-0.5",
              primary ? "col-span-2" : "col-span-1",
            )}
          >
            {v.tone === "alert" && <span className="absolute inset-y-4 left-0 w-[3px] rounded-r bg-urgent" aria-hidden />}
            <p className={cn("text-ink-3", primary ? "text-[13.5px]" : "text-[12.5px]")}>{v.label}</p>
            {loading ? (
              <Skeleton className={cn("mt-2.5", primary ? "h-10 w-24" : "h-7 w-14")} />
            ) : (
              <p
                className={cn(
                  "num mt-1 font-semibold leading-tight tracking-[-0.02em]",
                  primary ? "text-[34px]" : "text-[26px]",
                  v.tone === "alert" ? "text-urgent" : v.tone === "good" ? "text-ok" : "text-ink",
                )}
              >
                {v.value}
              </p>
            )}
            {v.context && <p className={cn("text-ink-3", primary ? "mt-1.5 text-[13px]" : "mt-0.5 text-[12px]")}>{v.context}</p>}
          </div>
        );
      })}
    </div>
  );
}
