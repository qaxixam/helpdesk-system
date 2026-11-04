import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ActivityLog } from "@/models/ActivityLog";
import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";
import { jsonError, paginationMeta, parsePagination } from "@/lib/http";

const ACTIONS = [
  "TICKET_CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "UNASSIGNED",
  "PRIORITY_CHANGED",
  "REPLY_POSTED",
  "INTERNAL_NOTE_ADDED",
  "SLA_BREACHED",
  "AUTO_CLOSED",
];

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth();
  if (!user) return errorResponse;

  try {
    await connectDB();
    void User;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams, 15);
    const action = searchParams.get("action");
    const range = searchParams.get("dateRange") || "all";

    const query: Record<string, unknown> = {};

    // Role scoping: user → apne tickets, agent → assigned tickets, admin → sab
    if (user.role !== "admin") {
      const ids = await Ticket.find(user.role === "user" ? { createdBy: user.id } : { assignedAgent: user.id })
        .select("_id")
        .lean();
      query.ticket = { $in: ids.map((t) => t._id) };
    }

    if (user.role === "user") {
      // Internal notes ki activity requester ko kabhi nazar nahi aati
      query.action = action && action !== "INTERNAL_NOTE_ADDED" && ACTIONS.includes(action)
        ? action
        : { $ne: "INTERNAL_NOTE_ADDED" };
    } else if (action && ACTIONS.includes(action)) {
      query.action = action;
    }

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    if (range === "today") {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      query.createdAt = { $gte: start };
    } else if (range === "7d") {
      query.createdAt = { $gte: new Date(now - 7 * DAY) };
    } else if (range === "30d") {
      query.createdAt = { $gte: new Date(now - 30 * DAY) };
    }

    const [activities, totalCount] = await Promise.all([
      ActivityLog.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .populate("ticket", "ticketNumber title priority status")
        .populate("actor", "name role")
        .lean(),
      ActivityLog.countDocuments(query),
    ]);

    return NextResponse.json({ activities, pagination: paginationMeta(page, limit, totalCount) });
  } catch (error) {
    console.error("GET /api/activity error:", error);
    return jsonError("Failed to load activity", 500);
  }
}
