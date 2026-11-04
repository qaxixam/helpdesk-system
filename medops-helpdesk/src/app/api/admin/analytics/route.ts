import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { User } from "@/models/User";
import { maybeSyncLifecycle } from "@/lib/ticket-lifecycle";
import { PRIORITIES, STATUSES } from "@/lib/validations";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const TREND_DAYS = 14;
const ACTIVE = ["Open", "In Progress", "Waiting on User"];

type Row = { _id: unknown; count: number };

export async function GET() {
  const { user, errorResponse } = await requireAuth(["admin"]);
  if (!user) return errorResponse;

  try {
    await connectDB();
    await maybeSyncLifecycle();

    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (TREND_DAYS - 1));

    const [facet] = await Ticket.aggregate([
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $in: ["$status", ACTIVE] }, 1, 0] } },
                unassigned: {
                  $sum: {
                    $cond: [{ $and: [{ $in: ["$status", ACTIVE] }, { $eq: [{ $ifNull: ["$assignedAgent", null] }, null] }] }, 1, 0],
                  },
                },
                breached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
                activeBreached: { $sum: { $cond: [{ $and: ["$slaBreached", { $in: ["$status", ACTIVE] }] }, 1, 0] } },
                avgFirstResponseMs: {
                  $avg: {
                    $cond: [
                      { $ne: [{ $ifNull: ["$firstRespondedAt", null] }, null] },
                      { $subtract: ["$firstRespondedAt", "$createdAt"] },
                      null,
                    ],
                  },
                },
                avgResolutionMs: {
                  $avg: {
                    $cond: [
                      { $ne: [{ $ifNull: ["$resolvedAt", null] }, null] },
                      { $subtract: ["$resolvedAt", "$createdAt"] },
                      null,
                    ],
                  },
                },
              },
            },
          ],
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          byPriority: [{ $match: { status: { $in: ACTIVE } } }, { $group: { _id: "$priority", count: { $sum: 1 } } }],
          byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }],
          workload: [
            { $match: { assignedAgent: { $ne: null } } },
            {
              $group: {
                _id: "$assignedAgent",
                total: { $sum: 1 },
                active: { $sum: { $cond: [{ $in: ["$status", ACTIVE] }, 1, 0] } },
                resolved: { $sum: { $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0] } },
                breached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
              },
            },
          ],
          created: [
            { $match: { createdAt: { $gte: start } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
          ],
          resolved: [
            { $match: { resolvedAt: { $gte: start } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$resolvedAt" } }, count: { $sum: 1 } } },
          ],
        },
      },
    ]);

    const [categories, agents, unassignedTickets] = await Promise.all([
      Category.find().select("name").lean(),
      User.find({ role: "agent", isActive: true }).select("name email facility").sort({ name: 1 }).lean(),
      Ticket.find({ assignedAgent: null, status: { $in: ACTIVE } })
        .select("ticketNumber title status priority category createdBy createdAt responseDueDate resolutionDueDate firstRespondedAt slaBreached")
        .populate("category", "name")
        .populate("createdBy", "name")
        .sort({ createdAt: 1 })
        .limit(6)
        .lean(),
    ]);

    const s = facet.summary[0] || {};
    const map = (rows: Row[]) => new Map(rows.map((r) => [String(r._id), r.count]));
    const statusMap = map(facet.byStatus);
    const priorityMap = map(facet.byPriority);
    const categoryMap = map(facet.byCategory);
    const createdMap = map(facet.created);
    const resolvedMap = map(facet.resolved);
    const workloadMap = new Map<string, { total: number; active: number; resolved: number; breached: number }>(
      facet.workload.map((w: { _id: unknown; total: number; active: number; resolved: number; breached: number }) => [String(w._id), w]),
    );

    const trend = Array.from({ length: TREND_DAYS }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      return {
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
        created: createdMap.get(key) || 0,
        resolved: resolvedMap.get(key) || 0,
      };
    });

    const total = s.total || 0;
    const breached = s.breached || 0;

    return NextResponse.json({
      summary: {
        totalTickets: total,
        activeTickets: s.active || 0,
        unassignedCount: s.unassigned || 0,
        slaBreachCount: breached,
        activeBreachCount: s.activeBreached || 0,
        slaComplianceRate: total ? Math.round(((total - breached) / total) * 100) : 100,
        avgFirstResponseMinutes: s.avgFirstResponseMs ? Math.round(s.avgFirstResponseMs / 60000) : null,
        avgResolutionHours: s.avgResolutionMs ? Math.round((s.avgResolutionMs / 3_600_000) * 10) / 10 : null,
        resolvedInPeriod: trend.reduce((a, d) => a + d.resolved, 0),
        createdInPeriod: trend.reduce((a, d) => a + d.created, 0),
      },
      ticketsByStatus: STATUSES.map((status) => ({ status, count: statusMap.get(status) || 0 })),
      ticketsByPriority: PRIORITIES.map((priority) => ({ priority, count: priorityMap.get(priority) || 0 })),
      ticketsByCategory: categories
        .map((c) => ({ category: c.name, count: categoryMap.get(c._id.toString()) || 0 }))
        .sort((a, b) => b.count - a.count),
      trend,
      agentWorkload: agents.map((a) => {
        const w = workloadMap.get(a._id.toString());
        return {
          agentId: a._id.toString(),
          name: a.name,
          email: a.email,
          active: w?.active || 0,
          resolved: w?.resolved || 0,
          breached: w?.breached || 0,
          total: w?.total || 0,
        };
      }),
      unassignedTickets,
      agents: agents.map((a) => ({ _id: a._id.toString(), name: a.name, email: a.email })),
    });
  } catch (error) {
    console.error("GET /api/admin/analytics error:", error);
    return jsonError("Failed to load analytics", 500);
  }
}
