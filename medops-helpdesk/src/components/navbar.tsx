"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    LayoutDashboard,
    BarChart3,
    LogOut,
    Building2,
    ShieldAlert,
} from "lucide-react";

export function Navbar() {
    const pathname = usePathname();
    const { data: session } = useSession();
    const user = session?.user;

    if (!user) return null;

    const roleColors: Record<string, string> = {
        admin: "bg-teal-500/15 text-teal-300 border-teal-500/30",
        agent: "bg-blue-500/15 text-blue-300 border-blue-500/30",
        user: "bg-slate-700 text-slate-200 border-slate-600",
    };

    return (
        <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-slate-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
                {/* Left: Brand & Nav Links */}
                <div className="flex items-center gap-6">
                    <Link href="/dashboard" className="flex items-center gap-2.5">
                        <div className="h-7 w-7 rounded bg-teal-500 flex items-center justify-center text-slate-950 font-bold">
                            <Activity className="h-4 w-4" />
                        </div>
                        <span className="font-semibold tracking-tight text-base text-white">
                            MedOps{" "}
                            <span className="font-mono text-xs text-teal-400">IT-SOC</span>
                        </span>
                    </Link>

                    <nav className="hidden md:flex items-center gap-1">
                        <Link
                            href="/dashboard"
                            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${pathname === "/dashboard" || pathname.startsWith("/tickets")
                                    ? "bg-slate-800 text-white"
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                                }`}
                        >
                            <LayoutDashboard className="h-3.5 w-3.5" />
                            {user.role === "agent"
                                ? "Assigned Incident Queue"
                                : user.role === "admin"
                                    ? "All Clinical Incidents"
                                    : "My Support Tickets"}
                        </Link>

                        {user.role === "admin" && (
                            <Link
                                href="/admin"
                                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition ${pathname.startsWith("/admin")
                                        ? "bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                                    }`}
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                                Admin Command & Analytics
                            </Link>
                        )}
                    </nav>
                </div>

                {/* Right: User Identity, Facility & Logout */}
                <div className="flex items-center gap-3">
                    <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 border-r border-slate-800 pr-3">
                        <Building2 className="h-3.5 w-3.5 text-slate-500" />
                        <span className="truncate max-w-[180px]">
                            {user.facility || "Main Medical Center"}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="text-right hidden sm:block">
                            <div className="text-xs font-medium text-slate-100 leading-none">
                                {user.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                                {user.email}
                            </div>
                        </div>

                        <Badge
                            variant="outline"
                            className={`uppercase font-mono text-[10px] px-2 py-0.5 ${roleColors[user.role] || roleColors.user
                                }`}
                        >
                            {user.role}
                        </Badge>
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 px-2.5 text-xs"
                    >
                        <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
                        <span className="hidden sm:inline">Sign Out</span>
                    </Button>
                </div>
            </div>

            {/* Mobile Sub-nav */}
            {user.role === "admin" && (
                <div className="flex md:hidden border-t border-slate-800 px-4 py-1.5 gap-2 bg-slate-950">
                    <Link
                        href="/dashboard"
                        className={`text-xs px-2.5 py-1 rounded ${pathname === "/dashboard"
                                ? "bg-slate-800 text-white"
                                : "text-slate-400"
                            }`}
                    >
                        Incident Queue
                    </Link>
                    <Link
                        href="/admin"
                        className={`text-xs px-2.5 py-1 rounded flex items-center gap-1 ${pathname.startsWith("/admin")
                                ? "bg-teal-500/20 text-teal-300"
                                : "text-slate-400"
                            }`}
                    >
                        <ShieldAlert className="h-3 w-3" />
                        Admin Portal
                    </Link>
                </div>
            )}
        </header>
    );
}