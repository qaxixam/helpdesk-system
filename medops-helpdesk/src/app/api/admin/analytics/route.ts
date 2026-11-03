import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { User } from "@/models/User";
import { Message } from "@/models/Message";

export async function GET() {
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    try {
        await connectDB();
        void Category;
        void User;
        void Message;

        const [rawTickets, categories, agents, messages] = await Promise.all([
            Ticket.find()
                .select("ticketNumber title status priority category createdBy assignedAgent createdAt firstRespondedAt resolvedAt slaBreached")
                .populate("category", "name")
                .populate("createdBy", "name email facility")
                .populate("assignedAgent", "name email facility")
                .sort({ createdAt: -1 })
                .lean(),
            Category.find().select("name").lean(),
            User.find({ role: "agent", isActive: true }).select("name email facility").lean(),
            Message.find().select("createdAt isInternal").lean(),
        ]);

        interface TicketDoc {
            _id: string;
            ticketNumber: string;
            title: string;
            status: string;
            priority: string;
            category?: { _id?: string; name: string };
            createdBy?: { name: string; email: string; facility?: string };
            assignedAgent?: { _id?: string; name: string; email: string };
            createdAt: Date;
            firstRespondedAt?: Date;
            resolvedAt?: Date;
            slaBreached: boolean;
        }

        const tickets = rawTickets as unknown as TicketDoc[];

        // 1. KPI Counts
        const totalTickets = tickets.length;
        const openTickets = tickets.filter((t) => t.status === "Open").length;
        const inProgressTickets = tickets.filter(
            (t) => t.status === "In Progress" || t.status === "Waiting on User"
        ).length;
        const resolvedClosedTickets = tickets.filter(
            (t) => t.status === "Resolved" || t.status === "Closed"
        ).length;
        const slaBreachCount = tickets.filter((t) => t.slaBreached).length;
        const unassignedCount = tickets.filter((t) => !t.assignedAgent).length;

        // SLA Compliance percentage
        const slaComplianceRate = totalTickets > 0
            ? Math.round(((totalTickets - slaBreachCount) / totalTickets) * 100)
            : 100;

        // 2. Average First-Response Time
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

        // 3. Incidents Distribution by Status
        const statusConfig = [
            { status: "Open", color: "#6052E9", badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200" },
            { status: "In Progress", color: "#38BDF8", badgeClass: "bg-sky-50 text-sky-700 border-sky-200" },
            { status: "Waiting on User", color: "#F59E0B", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
            { status: "Resolved", color: "#00D084", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
            { status: "Closed", color: "#94A3B8", badgeClass: "bg-slate-50 text-slate-700 border-slate-200" },
        ];

        const ticketsByStatus = statusConfig.map((cfg) => {
            const count = tickets.filter((t) => t.status === cfg.status).length;
            const percentage = totalTickets > 0 ? Math.round((count / totalTickets) * 100) : 0;
            return {
                status: cfg.status,
                count,
                percentage,
                color: cfg.color,
                badgeClass: cfg.badgeClass,
            };
        });

        // 4. Conversation & Incident Flow (Past 7 Days timeline)
        const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const now = new Date();
        const conversationFlow = [];

        for (let i = 6; i >= 0; i--) {
            const dateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
            const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
            const endOfDay = startOfDay + 24 * 60 * 60 * 1000;
            const dayLabel = dayNames[dateObj.getDay()];
            const monthDay = `${dateObj.toLocaleString("default", { month: "short" })} ${dateObj.getDate()}`;

            const newTicketsCount = tickets.filter((t) => {
                const tTime = new Date(t.createdAt).getTime();
                return tTime >= startOfDay && tTime < endOfDay;
            }).length;

            const resolvedCount = tickets.filter((t) => {
                if (!t.resolvedAt) return false;
                const rTime = new Date(t.resolvedAt).getTime();
                return rTime >= startOfDay && rTime < endOfDay;
            }).length;

            const repliesCount = messages.filter((m) => {
                const mTime = new Date(m.createdAt).getTime();
                return mTime >= startOfDay && mTime < endOfDay;
            }).length;

            conversationFlow.push({
                day: dayLabel,
                date: monthDay,
                incoming: newTicketsCount,
                conversations: repliesCount,
                resolved: resolvedCount,
            });
        }

        // 5. Tickets by Category
        const ticketsByCategory = categories.map((cat) => ({
            category: cat.name,
            count: tickets.filter(
                (t) => t.category?.name === cat.name
            ).length,
        }));

        // 6. Per-Agent Workload
        const agentWorkload = agents.map((agent) => {
            const agentTickets = tickets.filter(
                (t) => (t.assignedAgent as { _id?: { toString(): string } })?._id?.toString() === agent._id.toString()
            );
            return {
                agentId: agent._id.toString(),
                agentName: agent.name.split(" (")[0],
                facility: agent.facility || "Support HQ",
                active: agentTickets.filter((t) => t.status !== "Resolved" && t.status !== "Closed").length,
                resolved: agentTickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length,
                breached: agentTickets.filter((t) => t.slaBreached).length,
                total: agentTickets.length,
            };
        });

        // 7. Unassigned pending incidents for the triage command center
        const unassignedTickets = tickets.filter(
            (t) => !t.assignedAgent && t.status !== "Closed" && t.status !== "Resolved"
        );

        return NextResponse.json({
            summary: {
                totalTickets,
                openTickets,
                inProgressTickets,
                resolvedClosedTickets,
                slaBreachCount,
                slaComplianceRate,
                avgFirstResponseMinutes,
                unassignedCount,
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
