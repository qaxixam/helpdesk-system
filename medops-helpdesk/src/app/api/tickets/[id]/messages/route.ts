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
import { canAccessTicket } from "@/lib/ticket-access";
import { isObjectId, jsonError, readJson, validationError } from "@/lib/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

type Person = { _id: mongoose.Types.ObjectId; name: string; email: string } | null;

export async function POST(req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth();
  if (!user) return errorResponse;

  const { id } = await context.params;
  if (!isObjectId(id)) return jsonError("Invalid ticket ID", 400);

  const parsed = createMessageSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  try {
    await connectDB();
    void User;

    const ticket = await Ticket.findById(id)
      .populate("createdBy", "name email")
      .populate("assignedAgent", "name email");

    if (!ticket || !canAccessTicket(user, ticket)) return jsonError("Ticket not found", 404);
    if (ticket.status === "Closed") return jsonError("Closed tickets cannot receive new replies", 400);

    // Requester kabhi internal note nahi bana sakta — chahe API ko direct call kare
    const isInternal = user.role === "user" ? false : parsed.data.isInternal;
    const isStaff = user.role === "agent" || user.role === "admin";
    const now = new Date();
    const previousStatus = ticket.status;

    const message = await Message.create({
      ticket: ticket._id,
      author: user.id,
      body: parsed.data.body,
      attachments: parsed.data.attachments,
      isInternal,
    });

    // ---- Lifecycle ----
    if (isStaff && !isInternal) {
      if (!ticket.firstRespondedAt) {
        ticket.firstRespondedAt = now;
        if (now > new Date(ticket.responseDueDate)) ticket.slaBreached = true;
      }
      if (ticket.status === "Open") ticket.status = "In Progress";
    } else if (user.role === "user" && (ticket.status === "Waiting on User" || ticket.status === "Resolved")) {
      // User ka reply ticket ko dobara active kar deta hai (aur auto-close ruk jata hai)
      ticket.status = "In Progress";
      ticket.resolvedAt = null;
    }
    await ticket.save();

    const logs = [
      {
        ticket: ticket._id,
        actor: user.id,
        action: isInternal ? "INTERNAL_NOTE_ADDED" : "REPLY_POSTED",
        details: isInternal ? "Added an internal note" : `Posted a reply`,
      },
    ];
    if (previousStatus !== ticket.status) {
      logs.push({
        ticket: ticket._id,
        actor: user.id,
        action: "STATUS_CHANGED",
        details: `Status changed from ${previousStatus} to ${ticket.status}`,
      });
    }
    await ActivityLog.insertMany(logs);

    // ---- Email (internal notes par kabhi nahi) ----
    if (!isInternal) {
      const creator = ticket.createdBy as unknown as Person;
      const agent = ticket.assignedAgent as unknown as Person;
      const base = {
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        ticketId: ticket._id.toString(),
        bodyText: parsed.data.body.slice(0, 1500),
        status: ticket.status,
        priority: ticket.priority,
      };
      if (user.role === "user" && agent?.email) {
        await sendTicketEmail({
          ...base,
          to: agent.email,
          subject: `New reply from requester on ${ticket.ticketNumber}`,
          headline: `${user.name} replied`,
        });
      } else if (isStaff && creator?.email && creator._id.toString() !== user.id) {
        await sendTicketEmail({
          ...base,
          to: creator.email,
          subject: `New reply on your ticket ${ticket.ticketNumber}`,
          headline: `${user.name} from support replied to your ticket`,
        });
      }
    }

    return NextResponse.json(
      {
        message: {
          _id: message._id,
          body: message.body,
          attachments: message.attachments,
          isInternal: message.isInternal,
          createdAt: message.createdAt,
          author: { _id: user.id, name: user.name, role: user.role },
        },
        ticket: {
          status: ticket.status,
          firstRespondedAt: ticket.firstRespondedAt,
          resolvedAt: ticket.resolvedAt,
          slaBreached: ticket.slaBreached,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/tickets/[id]/messages error:", error);
    return jsonError("Failed to post message", 500);
  }
}
