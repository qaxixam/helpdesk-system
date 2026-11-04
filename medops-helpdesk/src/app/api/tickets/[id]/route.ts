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
import { calculateSLADates, isSLABreached } from "@/lib/sla";
import { sendTicketEmail } from "@/lib/mail";
import { canAccessTicket, refId } from "@/lib/ticket-access";
import { isObjectId, jsonError, readJson, validationError } from "@/lib/http";
import { maybeSyncLifecycle } from "@/lib/ticket-lifecycle";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const HISTORY_PAGE_SIZE = 30;

export async function GET(req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth();
  if (!user) return errorResponse;

  const { id } = await context.params;
  if (!isObjectId(id)) return jsonError("Invalid ticket ID", 400);

  const { searchParams } = new URL(req.url);
  const history = searchParams.get("history");
  if (history && history !== "messages" && history !== "activity") {
    return jsonError("Invalid history type", 400);
  }

  let beforeDate: Date | null = null;
  const beforeId = searchParams.get("beforeId");
  if (history) {
    const beforeAt = searchParams.get("beforeAt");
    beforeDate = beforeAt ? new Date(beforeAt) : null;
    if (!beforeDate || Number.isNaN(beforeDate.getTime()) || !isObjectId(beforeId)) {
      return jsonError("A valid history cursor is required", 400);
    }
  }

  try {
    await connectDB();
    await maybeSyncLifecycle();
    void Category;
    void User;

    const ticket = await Ticket.findById(id)
      .populate("category", "name description defaultPriority")
      .populate("createdBy", "name email facility role")
      .populate("assignedAgent", "name email facility role")
      .lean();

    // 404 (403 nahi) taake doosre users ke ticket IDs ka pata bhi na chale
    if (!ticket || !canAccessTicket(user, ticket)) return jsonError("Ticket not found", 404);

    const messageFilter: Record<string, unknown> = { ticket: ticket._id };
    const activityFilter: Record<string, unknown> = { ticket: ticket._id };
    // Internal notes requester ko kabhi nahi bheje jate
    if (user.role === "user") {
      messageFilter.isInternal = false;
      activityFilter.action = { $ne: "INTERNAL_NOTE_ADDED" };
    }

    const cursor =
      beforeDate && beforeId
        ? {
            $or: [
              { createdAt: { $lt: beforeDate } },
              { createdAt: beforeDate, _id: { $lt: new mongoose.Types.ObjectId(beforeId) } },
            ],
          }
        : {};

    const [messageRows, activityRows] = await Promise.all([
      history === "activity"
        ? Promise.resolve([])
        : Message.find({ ...messageFilter, ...cursor })
            .select("author body attachments isInternal createdAt")
            .populate("author", "name role")
            .sort({ createdAt: -1, _id: -1 })
            .limit(HISTORY_PAGE_SIZE + 1)
            .lean(),
      history === "messages"
        ? Promise.resolve([])
        : ActivityLog.find({ ...activityFilter, ...cursor })
            .select("actor action details createdAt")
            .populate("actor", "name role")
            .sort({ createdAt: -1, _id: -1 })
            .limit(HISTORY_PAGE_SIZE + 1)
            .lean(),
    ]);

    const hasMoreMessages = messageRows.length > HISTORY_PAGE_SIZE;
    const hasMoreActivity = activityRows.length > HISTORY_PAGE_SIZE;
    const messages = messageRows.slice(0, HISTORY_PAGE_SIZE).reverse();
    const activityLogs = activityRows.slice(0, HISTORY_PAGE_SIZE);

    if (history === "messages") return NextResponse.json({ messages, hasMoreMessages });
    if (history === "activity") return NextResponse.json({ activityLogs, hasMoreActivity });

    return NextResponse.json({ ticket, messages, activityLogs, hasMoreMessages, hasMoreActivity });
  } catch (error) {
    console.error("GET /api/tickets/[id] error:", error);
    return jsonError("Failed to load ticket", 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const { user, errorResponse } = await requireAuth();
  if (!user) return errorResponse;

  const { id } = await context.params;
  if (!isObjectId(id)) return jsonError("Invalid ticket ID", 400);

  const parsed = updateTicketSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  try {
    await connectDB();
    const ticket = await Ticket.findById(id).populate("createdBy", "name email");
    if (!ticket || !canAccessTicket(user, ticket)) return jsonError("Ticket not found", 404);

    // ---------- Role rules (server side) ----------
    if (user.role === "user") {
      if (input.status !== "Closed" || input.priority !== undefined || input.assignedAgent !== undefined) {
        return jsonError("Forbidden: requesters can only close their own tickets", 403);
      }
    }
    if (user.role === "agent" && input.assignedAgent !== undefined) {
      return jsonError("Forbidden: only admins can assign or reassign tickets", 403);
    }
    if (ticket.status === "Closed" && input.status === undefined && user.role !== "admin") {
      return jsonError("Closed tickets cannot be modified", 400);
    }

    const now = new Date();
    const logs: Array<{ action: string; details: string }> = [];
    const emails: Array<Parameters<typeof sendTicketEmail>[0]> = [];
    const creator = ticket.createdBy as unknown as { _id: mongoose.Types.ObjectId; email: string; name: string };
    const base = {
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      ticketId: ticket._id.toString(),
    };

    // ---------- Assignment (admin only) ----------
    const currentAgentId = refId(ticket.assignedAgent);
    if (user.role === "admin" && input.assignedAgent !== undefined && (input.assignedAgent ?? undefined) !== currentAgentId) {
      const previous = currentAgentId ? await User.findById(currentAgentId).select("name").lean() : null;
      if (input.assignedAgent === null) {
        ticket.assignedAgent = null;
        logs.push({ action: "UNASSIGNED", details: `Unassigned from ${previous?.name ?? "agent"}` });
      } else {
        const agent = await User.findOne({ _id: input.assignedAgent, role: "agent", isActive: true })
          .select("name email")
          .lean();
        if (!agent) return jsonError("Selected agent is invalid or inactive", 400);
        ticket.assignedAgent = agent._id;
        logs.push({
          action: "ASSIGNED",
          details: previous ? `Reassigned from ${previous.name} to ${agent.name}` : `Assigned to ${agent.name}`,
        });
        emails.push({
          ...base,
          to: agent.email,
          subject: `Ticket assigned to you: ${ticket.title}`,
          headline: `${ticket.ticketNumber} has been assigned to you`,
          bodyText: `${user.name} assigned this ${ticket.priority} priority ticket to your queue.`,
          status: ticket.status,
          priority: ticket.priority,
        });
        emails.push({
          ...base,
          to: creator.email,
          subject: `Your ticket has been assigned: ${ticket.title}`,
          headline: `${agent.name} is now handling your ticket`,
          bodyText: "A support agent has been assigned and will respond within the SLA target.",
          status: ticket.status,
          priority: ticket.priority,
        });
      }
    }

    // ---------- Priority (agent/admin) — SLA deadlines recalculate hoti hain ----------
    let priorityChanged = false;
    if (input.priority && input.priority !== ticket.priority) {
      const old = ticket.priority;
      ticket.priority = input.priority;
      const { responseDueDate, resolutionDueDate } = calculateSLADates(input.priority, ticket.createdAt);
      ticket.responseDueDate = responseDueDate;
      ticket.resolutionDueDate = resolutionDueDate;
      priorityChanged = true;
      logs.push({ action: "PRIORITY_CHANGED", details: `Priority changed from ${old} to ${input.priority}` });
    }

    // ---------- Status ----------
    if (input.status && input.status !== ticket.status) {
      const old = ticket.status;
      if (old === "Closed" && user.role === "user") {
        return jsonError("This ticket is already closed", 400);
      }
      ticket.status = input.status;

      if (input.status === "Resolved") {
        ticket.resolvedAt = now;
        ticket.closedAt = null;
        if (!ticket.firstRespondedAt) ticket.firstRespondedAt = now;
        emails.push({
          ...base,
          to: creator.email,
          subject: `Ticket resolved: ${ticket.title}`,
          headline: "Your ticket has been marked as Resolved",
          bodyText:
            "Please check the fix. If it is not working, reply on the ticket to reopen it. Otherwise it will close automatically in 3 days.",
          status: "Resolved",
          priority: ticket.priority,
        });
      } else if (input.status === "Closed") {
        ticket.closedAt = now;
        if (!ticket.resolvedAt) ticket.resolvedAt = now;
      } else {
        // Reopen / wapas active state: purane timestamps clear
        ticket.resolvedAt = null;
        ticket.closedAt = null;
      }

      logs.push({ action: "STATUS_CHANGED", details: `Status changed from ${old} to ${input.status}` });
    }

    // ---------- SLA flag ----------
    const breachedNow = isSLABreached(ticket, now);
    ticket.slaBreached = priorityChanged ? breachedNow : ticket.slaBreached || breachedNow;

    await ticket.save();

    if (logs.length > 0) {
      await ActivityLog.insertMany(logs.map((l) => ({ ticket: ticket._id, actor: user.id, ...l })));
    }
    await Promise.allSettled(emails.map((e) => sendTicketEmail(e)));

    const updated = await Ticket.findById(id)
      .populate("category", "name description defaultPriority")
      .populate("createdBy", "name email facility role")
      .populate("assignedAgent", "name email facility role")
      .lean();

    return NextResponse.json({ ticket: updated });
  } catch (error) {
    console.error("PATCH /api/tickets/[id] error:", error);
    return jsonError("Failed to update ticket", 500);
  }
}
