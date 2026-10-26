
import mongoose, { Schema } from "mongoose";

const activityLogSchema = new Schema(
    {
        ticket: {
            type: Schema.Types.ObjectId,
            ref: "Ticket",
            default: null,
            index: true,
        },

        actor: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        action: {
            type: String,
            enum: [
                "ticket_created",
                "ticket_assigned",
                "status_changed",
                "priority_changed",
                "message_added",
                "internal_note_added",
                "ticket_resolved",
                "ticket_closed",
                "attachment_added",
            ],
            required: true,
        },

        details: {
            type: String,
            trim: true,
            maxlength: 1000,
            default: "",
        },

        metadata: {
            type: Schema.Types.Mixed,
            default: {},
        },
    },
    {
        timestamps: true,
    }
);

activityLogSchema.index({ ticket: 1, createdAt: -1 });

const ActivityLog =
    mongoose.models.ActivityLog ||
    mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
