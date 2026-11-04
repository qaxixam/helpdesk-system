"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <h1 className="text-[24px] font-semibold tracking-[-0.015em] text-ink">Something broke on this page</h1>
      <p className="mt-2 max-w-md text-[14.5px] text-ink-3">
        {error.digest ? `Reference: ${error.digest}. ` : ""}Try again. If it keeps happening, tell your administrator.
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-flex h-10 items-center rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700"
      >
        Try again
      </button>
    </main>
  );
}
