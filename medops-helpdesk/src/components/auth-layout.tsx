import * as React from "react";

/** Split auth layout: ward-dark context panel on the left, form on the right. */
export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <aside className="relative hidden overflow-hidden bg-ward px-12 py-12 text-ward-ink lg:flex lg:flex-col">
        <div className="flex items-center gap-2.5">
          <svg width="28" height="28" viewBox="0 0 26 26" aria-hidden>
            <rect width="26" height="26" rx="7" fill="#16897e" />
            <path d="M4 14h4l2.2-5 3.6 10 2.4-6.5 1.3 1.5H22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-base font-semibold text-white">MedOps Helpdesk</span>
        </div>

        <div className="mt-auto max-w-md">
          <p className="text-[34px] font-semibold leading-[1.12] tracking-[-0.02em] text-white">
            When the EHR goes down, every minute is a patient waiting.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-ward-ink/75">
            Raise an IT issue from any clinic, see who is on it, and watch the response clock until it is fixed.
          </p>
        </div>

        {/* Monitor read-out: three tickets on the SLA clock */}
        <div className="mt-12 rounded-lg border border-ward-3 bg-ward-2/60 p-5">
          {[
            { id: "TKT-0042", t: "Pharmacy dispensing cabinet offline", p: "Urgent", w: 0.62, c: "#e0604f" },
            { id: "TKT-0041", t: "Telehealth audio dropping", p: "High", w: 0.38, c: "#e5a04a" },
            { id: "TKT-0039", t: "Badge reader at ER door", p: "Medium", w: 0.15, c: "#5eead4" },
          ].map((r) => (
            <div key={r.id} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-baseline justify-between gap-4 text-[13px]">
                <span className="truncate text-white/90">
                  <span className="mr-2 font-mono text-[12px] text-ward-ink/50">{r.id}</span>
                  {r.t}
                </span>
                <span className="shrink-0 text-[12px]" style={{ color: r.c }}>
                  {r.p}
                </span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-ward-3">
                <div className="h-full rounded-full" style={{ width: `${r.w * 100}%`, background: r.c }} />
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">{children}</div>
      </main>
    </div>
  );
}
