"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutGrid,
  BarChart3,
  Users,
  Activity,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Layers,
  BookOpen,
  UserCheck,
  Search,
  ShieldCheck,
  Stethoscope,
  Wrench,
  Ticket,
  Settings,
} from "lucide-react";

interface DashboardShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  sidebarAction?: React.ReactNode;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: string;
  badgeColor?: string;
}

export function DashboardShell({
  children,
  title = "Performance Dashboard",
  subtitle = "Real-time IT Operations & Healthcare Incident Management",
  action,
  sidebarAction,
}: DashboardShellProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState("");

  const user = session?.user;
  const role = user?.role || "user";

  // Role-specific navigation items strictly reflecting backend capabilities
  const adminNav: NavItem[] = [
    {
      label: "Overview & Analytics",
      href: "/admin",
      icon: BarChart3,
      active: pathname === "/admin",
    },
    {
      label: "All Clinical Incidents",
      href: "/dashboard",
      icon: LayoutGrid,
      active: pathname === "/dashboard",
    },
    {
      label: "Task Assignment",
      href: "/admin#assignment",
      icon: UserCheck,
      active: false,
    },
    {
      label: "Support Engineers",
      href: "/admin#users",
      icon: Users,
      active: false,
    },
    {
      label: "Categories & SLAs",
      href: "/admin#categories",
      icon: Layers,
      active: false,
    },
  ];

  const agentNav: NavItem[] = [
    {
      label: "Assigned Incident Queue",
      href: "/dashboard",
      icon: LayoutGrid,
      active: pathname === "/dashboard",
    },
    {
      label: "Urgent Incidents (<1h SLA)",
      href: "/dashboard?priority=Urgent",
      icon: AlertTriangle,
      active: false,
      badge: "URGENT",
      badgeColor: "bg-rose-500",
    },
    {
      label: "Pending First Response",
      href: "/dashboard?status=Open",
      icon: Clock,
      active: false,
    },
    {
      label: "Waiting on Clinic User",
      href: "/dashboard?status=Waiting+on+User",
      icon: Users,
      active: false,
    },
    {
      label: "Resolved Incidents",
      href: "/dashboard?status=Resolved",
      icon: CheckCircle2,
      active: false,
    },
  ];

  const userNav: NavItem[] = [
    {
      label: "Overview",
      href: "/dashboard",
      icon: LayoutGrid,
      active: pathname === "/dashboard",
    },
    {
      label: "My Tickets",
      href: "/dashboard#tickets",
      icon: Ticket,
      active: false,
    },
  ];

  const secondaryNav = {
    admin: [
      { label: "SLA Monitor & Sync", href: "/admin#sla-sync", icon: Activity },
      { label: "Live System Audit", href: "/dashboard#audit", icon: ShieldCheck },
    ],
    agent: [
      { label: "SLA Matrix & Rules", href: "/dashboard#sla-rules", icon: BookOpen },
      { label: "My Activity Stream", href: "/dashboard#activity", icon: Activity },
    ],
    user: [
      { label: "Settings", href: "/dashboard#settings", icon: Settings },
    ],
  };

  const navItems = role === "admin" ? adminNav : role === "agent" ? agentNav : userNav;
  const secondaryItems = secondaryNav[role as keyof typeof secondaryNav] || secondaryNav.user;

  const roleMeta = {
    admin: {
      tag: "ADMIN CONSOLE",
      tagColor: "bg-purple-500/20 text-purple-300 border-purple-400/30",
      roleLabel: "System Administrator",
      icon: ShieldCheck,
    },
    agent: {
      tag: "ENGINEER SOC",
      tagColor: "bg-teal-500/20 text-teal-300 border-teal-400/30",
      roleLabel: "Support Engineer",
      icon: Wrench,
    },
    user: {
      tag: "CLINIC PORTAL",
      tagColor: "bg-blue-500/20 text-blue-300 border-blue-400/30",
      roleLabel: "Clinical Requester",
      icon: Stethoscope,
    },
  }[role] || {
    tag: "PORTAL",
    tagColor: "bg-slate-500/20 text-slate-300 border-slate-400/30",
    roleLabel: "User",
    icon: Stethoscope,
  };

  return (
    <div className="min-h-screen flex bg-[#F4F6FB] text-slate-800 antialiased font-sans w-full max-w-full overflow-x-hidden">
      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Role-Specific Midnight Navy Sidebar (#141738) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#141738] text-white flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Brand Header */}
          <div className="p-6 flex items-center justify-between border-b border-white/5">
            <Link
              href={role === "admin" ? "/admin" : "/dashboard"}
              className="flex items-center gap-3 group"
              onClick={() => setMobileMenuOpen(false)}
            >
              {/* Baligo 3-dot signature emblem */}
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFB020] inline-block shadow-xs" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#00D2B4] inline-block shadow-xs" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5630] inline-block shadow-xs" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-white font-sans">
                  MedOps
                </span>
                <span className={`text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded border inline-block mt-0.5 w-fit font-bold ${roleMeta.tagColor}`}>
                  {roleMeta.tag}
                </span>
              </div>
            </Link>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Search */}
          <div className="px-5 pt-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={role === "admin" ? "Search tickets, staff..." : "Search incidents..."}
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                className="w-full bg-white/10 hover:bg-white/15 focus:bg-white/20 text-white placeholder-slate-400 text-xs rounded-xl pl-8 pr-3 py-2 border border-white/5 transition-all outline-none focus:ring-1 focus:ring-purple-400"
              />
            </div>
            {sidebarAction && (
              <div className="mt-3">
                {sidebarAction}
              </div>
            )}
          </div>

          {/* Nav Items */}
          <div className="flex-1 px-4 py-2 space-y-6">
            {/* Main Application Section */}
            <div>
              <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {role === "admin" ? "SOC Operations" : role === "agent" ? "Incident Queue" : "Application"}
              </div>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                        item.active
                          ? "bg-[#23274F] text-white shadow-xs font-bold"
                          : "text-slate-300 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            item.active
                              ? "text-[#00D2B4]"
                              : "text-slate-400 group-hover:text-slate-200"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full leading-none shadow-xs shrink-0 ${item.badgeColor || "bg-[#FF4D4D]"}`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Secondary / Tools Section */}
            <div>
              <div className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {role === "admin" ? "Controls" : role === "agent" ? "Engineering SLA" : "Others"}
              </div>
              <div className="space-y-1">
                {secondaryItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all group"
                    >
                      <Icon className="h-4 w-4 text-slate-400 group-hover:text-slate-200 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* User profile footer */}
          <div className="p-4 border-t border-white/5 bg-[#0F122F]/70">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white font-extrabold flex items-center justify-center text-xs shrink-0 ring-2 ring-white/10 shadow-sm">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : "MO"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-white truncate">
                    {user?.name || "Support Staff"}
                  </p>
                  <p className="text-[10px] text-slate-400 font-mono capitalize truncate">
                    {roleMeta.roleLabel} • {user?.facility || "Main Clinic"}
                  </p>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                title="Sign out of system"
                className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 w-full max-w-full lg:pl-64 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Purple Gradient Header Band */}
        <header className="bg-brand-purple text-white pt-8 pb-20 px-4 sm:px-8 shadow-sm relative w-full overflow-hidden">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full min-w-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-white hover:bg-white/10 rounded-xl cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-sans">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-purple-100/90 mt-1 font-normal">
                  {subtitle}
                </p>
              </div>
            </div>

            {/* Action slot */}
            {action && <div className="flex items-center gap-3 flex-wrap">{action}</div>}
          </div>
        </header>

        {/* Overlapping Content Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 -mt-12 sm:-mt-14 pb-12 relative z-10 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
