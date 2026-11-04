import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ActivityLog } from "@/models/ActivityLog";
import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    try {
        await connectDB();
        // Ensure models are registered for populate
        void User;
        void Ticket;

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get("page")) || 1);
        const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 12));
        const action = searchParams.get("action");
        const dateRange = searchParams.get("dateRange") || "all";

        let query: Record<string, unknown> = {};

        if (user.role === "user") {
            const userTickets = await Ticket.find({ createdBy: user.id }).select("_id").lean();
            const ticketIds = userTickets.map((t) => t._id);
            query = {
                $or: [{ actor: user.id }, { ticket: { $in: ticketIds } }],
                action: { $ne: "INTERNAL_NOTE_ADDED" }, // Internal staff notes strictly hidden from requester
            };
        } else if (user.role === "agent") {
            const agentTickets = await Ticket.find({ assignedAgent: user.id }).select("_id").lean();
            const ticketIds = agentTickets.map((t) => t._id);
            query = {
                $or: [{ actor: user.id }, { ticket: { $in: ticketIds } }],
            };
        }
        // Admin sees all activities across the entire system

        if (action && action !== "ALL") {
            query.action = action;
        }

        // Date range filtering
        const now = new Date();
        if (dateRange === "today") {
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            query.createdAt = { $gte: startOfToday };
        } else if (dateRange === "7d") {
            const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: sevenDaysAgo };
        } else if (dateRange === "30d") {
            const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: thirtyDaysAgo };
        }

        const skip = (page - 1) * limit;

        const [activities, totalCount] = await Promise.all([
            ActivityLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate("ticket", "ticketNumber title priority status")
                .populate("actor", "name email role facility")
                .lean(),
            ActivityLog.countDocuments(query),
        ]);

        return NextResponse.json({
            activities,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.max(1, Math.ceil(totalCount / limit)),
            },
        });
    } catch (error) {
        console.error("Activity API error:", error);
        return NextResponse.json(
            { error: "Failed to load activity stream" },
            { status: 500 }
        );
    }
}
