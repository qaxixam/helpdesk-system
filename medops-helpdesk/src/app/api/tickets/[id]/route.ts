import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Message } from "@/models/Message";
import { ActivityLog } from "@/models/ActivityLog";
import { User } from "@/models/User";
import { Category } from "@/models/Category";
import { updateTicketSchema } from "@/lib/validations";
import { calculateSLADates } from "@/lib/sla";
import { sendTicketEmail } from "@/lib/mail";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, context: RouteContext) {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    await connectDB();
    void Category;
    void User;

    const ticket = await Ticket.findById(id)
        .populate("category", "name description defaultPriority")
        .populate("createdBy", "name email facility role")
        .populate("assignedAgent", "name email facility role")
        .lean();

    if (!ticket) {
        return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // STRICT API-LEVEL AUTHORIZATION CHECK
    const creatorId = ticket.createdBy._id.toString();
    const agentId = ticket.assignedAgent?._id?.toString();

    if (user.role === "user" && creatorId !== user.id) {
        return NextResponse.json(
            { error: "Forbidden: You do not have permission to view this ticket" },
            { status: 403 }
        );
    }

    if (user.role === "agent" && agentId !== user.id) {
        return NextResponse.json(
            { error: "Forbidden: This ticket is not assigned to your queue" },
            { status: 403 }
        );
    }

    // Filter out internal notes if the caller is a standard User
    const messageFilter: Record<string, unknown> = { ticket: id };
    if (user.role === "user") {
        messageFilter.isInternal = false;
    }

    const [messages, activityLogs] = await Promise.all([
        Message.find(messageFilter)
            .populate("author", "name email role facility")
            .sort({ createdAt: 1 })
            .lean(),
        ActivityLog.find({ ticket: id })
            .populate("actor", "name email role")
            .sort({ createdAt: -1 })
            .lean(),
    ]);

    return NextResponse.json({
        ticket,
        messages,
        activityLogs,
    });
}

export async function PATCH(req: NextRequest, context: RouteContext) {
    const { user, errorResponse } = await requireAuth();
    if (errorResponse || !user) return errorResponse!;

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
    }

    try {
        const body = await req.json();
        const parsed = updateTicketSchema.safeParse(body);

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

        const ticket = await Ticket.findById(id).populate(
            "createdBy",
            "name email"
        );

        if (!ticket) {
            return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
        }

        const creatorId = ticket.createdBy._id.toString();
        const currentAgentId = ticket.assignedAgent?.toString();

        // 1. Role Check for USER: Can only close their own ticket
        if (user.role === "user") {
            if (creatorId !== user.id) {
                return NextResponse.json(
                    { error: "Forbidden: Cannot modify another user's ticket" },
                    { status: 403 }
                );
            }
            if (
                parsed.data.status !== "Closed" ||
                parsed.data.priority ||
                parsed.data.assignedAgent !== undefined
            ) {
                return NextResponse.json(
                    { error: "Forbidden: Requesters can only close their own tickets" },
                    { status: 403 }
                );
            }
        }

        // 2. Role Check for AGENT: Can only modify tickets assigned to them, cannot reassign
        if (user.role === "agent") {
            if (currentAgentId !== user.id) {
                return NextResponse.json(
                    { error: "Forbidden: Ticket is not assigned to you" },
                    { status: 403 }
                );
            }
            if (parsed.data.assignedAgent !== undefined) {
                return NextResponse.json(
                    { error: "Forbidden: Only admins can assign or reassign tickets" },
                    { status: 403 }
                );
            }
        }

        const now = new Date();
        const logsToCreate: Array<{ action: string; details: string }> = [];

        // Handle Agent Assignment / Reassignment (Admin Only)
        if (
            user.role === "admin" &&
            parsed.data.assignedAgent !== undefined &&
            parsed.data.assignedAgent !== currentAgentId
        ) {
            if (parsed.data.assignedAgent === null || parsed.data.assignedAgent === "") {
                ticket.assignedAgent = null;
                logsToCreate.push({
                    action: "UNASSIGNED",
                    details: "Unassigned ticket from support engineer",
                });
            } else {
                const agentUser = await User.findOne({
                    _id: parsed.data.assignedAgent,
                    role: "agent",
                    isActive: true,
                });

                if (!agentUser) {
                    return NextResponse.json(
                        { error: "Selected agent is invalid or inactive" },
                        { status: 400 }
                    );
                }

                ticket.assignedAgent = agentUser._id;
                logsToCreate.push({
                    action: "ASSIGNED",
                    details: `Assigned ticket to ${agentUser.name}`,
                });

                // Send assignment email to Agent
                await sendTicketEmail({
                    to: agentUser.email,
                    subject: `Ticket Assigned to You: ${ticket.title}`,
                    ticketNumber: ticket.ticketNumber,
                    title: ticket.title,
                    headline: `You have been assigned to ${ticket.ticketNumber}`,
                    bodyText: `Admin ${user.name} assigned this ${ticket.priority} priority incident to your queue.`,
                    status: ticket.status,
                    priority: ticket.priority,
                });
            }
        }

        // Handle Priority Change (Agent or Admin)
        if (parsed.data.priority && parsed.data.priority !== ticket.priority) {
            const oldPriority = ticket.priority;
            ticket.priority = parsed.data.priority;

            // Recalculate SLA dates based on original ticket creation time
            const { responseDueDate, resolutionDueDate } = calculateSLADates(
                parsed.data.priority,
                ticket.createdAt
            );
            ticket.responseDueDate = responseDueDate;
            ticket.resolutionDueDate = resolutionDueDate;

            logsToCreate.push({
                action: "PRIORITY_CHANGED",
                details: `Changed priority from ${oldPriority} to ${parsed.data.priority}`,
            });
        }

        // Handle Status Change
        if (parsed.data.status && parsed.data.status !== ticket.status) {
            const oldStatus = ticket.status;
            ticket.status = parsed.data.status;

            if (parsed.data.status === "Resolved") {
                ticket.resolvedAt = now;
                if (!ticket.firstRespondedAt) {
                    ticket.firstRespondedAt = now;
                }
            } else if (parsed.data.status === "Closed") {
                ticket.closedAt = now;
            }

            logsToCreate.push({
                action: "STATUS_CHANGED",
                details: `Changed status from ${oldStatus} to ${parsed.data.status}`,
            });

            // Notify User when ticket is Resolved
            if (parsed.data.status === "Resolved") {
                const creator = ticket.createdBy as unknown as {
                    email: string;
                    name: string;
                };
                if (creator?.email) {
                    await sendTicketEmail({
                        to: creator.email,
                        subject: `Incident Resolved: ${ticket.title}`,
                        ticketNumber: ticket.ticketNumber,
                        title: ticket.title,
                        headline: "Your clinical support ticket has been marked Resolved",
                        bodyText:
                            "Please verify the resolution. If we do not hear back within 3 days, this ticket will automatically close.",
                        status: "Resolved",
                        priority: ticket.priority,
                    });
                }
            }
        }

        await ticket.save();

        if (logsToCreate.length > 0) {
            await ActivityLog.insertMany(
                logsToCreate.map((l) => ({
                    ticket: ticket._id,
                    actor: user.id,
                    action: l.action,
                    details: l.details,
                }))
            );
        }

        const updatedTicket = await Ticket.findById(id)
            .populate("category", "name description defaultPriority")
            .populate("createdBy", "name email facility role")
            .populate("assignedAgent", "name email facility role")
            .lean();

        return NextResponse.json({ ticket: updatedTicket });
    } catch (error) {
        console.error("PATCH /api/tickets/[id] error:", error);
        return NextResponse.json(
            { error: "Failed to update ticket" },
            { status: 500 }
        );
    }
}