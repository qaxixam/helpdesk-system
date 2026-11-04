import { z } from "zod";

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export const STATUSES = ["Open", "In Progress", "Waiting on User", "Resolved", "Closed"] as const;
export const ROLES = ["user", "agent", "admin"] as const;

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

/**
 * Attachments sirf hamare Cloudinary account se aa sakti hain.
 * Is se `javascript:` URLs ya bahar ke malicious links block ho jate hain (XSS).
 */
const attachmentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z
    .string()
    .url()
    .refine((u) => {
      try {
        const parsed = new URL(u);
        return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
      } catch {
        return false;
      }
    }, "Attachments must be uploaded through the app"),
  publicId: z.string().max(300).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters").max(128),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Full name must be at least 2 characters").max(60),
  email: z.string().trim().email("Please enter a valid work email"),
  password: passwordSchema,
  facility: z.string().trim().min(2, "Clinic or department name is required").max(80),
});

export const createStaffSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  email: z.string().trim().email("Enter a valid email"),
  password: passwordSchema,
  role: z.enum(ROLES),
  facility: z.string().trim().max(80).optional(),
});

export const updateUserSchema = z
  .object({
    userId: objectId,
    role: z.enum(ROLES).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => d.role !== undefined || d.isActive !== undefined, "Nothing to update");

export const createTicketSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(150, "Title cannot exceed 150 characters"),
  description: z
    .string()
    .trim()
    .min(15, "Please describe the issue in at least 15 characters")
    .max(5000, "Description cannot exceed 5000 characters"),
  category: z.string().min(1, "Please select a category").regex(/^[a-f\d]{24}$/i, "Please select a valid category"),
  priority: z.enum(PRIORITIES),
  attachments: z.array(attachmentSchema).max(3, "Maximum 3 attachments allowed per ticket").default([]),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    priority: z.enum(PRIORITIES).optional(),
    assignedAgent: objectId.nullable().optional(),
  })
  .refine(
    (d) => d.status !== undefined || d.priority !== undefined || d.assignedAgent !== undefined,
    "Nothing to update",
  );

export const createMessageSchema = z.object({
  body: z.string().trim().min(2, "Message must be at least 2 characters").max(5000),
  isInternal: z.boolean().default(false),
  attachments: z.array(attachmentSchema).max(3, "Maximum 3 attachments allowed").default([]),
});

export const categorySchema = z.object({
  name: z.string().trim().min(3, "Category name must be at least 3 characters").max(60),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(300),
  defaultPriority: z.enum(PRIORITIES),
});

export const updateCategorySchema = categorySchema.partial();

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
