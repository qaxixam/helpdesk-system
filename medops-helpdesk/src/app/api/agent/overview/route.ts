import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";

export async function GET() {
    const { user, errorResponse } = await requireAuth(["agent"]);
    if (errorResponse || !user) return errorResponse!;

    if (!Types.ObjectId.isValid(user.id)) {
        return NextResponse.json({ error: "Invalid agent account" }, { status: 401 });
    }

    try {
        await connectDB();
        const [summary] = await Ticket.aggregate([
            { $match: { assignedAgent: new Types.ObjectId(user.id) } },
            {
                $group: {
                    _id: null,
                    totalAssigned: { $sum: 1 },
                    active: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["Open", "In Progress", "Waiting on User"]] }, 1, 0],
                        },
                    },
                    urgent: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$priority", "Urgent"] },
                                        { $in: ["$status", ["Open", "In Progress", "Waiting on User"]] },
                                    ],
                                },
                                1,
                                0,
                            ],
                        },
                    },
                    breached: { $sum: { $cond: ["$slaBreached", 1, 0] } },
                    resolved: {
                        $sum: {
                            $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0],
                        },
                    },
                },
            },
        ]);

        return NextResponse.json({
            summary: {
                totalAssigned: summary?.totalAssigned ?? 0,
                active: summary?.active ?? 0,
                urgent: summary?.urgent ?? 0,
                breached: summary?.breached ?? 0,
                resolved: summary?.resolved ?? 0,
                resolutionRate: summary?.totalAssigned
                    ? Math.round((summary.resolved / summary.totalAssigned) * 100)
                    : 0,
            },
        });
    } catch (error) {
        console.error("GET /api/agent/overview error:", error);
        return NextResponse.json({ error: "Failed to load agent overview" }, { status: 500 });
    }
}
