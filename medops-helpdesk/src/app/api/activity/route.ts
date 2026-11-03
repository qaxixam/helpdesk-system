import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { ActivityLog } from "@/models/ActivityLog";
import { Ticket } from "@/models/Ticket";
import { User } from "@/models/User";

export async function GET() {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    try {
        await connectDB();
        // Ensure models are registered for populate
        void User;
        void Ticket;

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

        const activities = await ActivityLog.find(query)
            .sort({ createdAt: -1 })
            .limit(60)
            .populate("ticket", "ticketNumber title priority status")
            .populate("actor", "name email role facility")
            .lean();

        // Calculate summary metrics for user
        const totalCount = activities.length;
        const myCreations = activities.filter(
            (a) => a.action === "TICKET_CREATED" && String((a.actor as { _id?: string })?._id || a.actor) === user.id
        ).length;
        const myReplies = activities.filter(
            (a) => a.action === "REPLY_POSTED" && String((a.actor as { _id?: string })?._id || a.actor) === user.id
        ).length;

        return NextResponse.json({
            activities,
            metrics: {
                totalCount,
                myCreations,
                myReplies,
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

