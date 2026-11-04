import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActivityLog extends Document {
    ticket: mongoose.Types.ObjectId;
    actor: mongoose.Types.ObjectId | null; // null = system (cron: SLA breach / auto-close)
    action: string; // TICKET_CREATED | STATUS_CHANGED | ASSIGNED | UNASSIGNED | PRIORITY_CHANGED | REPLY_POSTED | INTERNAL_NOTE_ADDED | SLA_BREACHED | AUTO_CLOSED
    details: string; // e.g., "Changed status from Open to In Progress"
    createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
    {
        ticket: {
            type: Schema.Types.ObjectId,
            ref: "Ticket",
            required: true,
        },
        actor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
        },
        action: { type: String, required: true },
        details: { type: String, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

ActivityLogSchema.index({ createdAt: -1 });
ActivityLogSchema.index({ actor: 1, createdAt: -1 });
ActivityLogSchema.index({ ticket: 1, createdAt: -1, _id: -1 });

export const ActivityLog: Model<IActivityLog> =
    mongoose.models.ActivityLog ||
    mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
