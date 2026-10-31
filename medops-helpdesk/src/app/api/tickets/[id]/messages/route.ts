import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Message } from "@/models/Message";
import { ActivityLog } from "@/models/ActivityLog";
import { User } from "@/models/User";
import { createMessageSchema } from "@/lib/validations";
import { sendTicketEmail } from "@/lib/mail";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth();
  if (errorResponse || !user) return errorResponse!;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const parsed = createMessageSchema.safeParse(body);

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
    void User;

    const ticket = await Ticket.findById(id)
      .populate("createdBy", "name email")
      .populate("assignedAgent", "name email");

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const creatorId = ticket.createdBy._id.toString();
    const agentId = ticket.assignedAgent?._id?.toString();

    // Strict API Role Check
    if (user.role === "user" && creatorId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You cannot reply to another user's ticket" },
        { status: 403 }
      );
    }

    if (user.role === "agent" && agentId !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: This ticket is not assigned to you" },
        { status: 403 }
      );
    }

    if (ticket.status === "Closed") {
      return NextResponse.json(
        { error: "Closed tickets cannot receive new replies" },
        { status: 400 }
      );
    }

    // Standard users can NEVER post internal notes
    const isInternal =
      user.role === "user" ? false : Boolean(parsed.data.isInternal);

    const message = await Message.create({
      ticket: ticket._id,
      author: user.id,
      body: parsed.data.body,
      attachments: parsed.data.attachments || [],
      isInternal,
    });

    const now = new Date();

    // Update Ticket SLA & Status Lifecycle
    if ((user.role === "agent" || user.role === "admin") && !isInternal) {
      if (!ticket.firstRespondedAt) {
        ticket.firstRespondedAt = now;
        if (now > new Date(ticket.responseDueDate)) {
          ticket.slaBreached = true;
        }
      }
      if (ticket.status === "Open") {
        ticket.status = "In Progress";
      }
    } else if (user.role === "user") {
      // Agar user Resolved ya Waiting on User ticket par reply kare toh wapas In Progress kar do
      if (
        ticket.status === "Waiting on User" ||
        ticket.status === "Resolved"
      ) {
        ticket.status = "In Progress";
        ticket.resolvedAt = null;
      }
    }

    await ticket.save();

    await ActivityLog.create({
      ticket: ticket._id,
      actor: user.id,
      action: isInternal ? "INTERNAL_NOTE_ADDED" : "REPLY_POSTED",
      details: isInternal
        ? `${user.name} added an internal staff note`
        : `${user.name} (${user.role}) posted a reply`,
    });

    // Send Email Notification (Sirf public reply par, internal note par nahi)
    if (!isInternal) {
      const creator = ticket.createdBy as unknown as {
        email: string;
        name: string;
      };
      const agent = ticket.assignedAgent as unknown as {
        email: string;
        name: string;
      } | null;

      if (user.role === "user" && agent?.email) {
        await sendTicketEmail({
          to: agent.email,
          subject: `New Requester Reply on ${ticket.ticketNumber}`,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          headline: `${user.name} replied to ${ticket.ticketNumber}`,
          bodyText: parsed.data.body,
          status: ticket.status,
          priority: ticket.priority,
        });
      } else if (
        (user.role === "agent" || user.role === "admin") &&
        creator?.email
      ) {
        await sendTicketEmail({
          to: creator.email,
          subject: `Update on your ticket ${ticket.ticketNumber}`,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          headline: `Support Engineer ${user.name} replied to your ticket`,
          bodyText: parsed.data.body,
          status: ticket.status,
          priority: ticket.priority,
        });
      }
    }

    const populatedMessage = await Message.findById(message._id)
      .populate("author", "name email role facility")
      .lean();

    return NextResponse.json({ message: populatedMessage }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets/[id]/messages error:", error);
    return NextResponse.json(
      { error: "Failed to post message" },
      { status: 500 }
    );
  }
}