import type { AuthedUser } from "@/lib/auth";

type Ref = { _id?: { toString(): string } } | { toString(): string } | string | null | undefined;

export function refId(ref: Ref): string | undefined {
  if (!ref) return undefined;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && "_id" in ref && ref._id) return ref._id.toString();
  return ref.toString();
}

/**
 * Ek hi jagah par ticket-level authorization rule:
 *  - user  → sirf apna banaya hua ticket
 *  - agent → sirf apne paas assigned ticket
 *  - admin → sab
 */
export function canAccessTicket(user: AuthedUser, ticket: { createdBy: Ref; assignedAgent?: Ref }) {
  if (user.role === "admin") return true;
  if (user.role === "user") return refId(ticket.createdBy) === user.id;
  if (user.role === "agent") return refId(ticket.assignedAgent) === user.id;
  return false;
}
