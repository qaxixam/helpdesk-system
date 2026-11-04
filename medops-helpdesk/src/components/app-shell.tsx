"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  FolderTree,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { cn, displayName } from "@/lib/utils";
import { Avatar } from "@/components/ui/primitives";
import type { Role } from "@/lib/types";

type NavItem = { label: string; href: string; icon: React.ComponentType<{ className?: string }>; exact?: boolean };

const NAV: Record<Role, NavItem[]> = {
  admin: [
    { label: "Overview", href: "/admin", icon: LayoutDashboard, exact: true },
    { label: "All tickets", href: "/admin/tickets", icon: Inbox },
    { label: "Team", href: "/admin/team", icon: Users },
    { label: "Categories", href: "/admin/categories", icon: FolderTree },
    { label: "Activity log", href: "/admin/activity", icon: Activity },
  ],
  agent: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
    { label: "My queue", href: "/tickets", icon: Inbox },
    { label: "Activity", href: "/activity", icon: Activity },
  ],
  user: [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
    { label: "My tickets", href: "/tickets", icon: Ticket },
    { label: "Activity", href: "/activity", icon: Activity },
  ],
};

const ROLE_LABEL: Record<Role, string> = { admin: "Administrator", agent: "Support agent", user: "Requester" };

function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden>
        <rect width="26" height="26" rx="7" fill="#16897e" />
        <path d="M4 14h4l2.2-5 3.6 10 2.4-6.5 1.3 1.5H22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-white">MedOps</span>
    </span>
  );
}

function Sidebar({ role, onNavigate }: { role: Role | null; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const items = role ? NAV[role] : [];

  async function handleSignOut() {
    await signOut({ redirect: false });
    queryClient.clear();
    window.location.replace("/login");
  }

  return (
    <div className="flex h-full flex-col bg-ward text-ward-ink">
      <div className="flex h-16 items-center px-5">
        <Link href={role === "admin" ? "/admin" : "/dashboard"} onClick={onNavigate}>
          <Logo />
        </Link>
      </div>

      {role === "user" && (
        <div className="px-3 pb-2">
          <Link
            href="/tickets?new=1"
            onClick={onNavigate}
            className="flex h-9 items-center justify-center gap-2 rounded-md bg-teal-500 text-sm font-medium text-white transition-colors hover:bg-teal-600"
          >
            <Plus className="size-4" /> New ticket
          </Link>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 px-3 py-3" aria-label="Main">
        {!role &&
          Array.from({ length: 4 }).map((_, i) => <div key={i} className="mx-2 my-3 h-3 rounded bg-ward-2" />)}
        {items.map((item) => {
          const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-9 items-center gap-3 rounded-md px-3 text-[13.5px] font-medium transition-colors",
                active ? "bg-ward-3 text-white" : "text-ward-ink/80 hover:bg-ward-2 hover:text-white",
              )}
            >
              {active && <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r bg-teal-200" aria-hidden />}
              <Icon className={cn("size-4", active ? "text-teal-200" : "text-ward-ink/60")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-ward-3 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar name={session?.user?.name} size={32} className="bg-teal-900! text-teal-100!" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{displayName(session?.user?.name)}</p>
            <p className="truncate text-[12px] text-ward-ink/60">{role ? ROLE_LABEL[role] : "…"}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md p-2 text-ward-ink/60 transition-colors hover:bg-ward-2 hover:text-white"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
  back,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  back?: React.ReactNode;
}) {
  const { data: session } = useSession();
  const role = (session?.user?.role as Role | undefined) ?? null;
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 lg:block">
        <Sidebar role={role} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ward/60" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 shadow-pop">
            <Sidebar role={role} onNavigate={() => setOpen(false)} />
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 rounded-md p-1.5 text-ward-ink hover:bg-ward-2"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-3 bg-ward px-4 lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-white hover:bg-ward-2" aria-label="Open menu">
            <Menu className="size-5" />
          </button>
          <Logo />
        </div>

        <main className="mx-auto w-full max-w-[1320px] px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-9">
          <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              {back && <div className="mb-3">{back}</div>}
              <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.015em] text-ink sm:text-[28px]">{title}</h1>
              {description && <p className="mt-1.5 max-w-2xl text-[14.5px] text-ink-3">{description}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
