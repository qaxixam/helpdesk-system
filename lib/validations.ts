
import { z } from "zod";

// Registration validation
export const registerSchema = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must be at least 2 characters")
        .max(100, "Name cannot exceed 100 characters"),

    email: z
        .string()
        .trim()
        .email("Please enter a valid email address")
        .max(254, "Email is too long"),

    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(72, "Password is too long"),
});

// Ticket creation validation
export const createTicketSchema = z.object({
    subject: z
        .string()
        .trim()
        .min(5, "Subject must be at least 5 characters")
        .max(150, "Subject cannot exceed 150 characters"),

    description: z
        .string()
        .trim()
        .min(10, "Description must be at least 10 characters")
        .max(5000, "Description cannot exceed 5000 characters"),

    category: z
        .string()
        .regex(/^[a-f\d]{24}$/i, "Invalid category ID"),

    priority: z
        .enum(["low", "medium", "high", "urgent"])
        .default("medium"),
});

// Ticket reply validation
export const messageSchema = z.object({
    body: z
        .string()
        .trim()
        .min(1, "Message cannot be empty")
        .max(10000, "Message cannot exceed 10000 characters"),
});
