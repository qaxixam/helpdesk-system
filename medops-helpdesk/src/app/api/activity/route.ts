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
        // Admin sees all activities across the entire system

        const activities = await ActivityLog.find(query)
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("ticket", "ticketNumber title priority status")
            .populate("actor", "name email role facility")
            .lean();

        // Calculate summary metrics
        const totalCount = activities.length;
        const ticketCreations = activities.filter((a) => a.action === "TICKET_CREATED").length;
        const replies = activities.filter((a) => a.action === "REPLY_POSTED").length;
        const statusChanges = activities.filter((a) => a.action === "STATUS_CHANGED").length;
        const assignments = activities.filter((a) => a.action === "ASSIGNED").length;

        return NextResponse.json({
            activities,
            metrics: {
                totalCount,
                ticketCreations,
                replies,
                statusChanges,
                assignments,
                myCreations: activities.filter(
                    (a) => a.action === "TICKET_CREATED" && String((a.actor as unknown as { _id?: unknown })?._id || a.actor) === user.id
                ).length,
                myReplies: activities.filter(
                    (a) => a.action === "REPLY_POSTED" && String((a.actor as unknown as { _id?: unknown })?._id || a.actor) === user.id
                ).length,
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
