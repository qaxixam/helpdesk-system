import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const protectedPrefixes = ["/dashboard", "/admin", "/tickets", "/activity"];

export async function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    const token = await getToken({
        req: request,
        secret,
        secureCookie: process.env.NODE_ENV === "production",
    });

    const isAuthPage = pathname === "/login" || pathname === "/register";
    const isProtectedRoute = protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );

    if (token && isAuthPage) {
        return NextResponse.redirect(new URL("/", request.url));
    }

    if (!token && isProtectedRoute) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
        return NextResponse.redirect(loginUrl);
    }

    if (token) {
        const role = token.role;
        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
            if (role !== "admin") return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        if (role === "admin" && (pathname === "/dashboard" || pathname.startsWith("/dashboard/"))) {
            return NextResponse.redirect(new URL("/admin", request.url));
        }
        if (role === "admin" && (pathname === "/tickets" || pathname.startsWith("/tickets/"))) {
            const adminTicketsUrl = new URL("/admin/tickets", request.url);
            adminTicketsUrl.search = search;
            return NextResponse.redirect(adminTicketsUrl);
        }
    }

    const response = NextResponse.next();
    if (isProtectedRoute) {
        response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
    }
    return response;
}

export const config = {
    matcher: [
        "/login",
        "/register",
        "/dashboard/:path*",
        "/admin/:path*",
        "/tickets/:path*",
        "/activity/:path*",
    ],
};
