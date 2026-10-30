import mongoose, { Schema, Document, Model } from "mongoose";

export type UserRole = "user" | "agent" | "admin";

export interface IUser extends Document {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    facility?: string; // e.g. "St. Jude Clinic - ER" (US Healthcare touch)
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
    {
        name: { type: String, required: true, trim: true },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: { type: String, required: true },
        role: {
            type: String,
            enum: ["user", "agent", "admin"],
            default: "user",
        },
        facility: { type: String, default: "Main Medical Center" },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const User: Model<IUser> =
    mongoose.models.User || mongoose.model<IUser>("User", UserSchema);