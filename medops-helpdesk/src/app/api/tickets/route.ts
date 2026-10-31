import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { createTicketSchema } from "@/lib/validations";
import { calculateSLADates } from "@/lib/sla";
import { syncSLAsAndAutoClose } from "@/lib/ticket-lifecycle";
import { sendTicketEmail } from "@/lib/mail";

export async function GET(req: NextRequest) {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    try {
        await connectDB();
        // Ensure Category & User models are registered before populate
        void Category;
        void User;

        // Sync SLA breaches & 3-day auto-close in real time
        await syncSLAsAndAutoClose();

        const { searchParams } = new URL(req.url);
        const page = Math.max(1, Number(searchParams.get("page")) || 1);
        const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 8));
        const status = searchParams.get("status");
        const priority = searchParams.get("priority");
        const category = searchParams.get("category");
        const search = searchParams.get("search")?.trim();
        const breached = searchParams.get("breached");

        // STRICT ROLE-BASED DATA ISOLATION
        const query: Record<string, unknown> = {};

        if (user.role === "user") {
            query.createdBy = user.id;
        } else if (user.role === "agent") {
            query.assignedAgent = user.id;
        }
        // Admin sees all tickets (and can optionally filter by assignedAgent)
        if (user.role === "admin" && searchParams.get("assignedAgent")) {
            const agentParam = searchParams.get("assignedAgent");
            query.assignedAgent = agentParam === "unassigned" ? null : agentParam;
        }

        if (status && status !== "ALL") query.status = status;
        if (priority && priority !== "ALL") query.priority = priority;
        if (category && category !== "ALL") query.category = category;
        if (breached === "true") query.slaBreached = true;

        if (search) {
            const safeRegex = new RegExp(
                search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                "i"
            );
            query.$or = [{ ticketNumber: safeRegex }, { title: safeRegex }];
        }

        const skip = (page - 1) * limit;

        const [tickets, totalCount] = await Promise.all([
            Ticket.find(query)
                .populate("category", "name defaultPriority")
                .populate("createdBy", "name email facility")
                .populate("assignedAgent", "name email facility")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Ticket.countDocuments(query),
        ]);

        return NextResponse.json({
            tickets,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages: Math.max(1, Math.ceil(totalCount / limit)),
            },
        });
    } catch (error) {
        console.error("GET /api/tickets error:", error);
        return NextResponse.json(
            { error: "Failed to fetch tickets" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireAuth(["user", "admin"]);
    if (errorResponse || !user) return errorResponse!;

    try {
        const body = await req.json();
        const parsed = createTicketSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "Validation failed",
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        await connectDB();

        const categoryDoc = await Category.findById(parsed.data.category);
        if (!categoryDoc) {
            return NextResponse.json(
                { error: "Selected category does not exist" },
                { status: 400 }
            );
        }

        // Auto-generate next sequential ticket number (e.g. TKT-0017)
        const lastTicket = await Ticket.findOne()
            .sort({ ticketNumber: -1 })
            .select("ticketNumber")
            .lean();

        let nextNum = 1;
        if (lastTicket?.ticketNumber) {
            const match = lastTicket.ticketNumber.match(/TKT-(\d+)/);
            if (match) nextNum = parseInt(match[1], 10) + 1;
        }
        const ticketNumber = `TKT-${String(nextNum).padStart(4, "0")}`;

        const now = new Date();
        const { responseDueDate, resolutionDueDate } = calculateSLADates(
            parsed.data.priority,
            now
        );

        const newTicket = await Ticket.create({
            ticketNumber,
            title: parsed.data.title,
            description: parsed.data.description,
            category: parsed.data.category,
            priority: parsed.data.priority,
            status: "Open",
            createdBy: user.id,
            assignedAgent: null,
            attachments: parsed.data.attachments || [],
            responseDueDate,
            resolutionDueDate,
            slaBreached: false,
        });

        await ActivityLog.create({
            ticket: newTicket._id,
            actor: user.id,
            action: "TICKET_CREATED",
            details: `Created ticket ${ticketNumber} (${parsed.data.priority} Priority)`,
        });

        // Send email notification to the user
        await sendTicketEmail({
            to: user.email || "",
            subject: `Incident Logged: ${newTicket.title}`,
            ticketNumber,
            title: newTicket.title,
            headline: "Your clinical support ticket has been logged",
            bodyText: `We have received your incident report and calculated your SLA targets based on ${parsed.data.priority} priority.`,
            status: "Open",
            priority: parsed.data.priority,
        });

        return NextResponse.json({ ticket: newTicket }, { status: 201 });
    } catch (error) {
        console.error("POST /api/tickets error:", error);
        return NextResponse.json(
            { error: "Failed to create ticket" },
            { status: 500 }
        );
    }
}