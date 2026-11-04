import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { syncSLAsAndAutoClose } from "@/lib/ticket-lifecycle";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Do tarah se chal sakta hai:
 *  1. Vercel Cron (GET) → header `Authorization: Bearer <CRON_SECRET>` (Vercel khud bhejta hai)
 *  2. Admin dashboard ka "Run SLA check" button (POST, admin session)
 */
function hasCronSecret(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function run() {
  try {
    const result = await syncSLAsAndAutoClose();
    return NextResponse.json({ message: "SLA check and auto-close completed", ...result });
  } catch (error) {
    console.error("SLA cron error:", error);
    return jsonError("Failed to run SLA check", 500);
  }
}

export async function GET(req: NextRequest) {
  if (!hasCronSecret(req)) return jsonError("Unauthorized", 401);
  return run();
}

export async function POST(req: NextRequest) {
  if (!hasCronSecret(req)) {
    const { user, errorResponse } = await requireAuth(["admin"]);
    if (!user) return errorResponse;
  }
  return run();
}
