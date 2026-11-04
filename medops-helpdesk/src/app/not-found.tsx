import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <p className="font-mono text-[13px] text-ink-3">404</p>
      <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.015em] text-ink">This page doesn’t exist</h1>
      <p className="mt-2 max-w-sm text-[14.5px] text-ink-3">The link may be old, or the page was moved.</p>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-md bg-teal-600 px-4 text-sm font-medium text-white hover:bg-teal-700">
        Go to my dashboard
      </Link>
    </main>
  );
}
