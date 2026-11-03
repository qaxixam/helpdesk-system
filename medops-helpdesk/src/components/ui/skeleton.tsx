import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                "animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/80",
                className
            )}
            {...props}
        />
    );
}

// Reusable Table Skeleton matching Baligo Design
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
    return (
        <div className="w-full divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, rIdx) => (
                <div key={rIdx} className="py-3 sm:py-4 px-3 sm:px-4 flex items-center justify-between gap-3 sm:gap-4 animate-pulse">
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                        <Skeleton className="h-6 w-16 sm:w-20 rounded-lg bg-slate-200/80 shrink-0" />
                        <div className="space-y-1.5 flex-1 min-w-0 max-w-sm">
                            <Skeleton className="h-4 w-3/4 rounded-md bg-slate-200/80" />
                            <Skeleton className="h-3 w-1/3 rounded-md bg-slate-100" />
                        </div>
                    </div>
                    {cols >= 4 && (
                        <div className="hidden sm:flex items-center gap-3 shrink-0">
                            <Skeleton className="h-6 w-16 rounded-lg bg-slate-100" />
                            <Skeleton className="h-6 w-20 rounded-full bg-slate-100" />
                        </div>
                    )}
                    <Skeleton className="h-7 w-12 sm:w-16 rounded-lg bg-slate-200/80 shrink-0" />
                </div>
            ))}
        </div>
    );
}

// Reusable Stat Cards Skeleton (Hidden on mobile per small screen design)
export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 w-full min-w-0">
            {Array.from({ length: count }).map((_, idx) => (
                <div
                    key={idx}
                    className="bg-white rounded-2xl p-5 border border-slate-100 shadow-baligo space-y-3 animate-pulse"
                >
                    <div className="flex items-center justify-between">
                        <Skeleton className="h-3.5 w-24 rounded-md bg-slate-200/70" />
                        <Skeleton className="h-5 w-12 rounded-full bg-slate-100" />
                    </div>
                    <Skeleton className="h-8 w-20 rounded-lg bg-slate-200" />
                    <Skeleton className="h-3 w-28 rounded-md bg-slate-100" />
                </div>
            ))}
        </div>
    );
}

// Reusable Activity Timeline Skeleton
export function ActivitySkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className="divide-y divide-slate-100">
            {Array.from({ length: count }).map((_, idx) => (
                <div key={idx} className="py-4 flex items-start justify-between gap-4 animate-pulse">
                    <div className="flex items-start gap-3.5 flex-1">
                        <Skeleton className="h-9 w-9 rounded-xl bg-slate-200 shrink-0" />
                        <div className="space-y-2 flex-1 max-w-md">
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-4 w-24 rounded-md bg-slate-200" />
                                <Skeleton className="h-4 w-16 rounded-md bg-slate-100" />
                            </div>
                            <Skeleton className="h-3.5 w-full rounded-md bg-slate-100" />
                            <Skeleton className="h-3 w-40 rounded-md bg-slate-100/70" />
                        </div>
                    </div>
                    <Skeleton className="h-3.5 w-16 rounded-md bg-slate-100 shrink-0" />
                </div>
            ))}
        </div>
    );
}

// Reusable Ticket Detail Skeleton
export function TicketDetailSkeleton() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full min-w-0 animate-pulse">
            <div className="lg:col-span-8 space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo space-y-4">
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-20 rounded-xl bg-slate-200" />
                        <Skeleton className="h-6 w-20 rounded-lg bg-slate-100" />
                        <Skeleton className="h-6 w-24 rounded-lg bg-slate-100" />
                    </div>
                    <Skeleton className="h-7 w-2/3 rounded-lg bg-slate-200" />
                    <div className="p-4 bg-slate-50/70 rounded-xl space-y-2">
                        <Skeleton className="h-4 w-full bg-slate-200/70" />
                        <Skeleton className="h-4 w-5/6 bg-slate-200/70" />
                        <Skeleton className="h-4 w-4/6 bg-slate-200/70" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo space-y-4">
                    <Skeleton className="h-4 w-32 bg-slate-200" />
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full rounded-xl bg-slate-100" />
                        <Skeleton className="h-16 w-full rounded-xl bg-slate-100" />
                    </div>
                </div>
            </div>

            <div className="lg:col-span-4 space-y-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-baligo space-y-4">
                    <Skeleton className="h-4 w-28 bg-slate-200" />
                    <Skeleton className="h-12 w-full rounded-xl bg-slate-100" />
                    <div className="space-y-2 pt-2">
                        <Skeleton className="h-4 w-full bg-slate-100" />
                        <Skeleton className="h-4 w-full bg-slate-100" />
                    </div>
                </div>
            </div>
        </div>
    );
}

