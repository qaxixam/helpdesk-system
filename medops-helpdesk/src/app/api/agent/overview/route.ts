import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { maybeSyncLifecycle } from "@/lib/ticket-lifecycle";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const ACTIVE = ["Open", "In Progress", "Waiting on User"];

/** Dashboard summary — agent ke liye assigned tickets, user ke liye apne tickets */
export async function GET() {
  const { user, errorResponse } = await requireAuth(["agent", "user"]);
  if (!user) return errorResponse;

  try {
    await connectDB();
    await maybeSyncLifecycle();
    const id = new Types.ObjectId(user.id);
    const match = user.role === "agent" ? { assignedAgent: id } : { createdBy: id };

    const [facet] = await Ticket.aggregate([
      { $match: match },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $in: ["$status", ACTIVE] }, 1, 0] } },
                waiting: { $sum: { $cond: [{ $eq: ["$status", "Waiting on User"] }, 1, 0] } },
                urgent: {
                  $sum: { $cond: [{ $and: [{ $eq: ["$priority", "Urgent"] }, { $in: ["$status", ACTIVE] }] }, 1, 0] },
                },
                breached: { $sum: { $cond: [{ $and: ["$slaBreached", { $in: ["$status", ACTIVE] }] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0] } },
                awaitingResponse: {
                  $sum: {
                    $cond: [
                      { $and: [{ $in: ["$status", ACTIVE] }, { $eq: [{ $ifNull: ["$firstRespondedAt", null] }, null] }] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
        },
      },
    ]);

    const s = facet.summary[0] || {};
    return NextResponse.json({
      summary: {
        total: s.total || 0,
        active: s.active || 0,
        waiting: s.waiting || 0,
        urgent: s.urgent || 0,
        breached: s.breached || 0,
        resolved: s.resolved || 0,
        awaitingResponse: s.awaitingResponse || 0,
        resolutionRate: s.total ? Math.round(((s.resolved || 0) / s.total) * 100) : 0,
      },
      byStatus: (facet.byStatus as { _id: string; count: number }[]).map((r) => ({ status: r._id, count: r.count })),
    });
  } catch (error) {
    console.error("GET /api/agent/overview error:", error);
    return jsonError("Failed to load overview", 500);
  }
}
