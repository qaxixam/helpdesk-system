import { Ticket } from "@/models/Ticket";
import { ActivityLog } from "@/models/ActivityLog";

export async function syncSLAsAndAutoClose() {
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // 1. Mark SLA Breached:
  // (a) First response abhi tak nahi aaya aur responseDueDate guzar gayi
  // (b) Ticket abhi Resolved/Closed nahi hui aur resolutionDueDate guzar gayi
  const breachResult = await Ticket.updateMany(
    {
      slaBreached: false,
      $or: [
        {
          firstRespondedAt: null,
          responseDueDate: { $lt: now },
        },
        {
          status: { $nin: ["Resolved", "Closed"] },
          resolutionDueDate: { $lt: now },
        },
      ],
    },
    { $set: { slaBreached: true } }
  );

  // 2. Auto-Close tickets that stayed in "Resolved" for > 3 days without user reply
  const staleResolvedTickets = await Ticket.find({
    status: "Resolved",
    resolvedAt: { $lte: threeDaysAgo },
  });

  let autoClosedCount = 0;

  for (const t of staleResolvedTickets) {
    t.status = "Closed";
    t.closedAt = now;
    await t.save();
    autoClosedCount++;

    await ActivityLog.create({
      ticket: t._id,
      actor: t.assignedAgent || t.createdBy,
      action: "AUTO_CLOSED",
      details:
        "System auto-closed ticket after 72 hours in Resolved state without requester reply",
    });
  }

  return {
    newlyBreached: breachResult.modifiedCount,
    autoClosedCount,
  };
}