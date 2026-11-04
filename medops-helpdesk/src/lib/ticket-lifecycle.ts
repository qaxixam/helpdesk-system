import { Ticket } from "@/models/Ticket";
import { ActivityLog } from "@/models/ActivityLog";
import { User } from "@/models/User";
import { connectDB } from "@/lib/db";
import { AUTO_CLOSE_DAYS } from "@/lib/sla";
import { sendTicketEmail } from "@/lib/mail";

const ACTIVE_STATUSES = ["Open", "In Progress", "Waiting on User"];

/**
 * 1) SLA breach marking — response ya resolution deadline guzar gayi ho to `slaBreached = true`
 * 2) Auto-close — jo ticket AUTO_CLOSE_DAYS se "Resolved" hai aur user ne reply nahi kiya
 *    (user reply ticket ko wapas "In Progress" kar deta hai, is liye Resolved rehna = no reply)
 */
export async function syncSLAsAndAutoClose() {
  await connectDB();
  const now = new Date();

  // --- 1. SLA breaches (activity log ke sath, taake history mein nazar aaye)
  const toBreach = await Ticket.find({
    slaBreached: false,
    status: { $in: ACTIVE_STATUSES },
    $or: [
      { resolutionDueDate: { $lt: now } },
      { firstRespondedAt: null, responseDueDate: { $lt: now } },
    ],
  })
    .select("_id ticketNumber firstRespondedAt responseDueDate resolutionDueDate")
    .limit(500)
    .lean();

  if (toBreach.length > 0) {
    await Ticket.updateMany(
      { _id: { $in: toBreach.map((t) => t._id) } },
      { $set: { slaBreached: true } },
      { timestamps: false },
    );
    await ActivityLog.insertMany(
      toBreach.map((t) => {
        const responseMissed = !t.firstRespondedAt && t.responseDueDate < now;
        return {
          ticket: t._id,
          actor: null,
          action: "SLA_BREACHED",
          details: responseMissed ? "First-response SLA target missed" : "Resolution SLA target missed",
        };
      }),
    );
  }

  // --- 2. Auto-close after N days in Resolved
  const cutoff = new Date(now.getTime() - AUTO_CLOSE_DAYS * 24 * 60 * 60 * 1000);
  const toClose = await Ticket.find({ status: "Resolved", resolvedAt: { $ne: null, $lt: cutoff } })
    .select("_id ticketNumber title priority createdBy")
    .limit(500)
    .lean();

  if (toClose.length > 0) {
    await Ticket.updateMany(
      { _id: { $in: toClose.map((t) => t._id) }, status: "Resolved" },
      { $set: { status: "Closed", closedAt: now } },
    );
    await ActivityLog.insertMany(
      toClose.map((t) => ({
        ticket: t._id,
        actor: null,
        action: "AUTO_CLOSED",
        details: `Automatically closed after ${AUTO_CLOSE_DAYS} days in Resolved with no reply from the requester`,
      })),
    );

    const creators = await User.find({ _id: { $in: toClose.map((t) => t.createdBy) } })
      .select("email")
      .lean();
    const emailById = new Map<string, string>(creators.map((u) => [u._id.toString(), u.email]));
    await Promise.allSettled(
      toClose.map((t) =>
        sendTicketEmail({
          to: emailById.get(t.createdBy.toString()) || "",
          subject: `Ticket closed: ${t.title}`,
          ticketNumber: t.ticketNumber,
          title: t.title,
          headline: "Your ticket has been closed",
          bodyText: `This ticket stayed Resolved for ${AUTO_CLOSE_DAYS} days without a reply, so it was closed automatically.`,
          status: "Closed",
          priority: t.priority,
          ticketId: t._id.toString(),
        }),
      ),
    );
  }

  return { newlyBreached: toBreach.length, autoClosedCount: toClose.length };
}

/**
 * Vercel Hobby plan par cron din mein sirf 1 dafa chalta hai, is liye list/dashboard
 * requests par bhi (throttled, har ~60s mein max ek dafa) sync chala dete hain.
 */
let lastRun = 0;
let inflight: Promise<unknown> | null = null;

export async function maybeSyncLifecycle() {
  const now = Date.now();
  if (inflight) return inflight;
  if (now - lastRun < 60_000) return;
  lastRun = now;
  inflight = syncSLAsAndAutoClose()
    .catch((err) => console.error("[lifecycle] sync failed:", err))
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
