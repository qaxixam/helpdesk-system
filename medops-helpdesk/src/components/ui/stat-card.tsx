import React from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  subtitle?: string;
  icon?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  change,
  isPositive = true,
  subtitle,
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100/90 shadow-baligo hover:shadow-baligo-lg transition-all flex flex-col justify-between">
      <div className="text-xs font-semibold text-slate-400 tracking-wide">
        {label}
      </div>

      <div className="flex items-baseline justify-between gap-2 my-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {value}
        </span>

        {change && (
          <span
            className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-md ${
              isPositive
                ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                : "bg-rose-50 text-rose-600 border border-rose-100"
            }`}
          >
            {isPositive ? (
              <ArrowUpRight className="h-3 w-3 stroke-[2.5]" />
            ) : (
              <ArrowDownRight className="h-3 w-3 stroke-[2.5]" />
            )}
            {change}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="text-xs text-slate-400 font-medium">{subtitle}</div>
      )}
    </div>
  );
}

