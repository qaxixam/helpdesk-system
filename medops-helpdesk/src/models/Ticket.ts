import mongoose, { Schema, Document, Model } from "mongoose";
import { TicketPriority, TicketStatus } from "@/lib/sla";

export interface IAttachment {
    name: string;
    url: string;
    publicId?: string;
}

export interface ITicket extends Document {
    ticketNumber: string; // e.g., TKT-0001
    title: string;
    description: string;
    category: mongoose.Types.ObjectId;
    priority: TicketPriority;
    status: TicketStatus;
    createdBy: mongoose.Types.ObjectId;
    assignedAgent?: mongoose.Types.ObjectId | null;
    attachments: IAttachment[];
    responseDueDate: Date;
    resolutionDueDate: Date;
    firstRespondedAt?: Date | null;
    resolvedAt?: Date | null;
    closedAt?: Date | null;
    slaBreached: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachment>(
    {
        name: { type: String, required: true },
        url: { type: String, required: true },
        publicId: { type: String },
    },
    { _id: false }
);

const TicketSchema = new Schema<ITicket>(
    {
        ticketNumber: { type: String, required: true, unique: true, index: true },
        title: { type: String, required: true, trim: true },
        description: { type: String, required: true },
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
        },
        priority: {
            type: String,
            enum: ["Low", "Medium", "High", "Urgent"],
            default: "Medium",
        },
        status: {
            type: String,
            enum: ["Open", "In Progress", "Waiting on User", "Resolved", "Closed"],
            default: "Open",
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        assignedAgent: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },
        attachments: {
            type: [AttachmentSchema],
            default: [],
            validate: [
                (val: IAttachment[]) => val.length <= 3,
                "Maximum 3 file attachments allowed",
            ],
        },
        responseDueDate: { type: Date, required: true },
        resolutionDueDate: { type: Date, required: true },
        firstRespondedAt: { type: Date, default: null },
        resolvedAt: { type: Date, default: null },
        closedAt: { type: Date, default: null },
        slaBreached: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const Ticket: Model<ITicket> =
    mongoose.models.Ticket || mongoose.model<ITicket>("Ticket", TicketSchema);