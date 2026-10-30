import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid clinical email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Full name must be at least 2 characters").max(60),
  email: z.string().email("Please enter a valid work email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  facility: z
    .string()
    .min(2, "Clinic or department name is required")
    .default("Main Medical Center"),
});

export const createTicketSchema = z.object({
  title: z
    .string()
    .min(5, "Incident title must be at least 5 characters")
    .max(150, "Title cannot exceed 150 characters"),
  description: z
    .string()
    .min(15, "Please provide at least 15 characters describing the issue"),
  category: z.string().min(1, "Please select an incident category"),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        publicId: z.string().optional(),
      })
    )
    .max(3, "Maximum 3 attachments allowed per ticket")
    .optional()
    .default([]),
});

export const updateTicketSchema = z.object({
  status: z
    .enum(["Open", "In Progress", "Waiting on User", "Resolved", "Closed"])
    .optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  assignedAgent: z.string().nullable().optional(),
});

export const createMessageSchema = z.object({
  body: z.string().min(2, "Message cannot be empty").max(5000),
  isInternal: z.boolean().optional().default(false),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        url: z.string().url(),
        publicId: z.string().optional(),
      })
    )
    .max(3, "Maximum 3 attachments allowed")
    .optional()
    .default([]),
});

export const categorySchema = z.object({
  name: z.string().min(3, "Category name is required").max(60),
  description: z.string().min(10, "Description must be at least 10 characters"),
  defaultPriority: z.enum(["Low", "Medium", "High", "Urgent"]),
});