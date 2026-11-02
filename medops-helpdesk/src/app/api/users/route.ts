import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { User } from "@/models/User";

export async function GET(req: NextRequest) {
    const { errorResponse } = await requireAuth(["admin"]);
    if (errorResponse) return errorResponse;

    await connectDB();
    const { searchParams } = new URL(req.url);
    const roleFilter = searchParams.get("role");

    const query: Record<string, unknown> = {};
    if (roleFilter && roleFilter !== "ALL") {
        query.role = roleFilter;
    }

    const users = await User.find(query)
        .select("-password")
        .sort({ role: 1, name: 1 })
        .lean();

    return NextResponse.json({ users });
}

export async function PATCH(req: NextRequest) {
    const { user: adminUser, errorResponse } = await requireAuth(["admin"]);
    if (errorResponse || !adminUser) return errorResponse!;

    try {
        const { userId, role, isActive } = await req.json();

        if (!userId) {
            return NextResponse.json({ error: "userId is required" }, { status: 400 });
        }

        await connectDB();
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (role && ["user", "agent", "admin"].includes(role)) {
            targetUser.role = role;
        }
        if (typeof isActive === "boolean") {
            targetUser.isActive = isActive;
        }

        await targetUser.save();

        return NextResponse.json({
            user: {
                _id: targetUser._id,
                name: targetUser.name,
                email: targetUser.email,
                role: targetUser.role,
                isActive: targetUser.isActive,
            },
        });
    } catch (error) {
        console.error("PATCH /api/users error:", error);
        return NextResponse.json(
            { error: "Failed to update user" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    // 🚨 SECURITY TEMPORARILY DISABLED FOR BOOTSTRAPPING

    try {
        const { name, email, password, role, facility } = await req.json();

        if (!name || !email || !password || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        await connectDB();

        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            // Agar pehle se bana hua hai toh bataye
            return NextResponse.json({ error: "Yeh email pehle se database mein mojood hai!" }, { status: 409 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email: email.toLowerCase(),
            password: hashedPassword,
            role, // "admin" yahan pass ho jayega
            facility: facility || "IT Headquarters",
        });

        return NextResponse.json({ message: "Success! Admin ban gaya hai.", user: newUser.email }, { status: 201 });
    } catch (error) {
        console.error("Admin creation error:", error);
        return NextResponse.json({ error: "Failed to create admin" }, { status: 500 });
    }
}