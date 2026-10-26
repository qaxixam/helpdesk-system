
import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
    {
        ticket: {
            type: Schema.Types.ObjectId,
            ref: "Ticket",
            required: true,
            index: true,
        },

        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        body: {
            type: String,
            required: [true, "Message cannot be empty"],
            trim: true,
            minlength: 1,
            maxlength: 10000,
        },

        isInternal: {
            type: Boolean,
            default: false,
            required: true,
        },

        attachments: {
            type: [
                {
                    url: { type: String, required: true },
                    publicId: { type: String, required: true },
                    fileName: {
                        type: String,
                        required: true,
                        maxlength: 255,
                    },
                },
            ],
            default: [],
            validate: {
                validator: (files: unknown[]) => files.length <= 3,
                message: "A message can have a maximum of 3 attachments",
            },
        },
    },
    {
        timestamps: true,
    }
);

messageSchema.index({ ticket: 1, createdAt: 1 });

const Message =
    mongoose.models.Message ||
    mongoose.model("Message", messageSchema);

export default Message;
