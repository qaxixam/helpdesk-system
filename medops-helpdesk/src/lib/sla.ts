export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type TicketStatus = "Open" | "In Progress" | "Waiting on User" | "Resolved" | "Closed";

/** SLA rules (hours). Urgent = 1h first response, 8h resolution (requirement ke mutabiq). */
export const SLA_RULES: Record<TicketPriority, { responseHours: number; resolutionHours: number }> = {
  Urgent: { responseHours: 1, resolutionHours: 8 },
  High: { responseHours: 4, resolutionHours: 24 },
  Medium: { responseHours: 8, resolutionHours: 48 },
  Low: { responseHours: 24, resolutionHours: 72 },
};

/** Resolved ticket itne din baad (user reply na kare to) khud Close ho jata hai. */
export const AUTO_CLOSE_DAYS = 3;

const HOUR = 60 * 60 * 1000;

export function calculateSLADates(priority: TicketPriority, createdAt: Date = new Date()) {
  const rule = SLA_RULES[priority];
  return {
    responseDueDate: new Date(createdAt.getTime() + rule.responseHours * HOUR),
    resolutionDueDate: new Date(createdAt.getTime() + rule.resolutionHours * HOUR),
  };
}

interface SLAInput {
  status: TicketStatus;
  responseDueDate: Date | string;
  resolutionDueDate: Date | string;
  firstRespondedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
}

/**
 * Ticket ka SLA breach hua ya nahi — dono targets check hote hain:
 *  1. First response: response deadline tak staff ka pehla public reply
 *  2. Resolution: resolution deadline tak Resolved/Closed
 */
export function isSLABreached(ticket: SLAInput, now: Date = new Date()): boolean {
  const responseDue = new Date(ticket.responseDueDate).getTime();
  const resolutionDue = new Date(ticket.resolutionDueDate).getTime();
  const t = now.getTime();

  if (ticket.firstRespondedAt) {
    if (new Date(ticket.firstRespondedAt).getTime() > responseDue) return true;
  } else if (t > responseDue && ticket.status !== "Closed") {
    return true;
  }

  if (ticket.resolvedAt) {
    if (new Date(ticket.resolvedAt).getTime() > resolutionDue) return true;
  } else if (ticket.status !== "Resolved" && ticket.status !== "Closed" && t > resolutionDue) {
    return true;
  }

  return false;
}
