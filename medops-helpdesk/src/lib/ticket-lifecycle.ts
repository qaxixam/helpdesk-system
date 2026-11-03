import { Ticket } from "@/models/Ticket";
import { connectDB } from "@/lib/db";

export async function syncSLAsAndAutoClose() {
  try {
    await connectDB();
    const now = new Date();

    // 1. Bulk mark breached tickets instantly (bina loop aur email hang ke)
    const breachResult = await Ticket.updateMany(
      {
        status: { $nin: ["Resolved", "Closed"] },
        slaBreached: false,
        resolutionDueDate: { $lt: now },
      },
      {
        $set: { slaBreached: true },
      }
    );

    // 2. Auto-close tickets jo 48 hours se Resolved par hain
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const closeResult = await Ticket.updateMany(
      {
        status: "Resolved",
        updatedAt: { $lt: twoDaysAgo },
      },
      {
        $set: { status: "Closed" },
      }
    );

    return {
      newlyBreached: breachResult.modifiedCount || 0,
      autoClosedCount: closeResult.modifiedCount || 0,
    };
  } catch (error) {
    console.error("SLA Sync Error:", error);
    return { newlyBreached: 0, autoClosedCount: 0 };
  }
}
