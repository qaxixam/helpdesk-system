
import mongoose, { Schema } from "mongoose";

const ticketSchema = new Schema(
    {
        ticketNumber: {
            type: String,
            unique: true,
            index: true,
        },

        subject: {
            type: String,
            required: [true, "Ticket subject is required"],
            trim: true,
            minlength: 5,
            maxlength: 150,
        },

        description: {
            type: String,
            required: [true, "Ticket description is required"],
            trim: true,
            minlength: 10,
            maxlength: 5000,
        },

        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },

        assignedTo: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null,
            index: true,
        },

        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
            required: true,
            index: true,
        },

        priority: {
            type: String,
            enum: ["low", "medium", "high", "urgent"],
            default: "medium",
            required: true,
        },

        status: {
            type: String,
            enum: [
                "open",
                "in_progress",
                "waiting_for_user",
                "resolved",
                "closed",
            ],
            default: "open",
            required: true,
            index: true,
        },

        attachments: {
            type: [
                {
                    url: { type: String, required: true },
                    publicId: { type: String, required: true },
                    fileName: { type: String, required: true, maxlength: 255 },
                },
            ],
            default: [],
            validate: {
                validator: (files: unknown[]) => files.length <= 3,
                message: "A ticket can have a maximum of 3 attachments",
            },
        },

        firstResponseAt: {
            type: Date,
            default: null,
        },

        firstResponseDueAt: {
            type: Date,
            required: true,
        },

        resolutionDueAt: {
            type: Date,
            required: true,
        },

        resolvedAt: {
            type: Date,
            default: null,
        },

        closedAt: {
            type: Date,
            default: null,
        },

        lastUserReplyAt: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Ticket =
    mongoose.models.Ticket ||
    mongoose.model("Ticket", ticketSchema);

export default Ticket;
