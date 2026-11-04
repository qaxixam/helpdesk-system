import mongoose, { Schema, Document, Model } from "mongoose";
import { IAttachment } from "./Ticket";

export interface IMessage extends Document {
  ticket: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  body: string;
  attachments: IAttachment[];
  isInternal: boolean; // True = sirf Agent aur Admin dekh sakte hain
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

const MessageSchema = new Schema<IMessage>(
  {
    ticket: {
      type: Schema.Types.ObjectId,
      ref: "Ticket",
      required: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    body: { type: String, required: true, trim: true },
    attachments: { type: [AttachmentSchema], default: [] },
    isInternal: { type: Boolean, default: false },
  },
  { timestamps: true }
);

MessageSchema.index({ ticket: 1, createdAt: -1, _id: -1 });
MessageSchema.index({ createdAt: 1 });

export const Message: Model<IMessage> =
  mongoose.models.Message || mongoose.model<IMessage>("Message", MessageSchema);
