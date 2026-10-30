export type TicketPriority = "Low" | "Medium" | "High" | "Urgent";
export type TicketStatus =
    | "Open"
    | "In Progress"
    | "Waiting on User"
    | "Resolved"
    | "Closed";

// SLA Rules (Hours mein) - Requirement ke mutabiq Urgent = 1h response, 8h resolution
export const SLA_RULES: Record<
    TicketPriority,
    { responseHours: number; resolutionHours: number }
> = {
    Urgent: { responseHours: 1, resolutionHours: 8 },
    High: { responseHours: 4, resolutionHours: 24 },
    Medium: { responseHours: 8, resolutionHours: 48 },
    Low: { responseHours: 24, resolutionHours: 72 },
};

// Nayi ticket bante waqt dono deadlines calculate karne ka function
export function calculateSLADates(
    priority: TicketPriority,
    createdAt: Date = new Date()
) {
    const rule = SLA_RULES[priority];
    const responseDueDate = new Date(
        createdAt.getTime() + rule.responseHours * 60 * 60 * 1000
    );
    const resolutionDueDate = new Date(
        createdAt.getTime() + rule.resolutionHours * 60 * 60 * 1000
    );

    return { responseDueDate, resolutionDueDate };
}

// Check karna ke ticket ka SLA breach hua hai ya nahi
export function checkSLABreach(ticket: {
    status: TicketStatus;
    responseDueDate: Date;
    resolutionDueDate: Date;
    firstRespondedAt?: Date | null;
    resolvedAt?: Date | null;
    slaBreached?: boolean;
}): boolean {
    if (ticket.slaBreached) return true;

    const now = new Date();

    // 1. Check First Response SLA
    if (!ticket.firstRespondedAt && now > new Date(ticket.responseDueDate)) {
        return true;
    }
    if (
        ticket.firstRespondedAt &&
        new Date(ticket.firstRespondedAt) > new Date(ticket.responseDueDate)
    ) {
        return true;
    }

    // 2. Check Resolution SLA (Agar ticket Resolved ya Closed nahi hai aur time nikal gaya)
    if (
        ticket.status !== "Resolved" &&
        ticket.status !== "Closed" &&
        now > new Date(ticket.resolutionDueDate)
    ) {
        return true;
    }

    if (
        ticket.resolvedAt &&
        new Date(ticket.resolvedAt) > new Date(ticket.resolutionDueDate)
    ) {
        return true;
    }

    return false;
}