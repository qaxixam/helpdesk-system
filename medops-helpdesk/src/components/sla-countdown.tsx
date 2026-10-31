"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface SLACountdownProps {
    status: string;
    responseDueDate: string;
    resolutionDueDate: string;
    firstRespondedAt?: string | null;
    slaBreached: boolean;
    compact?: boolean;
}

export function SLACountdown({
    status,
    responseDueDate,
    resolutionDueDate,
    firstRespondedAt,
    slaBreached,
    compact = false,
}: SLACountdownProps) {
    const [now, setNow] = useState<number>(() => Date.now());

    useEffect(() => {
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const targetDateStr = !firstRespondedAt ? responseDueDate : resolutionDueDate;
    const targetLabel = !firstRespondedAt ? "Resp SLA" : "Res SLA";
    const targetMs = new Date(targetDateStr).getTime();
    const diffMs = targetMs - now;

    const isCompleted = status === "Resolved" || status === "Closed";
    const isBreachedNow = slaBreached || (!isCompleted && diffMs < 0);

    if (isBreachedNow) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-red-50 text-red-700 border border-red-200">
                <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
                SLA BREACHED
            </span>
        );
    }

    if (isCompleted) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                SLA MET
            </span>
        );
    }

    const totalMinutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const isUrgentWarning = hours < 2;

    return (
        <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-medium border ${isUrgentWarning
                    ? "bg-amber-50 text-amber-800 border-amber-200"
                    : "bg-slate-100 text-slate-700 border-slate-200"
                }`}
        >
            <Clock className="h-3 w-3 shrink-0" />
            {!compact && <span>{targetLabel}:</span>}
            <span>
                {hours}h {minutes}m
            </span>
        </span>
    );
}