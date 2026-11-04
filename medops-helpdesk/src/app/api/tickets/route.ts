import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Ticket } from "@/models/Ticket";
import { Category } from "@/models/Category";
import { User } from "@/models/User";
import { ActivityLog } from "@/models/ActivityLog";
import { nextTicketNumber } from "@/models/Counter";
import { createTicketSchema, PRIORITIES, STATUSES } from "@/lib/validations";
import { calculateSLADates } from "@/lib/sla";
import { sendTicketEmail } from "@/lib/mail";
import { maybeSyncLifecycle } from "@/lib/ticket-lifecycle";
import {
  escapeRegex,
  isObjectId,
  jsonError,
  paginationMeta,
  parsePagination,
  readJson,
  validationError,
} from "@/lib/http";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireAuth();
  if (!user) return errorResponse;

  try {
    await connectDB();
    await maybeSyncLifecycle();
    void Category;
    void User;

    const { searchParams } = new URL(req.url);
    const { page, limit, skip } = parsePagination(searchParams, 10);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.trim().slice(0, 100);
    const breached = searchParams.get("breached");
    const scope = searchParams.get("scope"); // "active" = sirf open/in-progress/waiting

    // ROLE-BASED DATA ISOLATION — yeh filter server par lagta hai, client isay bypass nahi kar sakta
    const query: Record<string, unknown> = {};
    if (user.role === "user") {
      query.createdBy = user.id;
    } else if (user.role === "agent") {
      query.assignedAgent = user.id;
    } else {
      const agentParam = searchParams.get("assignedAgent");
      if (agentParam === "unassigned") query.assignedAgent = null;
      else if (isObjectId(agentParam)) query.assignedAgent = agentParam;
    }

    if (status && (STATUSES as readonly string[]).includes(status)) query.status = status;
    else if (scope === "active") query.status = { $in: ["Open", "In Progress", "Waiting on User"] };
    if (priority && (PRIORITIES as readonly string[]).includes(priority)) query.priority = priority;
    if (isObjectId(category)) query.category = category;
    if (breached === "true") query.slaBreached = true;

    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      query.$or = [{ ticketNumber: rx }, { title: rx }];
    }

    const [tickets, totalCount] = await Promise.all([
      Ticket.find(query)
        .select("-description -attachments")
        .populate("category", "name defaultPriority")
        .populate("createdBy", "name email facility")
        .populate("assignedAgent", "name email facility")
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Ticket.countDocuments(query),
    ]);

    return NextResponse.json({ tickets, pagination: paginationMeta(page, limit, totalCount) });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    return jsonError("Failed to fetch tickets", 500);
  }
}

export async function POST(req: NextRequest) {
  // Tickets requesters (users) banate hain; admin bhi kisi ki taraf se bana sakta hai
  const { user, errorResponse } = await requireAuth(["user", "admin"]);
  if (!user) return errorResponse;

  const parsed = createTicketSchema.safeParse(await readJson(req));
  if (!parsed.success) return validationError(parsed.error);

  try {
    await connectDB();

    const categoryDoc = await Category.findById(parsed.data.category).select("name").lean();
    if (!categoryDoc) return jsonError("Selected category does not exist", 400);

    const ticketNumber = await nextTicketNumber();
    const now = new Date();
    const { responseDueDate, resolutionDueDate } = calculateSLADates(parsed.data.priority, now);

    const ticket = await Ticket.create({
      ticketNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      priority: parsed.data.priority,
      status: "Open",
      createdBy: user.id,
      assignedAgent: null,
      attachments: parsed.data.attachments,
      responseDueDate,
      resolutionDueDate,
      slaBreached: false,
    });

    await ActivityLog.create({
      ticket: ticket._id,
      actor: user.id,
      action: "TICKET_CREATED",
      details: `Created ticket ${ticketNumber} (${parsed.data.priority} priority, ${categoryDoc.name})`,
    });

    // Notifications: requester ko confirmation + admins ko naya ticket (assign karne ke liye)
    const admins = await User.find({ role: "admin", isActive: true }).select("email").lean();
    await Promise.allSettled([
      sendTicketEmail({
        to: user.email,
        subject: `Ticket received: ${ticket.title}`,
        ticketNumber,
        title: ticket.title,
        headline: "We received your support ticket",
        bodyText: `Your ticket has been logged with ${parsed.data.priority} priority. Our first-response target is ${responseDueDate.toUTCString()}.`,
        status: "Open",
        priority: parsed.data.priority,
        ticketId: ticket._id.toString(),
      }),
      sendTicketEmail({
        to: admins.map((a) => a.email).filter((e) => e !== user.email),
        subject: `New ticket needs assignment: ${ticket.title}`,
        ticketNumber,
        title: ticket.title,
        headline: `New ${parsed.data.priority} ticket from ${user.name}`,
        bodyText: parsed.data.description.slice(0, 500),
        status: "Open",
        priority: parsed.data.priority,
        ticketId: ticket._id.toString(),
      }),
    ]);

    return NextResponse.json({ ticket: { _id: ticket._id, ticketNumber } }, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    return jsonError("Failed to create ticket", 500);
  }
}
