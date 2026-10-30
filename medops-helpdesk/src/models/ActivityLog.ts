import mongoose, { Schema, Document, Model } from "mongoose";

export interface IActivityLog extends Document {
    ticket: mongoose.Types.ObjectId;
    actor: mongoose.Types.ObjectId;
    action: string; // e.g., "TICKET_CREATED", "STATUS_CHANGED", "ASSIGNED", "PRIORITY_CHANGED"
    details: string; // e.g., "Changed status from Open to In Progress"
    createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
    {
        ticket: {
            type: Schema.Types.ObjectId,
            ref: "Ticket",
            required: true,
            index: true,
        },
        actor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        action: { type: String, required: true },
        details: { type: String, required: true },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export const ActivityLog: Model<IActivityLog> =
    mongoose.models.ActivityLog ||
    mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);