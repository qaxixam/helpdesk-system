import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { User } from "@/models/User";

interface LeanTicket {
    _id: unknown;
    title: string;
    description: string;
    status: string;
    priority: string;
    category?: unknown;
    assignedAgent?: unknown;
    createdAt: Date;
    firstRespondedAt?: Date;
    slaBreached: boolean;
}

export async function GET() {
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    try {
        await connectDB();
        void Category;
        void User;

        const [rawTickets, categories, agents] = await Promise.all([
            Ticket.find()
                .select("title description status priority category assignedAgent createdAt firstRespondedAt slaBreached")
                .populate("category", "name")
                .populate("assignedAgent", "name email")
                .sort({ createdAt: -1 })
                .lean(),
            Category.find().select("name").lean(),
            User.find({ role: "agent", isActive: true }).select("name email").lean(),
        ]);

        const tickets = rawTickets as unknown as LeanTicket[];

        // 1. Tickets by Status
        const statusOrder = ["Open", "In Progress", "Waiting on User", "Resolved", "Closed"];
        const ticketsByStatus = statusOrder.map((status) => ({
            status,
            count: tickets.filter((t) => t.status === status).length,
        }));

        // 2. Tickets by Category
        const ticketsByCategory = categories.map((cat) => ({
            category: cat.name,
            count: tickets.filter(
                (t) => (t.category as { _id?: { toString(): string } })?._id?.toString() === cat._id.toString()
            ).length,
        }));

        // 3. Average First-Response Time
        const respondedTickets = tickets.filter((t) => t.firstRespondedAt);
        let avgFirstResponseMinutes = 0;
        if (respondedTickets.length > 0) {
            const totalMinutes = respondedTickets.reduce((acc, t) => {
                if (!t.firstRespondedAt) return acc;
                const diffMs = new Date(t.firstRespondedAt).getTime() - new Date(t.createdAt).getTime();
                return acc + Math.max(1, Math.round(diffMs / 60000));
            }, 0);
            avgFirstResponseMinutes = Math.round(totalMinutes / respondedTickets.length);
        }

        const slaBreachCount = tickets.filter((t) => t.slaBreached).length;
        const openTicketsCount = tickets.filter(
            (t) => t.status !== "Closed" && t.status !== "Resolved"
        ).length;

        // 4. Per-Agent Workload
        const agentWorkload = agents.map((agent) => {
            const agentTickets = tickets.filter(
                (t) => (t.assignedAgent as { _id?: { toString(): string } })?._id?.toString() === agent._id.toString()
            );
            return {
                agentId: agent._id.toString(),
                agentName: agent.name.split(" (")[0],
                active: agentTickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length,
                resolved: agentTickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length,
                breached: agentTickets.filter((t) => t.slaBreached).length,
                total: agentTickets.length,
            };
        });

        return NextResponse.json({
            summary: {
                totalTickets: tickets.length,
                openTicketsCount,
                slaBreachCount,
                avgFirstResponseMinutes,
                unassignedCount: tickets.filter((t) => !t.assignedAgent).length,
            },
            ticketsByStatus,
            ticketsByCategory,
            agentWorkload,
            tickets,
            agents,
        });
    } catch (error) {
        console.error("GET /api/admin/analytics error:", error);
        return NextResponse.json({ error: "Failed to load analytics" }, { status: 500 });
    }
}
