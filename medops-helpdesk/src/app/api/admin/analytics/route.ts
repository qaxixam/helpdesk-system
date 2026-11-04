import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { User } from "@/models/User";
import { Message } from "@/models/Message";

const STATUS_CONFIG = [
    { status: "Open", color: "#6052E9", badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { status: "In Progress", color: "#38BDF8", badgeClass: "bg-sky-50 text-sky-700 border-sky-200" },
    { status: "Waiting on User", color: "#F59E0B", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
    { status: "Resolved", color: "#00D084", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { status: "Closed", color: "#94A3B8", badgeClass: "bg-slate-50 text-slate-700 border-slate-200" },
];

export async function GET() {
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    try {
        await connectDB();
        const now = new Date();
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setUTCHours(0, 0, 0, 0);
        sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);

        const [ticketMetrics, categories, agents, messageDaily, unassignedTickets] = await Promise.all([
            Ticket.aggregate([
                {
                    $facet: {
                        summary: [
                            {
                                $group: {
                                    _id: null,
                                    totalTickets: { $sum: 1 },
                                    openTickets: { $sum: { $cond: [{ $eq: ["$status", "Open"] }, 1, 0] } },
                                    inProgressTickets: {
                                        $sum: {
                                            $cond: [{ $in: ["$status", ["In Progress", "Waiting on User"]] }, 1, 0],
                                        },
                                    },
                                    resolvedClosedTickets: {
                                        $sum: { $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0] },
                                    },
                                    slaBreachCount: { $sum: { $cond: ["$slaBreached", 1, 0] } },
                                    unassignedCount: {
                                        $sum: { $cond: [{ $eq: [{ $ifNull: ["$assignedAgent", null] }, null] }, 1, 0] },
                                    },
                                    firstResponseMilliseconds: {
                                        $avg: {
                                            $cond: [
                                                { $ne: [{ $ifNull: ["$firstRespondedAt", null] }, null] },
                                                { $subtract: ["$firstRespondedAt", "$createdAt"] },
                                                null,
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                        statusCounts: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                        categoryCounts: [
                            { $group: { _id: "$category", count: { $sum: 1 } } },
                        ],
                        agentWorkload: [
                            { $match: { assignedAgent: { $ne: null } } },
                            {
                                $group: {
                                    _id: "$assignedAgent",
                                    total: { $sum: 1 },
                                    active: {
                                        $sum: {
                                            $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 0, 1],
                                        },
                                    },
                                    resolved: {
                                        $sum: {
                                            $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0],
                                        },
                                    },
                                    breached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
                                },
                            },
                        ],
                        dailyIncoming: [
                            { $match: { createdAt: { $gte: sevenDaysAgo } } },
                            {
                                $group: {
                                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                        dailyResolved: [
                            { $match: { resolvedAt: { $gte: sevenDaysAgo } } },
                            {
                                $group: {
                                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$resolvedAt", timezone: "UTC" } },
                                    count: { $sum: 1 },
                                },
                            },
                        ],
                    },
                },
            ]),
            Category.find().select("name").lean(),
            User.find({ role: "agent", isActive: true }).select("name email facility").sort({ name: 1 }).lean(),
            Message.aggregate([
                { $match: { createdAt: { $gte: sevenDaysAgo } } },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "UTC" } },
                        count: { $sum: 1 },
                    },
                },
            ]),
            Ticket.find({ assignedAgent: null, status: { $nin: ["Resolved", "Closed"] } })
                .select("ticketNumber title status priority category createdBy assignedAgent createdAt firstRespondedAt resolvedAt slaBreached")
                .populate("category", "name")
                .populate("createdBy", "name email facility")
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),
        ]);

        const metrics = ticketMetrics[0] || {};
        const summaryRow = metrics.summary?.[0] || {};
        const totalTickets = summaryRow.totalTickets || 0;
        const slaBreachCount = summaryRow.slaBreachCount || 0;
        const statusCountMap = new Map<string, number>(
            (metrics.statusCounts || []).map((entry: { _id: string; count: number }) => [entry._id, entry.count])
        );
        const ticketsByStatus = STATUS_CONFIG.map((config) => {
            const count = statusCountMap.get(config.status) || 0;
            return {
                ...config,
                count,
                percentage: totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0,
            };
        });

        const categoryCountMap = new Map<string, number>(
            (metrics.categoryCounts || []).map((entry: { _id: { toString(): string } | null; count: number }) => [
                entry._id?.toString() || "",
                entry.count,
            ])
        );
        const ticketsByCategory = categories
            .map((category) => ({
                category: category.name,
                count: categoryCountMap.get(category._id.toString()) || 0,
            }))
            .sort((a, b) => b.count - a.count);

        const workloadMap = new Map<string, { active: number; resolved: number; breached: number; total: number }>(
            (metrics.agentWorkload || []).map((entry: {
                _id: { toString(): string };
                active: number;
                resolved: number;
                breached: number;
                total: number;
            }) => [entry._id.toString(), entry])
        );
        const agentWorkload = agents.map((agent) => {
            const workload = workloadMap.get(agent._id.toString());
            return {
                agentId: agent._id.toString(),
                agentName: agent.name.split(" (")[0],
                facility: agent.facility || "Support HQ",
                active: workload?.active || 0,
                resolved: workload?.resolved || 0,
                breached: workload?.breached || 0,
                total: workload?.total || 0,
            };
        });

        const incomingByDay = new Map<string, number>((metrics.dailyIncoming || []).map((entry: { _id: string; count: number }) => [entry._id, entry.count]));
        const resolvedByDay = new Map<string, number>((metrics.dailyResolved || []).map((entry: { _id: string; count: number }) => [entry._id, entry.count]));
        const messagesByDay = new Map<string, number>(messageDaily.map((entry: { _id: string; count: number }) => [entry._id, entry.count]));
        const conversationFlow = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(sevenDaysAgo);
            date.setUTCDate(date.getUTCDate() + index);
            const key = date.toISOString().slice(0, 10);
            return {
                day: date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
                date: date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
                incoming: incomingByDay.get(key) || 0,
                conversations: messagesByDay.get(key) || 0,
                resolved: resolvedByDay.get(key) || 0,
            };
        });

        return NextResponse.json({
            summary: {
                totalTickets,
                openTickets: summaryRow.openTickets || 0,
                inProgressTickets: summaryRow.inProgressTickets || 0,
                resolvedClosedTickets: summaryRow.resolvedClosedTickets || 0,
                slaBreachCount,
                slaComplianceRate: totalTickets > 0 ? Math.round(((totalTickets - slaBreachCount) / totalTickets) * 100) : 100,
                avgFirstResponseMinutes: summaryRow.firstResponseMilliseconds
                    ? Math.max(1, Math.round(summaryRow.firstResponseMilliseconds / 60000))
                    : 0,
                unassignedCount: summaryRow.unassignedCount || 0,
            },
            ticketsByStatus,
            conversationFlow,
            ticketsByCategory,
            agentWorkload,
            unassignedTickets,
            agents,
        });
    } catch (error) {
        console.error("GET /api/admin/analytics error:", error);
        return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
    }
}
