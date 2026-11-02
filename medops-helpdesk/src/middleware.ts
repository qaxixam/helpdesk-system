import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
    // ✅ FIX: Get whichever secret is available in .env.local
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;

    // Token verify karein
    const token = await getToken({ req, secret });
    const { pathname } = req.nextUrl;

    const isAuthPage = pathname === "/login" || pathname === "/register";
    const isProtectedRoute =
        pathname.startsWith("/dashboard") ||
        pathname.startsWith("/admin") ||
        pathname.startsWith("/tickets");

    // RULE 1: Logged in user ko dobara Login page se wapas Home par bhejein
    if (token && isAuthPage) {
        return NextResponse.redirect(new URL("/", req.url));
    }

    // RULE 2: Bina login kiye kisi ko secure pages par na jane dein
    if (!token && isProtectedRoute) {
        return NextResponse.redirect(new URL("/login", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/login",
        "/register",
        "/dashboard/:path*",
        "/admin/:path*",
        "/tickets/:path*"
    ],
};