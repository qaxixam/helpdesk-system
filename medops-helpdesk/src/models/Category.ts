import mongoose, { Schema, Document, Model } from "mongoose";
import { TicketPriority } from "@/lib/sla";

export interface ICategory extends Document {
    name: string;
    description: string;
    defaultPriority: TicketPriority;
    createdAt: Date;
    updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
    {
        name: { type: String, required: true, unique: true, trim: true },
        description: { type: String, required: true, trim: true },
        defaultPriority: {
            type: String,
            enum: ["Low", "Medium", "High", "Urgent"],
            default: "Medium",
        },
    },
    { timestamps: true }
);

export const Category: Model<ICategory> =
    mongoose.models.Category ||
    mongoose.model<ICategory>("Category", CategorySchema);