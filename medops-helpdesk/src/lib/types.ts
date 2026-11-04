import type { TicketPriority, TicketStatus } from "@/lib/sla";

export type Role = "user" | "agent" | "admin";

export interface PersonRef {
  _id: string;
  name: string;
  email?: string;
  role?: Role;
  facility?: string;
}

export interface Attachment {
  name: string;
  url: string;
  publicId?: string;
}

export interface TicketRow {
  _id: string;
  ticketNumber: string;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  category?: { _id: string; name: string; description?: string; defaultPriority?: TicketPriority } | null;
  createdBy?: PersonRef | null;
  assignedAgent?: PersonRef | null;
  attachments?: Attachment[];
  responseDueDate: string;
  resolutionDueDate: string;
  firstRespondedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaBreached: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MessageRow {
  _id: string;
  body: string;
  isInternal: boolean;
  attachments: Attachment[];
  createdAt: string;
  author?: PersonRef | null;
}

export interface ActivityRow {
  _id: string;
  action: string;
  details: string;
  createdAt: string;
  actor?: PersonRef | null;
  ticket?: { _id: string; ticketNumber: string; title: string; priority: TicketPriority; status: TicketStatus } | null;
}

export interface CategoryRow {
  _id: string;
  name: string;
  description: string;
  defaultPriority: TicketPriority;
  ticketCount?: number;
}

export interface UserRow {
  _id: string;
  name: string;
  email: string;
  role: Role;
  facility?: string;
  isActive: boolean;
  createdAt: string;
}
